import { Address } from '../shared/profile-schema';
import { loadProfile, saveProfile } from '../shared/storage';

const root = document.querySelector('#app');

async function importChromeFilledAddress(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) throw new Error('Open the application page that contains your Chrome-filled address.');

  const [execution] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const autocompleteKeys: Record<string, string> = {
        'street-address': 'line1', 'address-line1': 'line1', 'address-line2': 'line2',
        'address-level1': 'stateOrProvince', 'address-level2': 'city', 'address-level3': 'county',
        'postal-code': 'postalCode', 'country-name': 'country', country: 'country'
      };
      const result: Record<string, string> = {};
      const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'));

      for (const control of controls) {
        if (control instanceof HTMLInputElement && ['hidden', 'checkbox', 'radio', 'password', 'button', 'submit'].includes(control.type)) continue;
        const label = `${control.closest('label')?.textContent ?? ''} ${control.getAttribute('aria-label') ?? ''} ${control.getAttribute('name') ?? ''}`.toLowerCase();
        if (/company|employer|school|office|emergency/.test(label)) continue;
        const tokens = (control.getAttribute('autocomplete') ?? '').toLowerCase().split(/\s+/);
        let key = tokens.map((token) => autocompleteKeys[token]).find(Boolean);
        if (!key) {
          if (/address line 2|apartment|suite|unit/.test(label)) key = 'line2';
          else if (/address line 1|street address|street name/.test(label)) key = 'line1';
          else if (/postal|zip code/.test(label)) key = 'postalCode';
          else if (/country/.test(label)) key = 'country';
          else if (/county/.test(label)) key = 'county';
          else if (/state|province|region/.test(label)) key = 'stateOrProvince';
          else if (/city|town/.test(label)) key = 'city';
        }
        if (!key) continue;
        const value = control instanceof HTMLSelectElement ? control.selectedOptions[0]?.textContent?.trim() ?? control.value.trim() : control.value.trim();
        if (value) result[key] = value;
      }
      return result;
    }
  });

  const address = (execution?.result ?? {}) as Partial<Address>;
  const importedValues = Object.values(address).filter((value) => typeof value === 'string' && value.trim());
  if (!importedValues.length) {
    throw new Error('No filled address fields found. Choose an address with Chrome Autofill on the application page first.');
  }

  const profile = await loadProfile();
  await saveProfile({
    ...profile,
    personal: { ...profile.personal, address: { ...profile.personal.address, ...address } }
  });
  return importedValues.length;
}

async function fillActiveTab(tabId: number): Promise<Array<{ filled: number; needsReview: number }>> {
  const target = { tabId, allFrames: true };
  try {
    await chrome.scripting.executeScript({ target, files: ['content/index.js'] });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/index.js'] });
  }

  const runFill = async (allFrames: boolean) => chrome.scripting.executeScript({
    target: allFrames ? target : { tabId },
    func: async () => {
      const pageWindow = window as typeof window & { __applyanceFill?: () => Promise<{ filled: number; needsReview: number }> };
      if (!pageWindow.__applyanceFill) return null;
      return pageWindow.__applyanceFill();
    }
  });

  try {
    const results = await runFill(true);
    return results.map((entry) => entry.result).filter((result): result is { filled: number; needsReview: number } => Boolean(result));
  } catch {
    const results = await runFill(false);
    return results.map((entry) => entry.result).filter((result): result is { filled: number; needsReview: number } => Boolean(result));
  }
}

function bindAddressImportButton(): void {
  const button = root?.querySelector<HTMLButtonElement>('#import-address-button');
  const status = root?.querySelector<HTMLElement>('#address-import-status');
  button?.addEventListener('click', async () => {
    if (!status) return;
    button.disabled = true;
    status.textContent = 'Reading address fields from this page…';
    try {
      const count = await importChromeFilledAddress();
      status.textContent = `Saved ${count} address fields to your local Applyance profile.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not import address fields from this page.';
    } finally {
      button.disabled = false;
    }
  });
}

async function render(): Promise<void> {
  if (!root) {
    return;
  }

  const data = await chrome.storage.local.get('profileComplete');
  const profileComplete = Boolean(data.profileComplete);

  if (!profileComplete) {
    root.innerHTML = '<p>Set up your profile to start autofilling.</p><button class="primary" type="button">Open setup</button><p class="address-import-hint">Use Chrome Autofill on an application first, then save those address fields here.</p><button class="secondary" type="button" id="import-address-button">Save Chrome-filled address</button><p id="address-import-status" role="status"></p>';
    const button = root.querySelector('button');
    button?.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
    });
    bindAddressImportButton();
    return;
  }

  root.innerHTML = '<p>Your profile is ready. Fill this page when you are on an application.</p><button class="primary" type="button">Fill this page</button><p id="fill-status" role="status" aria-live="polite"></p><button class="secondary" type="button" id="undo-button">Undo</button><button class="secondary" type="button" id="edit-profile-button">Edit full profile</button><p class="address-import-hint">Use Chrome Autofill on an application first, then save those address fields here.</p><button class="secondary" type="button" id="import-address-button">Save Chrome-filled address</button><p id="address-import-status" role="status"></p>';
  const button = root.querySelector('.primary');
  const fillStatus = root.querySelector<HTMLElement>('#fill-status');
  const undoButton = root.querySelector('#undo-button');
  const editProfileButton = root.querySelector('#edit-profile-button');

  button?.addEventListener('click', async () => {
    if (!(button instanceof HTMLButtonElement) || !fillStatus) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      fillStatus.textContent = 'Could not access the active tab. Open the job application and try again.';
      return;
    }

    button.disabled = true;
    fillStatus.textContent = 'Checking the application page…';
    try {
      const results = await fillActiveTab(tab.id);
      if (!results.length) {
        fillStatus.textContent = 'Applyance could not start on this page. Reload the job page and try again; Chrome blocks extensions on some browser pages.';
      } else {
        const filled = results.reduce((total, result) => total + result.filled, 0);
        const needsReview = results.reduce((total, result) => total + result.needsReview, 0);
        fillStatus.textContent = filled
          ? `Filled ${filled} field${filled === 1 ? '' : 's'}. Review them before submitting.${needsReview ? ` ${needsReview} field${needsReview === 1 ? '' : 's'} need review.` : ''}`
          : `Applyance ran but found no matching empty fields${needsReview ? `; ${needsReview} need review` : ''}. Check the field labels and that this is an application form.`;
      }
    } catch (error) {
      fillStatus.textContent = error instanceof Error ? error.message : 'Could not fill this page. Check the extension permissions and reload the job page.';
    } finally {
      button.disabled = false;
    }
  });

  undoButton?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { (window as typeof window & { __applyanceUndo?: () => void }).__applyanceUndo?.(); } });
    }
  });

  editProfileButton?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  });
  bindAddressImportButton();
}

void render();
