import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenericAdapter } from '../src/content/adapters/generic';
import { applyHighlights, clearHighlights, countReviewHighlights, handleUserEdit } from '../src/content/highlight';
import { DEFAULT_PROFILE, Profile } from '../src/shared/profile-schema';

const profile: Profile = {
  ...DEFAULT_PROFILE,
  personal: {
    ...DEFAULT_PROFILE.personal,
    firstName: 'Ishaan',
    address: { ...DEFAULT_PROFILE.personal.address, country: 'Narnia' }
  }
};

describe('control after autofill', () => {
  let dimensions: ReturnType<typeof vi.spyOn>;
  let root: HTMLElement;

  beforeEach(() => {
    dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    root = document.createElement('div');
    document.body.append(root);
  });

  afterEach(() => {
    dimensions.mockRestore();
    root.remove();
  });

  it('does not refill a field the user cleared, unless they ask for a fill', async () => {
    root.innerHTML = '<label>First name <input></label>';
    const input = root.querySelector('input')!;
    const adapter = new GenericAdapter(root);

    await adapter.fillPage(profile, { onlyFillEmptyFields: true });
    expect(input.value).toBe('Ishaan');

    input.value = '';
    await adapter.fillPage(profile, { onlyFillEmptyFields: true });
    expect(input.value).toBe('');

    await adapter.fillPage(profile, { onlyFillEmptyFields: true, retryAttempted: true });
    expect(input.value).toBe('Ishaan');
  });

  it('maps a newly added section to the next profile entry after an automatic pass', async () => {
    const twoSchools: Profile = {
      ...profile,
      education: [
        { school: 'First University', degree: 'BSc', fieldOfStudy: 'CS', currentlyEnrolled: false },
        { school: 'Second College', degree: 'MSc', fieldOfStudy: 'CS', currentlyEnrolled: false }
      ]
    };
    root.innerHTML = '<label>School name <input id="s0"></label>';
    const adapter = new GenericAdapter(root);
    await adapter.fillPage(twoSchools, { onlyFillEmptyFields: true });

    const added = document.createElement('label');
    added.innerHTML = 'School name <input id="s1">';
    root.append(added);
    await adapter.fillPage(twoSchools, { onlyFillEmptyFields: true });

    expect(root.querySelector<HTMLInputElement>('#s0')?.value).toBe('First University');
    expect(root.querySelector<HTMLInputElement>('#s1')?.value).toBe('Second College');
  });

  it('tries a dropdown with no matching option once, then closes it and gives focus back', async () => {
    root.innerHTML = `
      <label for="notes">Notes</label><textarea id="notes"></textarea>
      <label for="country-input">Country</label>
      <div role="combobox"><input id="country-input" aria-haspopup="listbox" aria-expanded="false" aria-controls="country-options"></div>
      <div id="country-options" role="listbox" hidden><div role="option">Canada</div></div>`;
    const input = root.querySelector<HTMLInputElement>('#country-input')!;
    const listbox = root.querySelector<HTMLElement>('#country-options')!;
    const notes = root.querySelector('textarea')!;
    const opened = vi.fn(() => { listbox.hidden = false; input.setAttribute('aria-expanded', 'true'); });
    input.addEventListener('click', opened);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { listbox.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    });
    notes.focus();
    const adapter = new GenericAdapter(root);

    const first = await adapter.fillPage(profile, { onlyFillEmptyFields: true });

    expect(first.needsReview).toBe(1);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('');
    expect(listbox.hidden).toBe(true);
    expect(document.activeElement).toBe(notes);

    const second = await adapter.fillPage(profile, { onlyFillEmptyFields: true });

    expect(second).toEqual({ filled: 0, needsReview: 0 });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(notes);
  });

  it('drops a highlight once the user edits the field, and only for real user edits', () => {
    root.innerHTML = '<input id="a" style="border: 1px solid red"><input id="b">';
    const a = root.querySelector<HTMLInputElement>('#a')!;
    const b = root.querySelector<HTMLInputElement>('#b')!;
    applyHighlights([{ element: a, status: 'review' }, { element: b, status: 'review' }]);
    expect(countReviewHighlights(document)).toBe(2);

    handleUserEdit({ isTrusted: false, target: a });
    expect(a.getAttribute('data-applyance-highlight')).toBe('review');

    handleUserEdit({ isTrusted: true, target: a });
    expect(a.hasAttribute('data-applyance-highlight')).toBe(false);
    expect(a.style.border).toBe('1px solid red');
    expect(countReviewHighlights(document)).toBe(1);

    clearHighlights(document);
    expect(b.hasAttribute('data-applyance-highlight')).toBe(false);
    expect(b.style.boxShadow).toBe('');
  });

  it('clears a whole radio group highlight when the user picks any option', () => {
    root.innerHTML = '<fieldset><legend>Team</legend><input type="radio" name="team" value="s"><input type="radio" name="team" value="l"></fieldset>';
    const [small, large] = Array.from(root.querySelectorAll<HTMLInputElement>('input'));
    applyHighlights([{ element: small, status: 'review' }]);

    handleUserEdit({ isTrusted: true, target: large });

    expect(small.hasAttribute('data-applyance-highlight')).toBe(false);
  });

  it('does not count AI-drafted answers as fields needing review', () => {
    root.innerHTML = '<input id="ai"><input id="manual">';
    const ai = root.querySelector<HTMLInputElement>('#ai')!;
    ai.setAttribute('data-applyance-source', 'ai');
    applyHighlights([{ element: ai, status: 'review' }, { element: root.querySelector<HTMLInputElement>('#manual')!, status: 'review' }]);

    expect(countReviewHighlights(document)).toBe(1);
  });
});
