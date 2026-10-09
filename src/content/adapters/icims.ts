import { Profile } from '../../shared/profile-schema';
import { GenericAdapter } from './generic';

export class IcimsAdapter extends GenericAdapter {
  public override name = 'icims';

  public override matches(url: URL): boolean {
    return url.hostname.includes('icims');
  }

  public override async fillPage(profile: Profile): Promise<{ filled: number; needsReview: number }> {
    return super.fillPage(profile, { confidenceThreshold: 0.7, onlyFillEmptyFields: true });
  }
}
