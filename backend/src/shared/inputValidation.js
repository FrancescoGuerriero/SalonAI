function isAsciiLetterOrDigit(character) {
  const code = character.charCodeAt(0);

  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isDomainLabel(label) {
  if (
    !label ||
    label.length > 63 ||
    label.startsWith("-") ||
    label.endsWith("-")
  ) {
    return false;
  }

  for (const character of label) {
    if (character !== "-" && !isAsciiLetterOrDigit(character)) {
      return false;
    }
  }

  return true;
}

export function isEmailAddress(value) {
  const email = String(value ?? "");

  if (!email || email.length > 254) {
    return false;
  }

  let separatorIndex = -1;

  for (let index = 0; index < email.length; index += 1) {
    const character = email[index];
    const code = email.charCodeAt(index);

    if (code <= 32 || code === 127) {
      return false;
    }

    if (character === "@") {
      if (separatorIndex !== -1) {
        return false;
      }

      separatorIndex = index;
    }
  }

  if (
    separatorIndex < 1 ||
    separatorIndex > 64 ||
    separatorIndex === email.length - 1
  ) {
    return false;
  }

  const localPart = email.slice(0, separatorIndex);
  const domain = email.slice(separatorIndex + 1);

  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return false;
  }

  const labels = domain.split(".");

  return labels.length >= 2 && labels.every(isDomainLabel);
}

export default {
  isEmailAddress,
};
