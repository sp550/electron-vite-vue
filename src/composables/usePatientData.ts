// src/composables/usePatientData.ts
import { ref, onMounted, watch } from "vue";
import { v4 as uuidv4 } from "uuid";
import type { Patient } from "@/types";
import { useFileSystemAccess } from "./useFileSystemAccess";
import { useConfig } from "./useConfig";

const patients = ref<Patient[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function usePatientData() {
  const {
    readFileAbsolute,
    writeFileAbsolute,
    mkdirAbsolute,
    rmdirAbsolute,
    showConfirmDialog,
    joinPaths,
    listFiles
  } = useFileSystemAccess();
  const { config, isConfigLoaded, isDataDirectorySet } = useConfig();

  // --- Helpers ---
  const getPatientsFilePath = async (): Promise<string | null> => {
    if (!isDataDirectorySet.value || !config.value.dataDirectory) return null;
    try {
      return await joinPaths(config.value.dataDirectory, "patients.json");
    } catch (error: any) {
      console.error("Error in getPatientsFilePath:", error);
      return null;
    }
  };

  const getPatientNotesDir = async (
    patientId: string,
    patientType: "umrn" | "uuid"
  ): Promise<string | null> => {
    if (!isDataDirectorySet.value || !config.value.dataDirectory) return null;
    try {
      const notesDir = await joinPaths(config.value.dataDirectory, "notes");
      const byTypeDir = await joinPaths(notesDir, `by-${patientType}`);
      const patientDir = await joinPaths(byTypeDir, patientId);
      return patientDir;
    } catch (error: any) {
      console.error("Error in getPatientNotesDir:", error);
      return null;
    }
  };
  // --- End Helpers ---

  const loadPatients = async () => {
    if (!isConfigLoaded.value || !isDataDirectorySet.value) {
      console.warn("loadPatients: Config not loaded or data directory not set.");
      patients.value = [];
      return;
    }

    isLoading.value = true;
    error.value = null;
    const absolutePath = await getPatientsFilePath(); // <-- await here

    if (!absolutePath) {
      error.value = "loadPatients: Could not determine patients file path.";
      isLoading.value = false;
      patients.value = [];
      return;
    }

    console.log("Loading patients from:", absolutePath);
    try {
      const fileContent = await readFileAbsolute(absolutePath);
      if (fileContent) {
        const parsedPatients = JSON.parse(fileContent) as Patient[];
        patients.value = parsedPatients.map(patient => ({
          ...patient,
          type: patient.umrn ? "umrn" : "uuid"
        }));
      } else {
        patients.value = [];
        console.warn("loadPatients: Patients file not found or empty. Initializing.");
      }
    } catch (err: any) {
      console.error("Error loading patients:", err);
      error.value = `Failed to load patients: ${err.message || err}`;
      patients.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const savePatients = async (updatedPatients: Patient[]): Promise<boolean> => {
    const absolutePath = await getPatientsFilePath();
    if (!absolutePath) {
      error.value = "savePatients: Could not determine patients file path.";
      return false;
    }

    console.log("Saving patients to:", absolutePath);
    try {
      await writeFileAbsolute(absolutePath, JSON.stringify(updatedPatients, null, 2));
      patients.value = updatedPatients; // Update reactive state
      return true;
    } catch (err: any) {
      console.error("Error saving patients:", err);
      error.value = `Failed to save patients: ${err.message || err}`;
      return false;
    }
  };



  const addPatient = async (patientData: Omit<Patient, "id" | "type">): Promise<Patient | null> => {
    let newPatientDir: string | null = null;
    try {
    const baseNotesDirCheck = await getPatientNotesDir("", "uuid"); // Check base path validity
    if (!baseNotesDirCheck) {
        error.value = "addPatient: Data directory not configured or invalid.";
      console.error("Add Patient Error: Base notes directory check failed.");
      return null;
    }

    isLoading.value = true;
  error.value = null;

  // Check if patient already exists (re-admission handling)
  if (!patientData.umrn) {
    // Implement search functionality based on patient name or admission date
    // to prompt a potential merge for patients without UMRN, avoiding unnecessary duplication.
    // This is a placeholder for the actual search implementation.
    const existingPatient = patients.value.find(
      (p) => p.name === patientData.name
    );
    if (existingPatient) {
      // Prompt user to merge patients
      const mergeConfirmation = await showConfirmDialog({
        type: "warning",
        buttons: ["Cancel", "Merge Patients", "Create New"],
        defaultId: 0,
        cancelId: 0,
        title: "Potential Duplicate Patient",
        message: `A patient with the name "${patientData.name}" already exists. What do you want to do?`,
        detail: "Merge will combine the patients. Create New will create a new patient with a new UUID.",
      });

      if (mergeConfirmation.response === 1) {
        // Merge patients
        console.log("Merging patients...");
        // Implement merge logic here
        return existingPatient;
      } else if (mergeConfirmation.response === 2) {
        // Create new patient
        console.log("Creating new patient with new UUID...");
        let patientId = uuidv4();
        let patientType = "uuid";
      }
       else {
        console.log("Patient creation cancelled by user.");
        return null;
      }
    }
  }

    let patientId: string = uuidv4();
    let patientType: "umrn" | "uuid" = "uuid";
    let umrnExists = false;

    if (patientData.umrn) {
      patientId = patientData.umrn;
      patientType = "umrn";
      // Check if UMRN directory exists
      const umrnDir = await getPatientNotesDir(patientId, patientType);
      if (umrnDir && await useFileSystemAccess().existsAbsolute(umrnDir)) {
        umrnExists = true;
        newPatientDir = umrnDir;
      }
    } else {
      patientId = uuidv4();
      patientType = "uuid";
    }

    const newPatient: Patient = { ...patientData, id: patientId, type: patientType };
    if (!newPatientDir) {
      newPatientDir = await getPatientNotesDir(patientId, patientType);
    }

      if (!newPatientDir) {
        throw new Error("Could not construct patient notes directory path.");
      }
  
      if (!umrnExists) {
        console.log("Creating notes directory for new patient:", newPatientDir);
        await mkdirAbsolute(newPatientDir);
        console.log("Directory created:", newPatientDir);
      }
  
      const currentPatients = [...patients.value];
      currentPatients.push(newPatient);
  
      console.log("Saving updated patient list...");
      const saveSuccess = await savePatients(currentPatients);
  
      if (saveSuccess) {
        console.log("Patient added successfully:", newPatient.id);
        return newPatient;
      } else {
        console.warn("Saving patient list failed after directory creation. Attempting cleanup...");
        if (newPatientDir && !umrnExists) {
          try {
            await rmdirAbsolute(newPatientDir);
            console.log("Cleaned up created directory:", newPatientDir);
          } catch (cleanupError) {
            console.error("Failed to cleanup created directory:", cleanupError);
          }
        }
        throw new Error("Failed to save updated patient list after adding patient.");
      }
    } catch (err: any) {
      console.error("Error adding patient:", err);
      error.value = `Failed to add patient: ${err.message || err}`;
      // Attempt cleanup again in the main catch block for errors after mkdir but before save completes
      if (newPatientDir) {
        try {
          // Check if it actually exists before trying to remove, might fail during mkdir
          const dirExists = await useFileSystemAccess().existsAbsolute(
            newPatientDir
          );
          if (dirExists) {
            await rmdirAbsolute(newPatientDir);
            console.log(
              "Cleaned up created directory in catch block:",
              newPatientDir
            );
          }
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup created directory during addPatient failure (in catch):",
            cleanupError
          );
        }
      }
      return null; // Indicate failure
    } finally {
      isLoading.value = false;
    }
  };

const moveFiles = async (sourceDir: string, targetDir: string): Promise<void> => {
  const { listFiles, readFileAbsolute, writeFileAbsolute } = useFileSystemAccess();

  try {
    // Ensure the target directory exists
    await useFileSystemAccess().mkdirAbsolute(targetDir);

    // List all files in the source directory
    const files = await listFiles(sourceDir);

    if (files) {
      for (const file of files) {
        const sourcePath = await useFileSystemAccess().joinPaths(sourceDir, file);
        const targetPath = await useFileSystemAccess().joinPaths(targetDir, file);

        // Read the content of the file from the source path
        const fileContent = await readFileAbsolute(sourcePath);

        if (fileContent !== null) {
          // Write the content to the target path
          await writeFileAbsolute(targetPath, fileContent);
        } else {
          console.warn(`Could not read file: ${file}`);
        }
      }
    }

    // Optionally, remove the source directory after moving all files
    await useFileSystemAccess().rmdirAbsolute(sourceDir);
  } catch (error: any) {
    console.error("Error moving files:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
};

const mergePatientData = async (uuid: string, umrn: string): Promise<boolean> => {
  isLoading.value = true;
  error.value = null;

  try {
    const uuidNotesDir = await getPatientNotesDir(uuid, "uuid");
    const umrnNotesDir = await getPatientNotesDir(umrn, "umrn");

    if (!uuidNotesDir) {
      error.value = "UUID notes directory not found.";
      return false;
    }

    if (!umrnNotesDir) {
      // Create the UMRN notes directory if it doesn't exist
      try {
        if (umrnNotesDir) {
          console.log("Creating UMRN notes directory:", umrnNotesDir);
          await useFileSystemAccess().mkdirAbsolute(umrnNotesDir);
          console.log("UMRN notes directory created:", umrnNotesDir);
        } else {
          console.error("UMRN notes directory is null.");
          error.value = "Could not create UMRN notes directory.";
          return false;
        }
      } catch (mkdirError) {
        console.error("Error creating UMRN notes directory:", mkdirError);
        error.value = "Could not create UMRN notes directory.";
        return false;
      }
    }

    // Use a file system operation to move the files
    if (uuidNotesDir && umrnNotesDir) {
      await moveFiles(uuidNotesDir, umrnNotesDir);
    }

    // Update the patient in patients.json
    const absolutePath = await getPatientsFilePath();
    if (!absolutePath) {
      error.value = "Could not determine patients file path.";
      return false;
    }

    const fileContent = await readFileAbsolute(absolutePath);
    if (!fileContent) {
      error.value = "Patients file not found or empty.";
      return false;
    }

    let parsedPatients = JSON.parse(fileContent) as Patient[];
    const patientIndex = parsedPatients.findIndex((p) => p.id === uuid);

    if (patientIndex === -1) {
      error.value = `Patient with UUID ${uuid} not found.`;
      return false;
    }

    // Update the patient's ID, type, and UMRN
    parsedPatients[patientIndex] = {
      ...parsedPatients[patientIndex],
      id: umrn,
      type: "umrn",
      umrn: umrn // Add umrn to the patient object
    };

    // Save the updated patients array back to the file
    await writeFileAbsolute(absolutePath, JSON.stringify(parsedPatients, null, 2));
    patients.value = parsedPatients;

    // Remove the old UUID directory
    try {
      await useFileSystemAccess().rmdirAbsolute(uuidNotesDir);
    } catch (rmdirError) {
      console.warn("Could not remove UUID notes directory:", rmdirError);
      // It's not critical if this fails, so don't return false
    }

    return true;
  } catch (err: any) {
    console.error("Error merging patient data:", err);
    error.value = `Failed to merge patient data: ${err.message || err}`;
    return false;
  } finally {
    isLoading.value = false;
  }
};
const updatePatient = async (updatedPatient: Patient): Promise<boolean> => {
  const absolutePath = await getPatientsFilePath();
  if (!absolutePath) {
    error.value = "Cannot update patient: Data directory not configured.";
    return false;
  }
  isLoading.value = true;
  error.value = null;

  try {
    const currentPatients = [...patients.value];
    const patientIndex = currentPatients.findIndex(
      (p) => p.id === updatedPatient.id
    );
    if (patientIndex === -1) {
      error.value = `Patient with ID ${updatedPatient.id} not found in the list.`;
      return false;
    }

    currentPatients[patientIndex] = { ...updatedPatient };

    const saveSuccess = await savePatients(currentPatients); // Save the modified array
    if (saveSuccess) {
      console.log("Patient list saved successfully after update.");
      return true;
    } else {
      throw new Error("Failed to save updated patient list."); // Let savePatients' catch handle logging
    }
  } catch (err: any) {
    console.error("Error updating patient:", err);
    error.value = `Failed to update patient: ${err.message || err}`;
    return false;
  } finally {
    isLoading.value = false;
  }
};

  // --- REMOVE PATIENT ---
  const removePatient = async (patientId: string): Promise<boolean> => {
    const patientToRemove = patients.value.find((p) => p.id === patientId);
    if (!patientToRemove) {
      error.value = "Patient not found.";
      console.error(
        `Remove Patient Error: Patient with ID ${patientId} not found.`
      );
      return false; // Or maybe true if already gone? False seems safer.
    }

    const notesDir = await getPatientNotesDir(patientId, patientToRemove.type); // Path for the patient's notes dir
    if (!notesDir) {
      error.value =
        "Cannot remove patient: Data directory not configured or invalid.";
      console.error("Remove Patient Error: Notes directory path check failed.");
      return false;
    }

    if (!patients.value.find((p) => p.id === patientId)) {
      error.value = "Patient not found.";
      console.error(
        `Remove Patient Error: Patient with ID ${patientId} not found.`
      );
      return false; // Or maybe true if already gone? False seems safer.
    }

    // --- Confirmation Dialog ---
    console.log(
      `Requesting confirmation to remove patient: ${patientToRemove.name}`
    );
    const confirmation = await showConfirmDialog({
      type: "warning",
      buttons: ["Cancel", "Delete Patient"], // Button order matters, 0=Cancel, 1=Delete
      defaultId: 0,
      cancelId: 0,
      title: "Confirm Deletion",
      message: `Are you sure you want to delete patient "${patientToRemove.name}"?`,
      detail:
        "This action cannot be undone and will delete all associated notes.",
    });

    if (confirmation.response !== 1) {
      // Check if the 'Delete Patient' button (index 1) was clicked
      console.log("Patient removal cancelled by user.");
      return false; // User cancelled
    }
    console.log("User confirmed patient removal.");

    isLoading.value = true;
    error.value = null;
    try {
      // --- Filter out the patient ---
      const updatedPatients = patients.value.filter((p) => p.id !== patientId);

      // --- Save the updated patient list ---
      console.log("Saving updated patient list (after removal)...");
      const saveSuccess = await savePatients(updatedPatients); // savePatients handles updating ref

      if (saveSuccess) {
        // --- Remove the patient's notes directory *after* successful save ---
        console.log(
          "Patient list saved. Removing patient notes directory:",
          notesDir
        );
        await rmdirAbsolute(notesDir); // Attempt removal
        console.log("Patient removed successfully:", patientId);
        return true;
      } else {
        // If saving the patient list failed, do NOT remove the directory
        console.error(
          "Failed to save patient list after filtering for removal."
        );
        // Error should be set by savePatients
        throw new Error("Failed to save patient list after removing patient.");
      }
    } catch (err: any) {
      console.error("Error removing patient:", err);
      error.value = `Failed to remove patient: ${err.message || err}`;
      // Consider reloading patients to revert local state if save failed,
      // but this might cause UI flicker or mask the root cause.
      // await loadPatients();
      return false; // Indicate failure
    } finally {
      isLoading.value = false;
    }
  };

  const getPatientById = (patientId: string): Patient | undefined => {
    return patients.value.find((p) => p.id === patientId);
  };

  // Watch for config changes (specifically dataDirectory being set/unset) and reload patients
  watch(
    [isConfigLoaded, isDataDirectorySet],
    ([loaded, dirSet], [oldLoaded, oldDirSet]) => {
      console.log(
        `Config watcher triggered: loaded=${loaded}, dirSet=${dirSet}`
      );
      if (loaded && dirSet) {
        // Reload patients only if the directory was *just* set or changed
        // Or if the config just finished loading and the directory *is* set
        if (dirSet !== oldDirSet || (loaded && !oldLoaded)) {
          console.log("Config loaded and directory set, reloading patients...");
          loadPatients();
        }
      } else if (loaded && !dirSet) {
        // Config loaded, but no directory set
        console.log(
          "Config loaded, but no data directory set. Clearing patients."
        );
        patients.value = []; // Clear patients if directory becomes unset
        error.value = "Data directory not configured. Please select one.";
      }
    },
    { immediate: false }
  );

  onMounted(() => {
    if (isConfigLoaded.value && isDataDirectorySet.value) {
      loadPatients();
    }
  });

  return {
    patients,
    isLoading,
    error,
    loadPatients, // Expose loadPatients if manual reload is needed
    addPatient,
    removePatient,
    getPatientById,
    updatePatient,
    savePatients,
    mergePatientData,
    listFiles

  };
}