import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, migrateProfile, isProfileComplete } from '../src/shared/profile-schema';

describe('profile schema', () => {
  it('creates a default profile with empty required fields', () => {
    expect(DEFAULT_PROFILE.schemaVersion).toBe(2);
    expect(DEFAULT_PROFILE.personal.email).toBe('');
  });

  it('migrates partial profiles without dropping defaults', () => {
    const profile = migrateProfile({ personal: { firstName: 'Ava', lastName: 'Liu', email: 'ava@example.com', phone: '999', phoneCountryCode: '+1', address: { line1: '', city: '', stateOrProvince: '', postalCode: '', country: '' } } });
    expect(profile.personal.firstName).toBe('Ava');
    expect(profile.schemaVersion).toBe(2);
    expect(profile.eeo.gender).toBe('');
    expect(profile.workAuthorization.authorizedToWorkIn['United States']).toBe('');
  });

  it('migrates legacy work authorization answers and education dates', () => {
    const profile = migrateProfile({
      workAuthorization: {
        authorizedToWorkIn: { 'United States': true },
        requiresSponsorshipIn: { 'United States': false }
      },
      education: [{ school: 'University', degree: 'BASc', fieldOfStudy: 'Engineering', startMonth: 'Sep', startYear: '2025', currentlyEnrolled: true }]
    });

    expect(profile.workAuthorization.authorizedToWorkIn['United States']).toBe('Yes');
    expect(profile.workAuthorization.requiresSponsorshipIn['United States']).toBe('');
    expect(profile.education[0].startDate).toBe('2025-09');
  });

  it('marks completed profiles when the required basics are present', () => {
    const complete = isProfileComplete({ personal: { firstName: 'Sam', lastName: 'Ng', email: 'sam@example.com', phone: '123456', phoneCountryCode: '+1', address: { line1: '', city: '', stateOrProvince: '', postalCode: '', country: '' } } });
    expect(complete).toBe(true);
  });
});
