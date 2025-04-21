// src/types/index.ts
export interface Patient {
  id: string; // Unique identifier (UMRN or UUID)
  type: "umrn" | "uuid"; // Type discriminator
  umrn?: string; // Medical Record Number (optional if type is uuid initially)
  name?: string; // Patient's full name
  location?: string; // Patient's current location (e.g., ward, bed number)
  age?: number | string; // Patient's age (number or string like "80+")
  los?: number | string; // Length of stay (days or string)
  admission_date?: string; // Date of admission (ISO format string recommended: YYYY-MM-DD)
  cons_name?: string; // Consultant's name
  dsc_date?: string; // Discharge date (optional, ISO format string)
  diagnosis?: string; // Primary diagnosis (optional)
}

export interface Note {
  date: string; // YYYY-MM-DD
  content: string; // Markdown format
}

// Interface for application configuration
export interface AppConfig {
  /** Base directory for storing patient data and notes. Null if not configured. */
  dataDirectory: string | null;
  /** Filename for the patient list JSON. Relative to dataDirectory. */
  patientsFilename: string;
  /** Subdirectory name for notes. Relative to dataDirectory. */
  notesBaseDir: string;
  theme: "light" | "dark";
  /** Directory path for the iCM patient list CSV. Null if not configured. */
  iCMListDirectory: string | null;
  // Add other config options later
}
