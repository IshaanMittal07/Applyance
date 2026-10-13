export interface Address {
  line1: string;
  line2?: string;
  city: string;
  stateOrProvince: string;
  county?: string;
  postalCode: string;
  country: string;
}

export interface PersonalInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  preferredMiddleName?: string;
  preferredLastName?: string;
  pronouns?: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  phoneType?: 'Mobile' | 'Home' | 'Work';
  address: Address;
}

export interface LinkRecord {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  other?: string[];
}

export interface EducationRecord {
  school: string;
  degree: string;
  accreditation?: string;
  fieldOfStudy: string;
  minor?: string;
  gpa?: string;
  gpaScale?: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  startDate?: string;
  endDate?: string;
  currentlyEnrolled: boolean;
}

export interface ExperienceRecord {
  company: string;
  title: string;
  location?: string;
  startMonth: string;
  startYear: string;
  endMonth?: string;
  endYear?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  description: string;
}

export interface LanguageRecord {
  language: string;
  proficiency: string;
}

export interface WorkAuthorization {
  authorizedToWorkIn: Record<string, string>;
  requiresSponsorshipIn: Record<string, string>;
  citizenship?: string[];
  currentVisaStatus?: string;
  willingToRelocate?: boolean;
}

export interface EeoProfile {
  gender: string;
  pronouns?: string;
  hispanicOrLatino: string;
  raceEthnicity: string;
  veteranStatus: string;
  disabilityStatus: string;
  lgbtqIdentity?: string;
  sexualOrientation?: string;
  transgender?: string;
}

export interface Preferences {
  howDidYouHear?: string;
  earliestStartDate?: string;
  salaryExpectation?: string;
  noticePeriod?: string;
  additionalInformation?: string;
}

export interface WorkdayAccount {
  registrationEmail: string;
  password: string;
}

export interface CustomAnswer {
  questionPattern: string;
  answer: string;
}

export interface Documents {
  resumeFileId?: string;
  coverLetterFileId?: string;
}

export interface Profile {
  schemaVersion: number;
  personal: PersonalInfo;
  links: LinkRecord;
  education: EducationRecord[];
  experience: ExperienceRecord[];
  skills: string[];
  languages?: LanguageRecord[];
  workAuthorization: WorkAuthorization;
  eeo: EeoProfile;
  preferences: Preferences;
  customAnswers: CustomAnswer[];
  documents: Documents;
  workdayAccount: WorkdayAccount;
}

export const DEFAULT_EEO: EeoProfile = {
  gender: '',
  hispanicOrLatino: '',
  raceEthnicity: '',
  veteranStatus: '',
  disabilityStatus: '',
  lgbtqIdentity: '',
  sexualOrientation: '',
  transgender: ''
};

export const DEFAULT_PROFILE: Profile = {
  schemaVersion: 2,
  personal: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    phoneCountryCode: '+1',
    address: {
      line1: '',
      line2: '',
      city: '',
      stateOrProvince: '',
      county: '',
      postalCode: '',
      country: ''
    }
  },
  links: {
    linkedin: '',
    github: '',
    portfolio: '',
    other: []
  },
  education: [],
  experience: [],
  skills: [],
  languages: [],
  workAuthorization: {
    authorizedToWorkIn: {
      'United States': '',
      Canada: ''
    },
    requiresSponsorshipIn: {
      'United States': '',
      Canada: ''
    }
  },
  eeo: DEFAULT_EEO,
  preferences: {},
  customAnswers: [],
  documents: {},
  workdayAccount: {
    registrationEmail: '',
    password: ''
  }
};

type ProfileMigrationInput = Omit<Partial<Profile>, 'workAuthorization'> & {
  workAuthorization?: Omit<Partial<WorkAuthorization>, 'authorizedToWorkIn' | 'requiresSponsorshipIn'> & {
    authorizedToWorkIn?: Record<string, string | boolean>;
    requiresSponsorshipIn?: Record<string, string | boolean>;
  };
};

function migrateAnswerMap(defaults: Record<string, string>, values?: Record<string, unknown>): Record<string, string> {
  const answers = { ...defaults };
  for (const [country, answer] of Object.entries(values ?? {})) {
    answers[country] = typeof answer === 'boolean' ? (answer ? 'Yes' : '') : typeof answer === 'string' ? answer : '';
  }
  return answers;
}

function legacyMonthDate(month?: string, year?: string): string {
  if (!year) {
    return '';
  }
  const monthNumber = month ? String(new Date(`${month} 1, ${year}`).getMonth() + 1).padStart(2, '0') : '01';
  return `${year}-${monthNumber}`;
}

export function migrateProfile(value: ProfileMigrationInput | null | undefined): Profile {
  const base: Profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  if (!value) {
    return base;
  }

  const merged: Profile = {
    ...base,
    ...value,
    schemaVersion: 2,
    personal: {
      ...base.personal,
      ...value.personal,
      address: {
        ...base.personal.address,
        ...value.personal?.address
      }
    },
    links: {
      ...base.links,
      ...value.links,
      other: value.links?.other ?? base.links.other
    },
    workAuthorization: {
      ...base.workAuthorization,
      ...value.workAuthorization,
      authorizedToWorkIn: migrateAnswerMap(base.workAuthorization.authorizedToWorkIn, value.workAuthorization?.authorizedToWorkIn as Record<string, unknown> | undefined),
      requiresSponsorshipIn: migrateAnswerMap(base.workAuthorization.requiresSponsorshipIn, value.workAuthorization?.requiresSponsorshipIn as Record<string, unknown> | undefined)
    },
    eeo: {
      ...base.eeo,
      ...value.eeo
    },
    preferences: {
      ...base.preferences,
      ...value.preferences
    },
    documents: {
      ...base.documents,
      ...value.documents
    },
    workdayAccount: {
      ...base.workdayAccount,
      ...value.workdayAccount
    },
    education: (value.education ?? base.education).map((entry) => ({
      ...entry,
      accreditation: entry.accreditation ?? entry.degree,
      startDate: entry.startDate ?? legacyMonthDate(entry.startMonth, entry.startYear),
      endDate: entry.endDate ?? legacyMonthDate(entry.endMonth, entry.endYear)
    })),
    experience: (value.experience ?? base.experience).map((entry) => ({
      ...entry,
      startDate: entry.startDate ?? legacyMonthDate(entry.startMonth, entry.startYear),
      endDate: entry.endDate ?? legacyMonthDate(entry.endMonth, entry.endYear)
    })),
    skills: value.skills ?? base.skills,
    languages: value.languages ?? base.languages,
    customAnswers: value.customAnswers ?? base.customAnswers
  };

  return merged;
}

export function isProfileComplete(profile: Partial<Profile> | null | undefined): boolean {
  const candidate = migrateProfile(profile);
  return Boolean(
    candidate.personal.firstName.trim() &&
      candidate.personal.lastName.trim() &&
      candidate.personal.email.trim() &&
      candidate.personal.phone.trim()
  );
}
