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
});
