import type { AiSuggestRequest, AiSuggestResponse } from '../shared/ai-assist';
import { loadProfile, loadSettings } from '../shared/storage';
import { suggestAnswers } from './ai-agent';

console.info('[Applyance] service worker ready');

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ profileComplete: false });
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

async function handleAiSuggest(request: AiSuggestRequest): Promise<AiSuggestResponse> {
  const settings = await loadSettings();
  if (!settings.aiAssistEnabled) return { ok: false, error: 'AI assist is turned off.' };
  const profile = await loadProfile();
  return suggestAnswers(settings.anthropicApiKey, profile, request.fields, request.page);
}

chrome.runtime.onMessage.addListener((message: AiSuggestRequest, sender, sendResponse) => {
  if (message?.type !== 'applyance:ai-suggest' || sender.id !== chrome.runtime.id) return false;
  handleAiSuggest(message).then(sendResponse, () => sendResponse({ ok: false, error: 'AI assist failed.' }));
  return true;
});
