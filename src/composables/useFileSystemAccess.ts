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
  async function getNoteFilePath(patientId: string, date: Date): Promise<string> {
      const dateString = date.toISOString().split('T')[0];
      const fileName = `${dateString}.txt`;
      const basePath = await window.electronAPI.getConfigValue('notesDirectory');
      // Now it can access joinPaths correctly
      const patientDir = await joinPaths(basePath, patientId);
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

  const readFileForDate = async (patientId: string, date: Date): Promise<string | null> => {
    const filePath = await getNoteFilePath(patientId, date);
    const fileExists = await existsAbsolute(filePath);
    if (!fileExists) {
        return null;
    }
    return readFileAbsolute(filePath);
  };

  const writeFileForDate = async (patientId: string, date: Date, content: string): Promise<boolean> => {
    const filePath = await getNoteFilePath(patientId, date);
    // Need the directory path separately to check/create it
    const basePath = await window.electronAPI.getConfigValue('notesDirectory');
    const patientDir = await joinPaths(basePath, patientId);

    const dirExists = await existsAbsolute(patientDir);
    if (!dirExists) {
        await mkdirAbsolute(patientDir);
    }

    return writeFileAbsolute(filePath, content);
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
  };
}
