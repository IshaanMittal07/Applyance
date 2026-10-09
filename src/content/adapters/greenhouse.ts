import { Profile } from '../../shared/profile-schema';
import { GenericAdapter } from './generic';

export class GreenhouseAdapter extends GenericAdapter {
  public override name = 'greenhouse';

  public override matches(url: URL): boolean {
    return url.hostname.includes('greenhouse');
  }

  public override async fillPage(profile: Profile): Promise<{ filled: number; needsReview: number }> {
    return super.fillPage(profile, { confidenceThreshold: 0.72, onlyFillEmptyFields: true });
  }
}
