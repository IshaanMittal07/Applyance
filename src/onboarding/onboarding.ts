import { DEFAULT_PROFILE, Profile } from '../shared/profile-schema';
import { loadDraft, saveDraft, saveProfile, setProfileComplete } from '../shared/storage';

type WizardStep = {
  title: string;
  optional?: boolean;
  render: (profile: Profile) => string;
};

const root = document.querySelector('#app');

const steps: WizardStep[] = [
  {
    title: 'Welcome',
    render: () => `
      <p class="muted">Applyance keeps your data on this device and only fills empty job fields after you review them.</p>
      <p>All values are stored locally in your browser. Nothing is sent to a remote server.</p>
    `
  },
  {
    title: 'Personal info',
    render: (profile: Profile) => `
      <div>
        <label>First name <input name="firstName" value="${profile.personal.firstName ?? ''}" /></label>
        <label>Last name <input name="lastName" value="${profile.personal.lastName ?? ''}" /></label>
        <label>Email <input type="email" name="email" value="${profile.personal.email ?? ''}" /></label>
        <label>Phone <input name="phone" value="${profile.personal.phone ?? ''}" /></label>
      </div>
    `
  },
  {
    title: 'Links',
    render: (profile: Profile) => `
      <div>
        <label>LinkedIn <input name="linkedin" value="${profile.links.linkedin ?? ''}" /></label>
        <label>GitHub <input name="github" value="${profile.links.github ?? ''}" /></label>
        <label>Portfolio <input name="portfolio" value="${profile.links.portfolio ?? ''}" /></label>
      </div>
    `
  },
  {
    title: 'Review',
    render: (profile: Profile) => `
      <p>Review your basics before saving.</p>
      <ul>
        <li><strong>Name:</strong> ${profile.personal.firstName ?? ''} ${profile.personal.lastName ?? ''}</li>
        <li><strong>Email:</strong> ${profile.personal.email ?? ''}</li>
        <li><strong>Phone:</strong> ${profile.personal.phone ?? ''}</li>
      </ul>
    `
  }
];

async function buildInitialProfile(): Promise<Profile> {
  const draft = await loadDraft();
  return { ...DEFAULT_PROFILE, ...draft, personal: { ...DEFAULT_PROFILE.personal, ...draft?.personal }, links: { ...DEFAULT_PROFILE.links, ...draft?.links }, workAuthorization: { ...DEFAULT_PROFILE.workAuthorization, ...draft?.workAuthorization } } as Profile;
}

async function renderWizard() {
  if (!root) {
    return;
  }

  const profile = await buildInitialProfile();
  let stepIndex = 0;

  const render = () => {
    const step = steps[stepIndex];
    const progress = ((stepIndex + 1) / steps.length) * 100;
    const form = `
      <h2>${step.title}</h2>
      <div style="height: 8px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; margin: 12px 0 18px;">
        <div style="width: ${progress}%; height: 100%; background: #0d6efd;"></div>
      </div>
      ${step.render(profile)}
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
        <button type="button" class="secondary" ${stepIndex === 0 ? 'disabled' : ''} data-action="back">Back</button>
        ${step.optional && stepIndex < steps.length - 1 ? '<button type="button" class="secondary" data-action="skip">Skip for now</button>' : ''}
        <button type="button" class="primary" data-action="next">${stepIndex === steps.length - 1 ? 'Save profile' : 'Next'}</button>
      </div>
    `;
    root.innerHTML = form;

    const nextButton = root.querySelector('[data-action="next"]') as HTMLButtonElement | null;
    const backButton = root.querySelector('[data-action="back"]') as HTMLButtonElement | null;
    const skipButton = root.querySelector('[data-action="skip"]') as HTMLButtonElement | null;

    nextButton?.addEventListener('click', async () => {
      const formEl = root.querySelector('input, select') as HTMLInputElement | null;
      if (formEl && formEl.closest('form')) {
        // no-op: the wizard uses direct field data collection below.
      }

      const firstName = (root.querySelector('input[name="firstName"]') as HTMLInputElement | null)?.value ?? profile.personal.firstName ?? '';
      const lastName = (root.querySelector('input[name="lastName"]') as HTMLInputElement | null)?.value ?? profile.personal.lastName ?? '';
      const email = (root.querySelector('input[name="email"]') as HTMLInputElement | null)?.value ?? profile.personal.email ?? '';
      const phone = (root.querySelector('input[name="phone"]') as HTMLInputElement | null)?.value ?? profile.personal.phone ?? '';
      const linkedin = (root.querySelector('input[name="linkedin"]') as HTMLInputElement | null)?.value ?? profile.links.linkedin ?? '';
      const github = (root.querySelector('input[name="github"]') as HTMLInputElement | null)?.value ?? profile.links.github ?? '';
      const portfolio = (root.querySelector('input[name="portfolio"]') as HTMLInputElement | null)?.value ?? profile.links.portfolio ?? '';

      profile.personal.firstName = firstName;
      profile.personal.lastName = lastName;
      profile.personal.email = email;
      profile.personal.phone = phone;
      profile.links.linkedin = linkedin;
      profile.links.github = github;
      profile.links.portfolio = portfolio;

      await saveDraft(profile);

      if (stepIndex === steps.length - 1) {
        await saveProfile(profile);
        await setProfileComplete(true);
        root.innerHTML = '<h2>Setup complete</h2><p>Your profile is saved locally and Applyance is ready to autofill.</p><button class="primary" type="button" onclick="window.close()">Close</button>';
        return;
      }

      stepIndex += 1;
      render();
    });

    backButton?.addEventListener('click', () => {
      if (stepIndex > 0) {
        stepIndex -= 1;
        render();
      }
    });

    skipButton?.addEventListener('click', async () => {
      stepIndex += 1;
      render();
    });
  };

  render();
}

void renderWizard();
