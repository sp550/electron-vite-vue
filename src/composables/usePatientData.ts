// src/composables/usePatientData.ts
import { ref, onMounted, watch, computed } from "vue"; // Added computed
import { v4 as uuidv4 } from "uuid";
import Papa from "papaparse";
import type { Patient } from "@/types"; // Import the updated interface
import { useFileSystemAccess } from "./useFileSystemAccess";
import { useConfig } from "./useConfig";
import { parsePatientName } from "@/utils/nameParser"; // Import the name parsing utility


// --- Date Navigation State (from useDateNavigation) ---
const dateMenu = ref(false);
const allowedDates = ref<string[]>([]);
const todayString = () => new Date().toISOString().split("T")[0]; // Revert to function

// --- Note Date (YYYY-MM-DD) ---

// --- Active Patient List Date (YYYY-MM-DD) ---
const activePatientListDate = ref<string>(todayString()); // Use the function call

// --- List of available patient list snapshot dates ---
const availablePatientListDates = ref<string[]>([]);

const patients = ref<Patient[]>([]); // Use the imported Patient type
// Store the original (custom) order of patients for "Custom Sort"
const customOrder = ref<Patient[]>([]);
// Data structure to map patient names to UMRN (if available)
const patient_identifierArray = ref<Record<string, string>>({});

// Helper function to update patient_identifierArray
const updatePatientIdentifierArray = (patientList: Patient[]) => {
  const newMap: Record<string, string> = {};
  patientList.forEach(patient => {
    // Use rawName for the identifier map if available, otherwise use fullName or id
    const identifier = patient.rawName || patient.fullName || patient.id;
    if (identifier && patient.umrn) {
      // Handle potential identifier collisions if necessary, for now, last one wins
      newMap[identifier] = patient.umrn;
    }
  });
  patient_identifierArray.value = newMap;
};
const isLoading = ref(false);
const error = ref<string | null>(null);

export function usePatientData() {
  // --- Date Display Computed (from useDateNavigation) ---
  const noteDateDisplay = computed(() => (dateString: string) => {
    try {
      const [year, month, day] = dateString.split('-');
      const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    } catch {
      return dateString;
    }
  });

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

/**
 * Set the active patient list date and reload patients.
 * Also updates selectedDate for date navigation.
 */
const setActivePatientListDate = async (date: string) => {
  activePatientListDate.value = date;
  await loadPatients();
};

/**
 * Handler for when the date is changed via UI (from useDateNavigation).
 */
const onDateChange = async () => {
  // Logic related to date change can be added here if needed in the future,
  // but for now, the date state is managed externally in App.vue.
};

const goToPreviousNoteDay = (currentDateString: string): string => {
  const [year, month, day] = currentDateString.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  dateObj.setUTCDate(dateObj.getUTCDate() - 1);
  return dateObj.toISOString().split('T')[0];
};

const goToNextNoteDay = (currentDateString: string): string => {
  const [year, month, day] = currentDateString.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  dateObj.setUTCDate(dateObj.getUTCDate() + 1);
  return dateObj.toISOString().split('T')[0];
};

// --- List available patient list snapshot dates in the data directory ---
const listAvailablePatientListDates = async (): Promise<string[]> => {
  if (!isDataDirectorySet.value || !config.value.dataDirectory) return [];
  try {
    const patientListsDir = await joinPaths(config.value.dataDirectory, 'patient-lists');
    const files = (await listFiles(patientListsDir)) ?? [];
    // Match files like patients_YYYY-MM-DD.json
    const dateRegex = /^patients_(\d{4}-\d{2}-\d{2})\.json$/;
    const dates = files
      .map((file: string) => {
        const match = file.match(dateRegex);
        return match ? match[1] : null;
      })
      .filter((date: string | null): date is string => !!date)
      .sort()
      .reverse(); // Most recent first
    availablePatientListDates.value = dates;
    return dates;
  } catch (error) {
    console.error("Error listing patient list snapshot files:", error);
    availablePatientListDates.value = [];
    return [];
  }
};

/**
 * Go to the previous available patient list date.
 */
/**
 * Navigates to a specific patient list date.
 * If the patient list file for the date does not exist, it creates a new empty one.
 * @param date The date string (YYYY-MM-DD) to navigate to.
 */
const navigateToPatientListDate = async (date: string) => {
  const filePath = await getPatientsFilePathForDate(date);

  if (!filePath) {
    console.error(`Could not determine file path for date: ${date}`);
    return; // Cannot proceed without a valid file path
  }

  const fileExists = await useFileSystemAccess().existsAbsolute(filePath);

  if (fileExists) {
    await setActivePatientListDate(date);
  } else {
    console.log(`No patient list file found for date: ${date}. Creating a new one.`);
    try {
      await useFileSystemAccess().writeFileAbsolute(filePath, JSON.stringify([], null, 2));
      console.log(`Created new patient list file for ${date}`);
      await setActivePatientListDate(date); // Navigate to the newly created file
    } catch (error) {
      console.error(`Error creating patient list file for ${date}:`, error);
      // Optionally, provide user feedback about the creation failure
    }
  }
};

/**
 * Go to the previous patient list date.
 * Creates a new file if one does not exist for the previous day.
 */
const goToPreviousPatientListDay = async () => {
  const [year, month, day] = activePatientListDate.value.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  dateObj.setUTCDate(dateObj.getUTCDate() - 1);
  const prevDate = dateObj.toISOString().split('T')[0];
  await navigateToPatientListDate(prevDate);
};

/**
 * Go to the next patient list date.
 * Creates a new file if one does not exist for the next day.
 */
const goToNextPatientListDay = async () => {
  const [year, month, day] = activePatientListDate.value.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  dateObj.setUTCDate(dateObj.getUTCDate() + 1);
  const nextDate = dateObj.toISOString().split('T')[0];
  await navigateToPatientListDate(nextDate);
};

// Helper function to get patient file path for a specific date
const getPatientsFilePathForDate = async (date: string): Promise<string | null> => {
  if (!isDataDirectorySet.value || !config.value.dataDirectory) return null;
  try {
    const patientListsDir = await joinPaths(config.value.dataDirectory, 'patient-lists');
    return await joinPaths(patientListsDir, `patients_${date}.json`);
  } catch (error: any) {
    console.error("Error in getPatientsFilePathForDate:", error);
    return null;
  }
};


  // Returns the file path for the currently active patient list date
  const getPatientsFilePath = async (): Promise<string | null> => {
    if (!isDataDirectorySet.value || !config.value.dataDirectory) return null;
    try {
      const date = activePatientListDate.value; // Use activePatientListDate for patient list file
      const patientListsDir = await joinPaths(config.value.dataDirectory, 'patient-lists');
      return await joinPaths(patientListsDir, `patients_${date}.json`);
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

  // Loads the patient list for the currently active date.
  // If the file does not exist, creates a blank patient list file for that date.
  const loadPatients = async () => {
    if (!isConfigLoaded.value || !isDataDirectorySet.value) {
      console.warn("loadPatients: Config not loaded or data directory not set.");
      patients.value = [];
      customOrder.value = [];
      return;
    }

    isLoading.value = true;
    error.value = null;
    const absolutePath = await getPatientsFilePath();

    if (!absolutePath) {
      error.value = "loadPatients: Could not determine patients file path.";
      isLoading.value = false;
      patients.value = [];
      customOrder.value = [];
      return;
    }

    try {
      const fileContent = await readFileAbsolute(absolutePath);
      if (fileContent) {
        const parsedPatients = JSON.parse(fileContent) as Patient[];
        const loadedPatients: Patient[] = parsedPatients.map((patient): Patient => ({
          ...patient,
          type: patient.umrn ? "umrn" : "uuid"
        }));
        // Ensure all loaded patients have parsed name components
        loadedPatients.forEach(patient => {
          const parsedName = parsePatientName(patient.rawName);
          // console.log(`[usePatientData] loadPatients: Parsing name for patient ID ${patient.id}:`, { rawName: patient.rawName, parsed: parsedName });
          Object.assign(patient, parsedName); // Merge parsed components into the patient object
          // console.log(`[usePatientData] loadPatients: Patient object after merging parsed name for ID ${patient.id}:`, patient);
        });
        patients.value = loadedPatients as Patient[];
        customOrder.value = [...loadedPatients] as Patient[];
        updatePatientIdentifierArray(patients.value);
      } else {
        // File does not exist or is empty: create a blank patient list file
        await writeFileAbsolute(absolutePath, JSON.stringify([], null, 2));
        patients.value = [];
        customOrder.value = [];
        updatePatientIdentifierArray([]);
      }
    } catch (err: any) {
      // If file does not exist, create a blank patient list file
      if (err && err.message && err.message.includes("ENOENT")) {
        try {
          await writeFileAbsolute(absolutePath, JSON.stringify([], null, 2));
          patients.value = [];
          customOrder.value = [];
          updatePatientIdentifierArray([]);
        } catch (writeErr) {
          // Safely handle unknown error type
          let writeErrMsg: string;
          if (writeErr instanceof Error) {
            writeErrMsg = writeErr.message;
          } else if (typeof writeErr === "object" && writeErr !== null && "message" in writeErr && typeof (writeErr as any).message === "string") {
            writeErrMsg = (writeErr as any).message;
          } else {
            writeErrMsg = String(writeErr);
          }
          console.error("Error creating blank patient list file:", writeErrMsg, writeErr);
          error.value = `Failed to create blank patient list: ${writeErrMsg}`;
        }
      } else {
        console.error("Error loading patients:", err);
        error.value = `Failed to load patients: ${err.message || err}`;
        patients.value = [];
        customOrder.value = [];
        updatePatientIdentifierArray([]);
      }
    } finally {
      isLoading.value = false;
    }
  };

  // Watch activePatientListDate to reload patients when the date changes
  watch(activePatientListDate, async () => {
    await loadPatients();
  });

  // Saves the patient list for the currently active date
  const savePatients = async (updatedPatients: Patient[]): Promise<boolean> => {
    const absolutePath = await getPatientsFilePath();
    if (!absolutePath) {
      error.value = "savePatients: Could not determine patients file path.";
      return false;
    }

    // Strictly require an array
    if (!Array.isArray(updatedPatients)) {
      error.value = "savePatients: Invalid input, expected Patient[].";
      console.error(error.value, updatedPatients);
      return false;
    }

    console.log("Saving patients to:", absolutePath);
    try {
      // Only keep allowed Patient fields to avoid circular references
      const sanitizedPatients = updatedPatients.map((p) => ({
        id: p.id,
        type: p.type,
        umrn: p.umrn,
        rawName: p.rawName, // Include rawName
        salutation: p.salutation, // Include parsed name fields
        firstName: p.firstName,
        middleName: p.middleName,
        lastName: p.lastName,
        suffix: p.suffix,
        fullName: p.fullName,
        location: p.location,
        age: p.age,
        los: p.los,
        admission_date: p.admission_date,
        cons_name: p.cons_name,
        dsc_date: p.dsc_date,
        diagnosis: p.diagnosis,
      }));
      await writeFileAbsolute(absolutePath, JSON.stringify(sanitizedPatients, null, 2));
      patients.value = sanitizedPatients; // Update reactive state
      updatePatientIdentifierArray(patients.value); // Update identifier map after save
      return true;
    } catch (err: any) {
      console.error("Error saving patients:", err);
      error.value = `Failed to save patients: ${err.message || err}`;
      return false;
    }
  };



  const addPatient = async (patientData: Omit<Patient, "id" | "type" | "salutation" | "firstName" | "middleName" | "lastName" | "suffix" | "fullName"> & { rawName?: string }): Promise<Patient | null> => {
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

      // Parse the raw name
      const parsedName = parsePatientName(patientData.rawName);
      console.log("[usePatientData] addPatient: Parsed name:", {
        rawName: patientData.rawName,
        parsed: parsedName,
      });

      // Check if patient already exists (re-admission handling)
      // Using rawName for duplicate check for now, can refine later if needed
      if (!patientData.umrn && patientData.rawName) {
        const existingPatient = patients.value.find(
          (p) => p.rawName === patientData.rawName
        );
        if (existingPatient) {
          // Prompt user to merge patients
          const mergeConfirmation = await showConfirmDialog({
            type: "warning",
            buttons: ["Cancel", "Merge Patients", "Create New"],
            defaultId: 0,
            cancelId: 0,
            title: "Potential Duplicate Patient",
            message: `A patient with the name "${patientData.rawName}" already exists. What do you want to do?`,
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
          } else {
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

      const newPatient: Patient = {
        ...patientData,
        ...parsedName, // Merge parsed name components
        id: patientId,
        type: patientType
      };
      console.log("[usePatientData] addPatient: New patient object before saving:", newPatient);

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
    // Find the index in the reactive patients array
    const patientIndex = patients.value.findIndex(
      (p) => p.id === updatedPatient.id
    );
    if (patientIndex === -1) {
      error.value = `Patient with ID ${updatedPatient.id} not found in the list.`;
      return false;
    }

    // Parse the raw name and merge components before updating
    const parsedName = parsePatientName(updatedPatient.rawName);
    const patientToUpdate = { // Renamed for clarity
      ...updatedPatient,
      ...parsedName, // Merge parsed name components, overwriting existing if present
    };

    // Update the patient object in place within the reactive array
    // Using Object.assign to ensure reactivity for individual properties
    Object.assign(patients.value[patientIndex], patientToUpdate);

    // The patients.value array is now reactively updated.
    // Now save the current state of patients.value to disk.

    const saveSuccess = await savePatients(patients.value); // Save the modified array
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
    // NOTE: As per requirements, removing a patient only updates the list file.
    // Patient notes directories are NEVER deleted by list changes.
    console.log(
      `Requesting confirmation to remove patient: ${patientToRemove.rawName || patientToRemove.fullName || patientToRemove.id}`
    );
    const confirmation = await showConfirmDialog({
      type: "warning",
      buttons: ["Cancel", "Remove from List"], // Button order matters, 0=Cancel, 1=Remove
      defaultId: 0,
      cancelId: 0,
      title: "Remove Patient from List",
      message: `Are you sure you want to remove patient "${patientToRemove.rawName || patientToRemove.fullName || patientToRemove.id}" from the list?`,
      detail:
        "This action will only remove the patient from the current day's list. All associated notes will be preserved and are never deleted by this action.",
    });

    if (confirmation.response !== 1) {
      // Check if the 'Remove from List' button (index 1) was clicked
      console.log("Patient removal cancelled by user.");
      return false; // User cancelled
    }
    console.log("User confirmed patient removal from list.");

    isLoading.value = true;
    error.value = null;
    try {
      // --- Filter out the patient ---
      const updatedPatients = patients.value.filter((p) => p.id !== patientId);

      // --- Save the updated patient list ---
      console.log("Saving updated patient list (after removal)...");
      const saveSuccess = await savePatients(updatedPatients); // savePatients handles updating ref

      if (saveSuccess) {
        // No notes directory is ever deleted here.
        console.log("Patient removed from list successfully:", patientId);
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

  const getPatientByUmrn = (umrn: string): Patient | undefined => {
    // In this system, if type is 'umrn', the id *is* the umrn.
    return patients.value.find((p) => p.type === 'umrn' && p.id === umrn);
  };

  // --- Internal Helper for CSV Parsing and Patient Mapping ---
  const _parseAndMapICMPatients = (
    csvContent: string,
    currentPatients: Patient[],
    skipExistingUmrns: boolean = true
  ): Patient[] => {
    console.log("Parsing CSV content...");
    const parseResult = Papa.parse<string[]>(csvContent, { // Expect array of strings, header: false
      header: false, // Do not use header row
      skipEmptyLines: true,
      dynamicTyping: true, // Automatically convert types where possible
    });

    if (parseResult.errors.length > 0) {
      console.error("CSV Parsing Errors:", parseResult.errors);
      // Report the first error
      throw new Error(
        `Error parsing CSV file: ${parseResult.errors[0].message} (Row: ${parseResult.errors[0].row})`
      );
    }

    // Check if there's data after the header row (row 0)
    if (!parseResult.data || parseResult.data.length <= 1) {
      console.warn("CSV file is empty or contains only a header row.");
      return []; // Return empty array, not an error
    }

    console.log(`Parsed ${parseResult.data.length} rows from CSV.`);
    const importedPatients: Patient[] = [];
    const existingUmrns = new Set(
      currentPatients.filter((p) => p.type === "umrn").map((p) => p.id)
    );

    // Start from the second row (index 1) to skip the header
    for (let i = 1; i < parseResult.data.length; i++) {
      const row = parseResult.data[i];

      // Ensure row has enough columns for Name (index 12) and MRN (index 18)
      if (row.length < 19) {
        console.warn(`Skipping row ${i + 1} due to insufficient columns:`, row);
        continue;
      }

      // Extract Name (index 12) and MRN (index 18) based on observed CSV structure
      const name = row[12] ? String(row[12]).trim() : undefined;
      const umrn = row[18] ? String(row[18]).trim() : undefined;

      // Basic validation: require at least a name or UMRN
      if (!umrn && !name) {
        console.warn(`Skipping row ${i + 1} due to missing UMRN and Name:`, row);
        continue;
      }

      // Optionally skip if UMRN already exists in the current patient list
      if (skipExistingUmrns && umrn && existingUmrns.has(umrn)) {
        console.log(`Skipping existing UMRN: ${umrn} in row ${i + 1}`);
        continue;
      }

      const patientId = umrn || uuidv4();
      const patientType = umrn ? "umrn" : "uuid";

      const newPatient: Patient = {
        id: patientId,
        type: patientType,
        umrn: umrn,
        rawName: name, // Store the original name from CSV
        ...parsePatientName(name), // Parse and merge name components
        // Map other fields based on their column index if needed, based on observed CSV structure
        location: row[13] ? String(row[13]).trim() : undefined, // Assuming Location is index 13
        age: row[14] !== null && row[14] !== undefined ? row[14] : undefined, // Assuming Age is index 14
        los: row[15] !== null && row[15] !== undefined ? row[15] : undefined, // Assuming LOS is index 15
        admission_date: row[16] ? String(row[16]).trim() : undefined, // Assuming Admission Date is index 16
        cons_name: row[19] ? String(row[19]).trim() : undefined, // Assuming Doctor is index 19
        dsc_date: row[21] ? String(row[21]).trim() : undefined, // Assuming Planned/Actual DSC Date is index 21
        diagnosis: row[22] ? String(row[22]).trim() : undefined, // Assuming Diagnosis is index 22
      };
      importedPatients.push(newPatient);
      console.log(`_parseAndMapICMPatients: Parsed patient from row ${i + 1}:`, {
        rawName: name,
        umrn: umrn,
        parsed: {
          salutation: newPatient.salutation,
          firstName: newPatient.firstName,
          middleName: newPatient.middleName,
          lastName: newPatient.lastName,
          suffix: newPatient.suffix,
          fullName: newPatient.fullName,
        },
      });
    }

    return importedPatients;
  };

  // --- Import from Default Configured Path ---
  const importICMPatientListFromDefault = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    console.log("Starting iCM patient list import from default path...");

    if (!isConfigLoaded.value || !config.value.iCMListDirectory) {
      error.value = "iCM list directory path is not configured.";
      console.error("Import Error:", error.value);
      isLoading.value = false;
      return;
    }

    const filePath = config.value.iCMListDirectory; // This should point to the specific file
    console.log("Attempting to read iCM list from default path:", filePath);

    try {
      const fileContent = await readFileAbsolute(filePath);
      if (!fileContent) {
        error.value = `iCM patient list file not found or empty at: ${filePath}`;
        console.error("Import Error:", error.value);
        isLoading.value = false;
        return;
      }

      const newPatients = _parseAndMapICMPatients(fileContent, patients.value);

      if (newPatients.length === 0) {
        console.log("No new patients to import after filtering.");
        isLoading.value = false;
        return;
      }

      console.log(`Adding ${newPatients.length} new patients to the list.`);
      const updatedPatients = [...patients.value, ...newPatients];

      console.log("Saving updated patient list after import...");
      const saveSuccess = await savePatients(updatedPatients);

      if (saveSuccess) {
        console.log("iCM patient list imported successfully from default path.");
      } else {
        console.error("Failed to save patient list after import from default path.");
        // Error should be set by savePatients
      }
    } catch (err: any) {
      console.error("Error during iCM patient list import from default path:", err);
      error.value = `Failed to import iCM patient list: ${err.message || err}`;
    } finally {
      isLoading.value = false;
      console.log("iCM patient list import process (default path) finished.");
    }
  };

  // --- Import from User-Selected Folder ---
  const importICMPatientListFromFolder = async (folderPath: string): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    console.log(`Starting iCM patient list import from folder: ${folderPath}`);

    // Regex to match the expected file naming convention (case-insensitive)
    const fileNameRegex = /^pt_list_\d{2}_\d{2}_\d{4}\.csv$/i;
    let targetFilePath: string | null = null;

    try {
      console.log("Listing files in selected folder...");
      const fileList = await listFiles(folderPath); // listFiles should return file names

      if (!fileList || fileList.length === 0) {
        error.value = `No files found in the selected folder: ${folderPath}`;
        console.warn("Import Warning:", error.value);
        isLoading.value = false;
        return;
      }

      console.log(`Found ${fileList.length} items in folder. Searching for matching CSV...`);

      // Find the first file matching the pattern
      for (const fileName of fileList) {
        if (fileNameRegex.test(fileName)) {
          targetFilePath = await joinPaths(folderPath, fileName);
          console.log(`Found matching file: ${targetFilePath}`);
          break; // Use the first match
        }
      }

      if (!targetFilePath) {
        error.value = `No file matching the pattern 'pt_list_DD_MM_YYYY.csv' found in: ${folderPath}`;
        console.warn("Import Warning:", error.value);
        isLoading.value = false;
        return;
      }

      console.log("Attempting to read iCM list from:", targetFilePath);
      const fileContent = await readFileAbsolute(targetFilePath);
      if (!fileContent) {
        error.value = `Selected iCM patient list file not found or empty at: ${targetFilePath}`;
        console.error("Import Error:", error.value);
        isLoading.value = false;
        return;
      }

      const newPatients = _parseAndMapICMPatients(fileContent, patients.value);

      if (newPatients.length === 0) {
        console.log("No new patients to import after filtering.");
        isLoading.value = false;
        return;
      }

      console.log(`Adding ${newPatients.length} new patients to the list.`);
      const updatedPatients = [...patients.value, ...newPatients];

      console.log("Saving updated patient list after import...");
      const saveSuccess = await savePatients(updatedPatients);

      if (saveSuccess) {
        console.log("iCM patient list imported successfully from folder.");
      } else {
        console.error("Failed to save patient list after import from folder.");
        // Error should be set by savePatients
      }
    } catch (err: any) {
      console.error("Error during iCM patient list import from folder:", err);
      error.value = `Failed to import iCM patient list from folder: ${err.message || err}`;
    } finally {
      isLoading.value = false;
      console.log("iCM patient list import process (folder) finished.");
    }
  };

  // --- Import from User-Selected File ---
  const importICMPatientListFromFile = async (filePath: string): Promise<void> => {
    isLoading.value = true;
    error.value = null;
    console.log("Starting iCM patient list import from file:", filePath);

    try {
      const fileContent = await readFileAbsolute(filePath);
      if (!fileContent) {
        error.value = `iCM patient list file not found or empty at: ${filePath}`;
        console.error("Import Error:", error.value);
        isLoading.value = false;
        return;
      }

      // Do NOT skip existing UMRNs; import all patients from file
      const importedPatients = _parseAndMapICMPatients(fileContent, patients.value, false);

      if (importedPatients.length === 0) {
        console.log("No patients found in imported file.");
        isLoading.value = false;
        return;
      }

      // Replace the current patient list with the imported one (remove any not present in import)
      console.log(`Replacing patient list with ${importedPatients.length} imported patients.`);
      const saveSuccess = await savePatients(importedPatients);

      if (saveSuccess) {
        console.log("iCM patient list imported and replaced successfully from file.");
      } else {
        console.error("Failed to save patient list after import from file.");
        // Error should be set by savePatients
      }
    } catch (err: any) {
      console.error("Error during iCM patient list import from file:", err);
      error.value = `Failed to import iCM patient list from file: ${err.message || err}`;
    } finally {
      isLoading.value = false;
      console.log("iCM patient list import process (file) finished.");
    }
  };

  // Watch for config changes (specifically dataDirectory being set/unset) and reload patients
  const { dataDirectoryChangeFlag } = useConfig();

  watch(
    [isConfigLoaded, dataDirectoryChangeFlag],
    ([loaded]) => {
      if (loaded) {
        loadPatients();
      } else {
        console.log(
          "Config loaded, but no data directory set. Clearing patients."
        );
        patients.value = []; // Clear patients if directory becomes unset
        updatePatientIdentifierArray([]); // Clear identifier map
        error.value = "Data directory not configured. Please select one.";
      }
    },
    { immediate: false }
  );

  // allowedDates is used by the date picker UI, which is tied to the note date.
  // We will rely on App.vue to trigger listAvailablePatientListDates when selectedNoteDate changes.

  onMounted(async () => { // Make onMounted async
    if (isConfigLoaded.value && isDataDirectorySet.value) {
      await loadPatients(); // Await initial load
      // App.vue will call listAvailablePatientListDates after mount and config load
    }
  });

  /**
   * Add patients to a specific date's patient list, skipping duplicates by id or UMRN.
   * @param patientsToAdd Array of Patient objects to add.
   * @param date Target date string (YYYY-MM-DD).
   * @returns Promise<boolean> true if successful, false otherwise.
   */
  const addPatientsToDate = async (patientsToAdd: Patient[], date: string): Promise<boolean> => {
    if (!isDataDirectorySet.value || !config.value.dataDirectory) return false;
    try {
      // Compute file path for the target date
      const patientListsDir = await joinPaths(config.value.dataDirectory, 'patient-lists');
      const filePath = await joinPaths(patientListsDir, `patients_${date}.json`);
      // Load existing patients for that date
      let existingPatients: Patient[] = [];
      try {
        const fileContent = await readFileAbsolute(filePath);
        if (fileContent) {
          existingPatients = JSON.parse(fileContent) as Patient[];
        }
      } catch (e) {
        // If file doesn't exist, start with empty list
        existingPatients = [];
      }
      // Build sets for deduplication
      const existingIds = new Set(existingPatients.map(p => p.id));
      const existingUmrns = new Set(existingPatients.map(p => p.umrn).filter(Boolean));
      // Filter out duplicates
      const newPatients = patientsToAdd.filter(p =>
        !existingIds.has(p.id) && (!p.umrn || !existingUmrns.has(p.umrn))
      );
      if (newPatients.length === 0) {
        // Nothing to add
        return true;
      }
      const updatedPatients = [...existingPatients, ...newPatients];
      // Save updated list
      await writeFileAbsolute(filePath, JSON.stringify(updatedPatients, null, 2));
      // If adding to the active patient list date, update in-memory list as well
      if (date === activePatientListDate.value) {
        patients.value = updatedPatients;
        updatePatientIdentifierArray(patients.value);
      }
      return true;
    } catch (err: any) {
      console.error("Error in addPatientsToDate:", err);
      error.value = `Failed to add patients to date: ${err.message || err}`;
      return false;
    }
  };

  // --- Sorting Logic ---
  /**
   * Sorts the patients list in-place.
   * @param sortBy "location" | "name" | "custom"
   */
  const sortPatients = (sortBy: "location" | "name" | "custom") => {
    if (sortBy === "location") {
      patients.value = [...patients.value].sort((a, b) => {
        const locA = (a.location || "").toLowerCase();
        const locB = (b.location || "").toLowerCase();
        if (locA < locB) return -1;
        if (locA > locB) return 1;
        return 0;
      });
    } else if (sortBy === "name") {
      patients.value = [...patients.value].sort((a, b) => {
        // Sort by last name, then first name
        const lastNameA = (a.lastName || "").toLowerCase();
        const lastNameB = (b.lastName || "").toLowerCase();
        if (lastNameA < lastNameB) return -1;
        if (lastNameA > lastNameB) return 1;
        const firstNameA = (a.firstName || "").toLowerCase();
        const firstNameB = (b.firstName || "").toLowerCase();
        if (firstNameA < firstNameB) return -1;
        if (firstNameA > firstNameB) return 1;
        return 0;
      });
    } else if (sortBy === "custom") {
      // Restore the original order as loaded
      // Use id as the unique key for matching
      const idToPatient = new Map(patients.value.map(p => [p.id, p]));
      patients.value = customOrder.value
        .map(orig => idToPatient.get(orig.id))
        .filter((p): p is Patient => !!p);
    }
  };

  return {
    // --- Date Navigation (merged from useDateNavigation) ---
    dateMenu,
    allowedDates,
    todayString,
    noteDateDisplay,
    onDateChange,
    goToPreviousNoteDay,
    goToNextNoteDay,

    // --- Date-based patient list management ---
    activePatientListDate,
    setActivePatientListDate,
    availablePatientListDates,
    listAvailablePatientListDates,
    goToPreviousPatientListDay, // Expose new function
    goToNextPatientListDay,     // Expose new function

    patients,
    patient_identifierArray,
    isLoading,
    error,
    loadPatients,
    addPatient,
    removePatient,
    getPatientById,
    getPatientByUmrn,
    updatePatient,
    savePatients,
    mergePatientData,
    listFiles,
    importICMPatientListFromDefault,
    importICMPatientListFromFolder,
    importICMPatientListFromFile,
    addPatientsToDate,
    sortPatients
  };
}