import { Profile } from '../../shared/profile-schema';
import { applyValueToField } from '../fillers';
import { GenericAdapter } from './generic';

export class WorkdayAdapter extends GenericAdapter {
  public override name = 'workday';

  public override matches(url: URL): boolean {
    return url.hostname.includes('workday') || url.hostname.includes('myworkday');
  }

  public override async fillPage(profile: Profile): Promise<{ filled: number; needsReview: number }> {
    const registrationEmail = profile.workdayAccount.registrationEmail || profile.personal.email;
    const workdayProfile = {
      ...profile,
      personal: { ...profile.personal, email: registrationEmail }
    };
    const result = await super.fillPage(workdayProfile, { confidenceThreshold: 0.72, onlyFillEmptyFields: true });

    const emailInputs = Array.from(document.querySelectorAll('input[type="email"], input[name*="email"], input[id*="email"]')) as HTMLInputElement[];
    const emailInput = emailInputs.find((entry) => !entry.value.trim());
    if (emailInput && registrationEmail) {
      applyValueToField(emailInput, registrationEmail);
    }

    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    if (passwordInputs.length === 2 && profile.workdayAccount.password && passwordInputs.every((input) => !input.value.trim())) {
      applyValueToField(passwordInputs[0], profile.workdayAccount.password);
      applyValueToField(passwordInputs[1], profile.workdayAccount.password);
    }

    return result;
  }
}
