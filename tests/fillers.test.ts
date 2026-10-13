import { describe, expect, it } from 'vitest';
import { applyValueToField, restoreAppliedValues } from '../src/content/fillers';

describe('fillers', () => {
  it('sets text input values and fires input change events', () => {
    const input = document.createElement('input');
    let fired = 0;
    input.addEventListener('input', () => {
      fired += 1;
    });

    applyValueToField(input, 'Alice');

    expect(input.value).toBe('Alice');
    expect(fired).toBe(1);
  });

  it('sets textarea values using the textarea native setter', async () => {
    const textarea = document.createElement('textarea');

    expect(await applyValueToField(textarea, 'Cover letter details')).toBe(true);
    expect(textarea.value).toBe('Cover letter details');
    restoreAppliedValues();
    expect(textarea.value).toBe('');
  });

  it('sets select values by matching the option text', () => {
    const select = document.createElement('select');
    select.innerHTML = '<option value="us">United States</option><option value="ca">Canada</option>';

    applyValueToField(select, 'Canada');

    expect(select.value).toBe('ca');
  });

  it('sets and restores checkbox state', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';

    applyValueToField(checkbox, 'true');
    expect(checkbox.checked).toBe(true);

    restoreAppliedValues();
    expect(checkbox.checked).toBe(false);
  });

  it('selects a matching option from a custom combobox', async () => {
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');
    combobox.setAttribute('aria-label', 'State');
    const input = document.createElement('input');
    combobox.append(input);
    document.body.append(combobox);
    input.addEventListener('input', () => {
      const listbox = document.createElement('div');
      listbox.setAttribute('role', 'listbox');
      const option = document.createElement('div');
      option.setAttribute('role', 'option');
      option.textContent = 'Ontario';
      option.addEventListener('click', () => { input.value = 'Ontario'; });
      listbox.append(option);
      document.body.append(listbox);
    }, { once: true });

    try {
      expect(await applyValueToField(input, 'Ontario')).toBe(true);
      expect(input.value).toBe('Ontario');
    } finally {
      document.body.replaceChildren();
      restoreAppliedValues();
    }
  });

  it('opens a Workday listbox button and selects an exact option', async () => {
    const button = document.createElement('button');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'workday-state-options');
    button.setAttribute('aria-label', 'State / Province');
    const listbox = document.createElement('div');
    listbox.id = 'workday-state-options';
    listbox.setAttribute('role', 'listbox');
    listbox.hidden = true;
    listbox.innerHTML = '<div role="option">Ontario</div><div role="option">Ontario County</div>';
    button.addEventListener('click', () => {
      listbox.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    });
    listbox.querySelector('[role="option"]')?.addEventListener('click', () => {
      button.textContent = 'Ontario';
      listbox.hidden = true;
    });
    document.body.append(button, listbox);

    try {
      expect(await applyValueToField(button, 'Ontario')).toBe(true);
      expect(button.textContent).toBe('Ontario');
      expect(listbox.hidden).toBe(true);
    } finally {
      document.body.replaceChildren();
      restoreAppliedValues();
    }
  });
});
