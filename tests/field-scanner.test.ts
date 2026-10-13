import { describe, expect, it, vi } from 'vitest';
import { scanFields } from '../src/content/field-scanner';
import { matchField } from '../src/content/matcher';

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
});