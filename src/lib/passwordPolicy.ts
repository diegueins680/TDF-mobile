const utf8ByteLength = (value: string): number => Array.from(value).reduce((total, character) => {
  const codePoint = character.codePointAt(0) ?? 0;
  if (codePoint <= 0x7f) return total + 1;
  if (codePoint <= 0x7ff) return total + 2;
  if (codePoint <= 0xffff) return total + 3;
  return total + 4;
}, 0);

// Matches the backend's Unicode categories: Control, Format, LineSeparator,
// and ParagraphSeparator.
const UNSAFE_PASSWORD_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export function isValidSignupPassword(rawPassword: string): boolean {
  const password = rawPassword.trim();
  return Array.from(password).length >= 8
    && utf8ByteLength(password) <= 72
    && !UNSAFE_PASSWORD_CHARACTER.test(password);
}
