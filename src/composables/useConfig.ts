// src/composables/useConfig.ts
import { ref, readonly, onMounted, computed } from "vue";
import type { AppConfig } from "@/types";
import { useFileSystemAccess } from "./useFileSystemAccess"; // Assuming this will handle userData paths for config

const CONFIG_FILENAME = "config.json"; // Config file stored in userData
const isLoading = ref(false);
const error = ref<string | null>(null);

const defaultConfig: AppConfig = {
  dataDirectory: null, // Default to null, meaning not configured
  patientsFilename: "patients.json",
  notesBaseDir: "notes",
  theme: "light",
};

// Use a reactive ref for the configuration object
const config = ref<AppConfig>({ ...defaultConfig });

// Flag to indicate if config has been loaded initially
const isConfigLoaded = ref(false);

export function useConfig() {
  // We need file system access specific to userData for the config file itself
  // Let's add dedicated functions for this specific purpose, separate from the
  // main data file access which will become path-aware.
    const { joinPaths } = useFileSystemAccess(); // Get the async joinPaths

    const readConfigFile = async (): Promise<string | null> => {
      try {
        const userDataPath = await window.electronAPI.getPath("userData");
        if (!userDataPath) throw new Error("Could not get userData path.");
        // Use the async joinPaths
        const configPath = await joinPaths(userDataPath, CONFIG_FILENAME); // <-- await here
        return await window.electronAPI.readFileAbsolute(configPath);
      } catch (error: any) {
        /* ... error handling ... */
        return null
      }
    };
    
    const writeConfigFile = async (configData: AppConfig): Promise<boolean> => {
      try {
        const userDataPath = await window.electronAPI.getPath("userData");
        if (!userDataPath) throw new Error("Could not get userData path.");
        // Use the async joinPaths
        const configPath = await joinPaths(userDataPath, CONFIG_FILENAME); // <-- await here
        await window.electronAPI.writeFileAbsolute(
          configPath,
          JSON.stringify(configData, null, 2)
        );
        return true;
      } catch (error: any) {
        /* ... error handling ... */
        return false
      }
    };
  const loadConfig = async () => {
    if (isConfigLoaded.value) return; // Don't reload if already loaded
    isLoading.value = true;
    error.value = null;
    console.log("Loading configuration...");
    try {
      const fileContent = await readConfigFile();
      if (fileContent) {
        const loadedConfig = JSON.parse(fileContent);
        // Merge defaults with loaded config to handle missing properties
        config.value = { ...defaultConfig, ...loadedConfig };
        console.log("Configuration loaded:", config.value);
      } else {
        // No config file found, use defaults and save it for the first time
        console.log("No config file found, using defaults and saving.");
        config.value = { ...defaultConfig };
        await saveConfig(); // Save the default config initially
      }
      isConfigLoaded.value = true;
    } catch (err: any) {
      console.error("Error loading or parsing config:", err);
      error.value = `Failed to load configuration: ${err.message}. Using defaults.`;
      config.value = { ...defaultConfig }; // Fallback to defaults on error
      isConfigLoaded.value = true; // Mark as loaded even on error to avoid loops
    } finally {
      isLoading.value = false;
    }
  };

  const saveConfig = async (): Promise<boolean> => {
    if (!isConfigLoaded.value) {
      console.warn("Attempted to save config before initial load.");
      return false; // Prevent saving before load is complete
    }
    isLoading.value = true; // Indicate saving activity
    console.log("Saving configuration:", config.value);
    const success = await writeConfigFile(config.value);
    isLoading.value = false; // Clear saving activity indicator
    if (success) {
      console.log("Configuration saved successfully.");
    }
    return success;
  };

  const setDataDirectory = async (newPath: string | null): Promise<boolean> => {
    console.log("Setting data directory to:", newPath);
    if (config.value.dataDirectory !== newPath) {
      config.value.dataDirectory = newPath;
      // Immediately save the config change
      return await saveConfig();
    }
    return true; // No change needed
  };

  // Ensure config is loaded when the composable is first used
  onMounted(() => {
    loadConfig();
  });

  // Computed property to check if the essential data directory is set
  const isDataDirectorySet = computed(() => !!config.value.dataDirectory);

  return {
    config: readonly(config), // Provide read-only access to reactive config state
    isLoading: readonly(isLoading),
    error: readonly(error),
    isConfigLoaded: readonly(isConfigLoaded),
    isDataDirectorySet,
    loadConfig,
    saveConfig, // Expose save if needed externally
    setDataDirectory,
  };
}
