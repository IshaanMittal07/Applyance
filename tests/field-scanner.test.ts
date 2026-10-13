import { describe, expect, it, vi } from 'vitest';
import { scanFields } from '../src/content/field-scanner';
import { matchField } from '../src/content/matcher';
import { applyValueToField, restoreAppliedValues } from '../src/content/fillers';

describe('field scanner autocomplete metadata', () => {
  it('recognizes address fields even when their visible labels are generic', () => {
    const form = document.createElement('form');
    form.innerHTML = '<label>Address <input autocomplete="address-line1"></label><label>Region <input autocomplete="address-level1"></label><input autocomplete="postal-code">';
    document.body.append(form);
    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);

    try {
      const fields = scanFields(form);
      expect(matchField(fields[0].label)?.key).toBe('personal.address.line1');
      expect(matchField(fields[1].label)?.key).toBe('personal.address.stateOrProvince');
      expect(matchField(fields[2].label)?.key).toBe('personal.address.postalCode');
    } finally {
      dimensions.mockRestore();
      form.remove();
    }
  });

  it('scans and selects one answer from a labeled authorization radio group', async () => {
    const form = document.createElement('form');
    form.innerHTML = '<fieldset><legend>Are you authorized to work in the U.S.?</legend><label><input type="radio" name="authorized" value="Yes">Yes</label><label><input type="radio" name="authorized" value="No">No</label></fieldset>';
    document.body.append(form);
    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);

    try {
      const fields = scanFields(form);
      expect(fields).toHaveLength(1);
      expect(matchField(fields[0].label)?.key).toBe('workAuthorization.authorizedToWorkIn.United States');
      expect(await applyValueToField(fields[0].element, 'Yes')).toBe(true);
      expect(form.querySelector<HTMLInputElement>('input[value="Yes"]')?.checked).toBe(true);
      restoreAppliedValues();
      expect(form.querySelector<HTMLInputElement>('input[value="Yes"]')?.checked).toBe(false);
    } finally {
      dimensions.mockRestore();
      form.remove();
      restoreAppliedValues();
    }
  });

  it('uses a combobox wrapper label when its input has a generated name', () => {
    const form = document.createElement('form');
    form.innerHTML = '<div role="combobox" aria-label="State / Province"><input name="field_9173"></div>';
    document.body.append(form);
    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);

    try {
      const [field] = scanFields(form);
      expect(matchField(field.label)?.key).toBe('personal.address.stateOrProvince');
    } finally {
      dimensions.mockRestore();
      form.remove();
    }
  });

  it('recognizes a Workday listbox button through its associated form label', () => {
    const form = document.createElement('form');
    form.innerHTML = '<label for="state-choice">State / Province</label><button id="state-choice" aria-haspopup="listbox" aria-expanded="false">Choose</button>';
    document.body.append(form);
    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);

    try {
      const fields = scanFields(form);
      expect(fields).toHaveLength(1);
      expect(matchField(fields[0].label)?.key).toBe('personal.address.stateOrProvince');
    } finally {
      dimensions.mockRestore();
      form.remove();
    }
  });

  it('reads the existing value of a Workday dropdown button', () => {
    const form = document.createElement('form');
    form.innerHTML = '<label for="country-choice">Country</label><button id="country-choice" aria-haspopup="listbox">Canada</button>';
    document.body.append(form);
    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);

    try {
      expect(scanFields(form)[0].value).toBe('Canada');
    } finally {
      dimensions.mockRestore();
      form.remove();
    }
  });

  it('uses the Workday formFieldLabel for an opaque selectWidget button', () => {
    const form = document.createElement('div');
    form.innerHTML = '<div data-automation-id="formField"><div data-automation-id="formFieldLabel">Ethnicity/Race*</div><div data-automation-id="selectWidget"><button id="select-412" aria-haspopup="listbox">Select One</button></div></div>';
    document.body.append(form);
    const dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);

    try {
      const fields = scanFields(form);
      expect(fields).toHaveLength(1);
      expect(matchField(fields[0].label)?.key).toBe('eeo.raceEthnicity');
    } finally {
      dimensions.mockRestore();
      form.remove();
    }
  });
});