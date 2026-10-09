export function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
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
  const option = Array.from(element.options).find((candidate) => candidate.text.toLowerCase() === value.toLowerCase() || candidate.text.toLowerCase().includes(value.toLowerCase()));
  if (!option) {
    return;
  }

  element.value = option.value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function applyValueToField(element: HTMLElement, value: string): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setInputValue(element, value);
    return true;
  }

  if (element instanceof HTMLSelectElement) {
    setSelectValue(element, value);
    return true;
  }

  if ((element as HTMLElement).getAttribute('role') === 'checkbox') {
    (element as HTMLElement).click();
    return true;
  }

  return false;
}
