import { ref,  computed } from 'vue';
import type { Note, Patient } from '@/types';
import { useFileSystemAccess } from './useFileSystemAccess';
import { useConfig } from './useConfig';

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function useNoteEditor() {
  const { readFileAbsolute, writeFileAbsolute, joinPaths } = useFileSystemAccess();
  const { config, isDataDirectorySet } = useConfig();
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentNote = ref<Note | null>(null);
  const currentPatient = ref<Patient | null>(null);
  const isAutoSaveEnabled = ref(true);
  const hasUnsavedChanges = ref(false);

  const getNotePath = async (patient: Patient, date: string): Promise<string | null> => {
    if (!isDataDirectorySet.value || !config.value.dataDirectory) {
        error.value = "Data directory not configured.";
        return null;
    }
    try {
      const formattedDate = date.split('T')[0];
      const basePath = config.value.dataDirectory;
      const notesBaseDir = config.value.notesBaseDir;

      // Use patient.type and umrn/id for pathing
      let patientIdentifier: string[];
      if (patient.type === "umrn" && patient.umrn) {
        patientIdentifier = ["by-umrn", patient.umrn];
      } else if (patient.type === "uuid") {
        patientIdentifier = ["by-uuid", patient.id];
      } else {
        // fallback for legacy or incomplete data
        patientIdentifier = patient.umrn ? ["by-umrn", patient.umrn] : ["by-uuid", patient.id];
      }
      const patientDir = await joinPaths(notesBaseDir, ...patientIdentifier);

      return await joinPaths(basePath, patientDir, `${formattedDate}.json`);
    } catch (e: any) {
      const patientName = patient.name ? ` (${patient.name})` : '';
      console.error(`Error determining note path for patient ${patient.id}${patientName}:`, e);
      error.value = `Failed to determine note path for patient ${patient.id}${patientName}: ${e.message || e}`;
      return null;
    }
  };

  const resetState = () => {
    currentNote.value = null;
    currentPatient.value = null;
    hasUnsavedChanges.value = false;
    isLoading.value = false;
  };

  const loadNote = async (patient: Patient, date: string): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    hasUnsavedChanges.value = false;

    const absolutePath = await getNotePath(patient, date);

    if (!absolutePath) {
      resetState(); // Resets loading state as well
      // error is set within getNotePath
      return;
    }

    currentPatient.value = patient;

    try {
      const fileContent = await readFileAbsolute(absolutePath);
      if (fileContent) {
        currentNote.value = JSON.parse(fileContent) as Note;
      } else {
        // File doesn't exist, create a new note structure
        currentNote.value = { date: date.split('T')[0], content: '' };
      }
    } catch (err: any) {
      const patientName = patient.name ? ` (${patient.name})` : '';
      console.error(`Error loading note for patient ${patient.id}${patientName} on ${date}:`, err);
      error.value = `Failed to load note for patient ${patient.id}${patientName}: ${err.message || err}`;
      resetState();
    } finally {
      isLoading.value = false; // Ensure loading is false even if resetState wasn't called
    }
  };

  // Modified to accept patient and the full note object to save
  const saveCurrentNote = async (patient: Patient, noteToSave: Note): Promise<boolean> => {
    const patientName = patient.name ? ` (${patient.name})` : '';
    console.log(`useNoteEditor: saveCurrentNote called for patient ${patient.id}${patientName}`);
    // Validate inputs directly
    if (!patient || !noteToSave) {
      error.value = "Invalid patient or note data provided for saving.";
      return false;
    }
    // Keep internal currentNote and currentPatient refs updated for consistency if needed elsewhere,
    // but primarily use the passed arguments for the save operation.
    currentPatient.value = patient; // Update internal ref
    currentNote.value = { ...noteToSave }; // Update internal ref (might be useful for UI state)

    isLoading.value = true;
    error.value = null;

    // Use the date from the noteToSave argument
    const absolutePath = await getNotePath(patient, noteToSave.date);

    if (!absolutePath) {
      isLoading.value = false;
      // error is set within getNotePath
      return false;
    }

    try {
      // Prepare the note object from the argument, ensuring date format is correct
      const finalNoteToSave = { ...noteToSave, date: noteToSave.date.split('T')[0] };
      console.log(
        `useNoteEditor: Content being sent to writeFileAbsolute for patient ${patient.id}${patientName}:`,
        JSON.stringify(finalNoteToSave.content)
      );
      const writeResult = await writeFileAbsolute(absolutePath, JSON.stringify(finalNoteToSave, null, 2));
      console.log('useNoteEditor: writeFileAbsolute result = ', writeResult);
      hasUnsavedChanges.value = false;
      return true;
    } catch (err: any) {
      // Use the date from the noteToSave argument in error message
      console.error(`Error saving note for patient ${patient.id}${patientName} on ${noteToSave.date}:`, err);
      error.value = `Failed to save note for patient ${patient.id}${patientName}: ${err.message || err}`;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

function setUnsavedChanges(bool: boolean) {
  hasUnsavedChanges.value = bool;
}

  return {
    isLoading,
    error,
    currentNote,
    isAutoSaveEnabled,
    hasUnsavedChanges: computed(() => hasUnsavedChanges.value),
    setUnsavedChanges,
    loadNote,
    saveCurrentNote,
    debounce
  };
}
