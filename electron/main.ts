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
  Menu, // Import Menu
  MenuItemConstructorOptions // Import MenuItemConstructorOptions
} from "electron";
import path from "node:path";
import fs from "node:fs";
const preloadPath = path.join(__dirname, "preload.js");
console.log("Resolved preload path:", preloadPath);
console.log("Preload exists at window creation:", fs.existsSync(preloadPath));

let mainWindow: BrowserWindow | null;
app.commandLine.appendSwitch("enable-logging");  
// --- macOS Standard Menu ---

const isMac = process.platform === "darwin";

const macAppMenu: MenuItemConstructorOptions[] = [
  { role: 'about' as 'about' },
  { type: 'separator' as 'separator' },
  { role: 'services' as 'services' },
  { type: 'separator' as 'separator' },
  { role: 'hide' as 'hide' },
  { role: 'hideOthers' as 'hideOthers' },
  { role: 'unhide' as 'unhide' },
  { type: 'separator' as 'separator' },
  { role: 'quit' as 'quit' },
];

const macWindowMenu: MenuItemConstructorOptions[] = [
  { type: 'separator' as 'separator' },
  { role: 'front' as 'front' },
  { type: 'separator' as 'separator' },
  { role: 'window' as 'window' }, // This role is for managing multiple windows, might not be needed for a single-window app
];


const template: MenuItemConstructorOptions[] = [];

if (isMac) {
  template.push({
    label: app.name,
    submenu: macAppMenu
  });
}

// Add File menu if needed, e.g., for New, Open, Save As...
// template.push({
//   label: 'File',
//   submenu: [
//     isMac ? { role: 'close' as 'close' } : { role: 'quit' as 'quit' }
//   ]
// });

// { role: 'editMenu' }
template.push({
  label: 'Edit',
  submenu: [
    { role: 'undo' as 'undo' },
    { role: 'redo' as 'redo' },
    { type: 'separator' as 'separator' },
    { role: 'cut' as 'cut' },
    { role: 'copy' as 'copy' },
    { role: 'paste' as 'paste' },
    ...(isMac ? [
      { role: 'pasteAndMatchStyle' as 'pasteAndMatchStyle' },
    ] : []),
    { role: 'delete' as 'delete' },
    { role: 'selectAll' as 'selectAll' }
  ]
});

{ role: 'viewMenu' }
template.push({
  label: 'View',
  submenu: [
    { role: 'reload' as 'reload' },
    { role: 'forceReload' as 'forceReload' },
    { role: 'toggleDevTools' as 'toggleDevTools' },
    { type: 'separator' as 'separator' },
    { role: 'resetZoom' as 'resetZoom' },
    { role: 'zoomIn' as 'zoomIn' },
    { role: 'zoomOut' as 'zoomOut' },
    { type: 'separator' as 'separator' },
    { role: 'togglefullscreen' as 'togglefullscreen' }
  ]
});

{ role: 'windowMenu' }
template.push({
  label: 'Window',
  submenu: [
    { role: 'minimize' as 'minimize' },
    { role: 'zoom' as 'zoom' },
    ...(isMac ? macWindowMenu : [
      { role: 'close' as 'close' }
    ])
  ]
});

// { role: 'help' }
template.push({
  role: 'help' as 'help',
  submenu: [
    {
      label: 'Learn More',
      click: async () => {
        const { shell } = require('electron');
        await shell.openExternal('https://electronjs.org'); // Replace with your app's help URL
      }
    }
  ]
});


// Build and set the menu
const menu = Menu.buildFromTemplate(template as MenuItemConstructorOptions[]);
Menu.setApplicationMenu(menu);


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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged, // Enable DevTools only if not packaged
    },
    autoHideMenuBar: true,
    resizable: true, // Allow the window to be resized
    icon: path.join(__dirname, '../src/assets/icons/icons/'), // Set the application icon
  });

  // Load the app content
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:") || url.startsWith("mailto:")) {
      shell.openExternal(url).catch(e => console.error("Failed to open external URL:", e));
    }
    return { action: "deny" }; // Prevent Electron from opening new windows
  });

  // Handle window close event with confirmation if there are unsaved changes
  mainWindow.on("close", async (e) => {
    if (mainWindow) {
      // Prevent the window from closing immediately
      e.preventDefault();
      
      // Check if there are unsaved changes
      const hasUnsavedChanges = await mainWindow.webContents.executeJavaScript('window.hasUnsavedChanges || false');
      
      if (hasUnsavedChanges) {
        // Show confirmation dialog
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Cancel', 'Discard Changes'],
          title: 'Unsaved Changes',
          message: 'You have unsaved changes. Are you sure you want to close?',
          detail: 'Your changes will be lost if you close without saving.',
          cancelId: 0,
          defaultId: 0
        });
        
        // If user confirms (clicked "Discard Changes")
        if (response === 1) {
          // Allow the window to close
          mainWindow.removeAllListeners('close');
          mainWindow.close();
        }
      } else {
        // No unsaved changes, allow the window to close
        mainWindow.removeAllListeners('close');
        mainWindow.close();
      }
    }
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
  try { // Outer try block to catch any unexpected errors in the handler logic
    try { // Inner try block specifically for the fs operation
      const result = await fsFunction(...args);
      // console.log(`IPC: ${operationName} successful: ${targetDesc}`); // Removed success log
      return result;
    } catch (error: any) { // Inner catch block for fs operation errors
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
      console.error(`IPC Error during ${operationName} for ${targetDesc} (stack):`, error.stack); // Log stack trace
      throw new Error(`[IPC] Failed to ${operationName} '${targetDesc}': ${error.message}`);
    }
  } catch (e: any) { // Outer catch block for unexpected handler errors
    console.error(`Unexpected Error in handleFsOperation during ${operationName} for ${targetDesc}:`, e);
    throw e; // Rethrow the unexpected error
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

ipcMain.handle("get-config-path", (): string =>
    handleSyncIpcOperation("get config path", getConfigPath) // Use existing function
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

/**
 * IPC handler to open a directory selection dialog only (no file selection or save).
 * Always restricts to directory navigation, regardless of frontend input.
 */
ipcMain.handle(
  "show-directory-dialog",
  async (_event): Promise<OpenDialogReturnValue> => {
    const ownerWindow = BrowserWindow.getFocusedWindow();
    if (!ownerWindow) {
      console.warn("IPC: show-directory-dialog called with no focused window.");
      return { canceled: true, filePaths: [] };
    }
    return handleAsyncIpcOperation(
      "show directory dialog",
      () =>
        dialog.showOpenDialog(ownerWindow, {
          properties: ["openDirectory", "createDirectory"],
          title: "Select a Directory",
          message: "Please select a directory.",
        })
    );
  }
);

// Handler for selecting a single folder
ipcMain.handle("select-folder", async (_event): Promise<string | null> => {
  const ownerWindow = BrowserWindow.getFocusedWindow();
  if (!ownerWindow) {
    console.warn("IPC: select-folder called with no focused window.");
    return null; // Return null if no window is focused
  }
  return handleAsyncIpcOperation(
    "select folder",
    async () => {
      const result = await dialog.showOpenDialog(ownerWindow, {
        properties: ["openDirectory", "dontAddToRecent"],
        title: "Select Folder",
        message: "Please select a folder.",
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null; // Return null if canceled or no folder selected
      }
      return result.filePaths[0]; // Return the selected folder path
    }
  );
});

// Handler for selecting a single CSV file
ipcMain.handle("select-csv-file", async (_event): Promise<string | null> => {
  const ownerWindow = BrowserWindow.getFocusedWindow();
  if (!ownerWindow) {
    console.warn("IPC: select-csv-file called with no focused window.");
    return null;
  }
  return handleAsyncIpcOperation(
    "select csv file",
    async () => {
      const result = await dialog.showOpenDialog(ownerWindow, {
        properties: ["openFile", "dontAddToRecent"],
        title: "Select CSV File",
        message: "Please select a CSV file.",
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    }
  );
});


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
   console.log(`IPC: writeFileAbsolute called with absolutePath: ${absolutePath}`);
   console.log(`IPC: writeFileAbsolute received content: ${JSON.stringify(content)}`); // Log received content
    // Ensure directory exists first (mkdir handles existing dirs gracefully)
    const dir = path.dirname(absolutePath);
    await handleFsOperation("create directory for write", fs.promises.mkdir, dir, { recursive: true });
    // Now write the file
    console.log(`IPC: Writing file to ${absolutePath}`);
    await handleFsOperation(
        "write file",
        fs.promises.writeFile, // fsFunction
        absolutePath,          // args for fsFunction...
        content,
        "utf-8"
    );
    console.log(`IPC: writeFileAbsolute completed successfully: ${absolutePath}`);
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

async function getPreviousDayNote(_patientId: string, currentDate: string): Promise<string | null> {
 // Logic to determine the previous day's note
 // This is a placeholder, replace with your actual implementation
 const currentDateObj = new Date(currentDate);
 const previousDateObj = new Date(currentDateObj.setDate(currentDateObj.getDate() - 1));
 const previousDate = previousDateObj.toISOString().split('T')[0];
 return previousDate;
}

async function getNextDayNote(_patientId: string, currentDate: string): Promise<string | null> {
 // Logic to determine the next day's note
 // This is a placeholder, replace with your actual implementation
 const currentDateObj = new Date(currentDate);
 const nextDateObj = new Date(currentDateObj.setDate(currentDateObj.getDate() + 1));
 const nextDate = nextDateObj.toISOString().split('T')[0];
 return nextDate;
}

ipcMain.handle('get-previous-day-note', async (_event, patientId: string, currentDate: string): Promise<string | null> => {
 return handleAsyncIpcOperation(
  "get previous day note",
  getPreviousDayNote,
  patientId,
  currentDate
 );
});

ipcMain.handle('get-next-day-note', async (_event, patientId: string, currentDate: string): Promise<string | null> => {
 return handleAsyncIpcOperation(
  "get next day note",
  getNextDayNote,
  patientId,
  currentDate
 );
});

// --- IPC Handlers for Window Management ---

// Handler for setting the unsaved changes flag
ipcMain.handle("set-unsaved-changes", (_event, hasChanges: boolean) => {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(`window.hasUnsavedChanges = ${hasChanges};`);
  }
  return true;
});

// --- App Lifecycle ---

app.whenReady().then(async () => {
  await ensureConfigExists(); // Ensure config is ready before creating window
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  // On macOS it's common to re-create a window when the dock icon is clicked
  // and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

/**
 * Aggregates all patients' notes for a selected day, formats them, and generates a timestamped .txt file.
 * @param date - The date string in YYYY-MM-DD format.
 * @returns The absolute path to the generated .txt file.
 */

/**
 * IPC handler to export notes for a given day and prompt user to save the .txt file.
 * @param date - The date string in YYYY-MM-DD format.
 * @returns The final saved file path, or null if canceled.
 */
/**
 * IPC handler for showing a save dialog.
 * @param options - Electron SaveDialogOptions
 * @returns The result of the save dialog.
 */
ipcMain.handle(
  "show-save-dialog",
  async (_event, options) => {
    const ownerWindow = BrowserWindow.getFocusedWindow();
    if (!ownerWindow) {
      console.warn("IPC: show-save-dialog called with no focused window.");
      return dialog.showSaveDialog(options);
    }
    return dialog.showSaveDialog(ownerWindow, options);
  }
);


// --- Open Directory Handler ---

/**
 * Function to handle the 'open-directory' IPC request in the Electron main process.
 *
 * @param {string} directory - The directory path to be opened.
 * @returns {Promise<string | undefined>} - A promise that resolves with the opened directory path if successful, or undefined if an error occurs.
 * @throws {Error} - Throws an error if the directory cannot be opened or if any other unexpected error occurs.
 */
async function handleOpenDirectory(directory: string): Promise<string | undefined> {
  try {
    const result = await shell.openPath(directory);
    if (result === '') {
      // Success: result is an empty string
      return directory;
    } else {
      // Failure: result is an error message string
      console.error('Error opening directory:', result);
      return undefined;
    }
  } catch (error: any) {
    console.error('Error opening directory:', error);
    throw new Error(`Failed to open directory: ${error.message}`);
  }
}

ipcMain.handle('open-directory', async (_event, directory: string) => {
  return await handleOpenDirectory(directory);
});

