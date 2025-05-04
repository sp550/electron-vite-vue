import humanparser from "humanparser";
import { Patient } from "../types";

/**
 * Parses a raw patient name string into structured name components.
 * @param rawName The raw patient name string.
 * @returns An object containing the parsed name components.
 */
function toTitleCase(str: string | undefined): string | undefined {
  if (!str) {
    return undefined;
  }
  const lower = str.toLowerCase();
  const words = lower.split(' ');
  const titleCaseWords = words.map(word => {
    if (word.length === 0) {
      return '';
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return titleCaseWords.join(' ');
}

export function parsePatientName(
  rawName: string | undefined
): Partial<Patient> {
  if (!rawName) {
    return {};
  }

  try {
    const parsed = humanparser.parseName(rawName);
    return {
      rawName: rawName,
      salutation: toTitleCase(parsed.salutation),
      firstName: toTitleCase(parsed.firstName),
      middleName: toTitleCase(parsed.middleName),
      lastName: toTitleCase(parsed.lastName),
      suffix: toTitleCase(parsed.suffix),
      fullName: toTitleCase(parsed.fullName) || undefined, // humanparser might provide this
    };
  } catch (error) {
    console.error(`Error parsing name "${rawName}":`, error);
    // Return raw name and empty parsed fields on error
    return {
      rawName: rawName,
      salutation: undefined,
      firstName: undefined,
      middleName: undefined,
      lastName: undefined,
      suffix: undefined,
      fullName: undefined,
    };
  }
}
