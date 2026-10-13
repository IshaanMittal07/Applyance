const restoreMap = new Map<HTMLElement, string>();

export function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  if (!restoreMap.has(element)) {
    restoreMap.set(element, element.value);
  }

  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

export function setSelectValue(element: HTMLSelectElement, value: string): void {
  if (!restoreMap.has(element)) {
    restoreMap.set(element, element.value);
  }

  const option = Array.from(element.options).find((candidate) => candidate.text.toLowerCase() === value.toLowerCase() || candidate.text.toLowerCase().includes(value.toLowerCase()));
  if (!option) {
    return;
  }

  element.value = option.value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function applyValueToField(element: HTMLElement, value: string): boolean {
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

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setInputValue(element, value);
    return true;
  }

  if (element instanceof HTMLSelectElement) {
    setSelectValue(element, value);
    return true;
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

  return false;
}

export function restoreAppliedValues(): void {
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
      const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, previousValue);
      } else {
        element.value = previousValue;
      }
    } else if (element instanceof HTMLSelectElement) {
      element.value = previousValue;
    }
  }

  restoreMap.clear();
}

(window as typeof window & { __applyanceUndo?: () => void }).__applyanceUndo = restoreAppliedValues;
