import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  OpenDialogOptions,
  OpenDialogReturnValue,
} from "electron"; // Add dialog types
import path from "node:path";
import fs from "node:fs";
// electron/main.ts
import { screen } from "electron"; // Add screen
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) { // Keep if you need Squirrel support
//   app.quit();
// }

let mainWindow: BrowserWindow | null;

const createWindow = () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Calculate window dimensions
  const windowWidth = process.env.NODE_ENV === 'development' ? Math.round((width / 3) * 2) : Math.round(width / 3); // 2/3 of screen width in development, 1/3 otherwise
  const windowHeight = height; // 100% of screen height

  // Calculate window position (top right)
  const windowX = width - windowWidth;
  const windowY = 0; // Top edge of screen

  // Create the browser window.
  mainWindow = new BrowserWindow({
    x: windowX,
    y: windowY,
    width: windowWidth,
    height: windowHeight,
    webPreferences: {
      // --- FIX THIS LINE ---
      // It needs to point from dist-electron/main/ up one level and into /preload/
      preload: path.join(__dirname, "../preload/index.js"), // <-- Corrected path
      // --- END FIX ---
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
      // devTools: false,
    },
    // Add other options like icon if needed
    // icon: path.join(__dirname, '../../public/logo.svg') // Example icon path
  });

  // Load the index.html of the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    // VITE_DEV_SERVER_URL is set by Vite >= 3.x.x
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Open the DevTools.
    if (!app.isPackaged) {
      // Only open dev tools if not packaged
      mainWindow.webContents.openDevTools();
    }
  } else {
    // Load the index.html file from the dist folder (adjust path if needed)
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  // Optional: Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith("http:") ||
      url.startsWith("https:") ||
      url.startsWith("mailto:")
    ) {
      try {
        // Use shell module which should be imported: import { shell } from 'electron';
        shell.openExternal(url);
      } catch (e) {
        console.error("Failed to open external URL:", e);
      }
      return { action: "deny" }; // Prevent Electron from opening a new window
    }
    // Handle other protocols or deny if necessary
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};
// --- Get User Data Path (Only for the config file itself) ---
// This is now less critical as data paths depend on config, but keep for config saving
const configBaseDir = app.getPath("userData"); // Config stored directly in userData
console.log("Config file base directory:", configBaseDir);

ipcMain.handle("join-paths", (_event: Electron.IpcMainInvokeEvent, ...paths: string[]): string => {
  try {
    // Basic validation
    if (!paths || paths.length === 0) {
      throw new Error("No paths provided to join.");
    }
    // Filter out any potentially null/undefined/empty strings just in case
    const validPaths = paths.filter(
      (p) => typeof p === "string" && p.length > 0
    );
    if (validPaths.length === 0) {
      throw new Error("No valid path segments provided to join.");
    }
    const joinedPath = path.join(...validPaths);
    // console.log("IPC Handling: Joining paths:", validPaths, "->", joinedPath); // Optional debug log
    return joinedPath;
  } catch (error: any) {
    console.error(`IPC Handling: Error joining paths (${paths}):`, error);
    // Depending on desired behavior, return empty string or re-throw
    // Throwing is better as the promise will reject in the renderer
    throw new Error(`Failed to join paths: ${error.message}`);
  }
});

// NEW: Handler for getting specific Electron paths
ipcMain.handle(
  "get-path",
  (_event: Electron.IpcMainInvokeEvent, name: Parameters<typeof app.getPath>[0]): string => {
    try {
      return app.getPath(name);
    } catch (error) {
      console.error(`Error getting path '${name}':`, error);
      return ""; // Return empty string or throw error
    }
  }
);

// NEW: Handler for showing the open directory dialog
ipcMain.handle(
  "show-open-dialog",
  async (_event: Electron.IpcMainInvokeEvent, options: OpenDialogOptions): Promise<OpenDialogReturnValue> => {
    const mainWindow = BrowserWindow.getFocusedWindow(); // Or get from event sender if preferred
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return await dialog.showOpenDialog(mainWindow, options);
  }
);

// UPDATED: File System Handlers - Now expect ABSOLUTE paths

ipcMain.handle(
  "read-file-absolute",
  async (_event: Electron.IpcMainInvokeEvent, absolutePath: string): Promise<string | null> => {
    console.log("IPC Handling: Reading absolute file:", absolutePath);
    try {
      const fileExists = await fs.promises
        .access(absolutePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
      if (fileExists) {
        return await fs.promises.readFile(absolutePath, "utf-8");
      }
      return null; // File doesn't exist
    } catch (error: any) {
      console.error(
        `IPC Handling: Error reading absolute file ${absolutePath}:`,
        error
      );
      // Only throw specific errors maybe? Or let renderer handle ENOENT
      if (error.code === "ENOENT") return null; // Treat not found as null
      throw new Error(`Failed to read file: ${path.basename(absolutePath)}`);
    }
  }
);

ipcMain.handle(
  "write-file-absolute",
  async (
    _event: Electron.IpcMainInvokeEvent,
    absolutePath: string,
    content: string
  ): Promise<void> => {
    console.log("IPC Handling: Writing absolute file:", absolutePath);
    try {
      const dir = path.dirname(absolutePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(absolutePath, content, "utf-8");
      console.log("IPC Handling: File write successful:", absolutePath); // Add success log
    } catch (error: any) {
      // Log the *specific* error object caught here
      console.error(
        `IPC Handling: fs.promises.writeFile failed for ${absolutePath}:`,
        error
      ); // Detailed log
      console.error("Error Code:", error.code); // Log specific error code if available (e.g., EPERM, EACCES)
      console.error("Error Message:", error.message);
      throw new Error(`Failed to write file: ${path.basename(absolutePath)}`);
    }
  }
);

ipcMain.handle(
  "delete-file-absolute",
  async (
    _event: Electron.IpcMainInvokeEvent,
    absolutePath: string
  ): Promise<void> => {
    console.log("IPC Handling: Deleting absolute file:", absolutePath);
    try {
      const fileExists = await fs.promises
        .access(absolutePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
      if (fileExists) {
        await fs.promises.unlink(absolutePath);
      } else {
        console.log(
          "IPC Handling: File not found, skipping delete:",
          absolutePath
        );
      }
    } catch (error: any) {
      console.error(
        `IPC Handling: Error deleting absolute file ${absolutePath}:`,
        error
      );
      throw new Error(`Failed to delete file: ${path.basename(absolutePath)}`);
    }
  }
);

ipcMain.handle(
  "exists-absolute",
  async (_event: Electron.IpcMainInvokeEvent,absolutePath: string): Promise<boolean> => {
    console.log("IPC Handling: Checking existence (absolute):", absolutePath);
    try {
      await fs.promises.access(absolutePath, fs.constants.F_OK);
      return true;
    } catch (error: any) {
      // If error code is ENOENT, file doesn't exist, return false. Otherwise, log/throw.
      if (error.code === "ENOENT") {
        return false;
      }
      console.error(
        `IPC Handling: Error checking existence for ${absolutePath}:`,
        error
      );
      throw new Error(
        `Failed to check existence for file: ${path.basename(absolutePath)}`
      );
    }
  }
);

ipcMain.handle(
  "mkdir-absolute",
  async (_event: Electron.IpcMainInvokeEvent, absolutePath: string): Promise<void> => {
    console.log("IPC Handling: Creating directory (absolute):", absolutePath);
    try {
      const dirExists = await fs.promises
        .access(absolutePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
      if (!dirExists) {
        await fs.promises.mkdir(absolutePath, { recursive: true });
        console.log(
          "IPC Handling: Directory created successfully (absolute):",
          absolutePath
        );
      } else {
        console.log(
          "IPC Handling: Directory already exists (absolute):",
          absolutePath
        );
      }
    } catch (error: any) {
      console.error(
        `IPC Handling: Error creating directory ${absolutePath}:`,
        error
      );
      throw new Error(
        `Failed to create directory: ${path.basename(absolutePath)}`
      );
    }
  }
);

ipcMain.handle(
  "rmdir-absolute",
  async (
    _event: Electron.IpcMainInvokeEvent,
    absolutePath: string
  ): Promise<void> => {
    console.log("IPC Handling: Removing directory (absolute):", absolutePath);
    try {
      const dirExists = await fs.promises
        .access(absolutePath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
      if (dirExists) {
        await fs.promises.rm(absolutePath, { recursive: true, force: true });
        console.log(
          "IPC Handling: Directory removed successfully (absolute):",
          absolutePath
        );
      } else {
        console.log(
          "IPC Handling: Directory not found, skipping remove:",
          absolutePath
        );
      }
    } catch (error: any) {
      console.error(
        `IPC Handling: Error removing directory ${absolutePath}:`,
        error
      );
      throw new Error(
        `Failed to remove directory: ${path.basename(absolutePath)}`
      );
    }
  }
);

// Keep the confirmation dialog handler
ipcMain.handle(
  "show-confirm-dialog",
  async (
    _event: Electron.IpcMainInvokeEvent,
    options: Electron.MessageBoxOptions
  ) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) return null;
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
  }
);

// Add other IPC handlers (deleteFile, exists, mkdir, rmdir, showConfirmDialog) here,
// ensuring they use `path.join(dataPath, relativePath)`

// --- App Lifecycle ---

app.whenReady().then(createWindow); // Use whenReady() promise

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
