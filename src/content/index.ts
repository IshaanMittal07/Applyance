console.info('[Applyance] content script ready');

const ELEMENT_ID = 'applyance-profile-gate';

async function checkGate(): Promise<void> {
  const data = await chrome.storage.local.get('profileComplete');
  if (data.profileComplete === true) {
    return;
  }

  const existing = document.getElementById(ELEMENT_ID);
  if (existing) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = ELEMENT_ID;
  banner.style.position = 'fixed';
  banner.style.bottom = '16px';
  banner.style.right = '16px';
  banner.style.zIndex = '2147483647';
  banner.style.background = '#111827';
  banner.style.color = '#ffffff';
  banner.style.padding = '12px 16px';
  banner.style.borderRadius = '10px';
  banner.style.fontFamily = 'sans-serif';
  banner.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
  banner.style.maxWidth = '320px';

  const text = document.createElement('div');
  text.textContent = 'Applyance: finish your profile to autofill this page';

  const link = document.createElement('a');
  link.href = chrome.runtime.getURL('onboarding.html');
  link.textContent = 'Open setup';
  link.style.color = '#bfdbfe';
  link.style.display = 'inline-block';
  link.style.marginTop = '8px';
  link.style.textDecoration = 'underline';

  banner.append(text, link);
  document.body?.appendChild(banner);
}

void checkGate();
