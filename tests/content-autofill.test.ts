import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE } from '../src/shared/profile-schema';
import { loadProfile } from '../src/shared/storage';

vi.mock('../src/shared/storage', () => ({ loadProfile: vi.fn() }));

describe('automatic application detection', () => {
  afterEach(() => {
    (window as typeof window & { __applyanceStop?: () => void }).__applyanceStop?.();
    document.body.replaceChildren();
    Reflect.deleteProperty(globalThis, 'chrome');
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('fills a supported application form rendered after the content script loads', async () => {
    vi.stubGlobal('chrome', {
      storage: { local: { get: vi.fn().mockResolvedValue({ profileComplete: true }) } },
      runtime: { getURL: (path: string) => `chrome-extension://test/${path}` }
    });
    vi.mocked(loadProfile).mockResolvedValue({
      ...DEFAULT_PROFILE,
      personal: { ...DEFAULT_PROFILE.personal, firstName: 'Ishaan' }
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    (window as typeof window & { __applyanceContentInstalled?: boolean }).__applyanceContentInstalled = false;
    window.history.replaceState({}, '', '/job/apply');

    await import('../src/content/index');
    await new Promise((resolve) => window.setTimeout(resolve, 20));

    const form = document.createElement('form');
    form.innerHTML = '<label>First name <input></label>';
    document.body.append(form);

    await vi.waitFor(() => expect(form.querySelector('input')?.value).toBe('Ishaan'));
    const panel = document.querySelector('#applyance-review-panel')?.shadowRoot;
    expect(panel?.querySelector('.status')?.textContent).toBe('Review your highlighted information');
    expect(panel?.querySelector('.detail')?.textContent).toContain('1 field filled');
  });
});