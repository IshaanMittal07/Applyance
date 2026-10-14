import { describe, expect, it } from 'vitest';
import { AiFieldRequest, buildProfileContext, buildUserPrompt, isSensitiveLabel, validateAiAnswers } from '../src/shared/ai-assist';
import { DEFAULT_PROFILE, Profile } from '../src/shared/profile-schema';

const profile: Profile = {
  ...DEFAULT_PROFILE,
  personal: {
    ...DEFAULT_PROFILE.personal,
    firstName: 'Ishaan',
    lastName: 'Mittal',
    email: 'ishaan@example.com',
    phone: '5550100',
    address: { ...DEFAULT_PROFILE.personal.address, line1: '1 Private Road', postalCode: 'A1A 1A1', city: 'Toronto', country: 'Canada' }
  },
  eeo: { ...DEFAULT_PROFILE.eeo, gender: 'Male' },
  preferences: { salaryExpectation: '120000', howDidYouHear: 'LinkedIn' },
  workdayAccount: { registrationEmail: 'ishaan@example.com', password: 'secret-password' },
  skills: ['TypeScript', 'Python'],
  customAnswers: [{ questionPattern: 'why this team', answer: 'I like building tools people rely on.' }]
};

describe('isSensitiveLabel', () => {
  it.each([
    'Gender', 'What is your race/ethnicity?', 'Are you a protected veteran?', 'Do you have a disability?',
    'Will you now or in the future require sponsorship?', 'Are you legally authorized to work in Canada?',
    'Expected salary', 'I certify that the information is true', 'I agree to the privacy policy',
    'Have you ever been convicted of a crime?', 'Date of birth', 'Social Security Number',
    'Do you have family members employed here?', 'Reference name', 'Signature', 'Have you previously worked for us?'
  ])('blocks %s', (label) => {
    expect(isSensitiveLabel(label)).toBe(true);
  });

  it.each([
    'How many years of experience do you have with Python?', 'Why do you want to work here?',
    'Do you have experience managing a team?', 'Which programming languages do you know?',
    'Describe a project you are proud of', 'Experience with drug discovery pipelines', 'Highest level of education completed'
  ])('allows %s', (label) => {
    expect(isSensitiveLabel(label)).toBe(false);
  });
});

describe('buildProfileContext', () => {
  it('never includes contact details, address, EEO, salary, or credentials', () => {
    const serialized = JSON.stringify(buildProfileContext(profile));
    for (const secret of ['ishaan@example.com', '5550100', '1 Private Road', 'A1A 1A1', 'Male', '120000', 'secret-password']) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain('Toronto');
    expect(serialized).toContain('TypeScript');
    expect(serialized).toContain('I like building tools people rely on.');
    expect(serialized).toContain('LinkedIn');
  });

  it('marks page content as data and includes the date for experience maths', () => {
    const prompt = buildUserPrompt(profile, [], { title: 'Engineer at Acme', heading: '', hostname: 'acme.com' }, new Date('2026-10-14T12:00:00Z'));
    expect(prompt).toContain("Today's date: 2026-10-14");
    expect(prompt).toContain('<page_context>');
    expect(prompt).not.toContain('secret-password');
  });
});

describe('validateAiAnswers', () => {
  const fields: AiFieldRequest[] = [
    { id: 'f0', label: 'Years of Python experience', kind: 'number', min: 0, max: 50 },
    { id: 'f1', label: 'Comfortable working hybrid?', kind: 'select', options: ['Yes', 'No'] },
    { id: 'f2', label: 'Short summary', kind: 'text', maxLength: 20 },
    { id: 'f3', label: 'Why this role?', kind: 'textarea' },
    { id: 'f4', label: 'Preferred work style', kind: 'radio', options: ['Remote', 'Hybrid', 'On-site'] }
  ];

  it('accepts grounded answers and returns options exactly as offered', () => {
    const accepted = validateAiAnswers({
      answers: [
        { id: 'f0', answer: '3', confidence: 'high', basis: 'roles' },
        { id: 'f1', answer: 'yes', confidence: 'medium', basis: 'preference' },
        { id: 'f3', answer: 'I build reliable tools.', confidence: 'medium', basis: 'experience' },
        { id: 'f4', answer: 'on site', confidence: 'high', basis: 'preference' }
      ]
    }, fields);
    expect(accepted).toEqual({ f0: '3', f1: 'Yes', f3: 'I build reliable tools.', f4: 'On-site' });
  });

  it('drops low confidence, abstentions, unknown ids, and duplicates', () => {
    const accepted = validateAiAnswers({
      answers: [
        { id: 'f0', answer: '4', confidence: 'low', basis: 'guess' },
        { id: 'f3', answer: '', confidence: 'high', basis: '' },
        { id: 'f9', answer: 'Yes', confidence: 'high', basis: '' },
        { id: 'f1', answer: 'No', confidence: 'high', basis: '' },
        { id: 'f1', answer: 'Yes', confidence: 'high', basis: '' }
      ]
    }, fields);
    expect(accepted).toEqual({ f1: 'No' });
  });

  it('rejects answers that do not fit the field', () => {
    const accepted = validateAiAnswers({
      answers: [
        { id: 'f0', answer: 'about 3 years', confidence: 'high', basis: '' },
        { id: 'f1', answer: 'Maybe', confidence: 'high', basis: '' },
        { id: 'f2', answer: 'This answer is far longer than twenty characters', confidence: 'high', basis: '' },
        { id: 'f3', answer: 'I admire [Company] culture', confidence: 'high', basis: '' }
      ]
    }, fields);
    expect(accepted).toEqual({});
  });

  it('rejects numbers outside the allowed range', () => {
    expect(validateAiAnswers({ answers: [{ id: 'f0', answer: '75', confidence: 'high', basis: '' }] }, fields)).toEqual({});
  });

  it('never accepts answers for sensitive questions', () => {
    const sensitive: AiFieldRequest[] = [{ id: 'f0', label: 'Gender', kind: 'select', options: ['Male', 'Female'] }];
    expect(validateAiAnswers({ answers: [{ id: 'f0', answer: 'Male', confidence: 'high', basis: '' }] }, sensitive)).toEqual({});
  });

  it('ignores malformed payloads', () => {
    expect(validateAiAnswers(null, fields)).toEqual({});
    expect(validateAiAnswers({ answers: 'nope' }, fields)).toEqual({});
    expect(validateAiAnswers({ answers: [null, { id: 'f0' }] }, fields)).toEqual({});
  });
});
