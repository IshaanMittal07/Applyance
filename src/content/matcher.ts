import { FIELD_SYNONYMS, NEGATIVE_PATTERNS, normalizeLabel } from '../shared/synonyms';

export interface FieldMatch {
  key: string;
  confidence: number;
}

export function matchField(label: string): FieldMatch | null {
  const normalized = normalizeLabel(label);
  if (!normalized) {
    return null;
  }

  for (const [, patterns] of Object.entries(NEGATIVE_PATTERNS)) {
    if (patterns.some((pattern) => normalized.includes(normalizeLabel(pattern)))) {
      return null;
    }
  }

  let best: FieldMatch | null = null;

  for (const [key, patterns] of Object.entries(FIELD_SYNONYMS)) {
    const matches = patterns
      .map((pattern) => normalizeLabel(pattern))
      .filter((pattern) => normalized.includes(pattern));

    if (matches.length === 0) {
      continue;
    }

    const specificity = Math.max(...matches.map((pattern) => pattern.length));
    const confidence = Math.min(0.99, 0.7 + specificity * 0.01 + matches.length * 0.03);
    if (!best || confidence > best.confidence) {
      best = { key, confidence };
    }
  }

  return best && best.confidence >= 0.7 ? best : null;
}
