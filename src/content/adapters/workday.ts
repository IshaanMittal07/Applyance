import { Profile } from '../../shared/profile-schema';
import { encryptVault } from '../../shared/crypto';
import { applyValueToField } from '../fillers';
import { GenericAdapter } from './generic';

function generateStrongPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const password: string[] = [];
  for (let index = 0; index < 18; index += 1) {
    password.push(chars[Math.floor(Math.random() * chars.length)]);
  }
  return password.join('');
}

export class WorkdayAdapter extends GenericAdapter {
  public override name = 'workday';

  public override matches(url: URL): boolean {
    return url.hostname.includes('workday') || url.hostname.includes('myworkday');
  }

  public override async fillPage(profile: Profile): Promise<{ filled: number; needsReview: number }> {
    const result = await super.fillPage(profile, { confidenceThreshold: 0.72, onlyFillEmptyFields: true });

    const emailInputs = Array.from(document.querySelectorAll('input[type="email"], input[name*="email"], input[id*="email"]')) as HTMLInputElement[];
    const emailInput = emailInputs.find((entry) => !entry.value.trim());
    if (emailInput && profile.personal.email) {
      applyValueToField(emailInput, profile.personal.email);
    }

    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    if (passwordInputs.length >= 2) {
      const generated = generateStrongPassword();
      applyValueToField(passwordInputs[0], generated);
      applyValueToField(passwordInputs[1], generated);

      const passphrase = await chrome.storage.local.get('masterPassphrase');
      if (passphrase.masterPassphrase) {
        const encrypted = await encryptVault(
          JSON.stringify({ tenantHost: window.location.hostname, email: profile.personal.email, password: generated, createdAt: new Date().toISOString() }),
          passphrase.masterPassphrase
        );
        await chrome.storage.local.set({ workdayVault: encrypted });
      }
    }

    return result;
  }
}
