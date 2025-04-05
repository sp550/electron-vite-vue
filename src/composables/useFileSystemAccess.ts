// src/composables/useFileSystemAccess.ts
// This composable now primarily just maps calls to the electronAPI using absolute paths

export function useFileSystemAccess() {
  const readFileAbsolute = async (
    absolutePath: string
  ): Promise<string | null> => {
    try {
      // Basic validation
      if (!absolutePath)
        throw new Error("readFileAbsolute requires a valid absolute path.");
      return await window.electronAPI.readFileAbsolute(absolutePath);
    } catch (error) {
      console.error(
        `Error reading absolute file ${absolutePath} via IPC:`,
        error
      );
      // Consider specific error handling or re-throwing
      throw error; // Re-throw to be handled by caller
    }
  };

  const writeFileAbsolute = async (
    absolutePath: string,
    content: string
  ): Promise<boolean> => {
    try {
      if (!absolutePath)
        throw new Error("writeFileAbsolute requires a valid absolute path.");
      await window.electronAPI.writeFileAbsolute(absolutePath, content);
      return true;
    } catch (error) {
      console.error(
        `Error writing absolute file ${absolutePath} via IPC:`,
        error
      );
      throw error; // Re-throw
    }
  };

  const deleteFileAbsolute = async (absolutePath: string): Promise<boolean> => {
    try {
      if (!absolutePath)
        throw new Error("deleteFileAbsolute requires a valid absolute path.");
      await window.electronAPI.deleteFileAbsolute(absolutePath);
      return true;
    } catch (error) {
      console.error(
        `Error deleting absolute file ${absolutePath} via IPC:`,
        error
      );
      throw error;
    }
  };

  const existsAbsolute = async (absolutePath: string): Promise<boolean> => {
    try {
      if (!absolutePath)
        throw new Error("existsAbsolute requires a valid absolute path.");
      return await window.electronAPI.existsAbsolute(absolutePath);
    } catch (error) {
      console.error(
        `Error checking existence (absolute) for ${absolutePath} via IPC:`,
        error
      );
      throw error;
    }
  };

  const mkdirAbsolute = async (absolutePath: string): Promise<boolean> => {
    try {
      if (!absolutePath)
        throw new Error("mkdirAbsolute requires a valid absolute path.");
      await window.electronAPI.mkdirAbsolute(absolutePath);
      return true;
    } catch (error) {
      console.error(
        `Error creating directory (absolute) ${absolutePath} via IPC:`,
        error
      );
      throw error;
    }
  };

  const rmdirAbsolute = async (absolutePath: string): Promise<boolean> => {
    try {
      if (!absolutePath)
        throw new Error("rmdirAbsolute requires a valid absolute path.");
      await window.electronAPI.rmdirAbsolute(absolutePath);
      return true;
    } catch (error) {
      console.error(
        `Error removing directory (absolute) ${absolutePath} via IPC:`,
        error
      );
      throw error;
    }
  };

  // Dialog functions remain the same as they don't depend on paths in the same way

  const showConfirmDialog = async (
    options: Electron.MessageBoxOptions
  ): Promise<Electron.MessageBoxReturnValue> => {
    try {
      return await window.electronAPI.showConfirmDialog(options);
    } catch (error) {
      console.error(`Error showing confirm dialog via IPC:`, error);
      // Return a default/error state if necessary, though invoke should handle rejection
      return { response: -1, checkboxChecked: false }; // Example error state
    }
  };
  const showOpenDialog = async (
    options: Electron.OpenDialogOptions
  ): Promise<Electron.OpenDialogReturnValue> => {
    console.log(
      "useFileSystemAccess: Calling window.electronAPI.showOpenDialog"
    ); // Add log
    try {
      const dialogResult = await window.electronAPI.showOpenDialog(options);
      console.log("useFileSystemAccess: Dialog result received:", dialogResult); // Add log
      // Ensure a valid structure is always returned even if IPC somehow resolves weirdly
      if (
        typeof dialogResult !== "object" ||
        dialogResult === null ||
        typeof dialogResult.canceled !== "boolean" ||
        !Array.isArray(dialogResult.filePaths)
      ) {
        console.error(
          "useFileSystemAccess: Invalid result structure received from electronAPI.showOpenDialog:",
          dialogResult
        );
        // Force a rejection or return a default cancelled state
        throw new Error(
          "Invalid response received from showOpenDialog IPC handler."
        );
        // OR return { canceled: true, filePaths: [] }; (less ideal as it hides errors)
      }
      return dialogResult;
    } catch (error: any) {
      console.error(
        `useFileSystemAccess: Error during showOpenDialog IPC call:`,
        error
      ); // Log specific error location
      throw error; // Re-throw the error to ensure the promise rejects
    }
  };
  // MODIFIED: Make joinPaths async and await the IPC call
  const joinPaths = async (...paths: string[]): Promise<string> => {
    try {
      // Ensure at least one path is provided, otherwise invoke might fail/be meaningless
      if (!paths || paths.length === 0) {
        console.warn("joinPaths called with no arguments.");
        return ""; // Or throw an error
      }
      return await window.electronAPI.joinPaths(...paths);
    } catch (error) {
      console.error("Error invoking joinPaths via IPC:", error);
      throw error; // Re-throw to be handled by caller
    }
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
    joinPaths,
  };
}
