// src/types/index.ts
export interface Patient {
  id: string; // Unique identifier (UMRN or UUID)
  type: "umrn" | "uuid"; // Type discriminator
  umrn?: string; // Medical Record Number (optional if type is uuid initially)
  rawName?: string; // Original patient's full name string input
  salutation?: string; // e.g., Mr., Ms., Dr.
  firstName?: string; // Patient's first given name
  middleName?: string; // Patient's middle name(s)
  lastName?: string; // Patient's surname
  suffix?: string; // e.g., Jr., Sr., III
  fullName?: string; // Parsed full name from components (optional, humanparser might provide this)
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
  /** Subdirectory name for notes. Relative to dataDirectory. */
  notesBaseDir: string;
  theme: "light" | "dark";
  /** Directory path for the iCM patient list CSV. Null if not configured. */
  iCMListDirectory: string | null;
  // Add other config options later
}
