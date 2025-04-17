/**
 * src/composables/useNoteRetrieval.ts
 * Provides a robust function to fetch note content for a given patient and date,
 * leveraging useFileSystemAccess and handling all error cases gracefully.
 */

import { useFileSystemAccess } from './useFileSystemAccess';
import type { Patient } from '../types'; // Import the Patient type

/**
 * Retrieves the note content for a given patient and date.
 * @param patient - The patient object.
 * @param dateISO - The date string in ISO 8601 format (e.g., "2024-04-17" or "2024-04-17T00:00:00Z").
 * @returns The note content as a string, or a default message if not found or error.
 */
export async function getNoteContent(patient: Patient, dateISO: string): Promise<string> {
  const { readFileForDate } = useFileSystemAccess();
  let rawData: string | null = null;
  let noteContent: string = '';
  const defaultMessage = 'No note found for this date.';

  try {
    // Parse date string to Date object
    const dateObj = new Date(dateISO);
    if (isNaN(dateObj.getTime())) {
      console.error(`[getNoteContent] Invalid date string: ${dateISO}`);
      return defaultMessage;
    }

    // Attempt to read the file for the given patient and date
    rawData = await readFileForDate(patient, dateObj); // Pass the patient object directly

    if (!rawData) {
      return defaultMessage;
    }

    // Try to parse as JSON and extract 'content'
    try {
      const parsed = JSON.parse(rawData);
      if (typeof parsed === 'object' && parsed !== null && typeof parsed.content === 'string') {
        noteContent = parsed.content;
      } else {
        // JSON parsed but no 'content' field, treat as raw
        noteContent = rawData;
      }
    } catch (jsonErr) {
      // Not valid JSON, treat as raw content
      noteContent = rawData;
    }

    // If noteContent is empty, return default message
    if (!noteContent || noteContent.trim() === '') {
      return defaultMessage;
    }

    return noteContent;
  } catch (err: any) {
    // Log error and return default message
    console.error(`[getNoteContent] Error retrieving note for patientId=${patient.id}, date=${dateISO}:`, err); // Use patient.id
    return defaultMessage;
  }
}