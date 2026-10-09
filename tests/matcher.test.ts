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
});
