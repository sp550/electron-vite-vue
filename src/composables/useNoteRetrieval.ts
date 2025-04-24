/**
 * src/composables/useNoteRetrieval.ts
 * Provides robust functions to fetch note content and handle note export/auto-export logic.
 */

import { useFileSystemAccess } from "./useFileSystemAccess";
import type { Patient } from "../types";

/**
 * Retrieves the note content for a given patient and date.
 * @param patient - The patient object.
 * @param dateISO - The date string in ISO 8601 format (e.g., "2024-04-17" or "2024-04-17T00:00:00Z").
 * @returns The note content as a string, or a default message if not found or error.
 */
export async function getNoteContent(
  patient: Patient,
  dateISO: string
): Promise<string> {
  const { readFileForDate } = useFileSystemAccess();
  let rawData: string | null = null;
  let noteContent: string = "";
  const defaultMessage = "No note found for this date.";

  try {
    // Parse date string to Date object
    const dateObj = new Date(dateISO);
    if (isNaN(dateObj.getTime())) {
      console.error(`[getNoteContent] Invalid date string: ${dateISO}`);
      return defaultMessage;
    }

    // Attempt to read the file for the given patient and date
    rawData = await readFileForDate(patient, dateObj); // Pass the patient object directly

    if (!rawData) {
      return defaultMessage;
    }

    // Try to parse as JSON and extract 'content'
    try {
      const parsed = JSON.parse(rawData);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof parsed.content === "string"
      ) {
        noteContent = parsed.content;
      } else {
        // JSON parsed but no 'content' field, treat as raw
        noteContent = rawData;
      }
    } catch (jsonErr) {
      // Not valid JSON, treat as raw content
      noteContent = rawData;
    }

    // If noteContent is empty, return default message
    if (!noteContent || noteContent.trim() === "") {
      return defaultMessage;
    }

    return noteContent;
  } catch (err: any) {
    // Log error and return default message
    console.error(
      `[getNoteContent] Error retrieving note for patientId=${patient.id}, date=${dateISO}:`,
      err
    ); // Use patient.id
    return defaultMessage;
  }
}

/**
 * Composable for note export and auto-export logic.
 * Accepts dependencies to keep business logic decoupled from UI.
 */
export function useNoteExport({
  showSnackbar,
  configState,
  patientData,
  fileSystemAccess,
  selectedDate,
  electronAPI,
}: {
  showSnackbar: (text: string, color?: "success" | "error" | "info") => void;
  configState: any;
  patientData: any;
  fileSystemAccess: any;
  selectedDate: { value: string };
  electronAPI: any;
}) {
  // --- Auto-export scheduling logic ---
  let autoExportIntervalId: ReturnType<typeof setInterval> | null = null;

  function startAutoExport() {
    try {
      if (autoExportIntervalId !== null) {
        // Interval already running; do not create a duplicate.
        console.warn("Auto-export interval already running.");
        return;
      }
      autoExportIntervalId = setInterval(async () => {
        try {
          await autoExportNotesForDay();
        } catch (err) {
          console.error("Error during auto-export:", err);
        }
      }, 60000); // 60,000 ms = 1 minute
    } catch (err) {
      console.error("Failed to start auto-export interval:", err);
    }
  }

  function stopAutoExport() {
    try {
      if (autoExportIntervalId !== null) {
        clearInterval(autoExportIntervalId);
        autoExportIntervalId = null;
        console.info("Auto-export interval stopped.");
      } else {
        console.warn("No auto-export interval to stop.");
      }
    } catch (err) {
      console.error("Failed to stop auto-export interval:", err);
    }
  }

  // Helper to split patient name
  function splitName(fullName: string): { last: string; first: string } {
    const parts = (fullName || "").trim().split(/\s+/);
    if (parts.length === 0) return { last: "", first: "" };
    if (parts.length === 1) return { last: parts[0], first: "" };
    return {
      last: parts[parts.length - 1],
      first: parts.slice(0, -1).join(" "),
    };
  }

  // Core export logic
  async function exportNotesForDayCore(
    patients: Patient[],
    dateStr: string,
    getNoteContentFn: (patient: Patient, dateStr: string) => Promise<string>
  ): Promise<string> {
    let output = "";
    for (const patient of patients) {
      const { last, first } = splitName(patient.name || "");
      const umrn = patient.umrn || "";
      let noteContent = await getNoteContentFn(patient, dateStr); // Pass the full patient object
      output += `[ ] -----${last}, ${first} (${umrn})-----\n${noteContent}\n\n`;
    }
    return output;
  }

  // Auto-export for all patients for today
  async function autoExportNotesForDay() {
    try {
      const config = configState.config.value;
      if (!config || !config.dataDirectory) {
        showSnackbar(
          "Auto-export failed: Data directory not configured.",
          "error"
        );
        return;
      }
      const patients = patientData.patients.value;
      const dateObj = new Date();

      const yyyy = dateObj.getFullYear();
      const MM = String(dateObj.getMonth() + 1).padStart(2, "0");
      const dd = String(dateObj.getDate()).padStart(2, "0");
      const hh = String(dateObj.getHours()).padStart(2, "0");
      const mm = String(dateObj.getMinutes()).padStart(2, "0");
      const ss = String(dateObj.getSeconds()).padStart(2, "0");

      const dateStr = `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;

      const exportString = await exportNotesForDayCore(
        patients,
        dateStr,
        getNoteContent
      );
      const filePath = `${config.dataDirectory}/auto-exports/notes-${dateStr}.txt`;

      try {
        await fileSystemAccess.writeFileAbsolute(filePath, exportString);
      } catch (err: any) {
        showSnackbar(
          `Auto-export failed: Could not write file (${filePath}): ${
            err?.message || err || "Unknown error"
          }`,
          "error"
        );
      }
    } catch (error: any) {
      showSnackbar(
        `Auto-export failed: ${error?.message || error || "Unknown error"}`,
        "error"
      );
    }
  }

  // Manual export for selected day
  async function manualExportNotesForDay() {
    try {
      showSnackbar("Exporting notes for the selected day...", "info");
      const patients = patientData.patients.value;
      const dateStr = selectedDate.value;
      if (!patients || patients.length === 0) {
        showSnackbar("No patients to export.", "info");
        return;
      }

      const output = await exportNotesForDayCore(
        patients,
        dateStr,
        getNoteContent
      );

      const defaultFileName = `notes-${dateStr}.txt`;
      const dialogResult = await electronAPI.showSaveDialog?.({
        title: "Export Notes: Select or enter a file to save",
        defaultPath: defaultFileName,
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      });

      if (!dialogResult || dialogResult.canceled || !dialogResult.filePath) {
        showSnackbar("Export canceled.", "info");
        return;
      }
      const selectedFile = dialogResult.filePath;

      try {
        await fileSystemAccess.writeFileAbsolute(selectedFile, output);
        showSnackbar(`Notes exported to: ${selectedFile}`, "success");
      } catch (err: any) {
        showSnackbar(
          `Failed to write export file: ${
            err?.message || err || "Unknown error"
          }`,
          "error"
        );
      }
    } catch (error: any) {
      showSnackbar(
        `Failed to export notes: ${error?.message || error || "Unknown error"}`,
        "error"
      );
    }
  }

  return {
    startAutoExport,
    stopAutoExport,
    exportNotesForDayCore,
    autoExportNotesForDay,
    manualExportNotesForDay,
  };
}
