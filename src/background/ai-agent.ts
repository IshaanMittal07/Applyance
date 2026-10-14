import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  AI_MAX_FIELDS_PER_REQUEST,
  AI_MODEL,
  AI_SYSTEM_PROMPT,
  AiFieldRequest,
  AiPageContext,
  AiSuggestResponse,
  buildApplicantContext,
  buildQuestionsPrompt,
  isSensitiveLabel
} from '../shared/ai-assist';
import { Profile } from '../shared/profile-schema';
import { buildResponseSchema, validateAiAnswers } from './ai-schemas';

async function requestBatch(client: Anthropic, applicantContext: string, fields: AiFieldRequest[], page: AiPageContext): Promise<Record<string, string>> {
  // create() rather than parse(): parse() throws on a refused or cut-off reply before stop_reason can be read,
  // so the reply is checked first and then validated with the same Zod schema.
  const response = await client.beta.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'high',
      format: betaZodOutputFormat(buildResponseSchema(fields))
    },
    system: [
      { type: 'text', text: AI_SYSTEM_PROMPT },
      // The profile and guidance repeat across batches and pages; the questions after them change every time.
      { type: 'text', text: applicantContext, cache_control: { type: 'ephemeral' } }
    ],
    messages: [{ role: 'user', content: buildQuestionsPrompt(fields, page, new Date()) }]
  });

  if (response.stop_reason === 'refusal') throw new Error('Claude declined to answer these questions.');
  if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of room before finishing the answers.');

  const text = response.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no answers.');
  return validateAiAnswers(JSON.parse(text), fields);
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'The Anthropic API key was rejected. Check it in Applyance options.';
  if (error instanceof Anthropic.PermissionDeniedError) return 'This Anthropic API key does not have access to the model.';
  if (error instanceof Anthropic.RateLimitError) return 'Anthropic rate limit reached. Try again shortly.';
  if (error instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Check your connection.';
  if (error instanceof Anthropic.APIError) return `Anthropic API error ${error.status ?? ''}`.trim();
  if (error instanceof SyntaxError) return 'Claude returned answers in an unexpected format.';
  return error instanceof Error ? error.message : 'AI assist failed.';
}

export async function suggestAnswers(apiKey: string, profile: Profile, fields: AiFieldRequest[], page: AiPageContext, globalPrompt = ''): Promise<AiSuggestResponse> {
  if (!apiKey.trim()) return { ok: false, error: 'Add an Anthropic API key in Applyance options to use AI assist.' };

  // The content script already filters these; re-check here so nothing sensitive is sent even if it did not.
  const allowed = fields.filter((field) => !isSensitiveLabel(field.label));
  if (!allowed.length) return { ok: true, answers: {} };

  // The key belongs to the user and stays in this extension's service worker; it is never exposed to web pages.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const applicantContext = buildApplicantContext(profile, globalPrompt);
  const answers: Record<string, string> = {};
  try {
    for (let start = 0; start < allowed.length; start += AI_MAX_FIELDS_PER_REQUEST) {
      Object.assign(answers, await requestBatch(client, applicantContext, allowed.slice(start, start + AI_MAX_FIELDS_PER_REQUEST), page));
    }
    return { ok: true, answers };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
