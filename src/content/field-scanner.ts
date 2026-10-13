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
  if (element instanceof HTMLInputElement && element.type === 'radio') {
    const group = element.closest('fieldset, [role="radiogroup"]');
    const groupLabel = group?.querySelector('legend')?.textContent ?? group?.getAttribute('aria-label');
    if (groupLabel) return withAutocomplete(groupLabel.trim());
    const groupLabelledby = group?.getAttribute('aria-labelledby') ?? element.getAttribute('aria-labelledby');
    if (groupLabelledby) {
      const text = groupLabelledby.split(' ').map((part) => document.getElementById(part)?.textContent).filter(Boolean).join(' ');
      if (text) return withAutocomplete(text.trim());
    }
  }
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

  const elementId = element.getAttribute('id');
  if (elementId) {
    const associatedLabel = Array.from(element.ownerDocument.querySelectorAll('label[for]'))
      .find((label) => label.getAttribute('for') === elementId)?.textContent;
    if (associatedLabel) return withAutocomplete(associatedLabel.trim());
  }

  const workdayField = element.closest('[data-automation-id="formField"], [data-automation-id="formFieldContainer"]');
  const workdayLabel = workdayField?.querySelector('[data-automation-id="formFieldLabel"], [data-automation-id="formFieldQuestion"], legend, label')?.textContent;
  if (workdayLabel) return withAutocomplete(workdayLabel.trim());

  const combobox = element.closest('[role="combobox"]');
  const comboboxLabel = combobox?.getAttribute('aria-label');
  if (comboboxLabel) return withAutocomplete(comboboxLabel.trim());
  const comboboxLabelledby = combobox?.getAttribute('aria-labelledby');
  if (comboboxLabelledby) {
    const text = comboboxLabelledby.split(' ').map((part) => document.getElementById(part)?.textContent).filter(Boolean).join(' ');
    if (text) return withAutocomplete(text.trim());
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

function getFieldValue(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value;
  }

  const value = element.getAttribute('data-value')
    ?? element.getAttribute('aria-valuetext')
    ?? element.querySelector<HTMLElement>('[aria-selected="true"]')?.textContent
    ?? element.textContent
    ?? '';
  const normalized = value.trim().toLowerCase();
  return ['choose', 'choose one', 'select', 'select one', 'select an option', 'select a value'].includes(normalized) ? '' : value.trim();
}

export function scanFields(root: Document | Element = document): ScannedField[] {
  const selectors = 'input, textarea, select, [role="combobox"], [role="listbox"], [role="radiogroup"], [role="checkbox"], [aria-haspopup="listbox"], [data-automation-id="selectWidget"]';
  const results: ScannedField[] = [];
  const handledRadioGroups = new WeakSet<Element>();

  for (const element of Array.from(root.querySelectorAll<HTMLElement>(selectors))) {
    if ((element.getAttribute('role') === 'combobox' || element.getAttribute('role') === 'listbox') && element.querySelector('input, textarea, select')) {
      continue;
    }
    if (element.getAttribute('data-automation-id') === 'selectWidget' && element.querySelector('button, [role="button"], input, select')) {
      continue;
    }
    if (element instanceof HTMLInputElement && (element.type === 'hidden' || element.disabled || element.readOnly)) {
      continue;
    }

    if (element instanceof HTMLInputElement && element.type === 'radio') {
      const group = element.closest('fieldset, [role="radiogroup"]') ?? element.form;
      if (group && handledRadioGroups.has(group)) continue;
      if (group) handledRadioGroups.add(group);
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
      value: getFieldValue(element)
    });
  }

  return results;
}
