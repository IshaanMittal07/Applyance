import { AshbyAdapter } from './adapters/ashby';
import { GenericAdapter } from './adapters/generic';
import { GreenhouseAdapter } from './adapters/greenhouse';
import { IcimsAdapter } from './adapters/icims';
import { LeverAdapter } from './adapters/lever';
import { SmartRecruitersAdapter } from './adapters/smartrecruiters';
import { WorkdayAdapter } from './adapters/workday';

export type AtsAdapter = {
  name: string;
  matches: (url: URL, doc: Document) => boolean;
  fillPage: (profile: Record<string, unknown>, opts?: { confidenceThreshold?: number; onlyFillEmptyFields?: boolean }) => Promise<{ filled: number; needsReview: number }>;
};

export function detectAdapter(url: URL, doc: Document): AtsAdapter {
  const hostname = url.hostname.toLowerCase();

  if (hostname.includes('greenhouse')) {
    return new GreenhouseAdapter();
  }

  if (hostname.includes('lever')) {
    return new LeverAdapter();
  }

  if (hostname.includes('ashby')) {
    return new AshbyAdapter();
  }

  if (hostname.includes('smartrecruiters')) {
    return new SmartRecruitersAdapter();
  }

  if (hostname.includes('icims')) {
    return new IcimsAdapter();
  }

  if (hostname.includes('workday') || hostname.includes('myworkday')) {
    return new WorkdayAdapter();
  }

  return new GenericAdapter(doc);
}
