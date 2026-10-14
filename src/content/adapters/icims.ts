import { Profile } from '../../shared/profile-schema';
import { FillOptions, GenericAdapter } from './generic';

export class IcimsAdapter extends GenericAdapter {
  public override name = 'icims';

  public override matches(url: URL): boolean {
    return url.hostname.includes('icims');
  }

  public override async fillPage(profile: Profile, opts: FillOptions = {}): Promise<{ filled: number; needsReview: number }> {
    return super.fillPage(profile, { ...opts, confidenceThreshold: 0.7, onlyFillEmptyFields: true });
  }
}
