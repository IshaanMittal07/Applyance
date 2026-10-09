import { DEFAULT_PROFILE, Profile, isProfileComplete, migrateProfile } from './profile-schema';

export const STORAGE_KEYS = {
  profile: 'profile',
  profileDraft: 'profileDraft',
  profileComplete: 'profileComplete',
  settings: 'settings'
} as const;

export interface Settings {
  confidenceThreshold: number;
  onlyFillEmptyFields: boolean;
  enableOnAllSites: boolean;
  autoTickWorkdayTerms: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  confidenceThreshold: 0.7,
  onlyFillEmptyFields: true,
  enableOnAllSites: false,
  autoTickWorkdayTerms: false
};

async function getStorageArea<T>(key: string, fallback: T): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return fallback;
  }

  const value = await chrome.storage.local.get(key);
  return value[key] ?? fallback;
}

export async function loadProfile(): Promise<Profile> {
  const stored = await getStorageArea<Partial<Profile> | undefined>(STORAGE_KEYS.profile, undefined);
  return migrateProfile(stored ?? DEFAULT_PROFILE);
}

export async function saveProfile(profile: Partial<Profile>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  const normalized = migrateProfile(profile);
  await chrome.storage.local.set({ [STORAGE_KEYS.profile]: normalized, [STORAGE_KEYS.profileComplete]: isProfileComplete(normalized) });
}

export async function loadDraft(): Promise<Partial<Profile> | undefined> {
  return getStorageArea<Partial<Profile> | undefined>(STORAGE_KEYS.profileDraft, undefined);
}

export async function saveDraft(draft: Partial<Profile>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.profileDraft]: draft });
}

export async function getProfileComplete(): Promise<boolean> {
  return getStorageArea<boolean>(STORAGE_KEYS.profileComplete, false);
}

export async function setProfileComplete(value: boolean): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.profileComplete]: value });
}

export async function loadSettings(): Promise<Settings> {
  const settings = await getStorageArea<Partial<Settings> | undefined>(STORAGE_KEYS.settings, undefined);
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: { ...DEFAULT_SETTINGS, ...settings } });
}
