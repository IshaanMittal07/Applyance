import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE } from '../src/shared/profile-schema';
import type { AiFieldRequest } from '../src/shared/ai-assist';

const create = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error { public status?: number; }
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class RateLimitError extends APIError {}
  class APIConnectionError extends APIError {}
  class Anthropic {
    public static APIError = APIError;
    public static AuthenticationError = AuthenticationError;
    public static PermissionDeniedError = PermissionDeniedError;
    public static RateLimitError = RateLimitError;
    public static APIConnectionError = APIConnectionError;
    public beta = { messages: { create } };
    public constructor(public readonly options: unknown) {}
  }
  return { default: Anthropic };
});

const { suggestAnswers } = await import('../src/background/ai-agent');
const Anthropic = (await import('@anthropic-ai/sdk')).default;

const page = { title: 'Engineer', heading: 'Engineer', hostname: 'jobs.example.com' };
const fields: AiFieldRequest[] = [
  { id: 'f0', label: 'Comfortable working hybrid?', kind: 'select', options: ['Yes', 'No'] },
  { id: 'f1', label: 'Gender', kind: 'select', options: ['Male', 'Female'] }
];

function reply(text: string, stop_reason = 'end_turn') {
  return { stop_reason, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] };
}

describe('suggestAnswers', () => {
  beforeEach(() => create.mockReset());

  it('requires an API key and makes no request without one', async () => {
    expect(await suggestAnswers('  ', DEFAULT_PROFILE, fields, page)).toEqual({ ok: false, error: 'Add an Anthropic API key in Applyance options to use AI assist.' });
    expect(create).not.toHaveBeenCalled();
  });

  it('sends only non-sensitive fields with structured output and validates the reply', async () => {
    create.mockResolvedValue(reply(JSON.stringify({ answers: { f0: { answer: 'yes', confidence: 'high', basis: 'preference' } } })));

    const result = await suggestAnswers('sk-test', DEFAULT_PROFILE, fields, page, 'I prefer hybrid work.');

    expect(result).toEqual({ ok: true, answers: { f0: 'Yes' } });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(Object.keys(params.output_config.format.schema.properties.answers.properties)).toEqual(['f0']);
    expect(params.fallbacks).toBe('default');
    expect(params.system[1].text).toContain('I prefer hybrid work.');
    expect(params.system[1].cache_control).toEqual({ type: 'ephemeral' });
    expect(params.messages[0].content).toContain('Comfortable working hybrid?');
    expect(params.messages[0].content).not.toContain('Gender');
  });

  it('splits large forms into batches', async () => {
    const many: AiFieldRequest[] = Array.from({ length: 30 }, (_, index) => ({ id: `f${index}`, label: `Question number ${index}`, kind: 'text' }));
    const abstainAll = (ids: string[]) => reply(JSON.stringify({ answers: Object.fromEntries(ids.map((id) => [id, { answer: '', confidence: 'low', basis: '' }])) }));
    create
      .mockResolvedValueOnce(abstainAll(many.slice(0, 25).map((field) => field.id)))
      .mockResolvedValueOnce(abstainAll(many.slice(25).map((field) => field.id)));

    expect(await suggestAnswers('sk-test', DEFAULT_PROFILE, many, page)).toEqual({ ok: true, answers: {} });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].system[1].text).toBe(create.mock.calls[1][0].system[1].text);
  });

  it('reports refusals, truncation, and API errors without filling anything', async () => {
    create.mockResolvedValueOnce(reply('', 'refusal'));
    expect(await suggestAnswers('sk-test', DEFAULT_PROFILE, fields, page)).toEqual({ ok: false, error: 'Claude declined to answer these questions.' });

    create.mockResolvedValueOnce(reply('{"answers":[', 'max_tokens'));
    expect(await suggestAnswers('sk-test', DEFAULT_PROFILE, fields, page)).toEqual({ ok: false, error: 'Claude ran out of room before finishing the answers.' });

    create.mockRejectedValueOnce(new (Anthropic.AuthenticationError as unknown as new (message: string) => Error)('bad key'));
    expect(await suggestAnswers('sk-test', DEFAULT_PROFILE, fields, page)).toEqual({ ok: false, error: 'The Anthropic API key was rejected. Check it in Applyance options.' });
  });
});
