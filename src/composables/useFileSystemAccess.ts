// src/composables/useFileSystemAccess.ts
// Provides composable functions for interacting with the filesystem via Electron's IPC.

// Helper function to wrap Electron API calls with error handling
async function callElectronApi<T>(
  apiCall: () => Promise<T>,
  errorMessagePrefix: string
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    // Re-throw the error for the caller to handle appropriately
    throw new Error(`${errorMessagePrefix}: ${(error as Error).message || error}`);
  }
}

// Helper function for validating absolute paths
function validateAbsolutePath(path: string | undefined | null, functionName: string): void {
    if (!path) {
        throw new Error(`${functionName} requires a valid absolute path.`);
    }
}


// Main composable function
export function useFileSystemAccess() {

  // Define joinPaths first as it's used by getNoteFilePath
  const joinPaths = async (...paths: string[]): Promise<string> => {
    if (!paths || paths.length === 0) {
        // Throw error instead of returning empty string for clarity
        throw new Error("joinPaths requires at least one path argument.");
    }
    // Need to await here because getNoteFilePath uses it
    const joined = await callElectronApi(
      () => window.electronAPI.joinPaths(...paths),
      `Error joining paths`
    );
    return joined;
  };

  // Helper function to construct the note file path (MOVED INSIDE)
  /**
   * Returns the absolute path to a patient's note file for a given date.
   * - If patient has a UMRN, uses notes/by-umrn/UMRN/YYYY-MM-DD.json
   * - Otherwise, uses notes/by-uuid/UUID/YYYY-MM-DD.json
   * - Uses dataDirectory from config (not notesDirectory)
   * @param patient An object with at least { id, umrn?, type? }
   * @param date The date for the note
   */
  async function getNoteFilePath(
    patient: { id: string; umrn?: string | null; type?: "umrn" | "uuid" },
    date: Date
  ): Promise<string> {
    console.log("here are the parameters received by getNOteFilePath: ",patient, " and   ", date)

    const dateString = date.toISOString().split('T')[0];
    const fileName = `${dateString}.json`;
    // Use dataDirectory from config
    const dataDirectory = await window.electronAPI.getConfigValue('dataDirectory');
    if (!dataDirectory) throw new Error("Data directory is not configured.");

    // Determine patient type and directory
    let patientType: "umrn" | "uuid";
    let patientId: string;
    if (patient.umrn && patient.umrn.trim() !== "") {
      patientType = "umrn";
      patientId = patient.umrn;
    } else {
      patientType = "uuid";
      patientId = patient.id;
    }
    const notesDir = await joinPaths(dataDirectory, "notes");
    const byTypeDir = await joinPaths(notesDir, `by-${patientType}`);
    const patientDir = await joinPaths(byTypeDir, patientId);
    return joinPaths(patientDir, fileName);
  }


  const readFileAbsolute = (absolutePath: string): Promise<string | null> => {
    validateAbsolutePath(absolutePath, 'readFileAbsolute');
    return callElectronApi(
      () => window.electronAPI.readFileAbsolute(absolutePath),
      `Error reading file ${absolutePath}`
    );
  };

  const writeFileAbsolute = async (absolutePath: string, content: string): Promise<boolean> => {
    validateAbsolutePath(absolutePath, 'writeFileAbsolute');
    await callElectronApi(
      () => window.electronAPI.writeFileAbsolute(absolutePath, content),
      `Error writing file ${absolutePath}`
    );
    return true; // Indicate success
  };

  const deleteFileAbsolute = async (absolutePath: string): Promise<boolean> => {
    validateAbsolutePath(absolutePath, 'deleteFileAbsolute');
    await callElectronApi(
      () => window.electronAPI.deleteFileAbsolute(absolutePath),
      `Error deleting file ${absolutePath}`
    );
    return true; // Indicate success
  };

  const existsAbsolute = (absolutePath: string): Promise<boolean> => {
    validateAbsolutePath(absolutePath, 'existsAbsolute');
    return callElectronApi(
      () => window.electronAPI.existsAbsolute(absolutePath),
      `Error checking existence for ${absolutePath}`
    );
  };

  const mkdirAbsolute = async (absolutePath: string): Promise<boolean> => {
    validateAbsolutePath(absolutePath, 'mkdirAbsolute');
    await callElectronApi(
      () => window.electronAPI.mkdirAbsolute(absolutePath),
      `Error creating directory ${absolutePath}`
    );
    return true; // Indicate success
  };

  const rmdirAbsolute = async (absolutePath: string): Promise<boolean> => {
    validateAbsolutePath(absolutePath, 'rmdirAbsolute');
    await callElectronApi(
      () => window.electronAPI.rmdirAbsolute(absolutePath),
      `Error removing directory ${absolutePath}`
    );
    return true; // Indicate success
  };

  const moveFiles = (sourceDir: string, destDir: string): Promise<void> => {
     if (!sourceDir || !destDir) {
        throw new Error("moveFiles requires valid source and destination directories.");
     }
    return callElectronApi(
      () => window.electronAPI.moveFiles(sourceDir, destDir),
      `Error moving files from ${sourceDir} to ${destDir}`
    );
  };

  const listFiles = (absolutePath: string): Promise<string[] | null> => {
    validateAbsolutePath(absolutePath, 'listFiles');
    return callElectronApi(
      () => window.electronAPI.listFiles(absolutePath),
      `Error listing files in directory ${absolutePath}`
    );
  };

  const showConfirmDialog = (options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> => {
    return callElectronApi(
      () => window.electronAPI.showConfirmDialog(options),
      `Error showing confirm dialog`
    );
  };

  const showOpenDialog = (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> => {
    return callElectronApi(
      () => window.electronAPI.showOpenDialog(options),
      `Error showing open dialog`
    );
  };

  // --- Date-specific file operations ---

  /**
   * Reads the note file for a given patient and date.
   * Accepts a patient object (with id, umrn, type) and date.
   */
  const readFileForDate = async (
    patient: { id: string; umrn?: string | null; type?: "umrn" | "uuid" },
    date: Date
  ): Promise<string | null> => {
    const filePath = await getNoteFilePath(patient, date);
    console.log(filePath)
    const fileExists = await existsAbsolute(filePath);
    if (!fileExists) {
      return null;
    }
    return readFileAbsolute(filePath);
  };

  /**
   * Writes the note file for a given patient and date.
   * Accepts a patient object (with id, umrn, type), date, and content.
   */
  const writeFileForDate = async (
    patient: { id: string; umrn?: string | null; type?: "umrn" | "uuid" },
    date: Date,
    content: string
  ): Promise<boolean> => {
    const filePath = await getNoteFilePath(patient, date);

    // Ensure the patient directory exists
    const dataDirectory = await window.electronAPI.getConfigValue('dataDirectory');
    if (!dataDirectory) throw new Error("Data directory is not configured.");

    let patientType: "umrn" | "uuid";
    let patientId: string;
    if (patient.umrn && patient.umrn.trim() !== "") {
      patientType = "umrn";
      patientId = patient.umrn;
    } else {
      patientType = "uuid";
      patientId = patient.id;
    }
    const notesDir = await joinPaths(dataDirectory, "notes");
    const byTypeDir = await joinPaths(notesDir, `by-${patientType}`);
    const patientDir = await joinPaths(byTypeDir, patientId);

    const dirExists = await existsAbsolute(patientDir);
    if (!dirExists) {
      await mkdirAbsolute(patientDir);
    }

    return writeFileAbsolute(filePath, content);
  };

  const getPreviousDayNote = (patientId: string, currentDate: string): Promise<string | null> => {
    if (!patientId || !currentDate) {
      throw new Error("getPreviousDayNote requires patientId and currentDate.");
    }
    return callElectronApi(
      () => window.electronAPI.getPreviousDayNote(patientId, currentDate),
      `Error getting previous day note for patient ${patientId} from ${currentDate}`
    );
  };

  const getNextDayNote = (patientId: string, currentDate: string): Promise<string | null> => {
    if (!patientId || !currentDate) {
      throw new Error("getNextDayNote requires patientId and currentDate.");
    }
    return callElectronApi(
      () => window.electronAPI.getNextDayNote(patientId, currentDate),
      `Error getting next day note for patient ${patientId} from ${currentDate}`
    );
  };

  return {
    readFileAbsolute,
    writeFileAbsolute,
    deleteFileAbsolute,
    existsAbsolute,
    mkdirAbsolute,
    rmdirAbsolute,
    showConfirmDialog,
    showOpenDialog,
    joinPaths, // Still expose joinPaths
    moveFiles,
    listFiles,
    readFileForDate,
    writeFileForDate,
    // Export the new functions
    getPreviousDayNote,
    getNextDayNote,
  };
}
