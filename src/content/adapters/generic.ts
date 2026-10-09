import { Profile } from '../../shared/profile-schema';
import { applyValueToField } from '../fillers';
import { scanFields } from '../field-scanner';
import { matchField } from '../matcher';
import { applyHighlights } from '../highlight';

export interface FillOptions {
  confidenceThreshold?: number;
  onlyFillEmptyFields?: boolean;
}

export interface FillReport {
  filled: number;
  needsReview: number;
}

export interface AtsAdapter {
  name: string;
  matches(url: URL, doc: Document): boolean;
  fillPage(profile: Profile, opts?: FillOptions): Promise<FillReport>;
}

function getValueForKey(profile: Profile, key: string): string {
  if (key === 'customAnswers') {
    return '';
  }

  const segments = key.split('.');
  let current: unknown = profile;

  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return '';
    }
  }

  if (typeof current === 'string') {
    return current;
  }

  if (Array.isArray(current)) {
    return current.join(', ');
  }

  if (current && typeof current === 'object') {
    return JSON.stringify(current);
  }

  return '';
}

function findCustomAnswer(profile: Profile, label: string): string {
  const normalized = label.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  for (const answer of profile.customAnswers) {
    if (normalized.includes(answer.questionPattern.toLowerCase().replace(/[^a-z0-9\s]/g, ' '))) {
      return answer.answer;
    }
  }
  return '';
}

export class GenericAdapter implements AtsAdapter {
  public name = 'generic';

  public constructor(private readonly doc: Document = document) {}

  public matches(_url: URL, _doc: Document): boolean {
    return true;
  }

  public async fillPage(profile: Profile, opts: FillOptions = {}): Promise<FillReport> {
    const threshold = opts.confidenceThreshold ?? 0.7;
    const fields = scanFields(this.doc);
    let filled = 0;
    let needsReview = 0;
    const highlightEntries: Array<{ element: HTMLElement; status: 'filled' | 'review' }> = [];

    for (const field of fields) {
      const match = matchField(field.label);
      if (!match) {
        continue;
      }

      if (match.confidence < threshold) {
        needsReview += 1;
        highlightEntries.push({ element: field.element, status: 'review' });
        continue;
      }

      const customAnswer = findCustomAnswer(profile, field.label);
      const value = customAnswer || getValueForKey(profile, match.key);
      const currentValue = field.element instanceof HTMLInputElement || field.element instanceof HTMLTextAreaElement || field.element instanceof HTMLSelectElement ? field.element.value : '';
      if (!value || currentValue.trim()) {
        if (!opts.onlyFillEmptyFields && currentValue.trim()) {
          // Allow a refill action when explicitly requested.
        } else {
          continue;
        }
      }

      applyValueToField(field.element, value);
      filled += 1;
      highlightEntries.push({ element: field.element, status: 'filled' });
    }

    applyHighlights(highlightEntries);
    return { filled, needsReview };
  }
}
