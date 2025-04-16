import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  screen, // Added screen import
  OpenDialogOptions,
  OpenDialogReturnValue,
  MessageBoxOptions,
  MessageBoxReturnValue,
} from "electron";
import path from "node:path";
import fs from "node:fs";

let mainWindow: BrowserWindow | null;

// --- Window Creation ---

const createWindow = () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Window dimensions (2/3 width in dev, 1/3 otherwise, full height)
  const widthFraction = process.env.NODE_ENV === 'development' ? 2 / 3 : 1 / 3;
  const windowWidth = Math.round(width * widthFraction);
  const windowHeight = height;

  // Window position (top right)
  const windowX = width - windowWidth;
  const windowY = 0;

  mainWindow = new BrowserWindow({
    x: windowX,
    y: windowY,
    width: windowWidth,
    height: windowHeight,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged, // Enable DevTools only if not packaged
    },
    autoHideMenuBar: true,
    // icon: path.join(__dirname, '../../public/logo.svg') // Optional: Uncomment and set path if you have an icon
  });

  // Load the app content
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:") || url.startsWith("mailto:")) {
      shell.openExternal(url).catch(e => console.error("Failed to open external URL:", e));
    }
    return { action: "deny" }; // Prevent Electron from opening new windows
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

// --- IPC Helper for File System Operations ---

/**
 * Handles common logic for file system IPC calls (try/catch, logging, error standardization).
 * @param operationName Descriptive name of the operation (e.g., "read file").
 * @param fsFunction The `fs.promises` function to execute.
 * @param args Arguments for the `fs.promises` function.
 * @returns The result of the fsFunction, or null/empty array for handled errors (like ENOENT).
 */
async function handleFsOperation<T>(
  operationName: string,
  fsFunction: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<T | null | string[]> {
  const targetDesc = typeof args[0] === 'string' ? path.basename(args[0]) : operationName.split(' ')[0];
  try {
    const result = await fsFunction(...args);
    // console.log(`IPC: ${operationName} successful: ${targetDesc}`); // Removed success log
    return result;
  } catch (error: any) {
    // Handle common non-fatal errors gracefully first
    if (error.code === 'ENOENT') {
      if (operationName.includes('read') || operationName.includes('delete') || operationName.includes('list')) {
        console.warn(`IPC: Target not found for ${operationName} on ${targetDesc}, returning null/empty.`);
        return operationName.includes('list') ? [] : null;
      }
      // For mkdir/rmdir/write, ENOENT might be handled by options or is an actual error.
      // Let it fall through if not handled by options like recursive:true.
    }

    // Log other errors and rethrow a standardized error
    console.error(`IPC Error during ${operationName} for ${targetDesc}:`, error.message);
    throw new Error(`[IPC] Failed to ${operationName} '${targetDesc}': ${error.message}`);
  }
}

/**
 * Handles common logic for non-FS IPC calls (try/catch, logging, error standardization).
 * @param operationName Descriptive name of the operation (e.g., "join paths").
 * @param syncFunction The synchronous function to execute.
 * @param args Arguments for the function.
 * @returns The result of the function.
 */
function handleSyncIpcOperation<T>(
    operationName: string,
    syncFunction: (...args: any[]) => T,
    ...args: any[]
): T {
    try {
        return syncFunction(...args);
    } catch (error: any) {
        console.error(`IPC Error during ${operationName}:`, error);
        throw new Error(`[IPC] Failed to ${operationName}: ${error.message}`);
    }
}

/**
 * Handles common logic for async non-FS IPC calls (try/catch, logging, error standardization).
 * @param operationName Descriptive name of the operation (e.g., "show dialog").
 * @param asyncFunction The asynchronous function to execute.
 * @param args Arguments for the function.
 * @returns The result of the function.
 */
async function handleAsyncIpcOperation<T>(
    operationName: string,
    asyncFunction: (...args: any[]) => Promise<T>,
    ...args: any[]
): Promise<T> {
    try {
        return await asyncFunction(...args);
    } catch (error: any) {
        console.error(`IPC Error during ${operationName}:`, error);
        throw new Error(`[IPC] Failed to ${operationName}: ${error.message}`);
    }
}


// --- IPC Handlers ---

// -- Environment --
ipcMain.handle("is-packaged", () => app.isPackaged);

// -- Path Handling --
ipcMain.handle("join-paths", (_event, ...paths: string[]): string =>
    handleSyncIpcOperation("join paths", (...args: string[]) => {
        const validPaths = args.filter(p => typeof p === "string" && p.length > 0);
        if (validPaths.length === 0) {
            throw new Error("No valid path segments provided.");
        }
        return path.join(...validPaths);
    }, ...paths)
);

ipcMain.handle("get-path", (_event, name: Parameters<typeof app.getPath>[0]): string =>
    handleSyncIpcOperation(`get path '${name}'`, app.getPath, name)
);

ipcMain.handle("get-app-path", (): string =>
    handleSyncIpcOperation("get app path", () => path.dirname(app.getPath("exe")))
);


// -- Dialogs --
ipcMain.handle(
  "show-open-dialog",
  (_event, options: OpenDialogOptions): Promise<OpenDialogReturnValue> => {
    const ownerWindow = BrowserWindow.getFocusedWindow();
    if (!ownerWindow) {
        console.warn("IPC: show-open-dialog called with no focused window.");
        return Promise.resolve({ canceled: true, filePaths: [] }); // Return resolved promise
    }
    return handleAsyncIpcOperation(
        "show open dialog",
        dialog.showOpenDialog,
        ownerWindow,
        options
    );
  }
);

ipcMain.handle(
  "show-confirm-dialog",
  (_event, options: MessageBoxOptions): Promise<MessageBoxReturnValue> => {
    const ownerWindow = BrowserWindow.getFocusedWindow();
     if (!ownerWindow) {
        console.warn("IPC: show-confirm-dialog called with no focused window.");
        return Promise.resolve({ response: -1, checkboxChecked: false }); // Return resolved promise
    }
     return handleAsyncIpcOperation(
        "show confirm dialog",
        dialog.showMessageBox,
        ownerWindow,
        options
    );
  }
);

// -- File System Operations (using helper) --

ipcMain.handle(
  "read-file-absolute",
  (_event, absolutePath: string) =>
    handleFsOperation(
        "read file",
        (p: string) => fs.promises.readFile(p, "utf-8"), // Wrap to specify encoding
        absolutePath
    )
);

ipcMain.handle(
  "write-file-absolute",
  async (_event, absolutePath: string, content: string): Promise<void> => {
    // Ensure directory exists first (mkdir handles existing dirs gracefully)
    const dir = path.dirname(absolutePath);
    await handleFsOperation("create directory for write", fs.promises.mkdir, dir, { recursive: true });
    // Now write the file
    await handleFsOperation(
        "write file",
        fs.promises.writeFile, // fsFunction
        absolutePath,          // args for fsFunction...
        content,
        "utf-8"
    );
    // Returns Promise<void>, so result is implicitly null on success via handleFsOperation
  }
);

ipcMain.handle(
  "delete-file-absolute",
  (_event, absolutePath: string) =>
    handleFsOperation("delete file", fs.promises.unlink, absolutePath)
);

// Use fs.promises.access for explicit existence check, as it's the standard way
ipcMain.handle(
  "exists-absolute",
  async (_event, absolutePath: string): Promise<boolean> => {
    // console.log(`IPC: Checking existence: ${path.basename(absolutePath)}`); // Removed log
    try {
      await fs.promises.access(absolutePath, fs.constants.F_OK);
      // console.log(`IPC: Existence check successful (exists): ${path.basename(absolutePath)}`); // Removed log
      return true;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // console.log(`IPC: Existence check successful (does not exist): ${path.basename(absolutePath)}`); // Removed log
        return false; // File does not exist
      }
      // Other errors (e.g., permissions) should be thrown
      console.error(`IPC Error checking existence for ${path.basename(absolutePath)}:`, error);
      throw new Error(`[IPC] Failed to check existence for ${path.basename(absolutePath)}: ${error.message}`);
    }
  }
);

ipcMain.handle(
  "mkdir-absolute",
  (_event, absolutePath: string) =>
    // recursive: true handles already existing directory gracefully
    handleFsOperation("create directory", fs.promises.mkdir, absolutePath, { recursive: true })
);

ipcMain.handle(
  "rmdir-absolute",
  (_event, absolutePath: string) =>
    // recursive: true and force: true handle non-existence and non-empty dirs
    handleFsOperation("remove directory", fs.promises.rm, absolutePath, { recursive: true, force: true })
);

ipcMain.handle(
  "move-files", // Can rename/move files or directories
  (_event, sourcePath: string, destPath: string) =>
    handleFsOperation("move/rename", fs.promises.rename, sourcePath, destPath)
);

ipcMain.handle(
  "list-files",
  (_event, absolutePath: string) =>
    handleFsOperation("list files", fs.promises.readdir, absolutePath)
);

// -- Config Handling --
const DEFAULT_CONFIG = {
  dataDirectory: "./data", // Relative to app resources path
  patientsFilename: "patients.json",
  notesBaseDir: "notes",
  theme: "light",
};

function getConfigPath(): string {
    const appExePath = app.getPath("exe");
    const appDir = path.dirname(appExePath);
    // Place config inside a 'resources' subdirectory relative to the executable
    // This is a common pattern, adjust if your build process places it elsewhere
    return path.join(appDir, "resources", "config.json");
}


async function ensureConfigExists() {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  try {
    // Ensure directory exists first
    await fs.promises.mkdir(configDir, { recursive: true });
    // Try accessing the file
    await fs.promises.access(configPath, fs.constants.F_OK);
    console.log("Config file exists:", configPath);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // Config file doesn't exist, create it with defaults
      console.log("Config file not found, creating with defaults:", configPath);
      try {
        await fs.promises.writeFile(
          configPath,
          JSON.stringify(DEFAULT_CONFIG, null, 2), // Pretty print JSON
          "utf-8"
        );
        console.log("Default config file created successfully:", configPath);
      } catch (writeError: any) {
        console.error("Fatal: Error creating default config file:", writeError);
        // Consider showing an error dialog to the user here
        dialog.showErrorBox("Configuration Error", `Failed to create the configuration file at ${configPath}. Please check permissions. Error: ${writeError.message}`);
        app.quit(); // Exit if config cannot be created
      }
    } else {
      // Other access errors (e.g., permissions)
      console.error("Fatal: Error accessing config file:", error);
      dialog.showErrorBox("Configuration Error", `Failed to access the configuration file at ${configPath}. Please check permissions. Error: ${error.message}`);
      app.quit(); // Exit if config cannot be accessed
    }
  }
}

ipcMain.handle("get-config-value", async (_event, key: string): Promise<any> => {
  const configPath = getConfigPath();
  try {
    const configContent = await fs.promises.readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);
    if (key in config) {
        return config[key];
    } else {
        console.warn(`IPC: Config key "${key}" not found, returning default or null.`);
        // Return default value if available, otherwise null/undefined
        return key in DEFAULT_CONFIG ? DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG] : undefined;
    }
  } catch (error: any) {
    console.error(`IPC Error getting config value for key "${key}" from ${configPath}:`, error);
    // Don't throw here, maybe return default or undefined
    // throw new Error(`[IPC] Failed to get config value for key ${key}: ${error.message}`);
     return key in DEFAULT_CONFIG ? DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG] : undefined;
  }
});


// --- App Lifecycle ---

app.whenReady().then(async () => {
  await ensureConfigExists(); // Ensure config is ready before creating window
  createWindow();
});

app.on("window-all-closed", () => {
  // Quit when all windows are closed, except on macOS
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window when the dock icon is clicked
  // and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
