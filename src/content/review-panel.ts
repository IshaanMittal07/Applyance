import { FillReport } from './adapters/generic';

const PANEL_ID = 'applyance-review-panel';

export interface ReviewPanel {
  update(status: string, report?: FillReport): void;
  onUndo(callback: () => void): void;
}

export function mountReviewPanel(doc: Document = document): ReviewPanel {
  let host = doc.getElementById(PANEL_ID) as HTMLElement | null;
  if (!host) {
    host = doc.createElement('div');
    host.id = PANEL_ID;
    host.setAttribute('data-applyance-ui', 'true');
    (doc.body ?? doc.documentElement).appendChild(host);
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const profileUrl = typeof chrome !== 'undefined' ? chrome.runtime.getURL('onboarding.html') : 'onboarding.html';
  shadow.innerHTML = `
    <style>
      :host { all: initial; position: fixed; z-index: 2147483647; top: 16px; right: 16px; color: #1d2a25; font: 14px/1.45 "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      .drawer { width: min(340px, calc(100vw - 32px)); overflow: hidden; border: 1px solid #cbded0; border-radius: 9px; background: #fff; box-shadow: 0 12px 36px rgba(16,60,47,.2); }
      .header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; color: #fff; background: #176b4f; }
      .mark { display: grid; width: 28px; height: 28px; flex: 0 0 28px; place-items: center; border-radius: 6px; color: #176b4f; background: #fff; font: 700 17px Georgia,serif; }
      .heading { min-width: 0; flex: 1; }
      .heading strong { display: block; font-size: 14px; }
      .heading span { display: block; color: #dbf1e3; font-size: 11px; }
      button { min-height: 34px; padding: 6px 10px; border: 1px solid #cbded0; border-radius: 5px; color: #176b4f; background: #fff; cursor: pointer; font: inherit; font-weight: 600; }
      button:hover { background: #f2f9f4; }
      .close { min-width: 32px; padding: 0; border-color: transparent; color: #fff; background: transparent; font-size: 20px; }
      .content { padding: 15px 16px 16px; }
      .status { margin: 0 0 7px; color: #103c2f; font-weight: 700; }
      .detail { min-height: 38px; margin: 0 0 14px; color: #66756d; font-size: 12px; }
      .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .undo { color: #7c3434; }
      .edit { display: block; margin-top: 12px; color: #176b4f; font-size: 12px; text-align: center; text-decoration: underline; }
      .collapsed { display: none; border-color: #176b4f; color: #fff; background: #176b4f; box-shadow: 0 4px 16px rgba(16,60,47,.24); }
      :host([data-collapsed="true"]) .drawer { display: none; }
      :host([data-collapsed="true"]) .collapsed { display: block; }
      @media (max-width: 600px) { :host { top: 8px; right: 8px; } }
    </style>
    <aside class="drawer" aria-label="Applyance application review">
      <header class="header"><span class="mark" aria-hidden="true">A</span><div class="heading"><strong>Applyance</strong><span>Application review</span></div><button class="close" type="button" aria-label="Minimize Applyance">−</button></header>
      <div class="content"><p class="status" role="status" aria-live="polite">Checking this application…</p><p class="detail">Your saved profile stays on this device. Applyance will not submit the application.</p>
        <div class="actions"><button class="undo" type="button">Undo filled values</button><button class="confirm" type="button">Review highlighted fields</button></div>
        <a class="edit" href="${profileUrl}" target="_blank" rel="noreferrer">Edit profile</a>
      </div>
    </aside>
    <button class="collapsed" type="button">Applyance · Review</button>
  `;

  const status = shadow.querySelector<HTMLElement>('.status');
  const detail = shadow.querySelector<HTMLElement>('.detail');
  shadow.querySelector('.close')?.addEventListener('click', () => host?.setAttribute('data-collapsed', 'true'));
  shadow.querySelector('.collapsed')?.addEventListener('click', () => host?.removeAttribute('data-collapsed'));
  shadow.querySelector('.confirm')?.addEventListener('click', () => {
    const firstMarkedField = doc.querySelector<HTMLElement>('[data-applyance-highlight="filled"]:not([data-applyance-ui]), [data-applyance-highlight="review"]:not([data-applyance-ui])');
    firstMarkedField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstMarkedField?.focus({ preventScroll: true });
  });

  return {
    update(message, report) {
      if (status) status.textContent = message;
      if (report && detail) {
        detail.textContent = report.filled
          ? `${report.filled} field${report.filled === 1 ? '' : 's'} filled. ${report.needsReview ? `${report.needsReview} need review. ` : ''}Check the highlighted values; nothing is submitted.`
          : `${report.needsReview ? `${report.needsReview} field${report.needsReview === 1 ? '' : 's'} need review. ` : ''}No values were filled. Check your profile and the application fields.`;
      }
    },
    onUndo(callback) {
      shadow.querySelector('.undo')?.addEventListener('click', callback);
    }
  };
}