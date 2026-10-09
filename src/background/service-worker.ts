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
