import { ref, readonly, onMounted, computed } from "vue";
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
const configPathDisplay = ref<string | null>(null); // Ref to store the config path for display

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
      console.log("[loadTemplates] Trying fetch with path:", fetchPath);
      const res = await fetch(fetchPath);
      console.log("[loadTemplates] Fetch response ok?", res.ok);
      if (res.ok) {
        cachedTemplates = await res.json();
        console.log("[loadTemplates] Loaded and parsed templates via fetch");
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

  // Helper function to determine the correct config file path
  const getConfigPath = async (): Promise<string> => {
    // Use the reliable IPC call to get the path from the ma   in process
    return await window.electronAPI.getConfigPath();
  };

  const readConfigFile = async (): Promise<AppConfig | null> => {
    try {
      const configPath = await getConfigPath();
      configPathDisplay.value = configPath; // Store the path
      const fileContent = await window.electronAPI.readFileAbsolute(configPath);
      return fileContent ? JSON.parse(fileContent) : null;
    } catch (error: any) {
      console.error("Error reading config file:", error);
      return null;
    }
  };

  const writeConfigFile = async (configData: AppConfig): Promise<void> => {
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
  };

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
    setDataDirectory,
    dataDirectoryChangeFlag: readonly(dataDirectoryChangeFlag),
    configPath: readonly(configPathDisplay), // Expose the config path
    loadMedicalLangConfig,
    loadTemplates,
  };
}
