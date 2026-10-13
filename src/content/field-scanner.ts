export interface ScannedField {
  element: HTMLElement;
  label: string;
  value: string;
}

const AUTOCOMPLETE_LABELS: Record<string, string> = {
  'street-address': 'street address',
  'address-line1': 'address line 1',
  'address-line2': 'address line 2',
  'address-level1': 'state province region',
  'address-level2': 'city town',
  'address-level3': 'county',
  'postal-code': 'postal code zip code',
  'country-name': 'country',
  country: 'country'
};

function isHidden(element: HTMLElement): boolean {
  if (!element.isConnected) {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return true;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return true;
  }

  return false;
}

function getLabelText(element: HTMLElement): string {
  const autocompleteLabel = (element.getAttribute('autocomplete') ?? '')
    .split(/\s+/)
    .map((token) => AUTOCOMPLETE_LABELS[token])
    .filter(Boolean)
    .join(' ');
  const withAutocomplete = (label: string): string => [label, autocompleteLabel].filter(Boolean).join(' ').trim();
  const directLabel = element.closest('label');
  if (directLabel && directLabel.textContent) {
    return withAutocomplete(directLabel.textContent.trim());
  }

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return withAutocomplete(ariaLabel.trim());
  }

  const ariaLabelledby = element.getAttribute('aria-labelledby');
  if (ariaLabelledby) {
    const id = ariaLabelledby.split(' ').map((part) => document.getElementById(part)?.textContent).filter(Boolean).join(' ');
    if (id) {
      return withAutocomplete(id.trim());
    }
  }

  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    return withAutocomplete(placeholder.trim());
  }

  const name = element.getAttribute('name');
  if (name) {
    return withAutocomplete(name.trim());
  }

  const id = element.getAttribute('id');
  if (id) {
    return withAutocomplete(id.trim());
  }

  const automation = element.getAttribute('data-automation-id') ?? element.getAttribute('data-qa');
  if (automation) {
    return withAutocomplete(automation.trim());
  }

  return autocompleteLabel;
}

export function scanFields(root: Document | Element = document): ScannedField[] {
  const selectors = 'input, textarea, select, [role="combobox"], [role="listbox"], [role="radiogroup"], [role="checkbox"]';
  const results: ScannedField[] = [];

  for (const element of Array.from(root.querySelectorAll<HTMLElement>(selectors))) {
    if (element instanceof HTMLInputElement && (element.type === 'hidden' || element.disabled || element.readOnly)) {
      continue;
    }

    if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) && element.value && element.value.trim()) {
      // Existing values are preserved and still scanned for matching context.
    }

    if (element.getAttribute('aria-hidden') === 'true' || isHidden(element)) {
      continue;
    }

    const label = getLabelText(element);
    if (!label && !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      continue;
    }

    results.push({
      element,
      label: label || element.getAttribute('name') || element.getAttribute('id') || 'untitled',
      value: (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) ? element.value : ''
    });
  }

  return results;
}
