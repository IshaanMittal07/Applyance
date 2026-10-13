import { describe, expect, it } from 'vitest';
import { parseResumeText } from '../src/shared/resume-text-parser';

describe('resume text parser', () => {
  it('extracts contact details, skills, education, and work history from sectioned text', () => {
    const resume = `
Ishaan Mittal
imittal@example.com
647-804-2505
https://www.linkedin.com/in/ishaan-mittal
https://github.com/ishaan

EDUCATION
University of Waterloo
Candidate for Bachelor of Applied Science - BASc, Computer Engineering
Sep 2025 - Oct 2026

EXPERIENCE
Software Engineer Intern | Cynorix Inc. | Sep 2026 - Present
Waterloo, ON
Built a secure key reconciliation system in C++.

SKILLS
C++, Python, TypeScript, React, AWS
`;

    const result = parseResumeText(resume);

    expect(result.personal).toMatchObject({ firstName: 'Ishaan', lastName: 'Mittal', email: 'imittal@example.com', phone: '647-804-2505' });
    expect(result.links.linkedin).toBe('https://www.linkedin.com/in/ishaan-mittal');
    expect(result.links.github).toBe('https://github.com/ishaan');
    expect(result.links.portfolio).toBeUndefined();
    expect(result.skills).toEqual(['C++', 'Python', 'TypeScript', 'React', 'AWS']);
    expect(result.education[0]).toMatchObject({ school: 'University of Waterloo', fieldOfStudy: 'Computer Engineering', startDate: '2025-09' });
    expect(result.experience[0]).toMatchObject({ company: 'Cynorix Inc.', title: 'Software Engineer Intern', current: true, location: 'Waterloo, ON' });
  });

  it('returns empty suggestions when a document has no recognizable profile data', () => {
    expect(parseResumeText('A short note about applying for a position.')).toMatchObject({
      personal: {}, links: {}, skills: [], education: [], experience: []
    });
  });
});