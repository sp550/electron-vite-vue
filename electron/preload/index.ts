// electron/preload/index.ts

import {
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
  // WAS: joinPaths: (...paths: string[]): string => path.join(...paths),
});

// --- Monaco Editor Worker Setup (Keep as before) ---
// This ensures the Monaco Editor worker scripts can be loaded correctly in Electron.
// Needs `monaco-editor` installed.
// Using dynamic import for the worker URLs to help Vite with bundling.
// @ts-ignore - MonacoEnvironment is expected on self/window by the editor loader
self.MonacoEnvironment = {
    getWorker: function (_moduleId: any, label: string) {
        let workerUrl: URL;
        switch (label) {
            case 'json':
                workerUrl = new URL('monaco-editor/esm/vs/language/json/json.worker?worker', import.meta.url);
                break;
            case 'css':
            case 'scss':
            case 'less':
                workerUrl = new URL('monaco-editor/esm/vs/language/css/css.worker?worker', import.meta.url);
                break;
            case 'html':
            case 'handlebars':
            case 'razor':
                workerUrl = new URL('monaco-editor/esm/vs/language/html/html.worker?worker', import.meta.url);
                break;
            case 'typescript':
            case 'javascript':
                workerUrl = new URL('monaco-editor/esm/vs/language/typescript/ts.worker?worker', import.meta.url);
                break;
            default:
                workerUrl = new URL('monaco-editor/esm/vs/editor/editor.worker?worker', import.meta.url);
                break;
        }
        // The `?worker` query suffix is a Vite convention to load the module as a web worker
        return new Worker(workerUrl, { type: 'module' });
    }
};


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
    };
    // monaco: typeof monaco; // Optional
  }
}
