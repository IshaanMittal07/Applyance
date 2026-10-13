import { AshbyAdapter } from './adapters/ashby';
import { GenericAdapter, type AtsAdapter } from './adapters/generic';
import { GreenhouseAdapter } from './adapters/greenhouse';
import { IcimsAdapter } from './adapters/icims';
import { LeverAdapter } from './adapters/lever';
import { SmartRecruitersAdapter } from './adapters/smartrecruiters';
import { WorkdayAdapter } from './adapters/workday';

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
