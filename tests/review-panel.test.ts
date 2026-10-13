import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountReviewPanel } from '../src/content/review-panel';

describe('review panel', () => {
  afterEach(() => {
    document.querySelector('#applyance-review-panel')?.remove();
    vi.restoreAllMocks();
  });

  it('shows fill counts and offers an undo action without exposing profile values', () => {
    const panel = mountReviewPanel();
    const undo = vi.fn();
    panel.onUndo(undo);
    panel.update('Application ready', { filled: 6, needsReview: 2 });
    const shadow = document.querySelector('#applyance-review-panel')?.shadowRoot;

    expect(shadow?.querySelector('.status')?.textContent).toBe('Application ready');
    expect(shadow?.querySelector('.detail')?.textContent).toContain('6 fields filled');
    expect(shadow?.querySelector('.detail')?.textContent).toContain('2 need review');
    expect(shadow?.textContent).not.toContain('private@example.com');
    shadow?.querySelector<HTMLButtonElement>('.undo')?.click();
    expect(undo).toHaveBeenCalledOnce();
  });
});