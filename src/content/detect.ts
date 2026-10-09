import { GenericAdapter } from './adapters/generic';
import { GreenhouseAdapter } from './adapters/greenhouse';
import { LeverAdapter } from './adapters/lever';

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

  return new GenericAdapter(doc);
}
