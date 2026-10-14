import { Profile } from '../../shared/profile-schema';
import { FillOptions, GenericAdapter } from './generic';

export class LeverAdapter extends GenericAdapter {
  public override name = 'lever';

  public override matches(url: URL): boolean {
    return url.hostname.includes('lever');
  }

  public override async fillPage(profile: Profile, opts: FillOptions = {}): Promise<{ filled: number; needsReview: number }> {
    return super.fillPage(profile, { ...opts, confidenceThreshold: 0.72, onlyFillEmptyFields: true });
  }
}
