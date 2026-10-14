import { detectAdapter } from './detect';
import { loadProfile, loadSettings } from '../shared/storage';
import { runAiAssist } from './ai-fill';
import type { FillReport } from './adapters/generic';
import { scanFields } from './field-scanner';
import { matchField } from './matcher';
import { mountReviewPanel, ReviewPanel } from './review-panel';
import { restoreAppliedValues } from './fillers';

const FORM_CONTROL_SELECTOR = 'input:not([type="hidden"]), textarea, select, [role="combobox"], [role="radiogroup"], [role="checkbox"]';
const PAGE_WINDOW = window as typeof window & {
  __applyanceContentInstalled?: boolean;
  __applyanceFill?: () => Promise<FillReport>;
  __applyanceStop?: () => void;
};

let reviewPanel: ReviewPanel | undefined;
let totalFilled = 0;
let aiFilled = 0;
let needsReview = 0;
let isFilling = false;
let fillAgain = false;
let fillTimer = 0;

function ensureReviewPanel(): ReviewPanel {
  if (!reviewPanel) {
    reviewPanel = mountReviewPanel(document);
    reviewPanel.onUndo(async () => {
      await restoreAppliedValues();
      totalFilled = 0;
      aiFilled = 0;
      reviewPanel?.update('Autofill undone', { filled: 0, needsReview: 0 });
    });
  }
  return reviewPanel;
}

async function runPageFill(): Promise<FillReport> {
  if (isFilling) {
    fillAgain = true;
    return { filled: 0, needsReview: 0 };
  }

  const fields = scanFields(document);
  const matchedFields = fields.filter((field) => matchField(field.label));
  if (!matchedFields.length) return { filled: 0, needsReview: 0 };

  const panel = ensureReviewPanel();
  const data = await chrome.storage.local.get('profileComplete');
  if (data.profileComplete !== true) {
    panel.update('Application form detected', { filled: 0, needsReview: matchedFields.length });
    return { filled: 0, needsReview: matchedFields.length };
  }

  isFilling = true;
  panel.update('Filling recognized empty fields…', { filled: totalFilled, needsReview });
  try {
    const profile = await loadProfile();
    const adapter = detectAdapter(new URL(window.location.href), document);
    const result = await adapter.fillPage(profile, { confidenceThreshold: 0.7, onlyFillEmptyFields: true });
    totalFilled += result.filled;
    needsReview = result.needsReview;

    let aiError = '';
    try {
      if ((await loadSettings()).aiAssistEnabled) {
        panel.update('Drafting answers to remaining questions with AI…', { filled: totalFilled, needsReview, aiFilled });
        const aiResult = await runAiAssist(document);
        totalFilled += aiResult.filled;
        aiFilled += aiResult.filled;
        result.filled += aiResult.filled;
        result.aiFilled = aiResult.filled;
        aiError = aiResult.error ?? '';
      }
    } catch {
      // AI assist is optional; its failure must not hide what the profile already filled.
      aiError = 'could not draft answers for the remaining questions.';
    }

    const status = aiError
      ? `AI assist: ${aiError}`
      : totalFilled ? 'Review your highlighted information' : 'Application detected; check highlighted fields';
    panel.update(status, { filled: totalFilled, needsReview, aiFilled });
    return result;
  } catch {
    needsReview += 1;
    panel.update('Some fields could not be filled', { filled: totalFilled, needsReview });
    return { filled: 0, needsReview };
  } finally {
    isFilling = false;
    if (fillAgain) {
      fillAgain = false;
      scheduleFill();
    }
  }
}

function nodeHasFormControls(node: unknown): boolean {
  if (!(node instanceof window.Element) || node.id === 'applyance-review-panel' || node.closest('#applyance-review-panel')) return false;
  return node.matches(FORM_CONTROL_SELECTOR) || Boolean(node.querySelector(FORM_CONTROL_SELECTOR));
}

function scheduleFill(): void {
  window.clearTimeout(fillTimer);
  fillTimer = window.setTimeout(() => { void runPageFill(); }, 250);
}

if (!PAGE_WINDOW.__applyanceContentInstalled) {
  PAGE_WINDOW.__applyanceContentInstalled = true;
  PAGE_WINDOW.__applyanceFill = runPageFill;

  const observer = new window.MutationObserver((mutations) => {
    if (mutations.some((mutation) => Array.from(mutation.addedNodes).some(nodeHasFormControls))) {
      scheduleFill();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  PAGE_WINDOW.__applyanceStop = () => {
    observer.disconnect();
    window.clearTimeout(fillTimer);
    PAGE_WINDOW.__applyanceContentInstalled = false;
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', scheduleFill, { once: true });
  } else {
    scheduleFill();
  }
} else {
  void PAGE_WINDOW.__applyanceFill?.();
}
