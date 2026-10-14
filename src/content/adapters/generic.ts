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
  aiFilled?: number;
}

export interface AtsAdapter {
  name: string;
  matches(url: URL, doc: Document): boolean;
  fillPage(profile: Profile, opts?: FillOptions): Promise<FillReport>;
}

function getValueForKey(profile: Profile, key: string, occurrence: number): string {
  if (key === 'customAnswers') {
    return '';
  }

  const segments = key.split('.');
  let current: unknown = profile;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      current = current[occurrence];
    }
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return '';
    }
  }

  if (typeof current === 'string') {
    return current;
  }

  if (typeof current === 'boolean') {
    return String(current);
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

function normalizeDropdownAnswer(key: string, value: string): string {
  if (key === 'education.degree' && /\b(bachelor|basc|bsc)\b/i.test(value)) return "Bachelor's Degree";
  if (key === 'eeo.veteranStatus') {
    if (/^(?:no|not a veteran)$/i.test(value.trim())) return 'I am not a veteran';
    if (/^(?:yes|veteran)$/i.test(value.trim())) return 'I am a veteran';
  }
  return value;
}

export class GenericAdapter implements AtsAdapter {
  public name = 'generic';

  public constructor(private readonly doc: Document | Element = document) {}

  public matches(_url: URL, _doc: Document): boolean {
    return true;
  }

  public async fillPage(profile: Profile, opts: FillOptions = {}): Promise<FillReport> {
    const threshold = opts.confidenceThreshold ?? 0.7;
    const fields = scanFields(this.doc);
    let filled = 0;
    let needsReview = 0;
    const occurrences = new Map<string, number>();
    const highlightEntries: Array<{ element: HTMLElement; status: 'filled' | 'review' }> = [];

    for (const field of fields) {
      const match = matchField(field.label);
      const customAnswer = findCustomAnswer(profile, field.label);
      if (!match && !customAnswer) {
        continue;
      }

      const key = match?.key ?? 'customAnswers';
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);

      if (match && match.confidence < threshold && !customAnswer) {
        needsReview += 1;
        highlightEntries.push({ element: field.element, status: 'review' });
        continue;
      }

      const value = customAnswer || normalizeDropdownAnswer(key, getValueForKey(profile, key, occurrence));
      const radioField = field.element instanceof HTMLInputElement && field.element.type === 'radio' ? field.element : undefined;
      const currentRadio = radioField
        ? Array.from(this.doc.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find((candidate) => candidate.name === radioField.name && candidate.form === radioField.form && candidate.checked)
        : undefined;
      const currentValue = currentRadio
        ? currentRadio.value
        : field.element instanceof HTMLInputElement && field.element.type === 'checkbox'
          ? (field.element.checked ? 'true' : '')
          : field.element instanceof HTMLInputElement || field.element instanceof HTMLTextAreaElement || field.element instanceof HTMLSelectElement
            ? field.element.value
            : field.value;
      if (!value || currentValue.trim()) {
        if (!opts.onlyFillEmptyFields && currentValue.trim()) {
          // Allow a refill action when explicitly requested.
        } else {
          continue;
        }
      }

      try {
        if (await applyValueToField(field.element, value)) {
          filled += 1;
          highlightEntries.push({ element: field.element, status: 'filled' });
        } else {
          needsReview += 1;
          highlightEntries.push({ element: field.element, status: 'review' });
        }
      } catch {
        needsReview += 1;
        highlightEntries.push({ element: field.element, status: 'review' });
      }
    }

    applyHighlights(highlightEntries);
    return { filled, needsReview };
  }
}
