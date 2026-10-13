export type HighlightStatus = 'filled' | 'review';

export function applyHighlights(elements: Array<{ element: HTMLElement; status: HighlightStatus }>): void {
  for (const entry of elements) {
    const { element, status } = entry;
    element.setAttribute('data-applyance-highlight', status);
    const outline = status === 'filled' ? '2px solid rgba(34,197,94,0.8)' : '2px solid rgba(245,158,11,0.8)';
    element.style.border = outline;
    element.style.boxShadow = status === 'filled' ? '0 0 0 3px rgba(34,197,94,0.15)' : '0 0 0 3px rgba(245,158,11,0.18)';
  }
}
