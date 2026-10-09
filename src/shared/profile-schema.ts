export interface Address {
  line1: string;
  line2?: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
}

export interface PersonalInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
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
  fieldOfStudy: string;
  minor?: string;
  gpa?: string;
  gpaScale?: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
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
  current: boolean;
  description: string;
}

export interface LanguageRecord {
  language: string;
  proficiency: string;
}

export interface WorkAuthorization {
  authorizedToWorkIn: Record<string, boolean>;
  requiresSponsorshipIn: Record<string, boolean>;
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
  sexualOrientation?: string;
  transgender?: string;
}

export interface Preferences {
  howDidYouHear?: string;
  earliestStartDate?: string;
  salaryExpectation?: string;
  noticePeriod?: string;
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
}

export const DEFAULT_EEO: EeoProfile = {
  gender: 'Decline to answer',
  hispanicOrLatino: 'Decline to answer',
  raceEthnicity: 'Decline to answer',
  veteranStatus: 'Decline to answer',
  disabilityStatus: 'Decline to answer'
};

export const DEFAULT_PROFILE: Profile = {
  schemaVersion: 1,
  personal: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    phoneCountryCode: '+1',
    address: {
      line1: '',
      city: '',
      stateOrProvince: '',
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
      'United States': false,
      Canada: false
    },
    requiresSponsorshipIn: {
      'United States': false,
      Canada: false
    }
  },
  eeo: DEFAULT_EEO,
  preferences: {},
  customAnswers: [],
  documents: {}
};

export function migrateProfile(value: Partial<Profile> | null | undefined): Profile {
  const base: Profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  if (!value) {
    return base;
  }

  const merged: Profile = {
    ...base,
    ...value,
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
      authorizedToWorkIn: { ...base.workAuthorization.authorizedToWorkIn, ...value.workAuthorization?.authorizedToWorkIn },
      requiresSponsorshipIn: { ...base.workAuthorization.requiresSponsorshipIn, ...value.workAuthorization?.requiresSponsorshipIn }
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
    education: value.education ?? base.education,
    experience: value.experience ?? base.experience,
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
