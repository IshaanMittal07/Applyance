import { EducationRecord, ExperienceRecord, Profile } from './profile-schema';

export interface ResumeSuggestions {
  personal: Partial<Pick<Profile['personal'], 'firstName' | 'middleName' | 'lastName' | 'email' | 'phone'>>;
  links: Partial<Profile['links']>;
  skills: string[];
  education: EducationRecord[];
  experience: ExperienceRecord[];
}

const SECTION_HEADING = /^(?:professional summary|summary|profile|technical skills|skills|core competencies|technologies|education|academic background|professional experience|work experience|experience|employment history|work history|projects|certifications|awards|interests)(?:\s*:\s*.*|\s+\d+)?$/i;
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_RANGE = /((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,.]?\s+20\d{2}|20\d{2})\s*(?:-|–|—|to)\s*(present|current|now|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,.]?\s+20\d{2}|20\d{2})/i;
const ROLE_WORDS = /\b(engineer|developer|intern|analyst|manager|designer|scientist|researcher|consultant|architect|administrator|specialist|coordinator|technician|lead)\b/i;

function cleanLine(line: string): string {
  return line.replace(/\u00a0/g, ' ').replace(/^\s*(?:[-*•·▪◦]+)\s*/, '').replace(/\s+/g, ' ').trim();
}

function getLines(text: string): string[] {
  return text.replace(/\r/g, '').split('\n').map(cleanLine).filter(Boolean);
}

function extractSection(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return [];
  const firstLine = lines[start];
  const inlineContent = firstLine.includes(':') ? firstLine.slice(firstLine.indexOf(':') + 1).trim() : '';
  const end = lines.findIndex((line, index) => index > start && SECTION_HEADING.test(line));
  return [...(inlineContent ? [inlineContent] : []), ...lines.slice(start + 1, end < 0 ? lines.length : end)];
}

function parseDate(value: string): { date: string; month: string; year: string } {
  const year = value.match(/20\d{2}/)?.[0] ?? '';
  const wordMonth = value.toLowerCase().match(/jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?/)?.[0];
  const month = wordMonth ? String(MONTH_NAMES.findIndex((name) => name === wordMonth.slice(0, 3)) + 1).padStart(2, '0') : '01';
  return { date: year ? `${year}-${month}` : '', month: wordMonth ? wordMonth.slice(0, 3) : '', year };
}

function parseEducation(lines: string[]): EducationRecord[] {
  const section = extractSection(lines, /^(?:education|academic background)(?:\s*:\s*.*)?$/i);
  if (!section.length) return [];

  const school = section.find((line) => /\b(university|college|institute|school)\b/i.test(line)) ?? '';
  const degreeLine = section.find((line) => /\b(bachelor|master|doctor|ph\.?d|basc|bsc|msc|mba|diploma|candidate for)\b/i.test(line)) ?? '';
  const degree = /\b(bachelor|basc|bsc)\b/i.test(degreeLine) ? "Bachelor's Degree"
    : /\b(master|msc|mba)\b/i.test(degreeLine) ? "Master's Degree"
      : /\b(doctor|ph\.?d)\b/i.test(degreeLine) ? 'Doctorate'
        : degreeLine;
  const dateRange = section.map((line) => DATE_RANGE.exec(line)).find(Boolean)?.[0] ?? '';
  const dates = dateRange ? dateRange.match(DATE_RANGE) : null;
  const dateParts = dates?.[0].match(DATE_RANGE)?.slice(1) ?? [];
  const start = dateParts[0] ? parseDate(dateParts[0]) : { date: '', month: '', year: '' };
  const end = dateParts[1] && !/^(present|current|now)$/i.test(dateParts[1]) ? parseDate(dateParts[1]) : { date: '', month: '', year: '' };
  const fieldOfStudy = degreeLine.split(/[,|]/).slice(1).join(',').trim();
  if (!school && !degree && !fieldOfStudy) return [];

  return [{
    school,
    degree,
    accreditation: degree,
    fieldOfStudy,
    startDate: start.date,
    startMonth: start.month,
    startYear: start.year,
    endDate: end.date,
    endMonth: end.month || undefined,
    endYear: end.year || undefined,
    currentlyEnrolled: /\b(currently enrolled|currently studying|present|expected)\b/i.test(section.join(' '))
  }];
}

function splitRoleAndCompany(header: string, precedingLine = ''): { title: string; company: string } {
  const cleanHeader = cleanLine(header.replace(DATE_RANGE, '').replace(/[|•·–—-]+\s*$/, ''));
  const source = cleanHeader || cleanLine(precedingLine);
  const pieces = source.split(/\s*(?:\||•|·|–|—)\s*|\s+at\s+/i).map(cleanLine).filter(Boolean);
  if (pieces.length >= 2) {
    const roleIndex = pieces.findIndex((piece) => ROLE_WORDS.test(piece));
    if (roleIndex >= 0) {
      return { title: pieces[roleIndex], company: pieces.find((_, index) => index !== roleIndex) ?? '' };
    }
    return { company: pieces[0], title: pieces[1] };
  }
  return ROLE_WORDS.test(source) ? { title: source, company: '' } : { title: '', company: source };
}

function parseExperience(lines: string[]): ExperienceRecord[] {
  const section = extractSection(lines, /^(?:professional experience|work experience|experience|employment history|work history)(?:\s*:\s*.*|\s+\d+)?$/i);
  const dateLines = section.map((line, index) => ({ line, index, dates: DATE_RANGE.exec(line) })).filter((entry) => entry.dates);
  return dateLines.map((entry, index) => {
    const startText = entry.dates?.[1] ?? '';
    const endText = entry.dates?.[2] ?? '';
    const start = parseDate(startText ?? '');
    const isCurrent = /^(present|current|now)$/i.test(endText ?? '');
    const end = isCurrent ? { date: '', month: '', year: '' } : parseDate(endText ?? '');
    const previous = section[entry.index - 1] ?? '';
    const { title, company } = splitRoleAndCompany(entry.line, previous);
    const nextDateIndex = dateLines[index + 1]?.index ?? section.length;
    const details = section.slice(entry.index + 1, nextDateIndex).filter((line) => !SECTION_HEADING.test(line));
    const location = details.find((line) => /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2,3}$/.test(line)) ?? '';
    const description = details.filter((line) => line !== location).join('\n');
    return {
      company,
      title,
      location,
      startMonth: start.month,
      startYear: start.year,
      startDate: start.date,
      endMonth: end.month || undefined,
      endYear: end.year || undefined,
      endDate: end.date,
      current: isCurrent,
      description
    };
  }).filter((entry) => entry.company || entry.title || entry.description);
}

export function parseResumeText(text: string): ResumeSuggestions {
  const lines = getLines(text);
  const headerLines = lines.slice(0, 10);
  const personal: ResumeSuggestions['personal'] = {};
  const labeledName = headerLines.find((line) => /^(?:full\s+)?name\s*[:-]/i.test(line));
  const inferredName = headerLines.find((line) => /^[\p{L}][\p{L}'’-]+(?:\s+[\p{L}][\p{L}'’-]+){1,2}$/u.test(line) && !ROLE_WORDS.test(line));
  const fullName = (labeledName?.replace(/^(?:full\s+)?name\s*[:-]\s*/i, '') || inferredName || '').trim();
  if (fullName) {
    const nameParts = fullName.split(/\s+/);
    personal.firstName = nameParts[0];
    personal.lastName = nameParts[nameParts.length - 1];
    if (nameParts.length > 2) personal.middleName = nameParts.slice(1, -1).join(' ');
  }

  personal.email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? undefined;
  const phone = headerLines.map((line) => line.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0]).find(Boolean);
  if (phone) personal.phone = phone.trim();

  const links: ResumeSuggestions['links'] = {};
  const textWithoutEmails = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '');
  const urls = textWithoutEmails.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?/gi) ?? [];
  const normalizedUrls = urls.map((url) => /^https?:\/\//i.test(url) ? url : `https://${url}`);
  links.linkedin = normalizedUrls.find((url) => /linkedin\.com/i.test(url));
  links.github = normalizedUrls.find((url) => /github\.com/i.test(url));
  links.portfolio = normalizedUrls.find((url) => !/linkedin\.com|github\.com/i.test(url));

  const skillsSection = extractSection(lines, /^(?:technical skills|skills|core competencies|technologies)(?:\s*:\s*.*)?$/i);
  const skills = Array.from(new Set(skillsSection.flatMap((line) => line.split(/[,;|•·]/).map(cleanLine)).filter((skill) => skill && skill.length <= 64)));

  return {
    personal,
    links,
    skills,
    education: parseEducation(lines),
    experience: parseExperience(lines)
  };
}