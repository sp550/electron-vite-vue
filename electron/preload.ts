import {
  // app, // Removed 'app' import
  contextBridge,
  ipcRenderer,
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  readFileAbsolute: (absolutePath: string): Promise<string | null> =>
    ipcRenderer.invoke("read-file-absolute", absolutePath),
  writeFileAbsolute: (absolutePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke("write-file-absolute", absolutePath, content),
  deleteFileAbsolute: (absolutePath: string): Promise<void> =>
    ipcRenderer.invoke("delete-file-absolute", absolutePath),
  existsAbsolute: (absolutePath: string): Promise<boolean> =>
    ipcRenderer.invoke("exists-absolute", absolutePath),
  mkdirAbsolute: (absolutePath: string): Promise<void> =>
    ipcRenderer.invoke("mkdir-absolute", absolutePath),
  rmdirAbsolute: (absolutePath: string): Promise<void> =>
    ipcRenderer.invoke("rmdir-absolute", absolutePath),

  showConfirmDialog: (
    options: MessageBoxOptions
  ): Promise<MessageBoxReturnValue> =>
    ipcRenderer.invoke("show-confirm-dialog", options),
  showOpenDialog: (
    options: OpenDialogOptions
  ): Promise<OpenDialogReturnValue> =>
    ipcRenderer.invoke("show-open-dialog", options),

  showSaveDialog: (
    options: SaveDialogOptions
  ): Promise<SaveDialogReturnValue> =>
    ipcRenderer.invoke("show-save-dialog", options),

  openDirectory: (dir: string): Promise<void> =>
    ipcRenderer.invoke("open-directory", dir),

  getPath: (
    name:
      | "home"
      | "appData"
      | "userData"
      | "logs"
      | "temp"
      | "desktop"
      | "documents"
      | "downloads"
      | "music"
      | "pictures"
      | "videos"
  ): Promise<string> => ipcRenderer.invoke("get-path", name),

  joinPaths: (...paths: string[]): Promise<string> =>
    ipcRenderer.invoke("join-paths", ...paths),
  getAppPath: (): Promise<string> => ipcRenderer.invoke("get-app-path"),
  isPackaged: (): Promise<boolean> => ipcRenderer.invoke("is-packaged"), // Changed to invoke IPC
  isProduction: (): boolean => process.env.NODE_ENV === "production",
  moveFiles: (sourceDir: string, destDir: string): Promise<void> =>
    ipcRenderer.invoke("move-files", sourceDir, destDir),
  listFiles: (absolutePath: string): Promise<string[] | null> =>
    ipcRenderer.invoke("list-files", absolutePath),
  getConfigValue: (key: string): Promise<any> => // Added getConfigValue implementation
    ipcRenderer.invoke("get-config-value", key),
  getPreviousDayNote: (patientId: string, currentDate: string): Promise<string | null> =>
    ipcRenderer.invoke("get-previous-day-note", patientId, currentDate),
  getNextDayNote: (patientId: string, currentDate: string): Promise<string | null> =>
    ipcRenderer.invoke("get-next-day-note", patientId, currentDate),
  getConfigPath: (): Promise<string> => ipcRenderer.invoke("get-config-path"), // Added getConfigPath
  setUnsavedChanges: (hasChanges: boolean): Promise<boolean> =>
    ipcRenderer.invoke("set-unsaved-changes", hasChanges),

  // Export notes for a given day and prompt user to save the .txt file
  exportNotesForDay: (date: string): Promise<string | null> =>
    ipcRenderer.invoke("export-notes-for-day", date),
  selectFolder: (): Promise<string | null> => // Add selectFolder function
    ipcRenderer.invoke("select-folder"),
  selectCSVFile: (): Promise<string | null> =>
    ipcRenderer.invoke("select-csv-file"),
  onNavigatePreviousNote: (callback: () => void) => ipcRenderer.on('navigate-previous-note', callback),
  onNavigateNextNote: (callback: () => void) => ipcRenderer.on('navigate-next-note', callback),
  onToggleTheme: (callback: () => void) => ipcRenderer.on('toggle-theme', callback),
});



declare global {
  interface Window {
    electronAPI: {
      readFileAbsolute: (absolutePath: string) => Promise<string | null>;
      writeFileAbsolute: (
        absolutePath: string,
        content: string
      ) => Promise<void>;
      deleteFileAbsolute: (absolutePath: string) => Promise<void>;
      existsAbsolute: (absolutePath: string) => Promise<boolean>;
      mkdirAbsolute: (absolutePath: string) => Promise<void>;
      rmdirAbsolute: (absolutePath: string) => Promise<void>;
      showConfirmDialog: (
        options: MessageBoxOptions
      ) => Promise<MessageBoxReturnValue>;
      showOpenDialog: (
        options: OpenDialogOptions
      ) => Promise<OpenDialogReturnValue>;
      showSaveDialog: (
        options: SaveDialogOptions
      ) => Promise<SaveDialogReturnValue>;
      getPath: (
        name:
          | "home"
          | "appData"
          | "userData"
          | "logs"
          | "temp"
          | "desktop"
          | "documents"
          | "downloads"
          | "music"
          | "pictures"
          | "videos"
      ) => Promise<string>;
      joinPaths: (...paths: string[]) => Promise<string>;
      getAppPath: () => Promise<string>;
      isPackaged: () => Promise<boolean>; // Updated type for isPackaged
      isProduction: () => boolean;
      moveFiles: (sourceDir: string, destDir: string) => Promise<void>;
      listFiles: (absolutePath: string) => Promise<string[] | null>;
      getConfigValue: (key: string) => Promise<any>;
      getPreviousDayNote: (patientId: string, currentDate: string) => Promise<string | null>;
      getNextDayNote: (patientId: string, currentDate: string) => Promise<string | null>;
      getConfigPath: () => Promise<string>; // Added getConfigPath type
      setUnsavedChanges: (hasChanges: boolean) => Promise<boolean>;
      exportNotesForDay: (date: string) => Promise<string | null>;
      openDirectory: (dir: string) => Promise<void>;
      selectFolder: () => Promise<string | null>; // Add selectFolder type
      selectCSVFile: () => Promise<string | null>;
      onNavigatePreviousNote: (callback: () => void) => void;
      onNavigateNextNote: (callback: () => void) => void;
      onToggleTheme: (callback: () => void) => void;
      // (end of electronAPI interface)
    };
  }
}
