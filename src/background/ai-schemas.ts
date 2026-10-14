import { z } from 'zod';
import { AiFieldRequest, isSensitiveLabel, normalizeForAi } from '../shared/ai-assist';

// Two layers of Zod schemas.
//
// 1. The response schema is sent to the API as structured output. It has one slot per question, so the model
//    must address every question and cannot invent extra ones. Its values are plain strings on purpose: the
//    API enforces the shape, but rules like enums or lengths only reach the model as hints, and a reply that
//    broke one would fail the whole batch.
// 2. Each answer is then checked against a strict schema for its question type, so a wrong answer drops only
//    that one field.

function describeAnswer(field: AiFieldRequest): string {
  const rules: string[] = [`The value to enter for question ${field.id}, or an empty string to abstain.`];
  if (field.options) rules.push(`Copy exactly one of: ${field.options.map((option) => JSON.stringify(option)).join(', ')}; or empty.`);
  if (field.kind === 'number') rules.push('Digits only, or empty.');
  if (field.min !== undefined) rules.push(`At least ${field.min}.`);
  if (field.max !== undefined) rules.push(`At most ${field.max}.`);
  if (field.maxLength !== undefined) rules.push(`At most ${field.maxLength} characters.`);
  return rules.join(' ');
}

// Fresh schema instances per slot, described only on the leaves: describing the slot object itself makes Zod
// move its fields into $defs and reference them, which the flat schema here does not need.
function answerSlot(field: AiFieldRequest) {
  return z.object({
    answer: z.string().describe(describeAnswer(field)),
    confidence: z.string().describe('Exactly one of: high, medium, low.'),
    basis: z.string().describe('The profile facts this answer relies on, in a short phrase.')
  });
}

export function buildResponseSchema(fields: AiFieldRequest[]) {
  return z.object({
    answers: z.object(Object.fromEntries(fields.map((field) => [field.id, answerSlot(field)])))
  });
}

export type AiResponse = z.infer<ReturnType<typeof buildResponseSchema>>;

const PLACEHOLDER_TEXT = /\[[^\]]*\]|\{\{|<[a-z_]+>|\bN\/?A\b|^unknown$|^tbd$/i;

const trustedConfidence = z.enum(['high', 'medium']);

function strictAnswerSchema(field: AiFieldRequest): z.ZodType<string> {
  if (field.kind === 'select' || field.kind === 'radio') {
    const options = field.options ?? [];
    const findOption = (value: string) => options.find((option) => normalizeForAi(option) === normalizeForAi(value));
    // Returns the option exactly as the page lists it, so the filler can select it.
    return z.string().trim().refine((value) => findOption(value) !== undefined, 'not one of the offered options')
      .transform((value) => findOption(value) as string);
  }

  if (field.kind === 'number') {
    return z.string().trim().regex(/^-?\d+(?:\.\d+)?$/, 'not a number')
      .refine((value) => field.min === undefined || Number(value) >= field.min, 'below the minimum')
      .refine((value) => field.max === undefined || Number(value) <= field.max, 'above the maximum');
  }

  // Never truncate: a cut-off answer is worse than none.
  const maxLength = field.maxLength !== undefined && field.maxLength > 0 ? field.maxLength : Number.MAX_SAFE_INTEGER;
  return z.string().trim().min(1).max(maxLength).refine((value) => !PLACEHOLDER_TEXT.test(value), 'contains placeholder text');
}

export function validateAiAnswers(response: unknown, fields: AiFieldRequest[]): Record<string, string> {
  const parsed = buildResponseSchema(fields).safeParse(response);
  if (!parsed.success) return {};

  const accepted: Record<string, string> = {};
  for (const field of fields) {
    const slot = parsed.data.answers[field.id];
    if (!slot || isSensitiveLabel(field.label) || !trustedConfidence.safeParse(slot.confidence.trim()).success) continue;
    const answer = strictAnswerSchema(field).safeParse(slot.answer);
    if (answer.success) accepted[field.id] = answer.data;
  }
  return accepted;
}
