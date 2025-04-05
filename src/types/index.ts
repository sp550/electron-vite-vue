// src/types/index.ts

export interface Patient {
  id: string;
  name: string;
  umrn?: string;
  ward?: string;
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
  // Add other config options later
}
