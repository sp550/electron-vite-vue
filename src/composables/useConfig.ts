import { ref, readonly, onMounted, onUnmounted, computed } from "vue";
import type { AppConfig } from "@/types";

// --- Caching for medicalLangConfig and templates ---
let cachedMedicalLangConfig: any = null;
let cachedTemplates: any = null;

const isLoading = ref(false);
const error = ref<string | null>(null);

const defaultConfig: AppConfig = {
  dataDirectory: null, // Default to null, meaning not configured
  notesBaseDir: "notes",
  theme: "light",
  iCMListDirectory: null, // Default path for iCM list
  adaptSystemTheme: false, // Add new property
};

// Hardcoded fallback for medicalLangConfig (minimal, can be expanded)
const fallbackMedicalLangConfig = {
  language: {
    id: "medical-notes",
    extensions: [".mednote", ".mnote"],
    aliases: ["Medical Notes", "mednote"],
    tokenizer: {
      root: [
        ["^//\\s*.*", "header"],
        ["^#\\s*.*", "issue"],
        ["\\b(chase|examine|request|addon)\\b", "action"],
        [".*[A-Z]\\d{7}.*", "umrn"],
        ["\\[x\\]", "green"],
        ["\\[xx\\]", "dark-green"],
        ["\\[\\s*\\]", "red"]
      ]
    }
  },
  theme: {
    id: "medical-notes-theme",
    base: "vs",
    inherit: true,
    rules: [],
    colors: {}
  },
  keyTerms: [],
  templates: {}
};

// Hardcoded fallback for templates (minimal, can be expanded)
const fallbackTemplates = [
  {
    label: "Presenting Complaint",
    insertText: "Presenting Complaint: ",
    detail: "Section header for presenting complaint"
  }
];

const config = ref<AppConfig>({ ...defaultConfig });
const isConfigLoaded = ref(false);
const dataDirectoryChangeFlag = ref(0); // Used to trigger reactivity on path change
// Cross-platform path join helper (moved to module scope)
function joinPath(...parts: string[]) {
  // Join with "/" and remove duplicate slashes
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}
// --- Loader for medicalLangConfig.json ---
export async function loadMedicalLangConfig(forceReload = false): Promise<any> {
  if (cachedMedicalLangConfig && !forceReload) {
    return cachedMedicalLangConfig;
  }
  const dataDir = config.value.dataDirectory;

  const configFilePath = dataDir
    ? joinPath(dataDir, "config", "medicalLangConfig.json")
    : "public/medicalLangConfig.json";

  try {
    // Try Electron API first (absolute path)
    const fileContent = await window.electronAPI.readFileAbsolute(configFilePath);
    if (fileContent) {
      cachedMedicalLangConfig = JSON.parse(fileContent);
      return cachedMedicalLangConfig;
    }
  } catch (e) {
    console.error("[loadMedicalLangConfig] Electron API error:", e);
    // Try fallback path (for dev or web context)
    try {
      const fetchPath = dataDir
        ? joinPath(dataDir, "config", "medicalLangConfig.json")
        : "/public/medicalLangConfig.json";
      const res = await fetch(fetchPath);
      if (res.ok) {
        cachedMedicalLangConfig = await res.json();
        return cachedMedicalLangConfig;
      }
    } catch (e2) {
      console.error("[loadMedicalLangConfig] Fetch error:", e2);
      // Ignore, fallback below
    }
  }
  console.warn("[loadMedicalLangConfig] Using fallbackMedicalLangConfig");
  cachedMedicalLangConfig = fallbackMedicalLangConfig;
  return cachedMedicalLangConfig;
}

// --- Loader for templates.json ---
export async function loadTemplates(forceReload = false): Promise<any[]> {
  if (cachedTemplates && !forceReload) {
    return cachedTemplates;
  }
  const dataDir = config.value.dataDirectory;

  const templatesFilePath = dataDir
    ? joinPath(dataDir, "config", "templates.json")
    : "public/templates.json";

  try {
    const fileContent = await window.electronAPI.readFileAbsolute(templatesFilePath);
    if (fileContent) {
      cachedTemplates = JSON.parse(fileContent);
      return cachedTemplates;
    }
  } catch (e) {
    console.error("[loadTemplates] Electron API error:", e);
    try {
      const fetchPath = dataDir
        ? joinPath(dataDir, "config", "templates.json")
        : "/public/templates.json";
      const res = await fetch(fetchPath);
      if (res.ok) {
        cachedTemplates = await res.json();
        return cachedTemplates;
      }
    } catch (e2) {
      console.error("[loadTemplates] Fetch error:", e2);
      // Ignore, fallback below
    }
  }

  console.warn("[loadTemplates] Using fallbackTemplates");
  cachedTemplates = fallbackTemplates;
  return cachedTemplates;
}

export function useConfig() {

  // New ref for system theme state
  const systemThemeIsDark = ref(false);

  // Define the listener callback
  const systemThemeListener = (_event: Electron.IpcRendererEvent, isDark: boolean) => {
    systemThemeIsDark.value = isDark;
  };

  // Set up listener
  window.electronAPI.onSystemThemeUpdated(systemThemeListener);

  // Cleanup listener on unmount
  onUnmounted(() => {
    // Use removeListener with the specific callback
    window.electronAPI.removeSystemThemeUpdated(systemThemeListener);
  });

  // Function to fetch system theme from main process
  const fetchSystemTheme = async () => {
    try {
      systemThemeIsDark.value = await window.electronAPI.getSystemTheme();
    } catch (error) {
      console.error("Failed to fetch system theme:", error);
      // Default to false (light) on error
      systemThemeIsDark.value = false;
    }
  };

  // Computed property for the effective theme
  const effectiveTheme = computed(() => {
    if (config.value.adaptSystemTheme) {
      return systemThemeIsDark.value ? 'dark' : 'light';
    }
    return config.value.theme;
  });

async function getConfigPath(): Promise<string> {
  // Use the reliable IPC call to get the path from the main process
  return await window.electronAPI.getConfigPath();
}

async function readConfigFile(): Promise<AppConfig | null> {
  try {
    const configPath = await getConfigPath();
    const fileContent = await window.electronAPI.readFileAbsolute(configPath);
    return fileContent ? JSON.parse(fileContent) : null;
  } catch (error: any) {
    console.error("Error reading config file:", error);
    return null;
  }
}

async function writeConfigFile(configData: AppConfig): Promise<void> {
  try {
    const configPath = await getConfigPath();
    await window.electronAPI.writeFileAbsolute(
      configPath,
      JSON.stringify(configData, null, 2)
    );
  } catch (error: any) {
    console.error("Error writing config file:", error);
    throw error; // Re-throw to be caught by caller
  }
}


  const configPathDisplay = ref<string | null>(null); // Ref to store the config path for display

  const loadConfig = async () => {
    if (isConfigLoaded.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      const loadedConfig = await readConfigFile();
      if (loadedConfig) {
        // Merge defaults with loaded config to handle missing properties
        config.value = { ...defaultConfig, ...loadedConfig };
      } else {
        // No config file found, use defaults and save it for the first time
        config.value = { ...defaultConfig };
        await writeConfigFile(config.value); // Save the default config
      }
      isConfigLoaded.value = true;
      // Fetch initial system theme


    } catch (err: any) {
      console.error("Error loading or parsing config:", err);
      error.value = `Failed to load configuration: ${err.message}. Using defaults.`;
      config.value = { ...defaultConfig }; // Fallback to defaults on error
      // Attempt to get path even on error, might still be useful for debugging
      try {
        configPathDisplay.value = await getConfigPath();
      } catch (pathError) {
        console.error("Could not determine config path on error:", pathError);
        configPathDisplay.value = "Error determining path";
      }
      isConfigLoaded.value = true; // Mark as loaded even on error
    } finally {
      isLoading.value = false;
    }
  };

  const saveConfig = async (): Promise<boolean> => {
    isLoading.value = true;
    try {
      await writeConfigFile(config.value);
      return true;
    } catch (err) {
      error.value = `Failed to save configuration: ${err}`;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  const updateTheme = (newTheme: "light" | "dark"): void => {
    config.value.theme = newTheme;
  };

  const updateAdaptSystemTheme = async (value: boolean) => {
    config.value.adaptSystemTheme = value;
    await saveConfig(); // Encapsulate saveConfig here
  };


  const setDataDirectory = async (newPath: string | null): Promise<boolean> => {
    if (config.value.dataDirectory !== newPath) {
      config.value.dataDirectory = newPath;
      const saved = await saveConfig();
      if (saved) {
        dataDirectoryChangeFlag.value++; // Trigger update only if save succeeded
      }
      return saved;
    }
    return true; // No change was needed
  };

  onMounted(async () => {
    await loadConfig();
    await fetchSystemTheme(); // Fetch initial system theme here
  });

  const isDataDirectorySet = computed(() => !!config.value.dataDirectory);

  return {
    config: readonly(config),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isConfigLoaded: readonly(isConfigLoaded),
    isDataDirectorySet,
    loadConfig,
    saveConfig,
    updateTheme,
    setDataDirectory,
    dataDirectoryChangeFlag: readonly(dataDirectoryChangeFlag),
    configPath: readonly(configPathDisplay),
    loadMedicalLangConfig,
    loadTemplates,
    // Expose new properties and functions
    systemThemeIsDark: readonly(systemThemeIsDark),
    effectiveTheme,
    updateAdaptSystemTheme,
  };
}
