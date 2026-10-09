import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, migrateProfile, isProfileComplete } from '../src/shared/profile-schema';

describe('profile schema', () => {
  it('creates a default profile with empty required fields', () => {
    expect(DEFAULT_PROFILE.schemaVersion).toBe(1);
    expect(DEFAULT_PROFILE.personal.email).toBe('');
  });

  it('migrates partial profiles without dropping defaults', () => {
    const profile = migrateProfile({ personal: { firstName: 'Ava', lastName: 'Liu', email: 'ava@example.com', phone: '999', phoneCountryCode: '+1', address: { line1: '', city: '', stateOrProvince: '', postalCode: '', country: '' } } });
    expect(profile.personal.firstName).toBe('Ava');
    expect(profile.eeo.gender).toBe('Decline to answer');
  });

  it('marks completed profiles when the required basics are present', () => {
    const complete = isProfileComplete({ personal: { firstName: 'Sam', lastName: 'Ng', email: 'sam@example.com', phone: '123456', phoneCountryCode: '+1', address: { line1: '', city: '', stateOrProvince: '', postalCode: '', country: '' } } });
    expect(complete).toBe(true);
  });
});
