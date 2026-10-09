export const FIELD_SYNONYMS: Record<string, string[]> = {
  'personal.firstName': ['first name', 'given name', 'fname', 'first'],
  'personal.lastName': ['last name', 'family name', 'surname', 'lastname'],
  'personal.email': ['email', 'email address', 'work email', 'e-mail'],
  'personal.phone': ['phone', 'phone number', 'mobile', 'cell phone', 'telephone'],
  'personal.address.city': ['city', 'town'],
  'personal.address.stateOrProvince': ['state', 'province', 'region'],
  'personal.address.postalCode': ['zip code', 'postal code', 'zipcode'],
  'personal.address.country': ['country'],
  'links.linkedin': ['linkedin', 'linked in'],
  'links.github': ['github', 'git hub'],
  'links.portfolio': ['portfolio', 'website', 'personal website'],
  'education.school': ['school', 'university', 'college', 'institution'],
  'education.degree': ['degree', 'diploma'],
  'education.fieldOfStudy': ['major', 'field of study', 'discipline'],
  'experience.company': ['company', 'employer', 'organization'],
  'experience.title': ['title', 'role', 'position', 'job title']
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
