import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE } from '../src/shared/profile-schema';
import { GenericAdapter } from '../src/content/adapters/generic';

describe('generic adapter', () => {
  it('fills repeated education fields from matching profile entries', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<label>School name <input></label><label>School name <input></label>';
    document.body.append(root);

    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    const profile = {
      ...DEFAULT_PROFILE,
      education: [
        { school: 'University of Waterloo', degree: '', fieldOfStudy: '', currentlyEnrolled: true },
        { school: 'Second University', degree: '', fieldOfStudy: '', currentlyEnrolled: false }
      ]
    };

    try {
      const result = await new GenericAdapter(root).fillPage(profile);
      const inputs = root.querySelectorAll('input');

      expect(result.filled).toBe(2);
      expect(inputs[0].value).toBe('University of Waterloo');
      expect(inputs[1].value).toBe('Second University');
    } finally {
      dimensions.mockRestore();
      root.remove();
    }
  });

  it('continues filling after a job-description textarea', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<label>First name <input></label><label>Job description <textarea></textarea></label><label>Email address <input></label>';
    document.body.append(root);

    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    const profile = {
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, firstName: 'Ishaan', email: 'ishaan@example.com' },
      experience: [{ company: 'Example Co', title: 'Engineer', startMonth: '', startYear: '', current: false, description: 'Built application systems.' }]
    };

    try {
      const result = await new GenericAdapter(root).fillPage(profile);

      expect(result.filled).toBe(3);
      expect(root.querySelector<HTMLInputElement>('input')?.value).toBe('Ishaan');
      expect(root.querySelector('textarea')?.value).toBe('Built application systems.');
      expect(root.querySelectorAll<HTMLInputElement>('input')[1].value).toBe('ishaan@example.com');
    } finally {
      dimensions.mockRestore();
      root.remove();
    }
  });

  it('fills a labeled Workday button dropdown from the saved address', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<label for="country-select">Country</label><button id="country-select" aria-haspopup="listbox" aria-expanded="false" aria-controls="country-options">Choose a country</button><div id="country-options" role="listbox" hidden><div role="option">Canada</div><div role="option">United States</div></div>';
    const button = root.querySelector<HTMLButtonElement>('button')!;
    const listbox = root.querySelector<HTMLElement>('[role="listbox"]')!;
    button.addEventListener('click', () => { listbox.hidden = false; });
    listbox.querySelector('[role="option"]')?.addEventListener('click', () => {
      button.textContent = 'Canada';
      listbox.hidden = true;
    });
    document.body.append(root);

    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    const profile = {
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, address: { ...DEFAULT_PROFILE.personal.address, country: 'Canada' } }
    };

    try {
      const result = await new GenericAdapter(root).fillPage(profile);

      expect(result.filled).toBe(1);
      expect(button.textContent).toBe('Canada');
    } finally {
      dimensions.mockRestore();
      root.remove();
    }
  });

  it('fills an employer-specific question from a saved custom answer even without a general synonym', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<label>Do you have family members currently employed at Fidelity?<select><option value="">Select</option><option>No</option><option>Yes</option></select></label>';
    document.body.append(root);
    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    const profile = {
      ...DEFAULT_PROFILE,
      customAnswers: [{ questionPattern: 'family members currently employed at Fidelity', answer: 'No' }]
    };

    try {
      const result = await new GenericAdapter(root).fillPage(profile);
      expect(result.filled).toBe(1);
      expect(root.querySelector('select')?.value).toBe('No');
    } finally {
      dimensions.mockRestore();
      root.remove();
    }
  });

  it('fills education and EEO native dropdowns from profile answers', async () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <label>Degree<select><option value="">Select</option><option>Bachelor's Degree</option></select></label>
      <label>Field of study<select><option value="">Select</option><option>Computer Engineering</option></select></label>
      <label>Gender*<select><option value="">Select</option><option>Male</option></select></label>
      <label>Veterans Status*<select><option value="">Select</option><option>I AM NOT A VETERAN</option></select></label>
      <label>Ethnicity/Race*<select><option value="">Select</option><option>Asian (Not Hispanic or Latinx) (United States of America)</option><option>White</option></select></label>
      <label>Are you interested in and able to work at the location(s) listed on this opening?<select><option value="">Select</option><option>Yes</option><option>No</option></select></label>`;
    document.body.append(root);
    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    const profile = {
      ...DEFAULT_PROFILE,
      education: [{ school: 'University of Waterloo', degree: 'Candidate for Bachelor of Applied Science (BASc)', fieldOfStudy: 'Computer Engineering', currentlyEnrolled: true }],
      eeo: { ...DEFAULT_PROFILE.eeo, gender: 'Male', veteranStatus: 'No', raceEthnicity: 'Asian' },
      applicationAnswers: { locationAvailability: 'Yes' }
    };

    try {
      const result = await new GenericAdapter(root).fillPage(profile);
      expect(result.filled).toBe(6);
      expect(Array.from(root.querySelectorAll('select')).map((select) => select.selectedOptions[0].textContent)).toEqual([
        "Bachelor's Degree", 'Computer Engineering', 'Male', 'I AM NOT A VETERAN', 'Asian (Not Hispanic or Latinx) (United States of America)', 'Yes'
      ]);
    } finally {
      dimensions.mockRestore();
      root.remove();
    }
  });
});