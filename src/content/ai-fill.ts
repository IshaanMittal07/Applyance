import { AiFieldRequest, AiPageContext, AiSuggestRequest, AiSuggestResponse, isSensitiveLabel } from '../shared/ai-assist';
import { scanFields } from './field-scanner';
import { applyValueToField } from './fillers';
import { applyHighlights } from './highlight';
import { matchField } from './matcher';

export interface AiFillReport {
  filled: number;
  error?: string;
}

type SendRequest = (request: AiSuggestRequest) => Promise<AiSuggestResponse>;

const PLACEHOLDER_OPTION = /^(?:|-+|choose.*|select.*|please select.*|pick.*|none selected)$/i;

// Each field is offered to the agent once per page, so DOM mutations do not trigger repeat requests.
const attemptedElements = new WeakSet<HTMLElement>();

function radioGroup(element: HTMLInputElement): HTMLInputElement[] {
  return Array.from(element.ownerDocument.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
    .filter((candidate) => candidate.name === element.name && candidate.form === element.form);
}

// Mirrors how applyValueToField reads radio labels, so an accepted option always selects.
function radioOptionText(candidate: HTMLInputElement): string {
  const labelText = candidate.labels ? Array.from(candidate.labels).map((label) => label.textContent ?? '').join(' ').trim() : '';
  return labelText || candidate.value.trim();
}

function selectOptions(element: HTMLSelectElement): string[] {
  return Array.from(element.options)
    .filter((option) => !option.disabled && option.value !== '' && !PLACEHOLDER_OPTION.test(option.label.trim()))
    .map((option) => option.label.trim());
}

function isEmpty(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement && element.type === 'radio') return !radioGroup(element).some((candidate) => candidate.checked);
  if (element instanceof HTMLSelectElement) {
    const selected = element.selectedOptions[0];
    return !selected || element.value === '' || PLACEHOLDER_OPTION.test(selected.label.trim());
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return !element.value.trim();
  return false;
}

function describeField(element: HTMLElement, id: string, label: string): AiFieldRequest | null {
  const required = element.hasAttribute('required') || element.getAttribute('aria-required') === 'true' || undefined;

  if (element instanceof HTMLTextAreaElement) {
    return { id, label, kind: 'textarea', maxLength: element.maxLength > 0 ? element.maxLength : undefined, required };
  }
  if (element instanceof HTMLSelectElement) {
    const options = selectOptions(element);
    return options.length ? { id, label, kind: 'select', options, required } : null;
  }
  if (!(element instanceof HTMLInputElement)) return null;

  if (element.type === 'radio') {
    const options = radioGroup(element).map(radioOptionText).filter(Boolean);
    // Without a question separate from the option labels, the agent cannot tell what is being asked.
    if (options.length < 2 || options.some((option) => option.toLowerCase() === label.trim().toLowerCase())) return null;
    return { id, label, kind: 'radio', options, required };
  }
  if (element.type === 'number') {
    const min = element.min !== '' ? Number(element.min) : undefined;
    const max = element.max !== '' ? Number(element.max) : undefined;
    return { id, label, kind: 'number', min: Number.isFinite(min) ? min : undefined, max: Number.isFinite(max) ? max : undefined, required };
  }
  if (element.type === 'text' || element.type === 'search' || element.type === '') {
    return { id, label, kind: 'text', maxLength: element.maxLength > 0 ? element.maxLength : undefined, required };
  }
  // Email, phone, URL, date, file, password, and custom widgets stay with the deterministic filler or the user.
  return null;
}

// A control nested in its <label> contributes its own text (e.g. every <option>) to the scanned label.
function questionLabel(element: HTMLElement, scannedLabel: string): string {
  const wrapper = element.closest('label');
  if (wrapper && !(element instanceof HTMLInputElement && element.type === 'radio')) {
    const clone = wrapper.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('select, textarea, input, option, [role="listbox"]').forEach((node) => node.remove());
    const text = clone.textContent?.trim();
    if (text) return text.replace(/\s+/g, ' ');
  }
  return scannedLabel.replace(/\s+/g, ' ').trim();
}

function pageContext(doc: Document): AiPageContext {
  return {
    title: doc.title.trim().slice(0, 300),
    heading: (doc.querySelector('h1')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
    hostname: doc.location?.hostname ?? ''
  };
}

export function collectAiFields(root: Document | Element): Array<{ element: HTMLElement; request: AiFieldRequest }> {
  const collected: Array<{ element: HTMLElement; request: AiFieldRequest }> = [];
  for (const field of scanFields(root)) {
    const { element, label } = field;
    if (attemptedElements.has(element) || element.hasAttribute('data-applyance-highlight')) continue;
    if (!/[a-z]{3,}/i.test(label) || label === 'untitled') continue;
    if (matchField(label) || isSensitiveLabel(label) || !isEmpty(element)) continue;
    const request = describeField(element, `f${collected.length}`, questionLabel(element, label));
    if (request) collected.push({ element, request });
  }
  return collected;
}

const sendToWorker: SendRequest = (request) => chrome.runtime.sendMessage(request);

export async function runAiAssist(doc: Document = document, send: SendRequest = sendToWorker): Promise<AiFillReport> {
  const candidates = collectAiFields(doc);
  if (!candidates.length) return { filled: 0 };
  for (const { element } of candidates) attemptedElements.add(element);

  const response = await send({ type: 'applyance:ai-suggest', fields: candidates.map((entry) => entry.request), page: pageContext(doc) });
  if (!response?.ok) return { filled: 0, error: response?.error ?? 'AI assist did not respond.' };

  let filled = 0;
  const highlights: Array<{ element: HTMLElement; status: 'review' }> = [];
  for (const { element, request } of candidates) {
    const answer = response.answers[request.id];
    // The user may have typed while the agent was working; never overwrite them.
    if (!answer || !isEmpty(element)) continue;
    try {
      if (await applyValueToField(element, answer)) {
        filled += 1;
        element.setAttribute('data-applyance-source', 'ai');
        highlights.push({ element, status: 'review' });
      }
    } catch {
      // Leave the field for the user.
    }
  }
  applyHighlights(highlights);
  return { filled };
}
