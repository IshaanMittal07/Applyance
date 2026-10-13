import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkdayAdapter } from '../src/content/adapters/workday';
import { DEFAULT_PROFILE } from '../src/shared/profile-schema';

describe('Workday adapter', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('uses the saved registration email and password on account creation only', async () => {
    document.body.innerHTML = '<form><label>Email <input type="email" name="email"></label><label>Password <input type="password"></label><label>Confirm password <input type="password"></label></form>';
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    const profile = {
      ...DEFAULT_PROFILE,
      workdayAccount: { registrationEmail: 'account@example.com', password: 'Strong-Password-123' }
    };

    await new WorkdayAdapter().fillPage(profile);

    expect(document.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe('account@example.com');
    expect(Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).map((input) => input.value)).toEqual(['Strong-Password-123', 'Strong-Password-123']);
  });

  it('does not fill a password into a one-field sign-in form', async () => {
    document.body.innerHTML = '<form><label>Email <input type="email" name="email"></label><label>Password <input type="password"></label></form>';
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    const profile = {
      ...DEFAULT_PROFILE,
      workdayAccount: { registrationEmail: 'account@example.com', password: 'Strong-Password-123' }
    };

    await new WorkdayAdapter().fillPage(profile);

    expect(document.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe('');
  });
});