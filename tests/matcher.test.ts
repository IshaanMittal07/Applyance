import { describe, expect, it } from 'vitest';
import { matchField } from '../src/content/matcher';

describe('matcher', () => {
  it('matches common personal labels', () => {
    expect(matchField('First Name')?.key).toBe('personal.firstName');
    expect(matchField('Email address')?.key).toBe('personal.email');
    expect(matchField('Phone Number')?.key).toBe('personal.phone');
  });

  it('rejects negative labels that should not be filled', () => {
    expect(matchField('Emergency contact name')).toBeNull();
    expect(matchField('School address')).toBeNull();
  });

  it('matches education and work fields', () => {
    expect(matchField('Company')?.key).toBe('experience.company');
    expect(matchField('School name')?.key).toBe('education.school');
  });

  it('matches address, authorization, EEO, and preference labels', () => {
    expect(matchField('County')?.key).toBe('personal.address.county');
    expect(matchField('Are you authorized to work in the US?')?.key).toBe('workAuthorization.authorizedToWorkIn.United States');
    expect(matchField('Will you require visa sponsorship?')?.key).toBe('workAuthorization.requiresSponsorshipIn.United States');
    expect(matchField('Do you have a disability?')?.key).toBe('eeo.disabilityStatus');
    expect(matchField('Expected annual salary')?.key).toBe('preferences.salaryExpectation');
  });

  it('prefers specific labels over generic overlapping labels', () => {
    expect(matchField('Preferred last name')?.key).toBe('personal.preferredLastName');
    expect(matchField('Address line 2')?.key).toBe('personal.address.line2');
  });
});
