import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export function toE164OrNull(
  input: string,
  defaultRegion: CountryCode = 'DE'
): string | null {
  const p = parsePhoneNumberFromString(input, defaultRegion);
  if (!p || !p.isValid()) return null;
  return p.number; // E.164
}
