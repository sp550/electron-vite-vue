import humanparser from 'humanparser';
import { Patient } from '../types';

/**
 * Parses a raw patient name string into structured name components.
 * @param rawName The raw patient name string.
 * @returns An object containing the parsed name components.
 */
export function parsePatientName(rawName: string | undefined): Partial<Patient> {
  if (!rawName) {
    return {};
  }

  try {
    const parsed = humanparser.parseName(rawName);
    return {
      rawName: rawName,
      salutation: parsed.salutation || undefined,
      firstName: parsed.firstName || undefined,
      middleName: parsed.middleName || undefined,
      lastName: parsed.lastName || undefined,
      suffix: parsed.suffix || undefined,
      fullName: parsed.fullName || undefined, // humanparser might provide this
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