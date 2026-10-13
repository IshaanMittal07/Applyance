export const FIELD_SYNONYMS: Record<string, string[]> = {
  'personal.firstName': ['first name', 'given name', 'fname'],
  'personal.middleName': ['middle name', 'middle initial'],
  'personal.lastName': ['last name', 'family name', 'surname', 'lastname'],
  'personal.preferredName': ['preferred first name', 'preferred name', 'chosen name'],
  'personal.preferredMiddleName': ['preferred middle name'],
  'personal.preferredLastName': ['preferred last name'],
  'personal.email': ['email', 'email address', 'work email', 'e-mail'],
  'personal.phone': ['phone', 'phone number', 'mobile', 'cell phone', 'telephone'],
  'personal.phoneType': ['phone type', 'type of phone'],
  'personal.phoneCountryCode': ['country calling code', 'phone country code'],
  'personal.address.line1': ['address line 1', 'address line', 'street address', 'street name'],
  'personal.address.line2': ['address line 2', 'apartment', 'suite', 'unit number'],
  'personal.address.city': ['city', 'town'],
  'personal.address.stateOrProvince': ['state', 'province', 'region'],
  'personal.address.county': ['county', 'regional municipality'],
  'personal.address.postalCode': ['zip code', 'postal code', 'zipcode'],
  'personal.address.country': ['country'],
  'links.linkedin': ['linkedin', 'linked in'],
  'links.github': ['github', 'git hub'],
  'links.portfolio': ['portfolio', 'website', 'personal website'],
  'education.school': ['school name', 'university', 'college', 'institution'],
  'education.degree': ['degree', 'diploma', 'accreditation', 'select degree', 'degree type'],
  'education.fieldOfStudy': ['major', 'field of study', 'discipline'],
  'education.minor': ['minor'],
  'education.gpa': ['gpa', 'grade point average'],
  'education.startDate': ['education start date', 'school start date', 'date started'],
  'education.endDate': ['education end date', 'graduation date', 'school end date'],
  'education.currentlyEnrolled': ['currently enrolled', 'currently studying here'],
  'experience.company': ['company', 'employer', 'organization'],
  'experience.title': ['job title', 'position title', 'role', 'position'],
  'experience.location': ['work location', 'job location', 'employment location'],
  'experience.startDate': ['employment start date', 'job start date', 'work start date'],
  'experience.endDate': ['employment end date', 'job end date', 'work end date'],
  'experience.description': ['job description', 'experience summary', 'responsibilities', 'describe your duties'],
  'experience.current': ['currently work here', 'current job', 'currently employed here'],
  skills: ['skills', 'technical skills', 'list your skills'],
  'workdayAccount.registrationEmail': ['registration email', 'account email'],
  'workAuthorization.authorizedToWorkIn.United States': ['authorized to work in the us', 'authorized to work in the u s', 'authorized to work in the united states', 'legally authorized to work'],
  'workAuthorization.requiresSponsorshipIn.United States': ['require sponsorship', 'visa sponsorship', 'sponsorship for employment visa'],
  'workAuthorization.authorizedToWorkIn.Canada': ['authorized to work in canada'],
  'workAuthorization.requiresSponsorshipIn.Canada': ['sponsorship in canada', 'require a work permit in canada'],
  'applicationAnswers.locationAvailability': ['interested in and able to work at the location', 'able to work at this location', 'able to work at the listed location'],
  customAnswers: [
    'accepted an offer to work at fidelity',
    'family member currently employed at fidelity',
    'family members currently employed at fidelity',
    'family member s currently employed at fidelity',
    'worked for either pricewaterhousecoopers',
    'worked for pwc',
    'worked for deloitte',
    'agreements with current or former employers',
    'restrict you from working at fidelity'
  ],
  'eeo.disabilityStatus': ['do you have a disability', 'disability status'],
  'eeo.veteranStatus': ['are you a veteran', 'veteran status', 'veterans status'],
  'eeo.gender': ['gender', 'what is your gender', 'gender identity'],
  'eeo.lgbtqIdentity': ['identify as lgbtq', 'lgbtq identity'],
  'eeo.hispanicOrLatino': ['hispanic or latino', 'hispanic latino'],
  'eeo.raceEthnicity': ['race ethnicity', 'ethnicity race', 'ethnicity/race', 'identify your race', 'racial identity'],
  'eeo.sexualOrientation': ['sexual orientation'],
  'eeo.pronouns': ['pronouns', 'what are your pronouns'],
  'preferences.salaryExpectation': ['expected annual salary', 'salary expectation', 'desired salary'],
  'preferences.earliestStartDate': ['earliest start date', 'when can you start', 'available start date'],
  'preferences.additionalInformation': ['anything else we should know', 'additional information', 'additional comments']
};

export const NEGATIVE_PATTERNS: Record<string, string[]> = {
  'personal.firstName': ['emergency contact name', 'reference name', 'recruiter name', 'company name', 'manager name'],
  'personal.lastName': ['emergency contact last name', 'reference last name', 'company name'],
  'personal.address.line1': ['school address', 'billing address', 'shipping address', 'office address'],
  'personal.address.city': ['school city', 'company city'],
  'personal.phone': ['emergency contact phone', 'reference phone']
};

export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
