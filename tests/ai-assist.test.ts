import { describe, expect, it } from 'vitest';
import { buildResponseSchema, validateAiAnswers } from '../src/background/ai-schemas';
import { AiFieldRequest, buildApplicantContext, buildProfileContext, buildQuestionsPrompt, isSensitiveLabel } from '../src/shared/ai-assist';
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
    const prompt = buildQuestionsPrompt([], { title: 'Engineer at Acme', heading: '', hostname: 'acme.com' }, new Date('2026-10-14T12:00:00Z'));
    expect(prompt).toContain("Today's date: 2026-10-14");
    expect(prompt).toContain('<page_context>');
  });

  it('adds the global prompt to the applicant context and caps its length', () => {
    const context = buildApplicantContext(profile, '  Targeting backend roles; I prefer remote work.  ');
    expect(context).toContain('<applicant_guidance>\nTargeting backend roles; I prefer remote work.\n</applicant_guidance>');
    expect(context).not.toContain('secret-password');
    expect(buildApplicantContext(profile, '')).toContain('(none provided)');
    expect(buildApplicantContext(profile, 'x'.repeat(5000))).toContain(`<applicant_guidance>\n${'x'.repeat(4000)}\n</applicant_guidance>`);
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
  const abstain = { answer: '', confidence: 'low' };
  const reply = (slots: Record<string, { answer: string; confidence: string }>) => ({
    answers: Object.fromEntries(fields.map((field) => [field.id, { basis: '', ...(slots[field.id] ?? abstain) }]))
  });

  it('accepts grounded answers and returns options exactly as offered', () => {
    const accepted = validateAiAnswers(reply({
      f0: { answer: '3', confidence: 'high' },
      f1: { answer: 'yes', confidence: 'medium' },
      f3: { answer: 'I build reliable tools.', confidence: 'medium' },
      f4: { answer: 'on site', confidence: 'high' }
    }), fields);
    expect(accepted).toEqual({ f0: '3', f1: 'Yes', f3: 'I build reliable tools.', f4: 'On-site' });
  });

  it('drops low or unrecognised confidence and abstentions', () => {
    const accepted = validateAiAnswers(reply({
      f0: { answer: '4', confidence: 'low' },
      f1: { answer: 'No', confidence: 'certain' },
      f3: { answer: '', confidence: 'high' }
    }), fields);
    expect(accepted).toEqual({});
  });

  it('rejects answers that do not fit the field, one field at a time', () => {
    const accepted = validateAiAnswers(reply({
      f0: { answer: 'about 3 years', confidence: 'high' },
      f1: { answer: 'Maybe', confidence: 'high' },
      f2: { answer: 'This answer is far longer than twenty characters', confidence: 'high' },
      f3: { answer: 'I admire [Company] culture', confidence: 'high' },
      f4: { answer: 'Hybrid', confidence: 'high' }
    }), fields);
    expect(accepted).toEqual({ f4: 'Hybrid' });
  });

  it('rejects numbers outside the allowed range', () => {
    expect(validateAiAnswers(reply({ f0: { answer: '75', confidence: 'high' } }), fields)).toEqual({});
    expect(validateAiAnswers(reply({ f0: { answer: '-1', confidence: 'high' } }), fields)).toEqual({});
  });

  it('never accepts answers for sensitive questions', () => {
    const sensitive: AiFieldRequest[] = [{ id: 'f0', label: 'Gender', kind: 'select', options: ['Male', 'Female'] }];
    expect(validateAiAnswers({ answers: { f0: { answer: 'Male', confidence: 'high', basis: '' } } }, sensitive)).toEqual({});
  });

  it('rejects replies that do not match the response schema', () => {
    expect(validateAiAnswers(null, fields)).toEqual({});
    expect(validateAiAnswers({ answers: [] }, fields)).toEqual({});
    expect(validateAiAnswers({ answers: { f0: { answer: '3', confidence: 'high', basis: '' } } }, fields)).toEqual({});
  });
});

describe('buildResponseSchema', () => {
  it('gives every question its own required slot and describes its options', async () => {
    const { betaZodOutputFormat } = await import('@anthropic-ai/sdk/helpers/beta/zod');
    const fields: AiFieldRequest[] = [
      { id: 'f0', label: 'Hybrid?', kind: 'select', options: ['Yes', 'No'] },
      { id: 'f1', label: 'Years?', kind: 'number', min: 0 }
    ];
    const schema = betaZodOutputFormat(buildResponseSchema(fields)).schema as {
      properties: { answers: { required: string[]; additionalProperties: boolean; properties: Record<string, { required: string[]; properties: { answer: { description: string } } }> } };
    };
    const answers = schema.properties.answers;
    expect(answers.required).toEqual(['f0', 'f1']);
    expect(answers.additionalProperties).toBe(false);
    expect(answers.properties.f0.required).toEqual(['answer', 'confidence', 'basis']);
    expect(answers.properties.f0.properties.answer.description).toContain('"Yes", "No"');
    expect(answers.properties.f1.properties.answer.description).toContain('At least 0.');
    expect(JSON.stringify(schema)).not.toContain('$ref');
  });
});
