const restoreMap = new Map<HTMLElement, string>();

function setTextValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

export function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  if (!restoreMap.has(element)) {
    restoreMap.set(element, element.value);
  }

  setTextValue(element, value);

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

export function setSelectValue(element: HTMLSelectElement, value: string): boolean {
  const options = Array.from(element.options);
  const desired = normalizeOption(value);
  const option = options.find((candidate) => normalizeOption(candidate.label) === desired)
    ?? options.find((candidate) => normalizeOption(candidate.value) === desired)
    ?? findUniquePrefix(options, (candidate) => normalizeOption(candidate.label), desired);
  if (!option) {
    return false;
  }

  if (!restoreMap.has(element)) {
    restoreMap.set(element, element.value);
  }
  element.value = option.value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function normalizeOption(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findUniquePrefix<T>(items: T[], getText: (item: T) => string, desired: string): T | undefined {
  const matches = items.filter((item) => getText(item).startsWith(desired));
  return matches.length === 1 ? matches[0] : undefined;
}

function listboxOptions(element: HTMLElement): HTMLElement[] {
  const controlledIds = [element.getAttribute('aria-controls'), element.getAttribute('aria-owns')]
    .filter(Boolean)
    .flatMap((value) => (value ?? '').split(/\s+/));
  const controlledRoots = controlledIds.map((id) => element.ownerDocument.getElementById(id)).filter((root): root is HTMLElement => root instanceof HTMLElement);
  const roots = controlledRoots.length
    ? controlledRoots
    : Array.from(element.ownerDocument.querySelectorAll<HTMLElement>('[role="listbox"], [role="menu"]'))
      .filter((root) => !root.hidden && root.getAttribute('aria-hidden') !== 'true');
  return roots.flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>('[role="option"], [role="menuitemradio"]')))
    .filter((option) => !option.hidden && option.getAttribute('aria-disabled') !== 'true' && option.getAttribute('aria-hidden') !== 'true');
}

async function setComboboxValue(element: HTMLElement, value: string): Promise<boolean> {
  const trigger = element.matches('button, [role="button"], [aria-haspopup="listbox"]')
    ? element
    : element.querySelector<HTMLElement>('button, [role="button"], [aria-haspopup="listbox"], input') ?? element;
  const input = trigger instanceof HTMLInputElement ? trigger : element.querySelector<HTMLInputElement>('input');
  const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';
  const previousFocus = element.ownerDocument.activeElement;
  const previousInputValue = input?.value ?? '';
  const hadRestoreEntry = input ? restoreMap.has(input) : false;
  if (input) {
    setInputValue(input, value);
    input.focus({ preventScroll: true });
  }
  if (!wasExpanded) trigger.click();

  const desired = normalizeOption(value);
  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const options = listboxOptions(trigger);
      const option = options.find((candidate) => normalizeOption(candidate.getAttribute('data-value') ?? '') === desired)
        ?? options.find((candidate) => normalizeOption(candidate.getAttribute('aria-label') ?? candidate.textContent ?? '') === desired)
        ?? findUniquePrefix(options, (candidate) => normalizeOption(candidate.getAttribute('aria-label') ?? candidate.textContent ?? ''), desired);
      if (option) {
        if (!restoreMap.has(element)) {
          restoreMap.set(element, previousInputValue || element.getAttribute('aria-valuetext') || element.textContent?.trim() || '');
        }
        option.click();
        return true;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }

    const requiresOption = trigger.getAttribute('aria-haspopup') === 'listbox'
      || element.getAttribute('role') === 'combobox'
      || element.getAttribute('data-automation-id') === 'selectWidget';
    if (input && !requiresOption) return true;

    // No matching option: undo the typed search text and close the list we opened, leaving the field as it was.
    if (input) {
      setTextValue(input, previousInputValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (!hadRestoreEntry) restoreMap.delete(input);
    }
    if (!wasExpanded && trigger.getAttribute('aria-expanded') === 'true') {
      (input ?? trigger).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      if (trigger.getAttribute('aria-expanded') === 'true') trigger.click();
    }
    return false;
  } finally {
    // Hand focus back so autofill never leaves the cursor somewhere the user did not put it.
    const activeElement = element.ownerDocument.activeElement;
    if (activeElement instanceof HTMLElement && element.contains(activeElement)) {
      if (previousFocus instanceof HTMLElement && previousFocus !== element.ownerDocument.body && previousFocus.isConnected && !element.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      } else {
        activeElement.blur();
      }
    }
  }
}

export async function applyValueToField(element: HTMLElement, value: string): Promise<boolean> {
  if (element instanceof HTMLInputElement && element.type === 'radio') {
    const group = Array.from(element.ownerDocument.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
      .filter((candidate) => candidate.name === element.name && candidate.form === element.form);
    const normalizedValue = value.trim().toLowerCase();
    const selected = group.find((candidate) => {
      const optionLabel = candidate.labels ? Array.from(candidate.labels).map((label) => label.textContent ?? '').join(' ') : '';
      return candidate.value.trim().toLowerCase() === normalizedValue || optionLabel.trim().toLowerCase() === normalizedValue;
    });
    if (!selected) return false;
    for (const candidate of group) {
      if (!restoreMap.has(candidate)) restoreMap.set(candidate, `checked:${candidate.checked}`);
    }
    selected.checked = true;
    selected.dispatchEvent(new Event('input', { bubbles: true }));
    selected.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    const checked = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
    if (!restoreMap.has(element)) {
      restoreMap.set(element, `checked:${element.checked}`);
    }
    element.checked = checked;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  const combobox = element.getAttribute('role') === 'combobox' ? element : element.closest('[role="combobox"]');
  if (combobox instanceof HTMLElement) {
    return setComboboxValue(combobox, value);
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setInputValue(element, value);
    return true;
  }

  if (element instanceof HTMLSelectElement) {
    return setSelectValue(element, value);
  }

  if ((element as HTMLElement).getAttribute('role') === 'checkbox') {
    const checked = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
    const current = element.getAttribute('aria-checked') === 'true';
    if (!restoreMap.has(element)) {
      restoreMap.set(element, `checked:${current}`);
    }
    if (current !== checked) {
      element.click();
    }
    return true;
  }

  if (element.matches('[aria-haspopup="listbox"], [data-automation-id="selectWidget"]')) {
    return setComboboxValue(element, value);
  }

  return false;
}

export async function restoreAppliedValues(): Promise<void> {
  const entries = Array.from(restoreMap.entries());
  for (const [element, previousValue] of entries) {
    if ((element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) || element.getAttribute('role') === 'checkbox') {
      const wasChecked = previousValue === 'checked:true';
      if (element instanceof HTMLInputElement) {
        element.checked = wasChecked;
      } else if ((element.getAttribute('aria-checked') === 'true') !== wasChecked) {
        element.click();
      }
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      setTextValue(element, previousValue);
    } else if (element instanceof HTMLSelectElement) {
      element.value = previousValue;
    } else if (element.matches('[aria-haspopup="listbox"], [data-automation-id="selectWidget"], [role="combobox"]') && previousValue) {
      await setComboboxValue(element, previousValue);
    }
  }

  restoreMap.clear();
}

(window as typeof window & { __applyanceUndo?: () => Promise<void> }).__applyanceUndo = restoreAppliedValues;
