// electron/preload/index.ts

import {
  app,
  contextBridge,
  ipcRenderer,
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  OpenDialogReturnValue,
} from "electron";
// import path from 'node:path'; // <-- REMOVE THIS IMPORT

// --- Expose Electron APIs to Renderer ---
contextBridge.exposeInMainWorld("electronAPI", {
  // File System Operations using ABSOLUTE paths (keep these)
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

  // Dialogs (keep these)
  showConfirmDialog: (
    options: MessageBoxOptions
  ): Promise<MessageBoxReturnValue> =>
    ipcRenderer.invoke("show-confirm-dialog", options),
  showOpenDialog: (
    options: OpenDialogOptions
  ): Promise<OpenDialogReturnValue> =>
    ipcRenderer.invoke("show-open-dialog", options),

  // Path Utilities (keep getPath)
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

  // MODIFIED: Use IPC for joining paths
  joinPaths: (...paths: string[]): Promise<string> =>
    ipcRenderer.invoke("join-paths", ...paths),
  getAppPath: (): Promise<string> => ipcRenderer.invoke("get-app-path"),
  isPackaged: ():Boolean => app.isPackaged,
  moveFiles: (sourceDir: string, destDir: string): Promise<void> =>
    ipcRenderer.invoke("move-files", sourceDir, destDir),
  listFiles: (absolutePath: string): Promise<string[] | null> =>
    ipcRenderer.invoke("list-files", absolutePath),
});


console.log('Preload script fully loaded and configured.');

// --- TypeScript Declarations for Renderer ---
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
      // MODIFIED: joinPaths now returns a Promise
      joinPaths: (...paths: string[]) => Promise<string>;
      getAppPath: () => Promise<string>;
      moveFiles: (sourceDir: string, destDir: string) => Promise<void>;
      listFiles: (absolutePath: string) => Promise<string[] | null>;
    };
    // monaco: typeof monaco; // Optional
  }
}
