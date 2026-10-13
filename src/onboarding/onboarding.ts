import { DEFAULT_PROFILE, EducationRecord, ExperienceRecord, Profile, migrateProfile } from '../shared/profile-schema';
import { extractResumeText } from '../shared/resume-reader';
import { parseResumeText, ResumeSuggestions } from '../shared/resume-text-parser';
import { getProfileComplete, loadDraft, loadProfile, saveDraft, saveProfile, setProfileComplete } from '../shared/storage';

type WizardStep = {
  title: string;
  description: string;
  render: (profile: Profile) => string;
  collect: (profile: Profile) => void;
};

const root = document.querySelector<HTMLElement>('#app');
const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);

function field(label: string, name: string, value = '', type = 'text', hint = '', autocomplete = ''): string {
  return `<label class="field"><span>${label}</span><input data-field="${escapeHtml(name)}" name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${hint ? `placeholder="${escapeHtml(hint)}"` : ''}></label>`;
}

function selectField(label: string, name: string, value: string, options: string[], autocomplete = ''): string {
  return `<label class="field"><span>${label}</span><select data-field="${escapeHtml(name)}" name="${escapeHtml(name)}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''}><option value="">Choose an answer</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
}

const OTHER_LOCATION = '__other__';
const otherLocationFields = new Set<string>();
const COUNTRY_OPTIONS = ['Australia', 'Canada', 'France', 'Germany', 'India', 'Ireland', 'Italy', 'Japan', 'Mexico', 'Netherlands', 'New Zealand', 'Singapore', 'South Africa', 'Spain', 'Sweden', 'Switzerland', 'United Arab Emirates', 'United Kingdom', 'United States'];
const REGION_OPTIONS: Record<string, string[]> = {
  Canada: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'],
  'United States': ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']
};
const REGION_CHOICES = Array.from(new Set(Object.values(REGION_OPTIONS).flat())).sort();
const CITY_OPTIONS: Record<string, string[]> = {
  Canada: ['Brampton', 'Calgary', 'Edmonton', 'Halifax', 'Hamilton', 'Kitchener', 'London', 'Markham', 'Milton', 'Mississauga', 'Montreal', 'Ottawa', 'Quebec City', 'Regina', 'Saskatoon', 'Surrey', 'Toronto', 'Vancouver', 'Victoria', 'Waterloo', 'Windsor', 'Winnipeg'],
  'United States': ['Atlanta', 'Austin', 'Baltimore', 'Boston', 'Charlotte', 'Chicago', 'Columbus', 'Dallas', 'Denver', 'Detroit', 'Honolulu', 'Houston', 'Indianapolis', 'Jacksonville', 'Las Vegas', 'Los Angeles', 'Miami', 'Minneapolis', 'Nashville', 'New York City', 'Philadelphia', 'Phoenix', 'Pittsburgh', 'Portland', 'Raleigh', 'Sacramento', 'San Antonio', 'San Diego', 'San Francisco', 'San Jose', 'Seattle', 'Tampa', 'Washington']
};
const CITY_CHOICES = Array.from(new Set(Object.values(CITY_OPTIONS).flat())).sort();

function locationField(label: string, name: string, value: string, options: string[], autocomplete: string): string {
  const useOther = otherLocationFields.has(name) || Boolean(value && !options.includes(value));
  if (useOther) otherLocationFields.add(name);
  const choice = useOther ? OTHER_LOCATION : value;
  return `<label class="field"><span>${label}</span><select data-location-select="${escapeHtml(name)}" name="${escapeHtml(name)}" autocomplete="${autocomplete}"><option value="">Choose ${escapeHtml(label.toLowerCase())}</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${choice === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}<option value="${OTHER_LOCATION}" ${choice === OTHER_LOCATION ? 'selected' : ''}>Other / enter manually</option></select><input data-field="${escapeHtml(name)}.other" data-location-other="${escapeHtml(name)}" name="${escapeHtml(name)}-other" value="${escapeHtml(useOther ? value : '')}" placeholder="Enter ${escapeHtml(label.toLowerCase())}" ${useOther ? '' : 'hidden'}></label>`;
}

function textareaField(label: string, name: string, value = '', hint = ''): string {
  return `<label class="field field-wide"><span>${label}</span><textarea data-field="${escapeHtml(name)}" rows="4" ${hint ? `placeholder="${escapeHtml(hint)}"` : ''}>${escapeHtml(value)}</textarea></label>`;
}

function checkboxField(label: string, name: string, checked: boolean): string {
  return `<label class="check-field"><input data-field="${escapeHtml(name)}" type="checkbox" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
}

function readValue(name: string): string {
  const element = root?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-field="${name}"]`);
  return element?.value.trim() ?? '';
}

function readLocation(name: string): string {
  const choice = root?.querySelector<HTMLSelectElement>(`[data-location-select="${name}"]`)?.value ?? '';
  return choice === OTHER_LOCATION ? readValue(`${name}.other`) : choice;
}

function readRecordValue(record: Element, name: string): string {
  return record.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-field="${name}"]`)?.value.trim() ?? '';
}

function blankEducation(): EducationRecord {
  return { school: '', degree: '', fieldOfStudy: '', currentlyEnrolled: false };
}

function blankExperience(): ExperienceRecord {
  return { company: '', title: '', startMonth: '', startYear: '', current: false, description: '' };
}

function mergeResumeSuggestions(profile: Profile, suggestions: ResumeSuggestions): { fields: number; skills: number; education: number; experience: number } {
  let fields = 0;
  for (const key of ['firstName', 'middleName', 'lastName', 'email', 'phone'] as const) {
    const value = suggestions.personal[key]?.trim();
    if (value && !profile.personal[key]?.trim()) {
      profile.personal[key] = value;
      fields += 1;
    }
  }
  for (const key of ['linkedin', 'github', 'portfolio'] as const) {
    const value = suggestions.links[key]?.trim();
    if (value && !profile.links[key]?.trim()) {
      profile.links[key] = value;
      fields += 1;
    }
  }

  const existingSkills = new Set(profile.skills.map((skill) => skill.toLowerCase()));
  const newSkills = suggestions.skills.filter((skill) => !existingSkills.has(skill.toLowerCase()));
  profile.skills = [...profile.skills, ...newSkills];

  const newEducation = suggestions.education.filter((entry) => !profile.education.some((existing) =>
    existing.school.toLowerCase() === entry.school.toLowerCase() && existing.startDate === entry.startDate
  ));
  profile.education.push(...newEducation);

  const newExperience = suggestions.experience.filter((entry) => !profile.experience.some((existing) =>
    existing.company.toLowerCase() === entry.company.toLowerCase() && existing.title.toLowerCase() === entry.title.toLowerCase() && existing.startYear === entry.startYear
  ));
  profile.experience.push(...newExperience);

  return { fields, skills: newSkills.length, education: newEducation.length, experience: newExperience.length };
}

function renderEducation(entries: EducationRecord[]): string {
  const records = entries.length ? entries : [blankEducation()];
  return `${records.map((entry, index) => `
    <article class="record" data-record="education">
      <div class="record-heading"><h3>Education ${index + 1}</h3><button class="icon-button" type="button" data-remove="education" data-index="${index}" aria-label="Remove education ${index + 1}" title="Remove">×</button></div>
      <div class="field-grid">
        ${field('School name', 'school', entry.school)}
        ${field('Degree / accreditation', 'accreditation', entry.accreditation ?? entry.degree)}
        ${field('Field of study', 'fieldOfStudy', entry.fieldOfStudy)}
        ${field('Minor', 'minor', entry.minor ?? '')}
        ${field('GPA', 'gpa', entry.gpa ?? '')}
        ${field('Start date', 'startDate', entry.startDate ?? '', 'month')}
        ${field('End date', 'endDate', entry.endDate ?? '', 'month')}
        ${checkboxField('I currently study here', 'currentlyEnrolled', entry.currentlyEnrolled)}
      </div>
    </article>`).join('')}
    <button class="text-button" type="button" data-add="education">+ Add education</button>`;
}

function renderExperience(entries: ExperienceRecord[]): string {
  const records = entries.length ? entries : [blankExperience()];
  return `${records.map((entry, index) => `
    <article class="record" data-record="experience">
      <div class="record-heading"><h3>Work experience ${index + 1}</h3><button class="icon-button" type="button" data-remove="experience" data-index="${index}" aria-label="Remove work experience ${index + 1}" title="Remove">×</button></div>
      <div class="field-grid">
        ${field('Company', 'company', entry.company)}
        ${field('Job title', 'title', entry.title)}
        ${field('Location', 'location', entry.location ?? '')}
        ${field('Start date', 'startDate', entry.startDate ?? (entry.startYear ? `${entry.startYear}-${String(new Date(`${entry.startMonth} 1, ${entry.startYear}`).getMonth() + 1).padStart(2, '0')}` : ''), 'month')}
        ${field('End date', 'endDate', entry.endDate ?? (entry.endYear && entry.endMonth ? `${entry.endYear}-${String(new Date(`${entry.endMonth} 1, ${entry.endYear}`).getMonth() + 1).padStart(2, '0')}` : ''), 'month')}
        ${checkboxField('I currently work here', 'current', entry.current)}
        ${textareaField('Experience summary / job description', 'description', entry.description, 'Enter one achievement or responsibility per line')}
      </div>
    </article>`).join('')}
    <button class="text-button" type="button" data-add="experience">+ Add work experience</button>`;
}

function renderCustomAnswers(profile: Profile): string {
  return `${profile.customAnswers.map((answer, index) => `
    <article class="record compact-record" data-record="custom-answer">
      <div class="record-heading"><h3>Custom answer ${index + 1}</h3><button class="icon-button" type="button" data-remove="custom-answer" data-index="${index}" aria-label="Remove custom answer ${index + 1}" title="Remove">×</button></div>
      <div class="field-grid">
        ${field('Question or label contains', 'questionPattern', answer.questionPattern, 'text', 'e.g. willing to relocate')}
        ${field('Answer', 'answer', answer.answer)}
      </div>
    </article>`).join('')}
    <button class="text-button" type="button" data-add="custom-answer">+ Add a custom answer</button>`;
}

const steps: WizardStep[] = [
  {
    title: 'Import your resume',
    description: 'Optionally extract details from a PDF, Word document, or text resume. The file is read locally and is not saved or uploaded.',
    render: () => `<div class="section-block"><label class="field field-wide"><span>Resume file</span><input id="resume-file" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"></label>
      <p class="notice">Recognized contact details, links, skills, education, and work history are added only where possible. Review and correct everything in the next steps. Scanned image PDFs are not supported.</p>
      <div id="resume-import-status" class="notice" role="status" hidden></div></div>`,
    collect: () => undefined
  },
  {
    title: 'Personal details',
    description: 'Add the contact details you want to use on applications.',
    render: (profile) => `
      <div class="section-block"><h3>Name and contact</h3><div class="field-grid">
        ${field('First name *', 'firstName', profile.personal.firstName, 'text', '', 'given-name')}
        ${field('Middle name', 'middleName', profile.personal.middleName ?? '', 'text', '', 'additional-name')}
        ${field('Last name *', 'lastName', profile.personal.lastName, 'text', '', 'family-name')}
        ${field('Preferred first name', 'preferredName', profile.personal.preferredName ?? '')}
        ${field('Preferred middle name', 'preferredMiddleName', profile.personal.preferredMiddleName ?? '')}
        ${field('Preferred last name', 'preferredLastName', profile.personal.preferredLastName ?? '')}
        ${field('Email address *', 'email', profile.personal.email, 'email', '', 'email')}
        ${selectField('Phone type', 'phoneType', profile.personal.phoneType ?? '', ['Mobile', 'Home', 'Work'])}
        ${field('Phone *', 'phone', profile.personal.phone, 'tel', '', 'tel')}
        ${field('Country calling code', 'phoneCountryCode', profile.personal.phoneCountryCode, 'text', 'e.g. +1')}
        ${selectField('Pronouns', 'pronouns', profile.personal.pronouns ?? '', ['She/her', 'He/him', 'They/them', 'Use my name', 'Decline to answer'])}
      </div></div>
      <div class="section-block"><h3>Address</h3><div class="field-grid">
        ${field('Address line', 'address.line1', profile.personal.address.line1, 'text', '', 'address-line1')}
        ${field('Apartment / unit', 'address.line2', profile.personal.address.line2 ?? '', 'text', '', 'address-line2')}
        ${locationField('Country', 'address.country', profile.personal.address.country, COUNTRY_OPTIONS, 'country-name')}
        ${locationField('State / province', 'address.stateOrProvince', profile.personal.address.stateOrProvince, REGION_CHOICES, 'address-level1')}
        ${locationField('City', 'address.city', profile.personal.address.city, CITY_CHOICES, 'address-level2')}
        ${field('County / region', 'address.county', profile.personal.address.county ?? '', 'text', '', 'address-level3')}
        ${field('Postal code', 'address.postalCode', profile.personal.address.postalCode, 'text', '', 'postal-code')}
      </div></div>
      <div class="section-block"><h3>Online profiles</h3><div class="field-grid">
        ${field('LinkedIn URL', 'linkedin', profile.links.linkedin ?? '', 'url', '', 'url')}
        ${field('GitHub URL', 'github', profile.links.github ?? '', 'url', '', 'url')}
        ${field('Website / portfolio URL', 'portfolio', profile.links.portfolio ?? '', 'url', '', 'url')}
      </div></div>`,
    collect: (profile) => {
      profile.personal = {
        ...profile.personal,
        firstName: readValue('firstName'), middleName: readValue('middleName'), lastName: readValue('lastName'),
        preferredName: readValue('preferredName'), preferredMiddleName: readValue('preferredMiddleName'), preferredLastName: readValue('preferredLastName'),
        email: readValue('email'), phoneType: (readValue('phoneType') || undefined) as Profile['personal']['phoneType'],
        phone: readValue('phone'), phoneCountryCode: readValue('phoneCountryCode'), pronouns: readValue('pronouns'),
        address: {
          ...profile.personal.address, line1: readValue('address.line1'), line2: readValue('address.line2'),
          country: readLocation('address.country'), stateOrProvince: readLocation('address.stateOrProvince'), city: readLocation('address.city'),
          county: readValue('address.county'), postalCode: readValue('address.postalCode')
        }
      };
      profile.links = { ...profile.links, linkedin: readValue('linkedin'), github: readValue('github'), portfolio: readValue('portfolio') };
    }
  },
  {
    title: 'Education',
    description: 'Add each school or program you want Applyance to use.',
    render: (profile) => renderEducation(profile.education),
    collect: (profile) => {
      profile.education = Array.from(root?.querySelectorAll<HTMLElement>('[data-record="education"]') ?? []).map((record) => ({
        school: readRecordValue(record, 'school'), degree: readRecordValue(record, 'accreditation'), accreditation: readRecordValue(record, 'accreditation'),
        fieldOfStudy: readRecordValue(record, 'fieldOfStudy'), minor: readRecordValue(record, 'minor'), gpa: readRecordValue(record, 'gpa'),
        startDate: readRecordValue(record, 'startDate'), endDate: readRecordValue(record, 'endDate'), currentlyEnrolled: record.querySelector<HTMLInputElement>('[data-field="currentlyEnrolled"]')?.checked ?? false
      })).filter((entry) => entry.school || entry.degree || entry.fieldOfStudy || entry.minor || entry.gpa || entry.startDate || entry.endDate);
    }
  },
  {
    title: 'Work experience',
    description: 'Add roles in the order you would like them filled.',
    render: (profile) => renderExperience(profile.experience),
    collect: (profile) => {
      profile.experience = Array.from(root?.querySelectorAll<HTMLElement>('[data-record="experience"]') ?? []).map((record) => {
        const startDate = readRecordValue(record, 'startDate');
        const endDate = readRecordValue(record, 'endDate');
        const [startYear = '', startMonth = ''] = startDate.split('-');
        const [endYear = '', endMonth = ''] = endDate.split('-');
        return {
          company: readRecordValue(record, 'company'), title: readRecordValue(record, 'title'), location: readRecordValue(record, 'location'),
          startDate, endDate, startYear, startMonth, endYear, endMonth,
          current: record.querySelector<HTMLInputElement>('[data-field="current"]')?.checked ?? false,
          description: readRecordValue(record, 'description')
        };
      }).filter((entry) => entry.company || entry.title || entry.location || entry.description || entry.startDate || entry.endDate);
    }
  },
  {
    title: 'Skills',
    description: 'List skills, tools, technologies, and platforms you want to reuse.',
    render: (profile) => `<div class="section-block"><div class="field-grid">${textareaField('Skills and tools', 'skills', profile.skills.join('\n'), 'One item per line, or separate items with commas')}</div></div>`,
    collect: (profile) => { profile.skills = readValue('skills').split(/[\n,]/).map((skill) => skill.trim()).filter(Boolean); }
  },
  {
    title: 'Work authorization',
    description: 'These answers are optional. Leave a question blank if you do not want it autofilled.',
    render: (profile) => `<div class="section-block"><h3>United States</h3><div class="field-grid">
      ${selectField('Are you authorized to work in the U.S.?', 'authorizedToWorkIn.United States', profile.workAuthorization.authorizedToWorkIn['United States'] ?? '', ['Yes', 'No', 'Not sure', 'Decline to answer'])}
      ${selectField('Will you now or in the future require employment visa sponsorship in the U.S.?', 'requiresSponsorshipIn.United States', profile.workAuthorization.requiresSponsorshipIn['United States'] ?? '', ['Yes', 'No', 'Not sure', 'Decline to answer'])}
      ${selectField('Are you authorized to work in Canada?', 'authorizedToWorkIn.Canada', profile.workAuthorization.authorizedToWorkIn.Canada ?? '', ['Yes', 'No', 'Not sure', 'Decline to answer'])}
      ${selectField('Will you require employment visa sponsorship in Canada?', 'requiresSponsorshipIn.Canada', profile.workAuthorization.requiresSponsorshipIn.Canada ?? '', ['Yes', 'No', 'Not sure', 'Decline to answer'])}
      ${field('Current visa status (optional)', 'currentVisaStatus', profile.workAuthorization.currentVisaStatus ?? '')}
      ${field('Citizenship(s), optional', 'citizenship', (profile.workAuthorization.citizenship ?? []).join(', '), 'Separate multiple countries with commas')}
      ${selectField('Willing to relocate?', 'willingToRelocate', profile.workAuthorization.willingToRelocate === undefined ? '' : profile.workAuthorization.willingToRelocate ? 'Yes' : 'No', ['Yes', 'No', 'Decline to answer'])}
    </div></div>`,
    collect: (profile) => {
      profile.workAuthorization = {
        ...profile.workAuthorization,
        authorizedToWorkIn: { ...profile.workAuthorization.authorizedToWorkIn, 'United States': readValue('authorizedToWorkIn.United States'), Canada: readValue('authorizedToWorkIn.Canada') },
        requiresSponsorshipIn: { ...profile.workAuthorization.requiresSponsorshipIn, 'United States': readValue('requiresSponsorshipIn.United States'), Canada: readValue('requiresSponsorshipIn.Canada') },
        currentVisaStatus: readValue('currentVisaStatus'), citizenship: readValue('citizenship').split(',').map((item) => item.trim()).filter(Boolean),
        willingToRelocate: readValue('willingToRelocate') === 'Yes' ? true : readValue('willingToRelocate') === 'No' ? false : undefined
      };
    }
  },
  {
    title: 'Voluntary self-identification',
    description: 'These sensitive questions are optional. Answer only what you choose; unanswered fields stay blank.',
    render: (profile) => `<div class="notice">You can leave any of these blank or choose “Decline to answer.” Review every answer before submitting an application.</div>
      <div class="section-block"><div class="field-grid">
        ${selectField('Gender', 'eeo.gender', profile.eeo.gender, ['Female', 'Male', 'Non-binary', 'Self-describe', 'Decline to answer'])}
        ${selectField('Are you Hispanic or Latino?', 'eeo.hispanicOrLatino', profile.eeo.hispanicOrLatino, ['Yes', 'No', 'Decline to answer'])}
        ${selectField('Race / ethnicity', 'eeo.raceEthnicity', profile.eeo.raceEthnicity, ['American Indian or Alaska Native', 'Asian', 'Black or African American', 'Native Hawaiian or Pacific Islander', 'White', 'Two or more races', 'Other', 'Decline to answer'])}
        ${selectField('Do you identify as LGBTQ+?', 'eeo.lgbtqIdentity', profile.eeo.lgbtqIdentity ?? '', ['Yes', 'No', 'Decline to answer'])}
        ${selectField('Sexual orientation', 'eeo.sexualOrientation', profile.eeo.sexualOrientation ?? '', ['Straight / heterosexual', 'Gay or lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Queer', 'Self-describe', 'Decline to answer'])}
        ${selectField('Do you identify as transgender?', 'eeo.transgender', profile.eeo.transgender ?? '', ['Yes', 'No', 'Decline to answer'])}
        ${selectField('Do you have a disability?', 'eeo.disabilityStatus', profile.eeo.disabilityStatus, ['Yes', 'No', 'Decline to answer'])}
        ${selectField('Are you a veteran?', 'eeo.veteranStatus', profile.eeo.veteranStatus, ['Yes', 'No', 'Decline to answer'])}
        ${field('Pronouns (optional)', 'eeo.pronouns', profile.eeo.pronouns ?? '', 'text', 'e.g. they/them')}
      </div></div>`,
    collect: (profile) => {
      profile.eeo = {
        ...profile.eeo, gender: readValue('eeo.gender'), hispanicOrLatino: readValue('eeo.hispanicOrLatino'),
        raceEthnicity: readValue('eeo.raceEthnicity'), lgbtqIdentity: readValue('eeo.lgbtqIdentity'),
        sexualOrientation: readValue('eeo.sexualOrientation'), transgender: readValue('eeo.transgender'),
        disabilityStatus: readValue('eeo.disabilityStatus'), veteranStatus: readValue('eeo.veteranStatus'), pronouns: readValue('eeo.pronouns')
      };
    }
  },
  {
    title: 'Preferences and custom answers',
    description: 'Set the details you often enter, plus reusable answers to other application questions.',
    render: (profile) => `<div class="section-block"><h3>Application preferences</h3><div class="field-grid">
      ${field('Expected annual salary', 'salaryExpectation', profile.preferences.salaryExpectation ?? '', 'text', 'e.g. 35-40 or 85000')}
      ${field('Earliest start date', 'earliestStartDate', profile.preferences.earliestStartDate ?? '', 'date')}
      ${field('Notice period', 'noticePeriod', profile.preferences.noticePeriod ?? '')}
      ${textareaField('Anything else an employer should know?', 'additionalInformation', profile.preferences.additionalInformation ?? '')}
    </div></div>
      <div class="section-block"><h3>Reusable answers</h3><p class="muted">Applyance uses these only when a question label contains the matching phrase.</p>${renderCustomAnswers(profile)}</div>`,
    collect: (profile) => {
      profile.preferences = { ...profile.preferences, salaryExpectation: readValue('salaryExpectation'), earliestStartDate: readValue('earliestStartDate'), noticePeriod: readValue('noticePeriod'), additionalInformation: readValue('additionalInformation') };
      profile.customAnswers = Array.from(root?.querySelectorAll<HTMLElement>('[data-record="custom-answer"]') ?? []).map((record) => ({ questionPattern: readRecordValue(record, 'questionPattern'), answer: readRecordValue(record, 'answer') })).filter((answer) => answer.questionPattern && answer.answer);
    }
  },
  {
    title: 'Workday registration',
    description: 'Optionally save details for creating a Workday account. Applyance stores them on this device only.',
    render: (profile) => `<div class="section-block"><div class="field-grid">
      ${field('Registration email', 'registrationEmail', profile.workdayAccount.registrationEmail, 'email')}
      ${field('Password', 'workdayPassword', profile.workdayAccount.password, 'password')}
    </div><ul class="password-rules"><li>At least 12 characters</li><li>One uppercase and one lowercase letter</li><li>One number and one special character</li></ul>
      <p class="notice">The password is stored in Chrome local storage on this device. Applyance does not encrypt it or send it to a server. Do not use a password you use elsewhere.</p></div>`,
    collect: (profile) => {
      profile.workdayAccount = { registrationEmail: readValue('registrationEmail'), password: readValue('workdayPassword') };
    }
  },
  {
    title: 'Review and save',
    description: 'Check your profile before saving. You can edit any section later in Applyance options.',
    render: (profile) => `<div class="review-grid">
      <section class="review-card"><h3>Contact</h3><p>${escapeHtml([profile.personal.firstName, profile.personal.middleName, profile.personal.lastName].filter(Boolean).join(' '))}</p><p>${escapeHtml(profile.personal.email)}</p><p>${escapeHtml(profile.personal.phone)}</p><p>${escapeHtml([profile.personal.address.line1, profile.personal.address.city, profile.personal.address.stateOrProvince, profile.personal.address.postalCode, profile.personal.address.country].filter(Boolean).join(', '))}</p></section>
      <section class="review-card"><h3>Education and experience</h3><p>${profile.education.filter((entry) => entry.school).length} education entries</p><p>${profile.experience.filter((entry) => entry.company).length} work entries</p></section>
      <section class="review-card"><h3>Skills</h3><p>${escapeHtml(profile.skills.join(', ') || 'None added')}</p></section>
      <section class="review-card"><h3>Workday account</h3><p>${escapeHtml(profile.workdayAccount.registrationEmail || 'Not configured')}</p><p>${profile.workdayAccount.password ? 'Password saved locally' : 'No password saved'}</p></section>
    </div><p class="muted">Your profile is saved in Chrome on this device. Nothing is sent to an Applyance server.</p>`,
    collect: () => undefined
  }
];

async function buildInitialProfile(): Promise<Profile> {
  const [complete, draft, savedProfile] = await Promise.all([getProfileComplete(), loadDraft(), loadProfile()]);
  return migrateProfile(complete ? savedProfile : draft ?? savedProfile ?? DEFAULT_PROFILE);
}

async function renderWizard(): Promise<void> {
  if (!root) return;

  const profile = await buildInitialProfile();
  let stepIndex = 0;
  const collectCurrentStep = (): void => steps[stepIndex].collect(profile);

  const render = (): void => {
    const step = steps[stepIndex];
    const progress = ((stepIndex + 1) / steps.length) * 100;
    root.innerHTML = `
      <header class="wizard-header"><a class="brand" href="#" aria-label="Applyance setup home"><img class="brand-icon" src="icons/icon32.png" width="36" height="36" alt=""><span>Applyance</span></a><span class="step-count">STEP ${stepIndex + 1} OF ${steps.length}</span></header>
      <div class="progress-track" aria-label="Setup progress"><span style="width:${progress}%"></span></div>
      <form class="wizard-form" autocomplete="on"><section class="wizard-content"><p class="eyebrow">PROFILE SETUP</p><h1>${step.title}</h1><p class="step-description">${step.description}</p>
        <div class="validation-message" role="alert" hidden></div>
        ${step.render(profile)}
        <footer class="wizard-actions">${stepIndex > 0 ? '<button type="button" class="button button-secondary" data-action="back">Back</button>' : '<span></span>'}<button type="button" class="button button-primary" data-action="next">${stepIndex === steps.length - 1 ? 'Save profile' : 'Continue'}</button></footer>
      </section></form>`;

    root.querySelector<HTMLFormElement>('.wizard-form')?.addEventListener('submit', (event) => event.preventDefault());

    const resumeInput = root.querySelector<HTMLInputElement>('#resume-file');
    resumeInput?.addEventListener('change', async () => {
      const file = resumeInput.files?.[0];
      const status = root.querySelector<HTMLElement>('#resume-import-status');
      if (!file || !status) return;
      status.hidden = false;
      status.textContent = 'Reading the resume on this device…';
      status.classList.remove('resume-import-error');

      try {
        const text = await extractResumeText(file);
        const extracted = mergeResumeSuggestions(profile, parseResumeText(text));
        const categories = [
          extracted.fields ? `${extracted.fields} contact/link fields` : '',
          extracted.skills ? `${extracted.skills} skills` : '',
          extracted.education ? `${extracted.education} education entries` : '',
          extracted.experience ? `${extracted.experience} work entries` : ''
        ].filter(Boolean);
        if (!categories.length) {
          status.textContent = 'No recognizable details were found. Try a text-based PDF or DOCX, or continue and enter details manually.';
        } else {
          await saveDraft(profile);
          status.textContent = `Imported ${categories.join(', ')}. Continue to review and edit them.`;
        }
      } catch (error) {
        status.classList.add('resume-import-error');
        status.textContent = error instanceof Error ? error.message : 'The resume could not be read.';
      } finally {
        resumeInput.value = '';
      }
    });

    root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      collectCurrentStep();
      void saveDraft(profile);
      stepIndex -= 1;
      render();
    });

    root.querySelector('[data-action="next"]')?.addEventListener('click', async () => {
      const message = root.querySelector<HTMLElement>('.validation-message');
      const requiredPersonal = ['firstName', 'lastName', 'email', 'phone'];
      if (step.title === 'Personal details' && requiredPersonal.some((name) => !readValue(name))) {
        if (message) {
          message.hidden = false;
          message.textContent = 'Enter your first name, last name, email, and phone to continue.';
        }
        return;
      }
      if (step.title === 'Workday registration') {
        const password = readValue('workdayPassword');
        if (password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password)) {
          if (message) {
            message.hidden = false;
            message.textContent = 'Use at least 12 characters with uppercase, lowercase, a number, and a special character.';
          }
          return;
        }
      }

      collectCurrentStep();
      await saveDraft(profile);
      if (stepIndex === steps.length - 1) {
        await saveProfile(profile);
        await setProfileComplete(true);
        root.innerHTML = '<section class="completion"><span class="completion-check">✓</span><p class="eyebrow">PROFILE SAVED</p><h1>You are ready to apply.</h1><p>Your profile is saved locally. Review each application before submitting.</p><button type="button" class="button button-primary" data-action="close">Close setup</button></section>';
        root.querySelector('[data-action="close"]')?.addEventListener('click', () => window.close());
        return;
      }
      stepIndex += 1;
      render();
    });

    root.querySelectorAll<HTMLSelectElement>('[data-location-select]').forEach((select) => select.addEventListener('change', () => {
      const name = select.dataset.locationSelect ?? '';
      const fallback = select.parentElement?.querySelector<HTMLInputElement>(`[data-location-other="${name}"]`);
      const isOther = select.value === OTHER_LOCATION;
      if (isOther) otherLocationFields.add(name);
      else otherLocationFields.delete(name);
      if (fallback) fallback.hidden = !isOther;
    }));

    root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((button) => button.addEventListener('click', () => {
      collectCurrentStep();
      if (button.dataset.add === 'education') profile.education.push(blankEducation());
      if (button.dataset.add === 'experience') profile.experience.push(blankExperience());
      if (button.dataset.add === 'custom-answer') profile.customAnswers.push({ questionPattern: '', answer: '' });
      render();
    }));

    root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((button) => button.addEventListener('click', () => {
      collectCurrentStep();
      const index = Number(button.dataset.index);
      if (button.dataset.remove === 'education') profile.education.splice(index, 1);
      if (button.dataset.remove === 'experience') profile.experience.splice(index, 1);
      if (button.dataset.remove === 'custom-answer') profile.customAnswers.splice(index, 1);
      render();
    }));
  };

  render();
}

void renderWizard();
