// src/composables/useNoteEditor.ts
import { ref } from 'vue';
import type { Note } from '@/types';
import { useFileSystemAccess } from './useFileSystemAccess';
import { useConfig } from './useConfig';

export function useNoteEditor() {
  const { readFileAbsolute, writeFileAbsolute, joinPaths } = useFileSystemAccess();
  const { config, isDataDirectorySet } = useConfig();
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // --- Helper to get absolute path ---
  const getNotePath = async (patientId: string, date: string): Promise<string | null> => {
    if (!isDataDirectorySet.value || !config.value.dataDirectory) return null;
    try {
    const formattedDate = date.split('T')[0]; // Ensure YYYY-MM-DD
        return await joinPaths(
            config.value.dataDirectory,
            config.value.notesBaseDir,
            patientId,
            `${formattedDate}.json`
        );
    } catch (e) {
        console.log("There was an error" + e)
        return null
    }
  };
  // --- End Helper ---

  const loadNote = async (patientId: string, date: string): Promise<Note | null> => {
    if (!isDataDirectorySet.value) {
      error.value = "Data directory not configured.";
      return null;
    }

    isLoading.value = true;
    error.value = null;
    const absolutePath = await getNotePath(patientId, date);

    if (!absolutePath) {
      error.value = "Could not determine note path.";
      isLoading.value = false;
      return null;
    }


    console.log("Loading note from:", absolutePath);

    try {
      const fileContent = await readFileAbsolute(absolutePath);
      if (fileContent) {
        return JSON.parse(fileContent) as Note;
      }
      // Return a default empty note if file doesn't exist
      console.log(`Note file (${absolutePath}) not found. Creating new note structure.`);
      return { date: date.split('T')[0], content: '' };
    } catch (err: any) {
      // Let readFileAbsolute handle ENOENT as null, catch other errors
      console.error(`Error loading note for ${patientId} on ${date}:`, err);
      error.value = `Failed to load note: ${err.message || err}`;
      return null; // Indicate error
    } finally {
      isLoading.value = false;
    }
  };

  const saveNote = async (patientId: string, note: Note): Promise<boolean> => {
    if (!isDataDirectorySet.value) {
      error.value = "Cannot save note: Data directory not configured.";
      return false;
    }

    isLoading.value = true;
    error.value = null;
    const absolutePath = await getNotePath(patientId, note.date); // <-- await here

    if (!absolutePath) {
      error.value = "Could not determine note path for saving.";
      isLoading.value = false;
      return false;
    }
    console.log("Saving note to:", absolutePath);

    try {
      const noteToSave = { ...note, date: note.date.split('T')[0] };
      await writeFileAbsolute(absolutePath, JSON.stringify(noteToSave, null, 2));
      return true;
    } catch (err: any) {
      console.error(`Error saving note for ${patientId} on ${note.date}:`, err);
      error.value = `Failed to save note: ${err.message || err}`;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    loadNote,
    saveNote,
  };
}
