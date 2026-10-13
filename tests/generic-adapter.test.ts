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
});