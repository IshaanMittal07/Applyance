import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAiAssist } from '../src/content/ai-fill';
import type { AiSuggestRequest } from '../src/shared/ai-assist';

describe('runAiAssist', () => {
  let dimensions: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dimensions = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 120, height: 24 } as ReturnType<HTMLElement['getBoundingClientRect']>);
    document.title = 'Software Engineer - Acme';
    document.body.innerHTML = `
      <h1>Software Engineer</h1>
      <label>First name <input id="first"></label>
      <label>How many years of TypeScript experience do you have? <input id="years" type="number" min="0" max="40"></label>
      <label>What motivates you to apply here? <textarea id="why" maxlength="500"></textarea></label>
      <label>Are you comfortable working in a hybrid environment? <select id="hybrid"><option value="">Select...</option><option value="y">Yes</option><option value="n">No</option></select></label>
      <fieldset><legend>Preferred team size</legend><label><input type="radio" name="team" value="s"> Small</label><label><input type="radio" name="team" value="l"> Large</label></fieldset>
      <label>Gender <select id="gender"><option value="">Select...</option><option>Male</option><option>Female</option></select></label>
      <label>I certify that my answers are true <input id="certify" type="text"></label>
      <label>Favourite framework <input id="prefilled" value="React"></label>
      <label>Portfolio password <input id="pw" type="password"></label>
    `;
  });

  afterEach(() => {
    dimensions.mockRestore();
    document.body.innerHTML = '';
  });

  it('asks only about uncovered, empty, non-sensitive questions and fills validated answers', async () => {
    const send = vi.fn(async (request: AiSuggestRequest) => {
      const byLabel = Object.fromEntries(request.fields.map((field) => [field.label, field.id]));
      return {
        ok: true as const,
        answers: {
          [byLabel['How many years of TypeScript experience do you have?']]: '4',
          [byLabel['What motivates you to apply here?']]: 'I enjoy building reliable developer tools.',
          [byLabel['Are you comfortable working in a hybrid environment?']]: 'Yes',
          [byLabel['Preferred team size']]: 'Small'
        }
      };
    });

    const report = await runAiAssist(document, send);

    expect(send).toHaveBeenCalledTimes(1);
    const request = send.mock.calls[0][0];
    expect(request.page).toMatchObject({ title: 'Software Engineer - Acme', heading: 'Software Engineer' });
    expect(request.fields.map((field) => field.label)).toEqual([
      'How many years of TypeScript experience do you have?',
      'What motivates you to apply here?',
      'Are you comfortable working in a hybrid environment?',
      'Preferred team size'
    ]);
    expect(request.fields[0]).toMatchObject({ kind: 'number', min: 0, max: 40 });
    expect(request.fields[1]).toMatchObject({ kind: 'textarea', maxLength: 500 });
    expect(request.fields[2]).toMatchObject({ kind: 'select', options: ['Yes', 'No'] });
    expect(request.fields[3]).toMatchObject({ kind: 'radio', options: ['Small', 'Large'] });

    expect(report).toEqual({ filled: 4 });
    expect(document.querySelector<HTMLInputElement>('#years')?.value).toBe('4');
    expect(document.querySelector<HTMLTextAreaElement>('#why')?.value).toBe('I enjoy building reliable developer tools.');
    expect(document.querySelector<HTMLSelectElement>('#hybrid')?.value).toBe('y');
    expect(document.querySelector<HTMLInputElement>('input[value="s"]')?.checked).toBe(true);
    expect(document.querySelector('#why')?.getAttribute('data-applyance-source')).toBe('ai');
    expect(document.querySelector('#why')?.getAttribute('data-applyance-highlight')).toBe('review');
    expect(document.querySelector<HTMLSelectElement>('#gender')?.value).toBe('');
    expect(document.querySelector<HTMLInputElement>('#prefilled')?.value).toBe('React');
  });

  it('does not overwrite a field the user filled while the agent was working', async () => {
    const send = vi.fn(async (request: AiSuggestRequest) => {
      document.querySelector<HTMLTextAreaElement>('#why')!.value = 'My own words';
      return { ok: true as const, answers: Object.fromEntries(request.fields.filter((field) => field.kind === 'textarea').map((field) => [field.id, 'Drafted'])) };
    });

    const report = await runAiAssist(document, send);

    expect(report.filled).toBe(0);
    expect(document.querySelector<HTMLTextAreaElement>('#why')?.value).toBe('My own words');
  });

  it('offers each field once and reports worker errors', async () => {
    const send = vi.fn(async () => ({ ok: false as const, error: 'Add an Anthropic API key in Applyance options to use AI assist.' }));

    expect(await runAiAssist(document, send)).toEqual({ filled: 0, error: 'Add an Anthropic API key in Applyance options to use AI assist.' });
    expect(await runAiAssist(document, send)).toEqual({ filled: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
