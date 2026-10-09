const root = document.querySelector('#app');

async function render(): Promise<void> {
  if (!root) {
    return;
  }

  const data = await chrome.storage.local.get('profileComplete');
  const profileComplete = Boolean(data.profileComplete);

  if (!profileComplete) {
    root.innerHTML = '<p>Set up your profile to start autofilling.</p><button class="primary" type="button">Open setup</button>';
    const button = root.querySelector('button');
    button?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
    });
    return;
  }

  root.innerHTML = '<p>Your profile is ready. Fill this page when you are on an application.</p><button class="primary" type="button">Fill this page</button><button class="secondary" type="button" id="undo-button">Undo</button>';
  const button = root.querySelector('.primary');
  const undoButton = root.querySelector('#undo-button');

  button?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          (window as typeof window & { __applyanceFill?: () => Promise<void> }).__applyanceFill?.();
        }
      });
    }
  });

  undoButton?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { (window as typeof window & { __applyanceUndo?: () => void }).__applyanceUndo?.(); } });
    }
  });
}

void render();
