export type HighlightStatus = 'filled' | 'review';

const HIGHLIGHT_SELECTOR = '[data-applyance-highlight]';
const originalStyles = new WeakMap<HTMLElement, { border: string; boxShadow: string }>();
const listeningDocuments = new WeakSet<Document>();

function clearHighlight(element: HTMLElement): void {
  const original = originalStyles.get(element);
  if (original) {
    element.style.border = original.border;
    element.style.boxShadow = original.boxShadow;
    originalStyles.delete(element);
  }
  element.removeAttribute('data-applyance-highlight');
  element.removeAttribute('data-applyance-source');
}

// Once the user edits a highlighted field it is theirs: drop the highlight instead of leaving it marked for review.
export function handleUserEdit(event: Pick<Event, 'isTrusted' | 'target'>): void {
  if (!event.isTrusted || !(event.target instanceof HTMLElement)) return;
  const target = event.target;
  const highlighted = target.closest<HTMLElement>(HIGHLIGHT_SELECTOR);
  if (highlighted) clearHighlight(highlighted);
  // Radio groups are highlighted on their first option, but the user may pick any of them.
  if (target instanceof HTMLInputElement && target.type === 'radio' && target.name) {
    for (const radio of Array.from(target.ownerDocument.querySelectorAll<HTMLInputElement>(`input[type="radio"]${HIGHLIGHT_SELECTOR}`))) {
      if (radio.name === target.name && radio.form === target.form) clearHighlight(radio);
    }
  }
}

function listenForUserEdits(doc: Document): void {
  if (listeningDocuments.has(doc)) return;
  listeningDocuments.add(doc);
  doc.addEventListener('input', handleUserEdit, true);
  doc.addEventListener('change', handleUserEdit, true);
}

export function applyHighlights(elements: Array<{ element: HTMLElement; status: HighlightStatus }>): void {
  for (const entry of elements) {
    const { element, status } = entry;
    if (!originalStyles.has(element)) {
      originalStyles.set(element, { border: element.style.border, boxShadow: element.style.boxShadow });
    }
    element.setAttribute('data-applyance-highlight', status);
    const outline = status === 'filled' ? '2px solid rgba(34,197,94,0.8)' : '2px solid rgba(245,158,11,0.8)';
    element.style.border = outline;
    element.style.boxShadow = status === 'filled' ? '0 0 0 3px rgba(34,197,94,0.15)' : '0 0 0 3px rgba(245,158,11,0.18)';
    listenForUserEdits(element.ownerDocument);
  }
}

export function clearHighlights(doc: Document = document): void {
  for (const element of Array.from(doc.querySelectorAll<HTMLElement>(`${HIGHLIGHT_SELECTOR}:not([data-applyance-ui])`))) {
    clearHighlight(element);
  }
}

export function countReviewHighlights(doc: Document = document): number {
  // AI-drafted answers are reported separately, so they are not counted here.
  return doc.querySelectorAll('[data-applyance-highlight="review"]:not([data-applyance-ui]):not([data-applyance-source="ai"])').length;
}
