import { Profile } from '../shared/profile-schema';
import { clearAllData, loadProfile, loadSettings, saveProfile, saveSettings } from '../shared/storage';

const root = document.querySelector('#app');

const renderForm = async (): Promise<void> => {
  if (!root) {
    return;
  }

  const profile = await loadProfile();
  const settings = await loadSettings();

  root.innerHTML = `
    <form id="profile-form">
      <div class="card">
        <h2>Personal</h2>
        <label>First name <input name="firstName" value="${profile.personal.firstName ?? ''}" /></label>
        <label>Last name <input name="lastName" value="${profile.personal.lastName ?? ''}" /></label>
        <label>Email <input type="email" name="email" value="${profile.personal.email ?? ''}" /></label>
        <label>Phone <input name="phone" value="${profile.personal.phone ?? ''}" /></label>
      </div>
      <div class="card">
        <h2>Links</h2>
        <label>LinkedIn <input name="linkedin" value="${profile.links.linkedin ?? ''}" /></label>
        <label>GitHub <input name="github" value="${profile.links.github ?? ''}" /></label>
        <label>Portfolio <input name="portfolio" value="${profile.links.portfolio ?? ''}" /></label>
      </div>
      <div class="card">
        <h2>Skills</h2>
        <textarea name="skills" rows="4">${(profile.skills ?? []).join(', ')}</textarea>
      </div>
      <div class="card">
        <h2>Settings</h2>
        <label>Confidence threshold <input type="number" step="0.1" min="0.1" max="1" name="confidenceThreshold" value="${settings.confidenceThreshold}" /></label>
        <label><input type="checkbox" name="onlyFillEmptyFields" ${settings.onlyFillEmptyFields ? 'checked' : ''} /> Only fill empty fields</label>
        <label><input type="checkbox" name="enableOnAllSites" ${settings.enableOnAllSites ? 'checked' : ''} /> Enable on all sites</label>
        <label><input type="checkbox" name="autoTickWorkdayTerms" ${settings.autoTickWorkdayTerms ? 'checked' : ''} /> Auto-tick Workday terms</label>
      </div>
      <div class="card">
        <button type="submit" class="primary">Save profile</button>
        <button type="button" class="secondary" id="export-btn">Export profile</button>
        <button type="button" class="secondary" id="import-btn">Import profile</button>
        <button type="button" id="delete-btn">Delete all data</button>
      </div>
    </form>
    <input type="file" id="import-file" accept="application/json" hidden />
  `;

  const form = root.querySelector('#profile-form') as HTMLFormElement | null;
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const updated: Profile = {
      ...profile,
      personal: {
        ...profile.personal,
        firstName: String(formData.get('firstName') ?? ''),
        lastName: String(formData.get('lastName') ?? ''),
        email: String(formData.get('email') ?? ''),
        phone: String(formData.get('phone') ?? '')
      },
      links: {
        ...profile.links,
        linkedin: String(formData.get('linkedin') ?? ''),
        github: String(formData.get('github') ?? ''),
        portfolio: String(formData.get('portfolio') ?? '')
      },
      skills: String(formData.get('skills') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
    };

    await saveProfile(updated);
    await saveSettings({
      confidenceThreshold: Number(formData.get('confidenceThreshold') ?? 0.7),
      onlyFillEmptyFields: formData.get('onlyFillEmptyFields') === 'on',
      enableOnAllSites: formData.get('enableOnAllSites') === 'on',
      autoTickWorkdayTerms: formData.get('autoTickWorkdayTerms') === 'on'
    });
    window.alert('Profile saved.');
    await renderForm();
  });

  const exportButton = root.querySelector('#export-btn');
  exportButton?.addEventListener('click', async () => {
    const exported = await loadProfile();
    const bytes = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(bytes);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'applyance-profile.json';
    anchor.click();
    URL.revokeObjectURL(url);
  });

  const importButton = root.querySelector('#import-btn');
  const importFile = root.querySelector('#import-file') as HTMLInputElement | null;
  importButton?.addEventListener('click', () => importFile?.click());
  importFile?.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    const content = await file.text();
    const parsed = JSON.parse(content) as Partial<Profile>;
    await saveProfile(parsed);
    target.value = '';
    await renderForm();
  });

  const deleteButton = root.querySelector('#delete-btn');
  deleteButton?.addEventListener('click', async () => {
    if (window.confirm('Delete all stored profile data?')) {
      await clearAllData();
      await renderForm();
    }
  });
};

void renderForm();

document.querySelector('#edit-profile-btn')?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
});
