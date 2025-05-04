# Plan: Integrate `humanparser` for Patient Name Parsing

## Objective

Expand the `Patient` interface in `src/types/index.ts` to include structured name components (surname, given names, first name, middle names) and implement a robust parsing mechanism using the `humanparser` npm module to populate these fields from the raw patient name input.

## Steps

1.  **Install `humanparser`:**
    *   Add the `humanparser` package to the project dependencies using npm or yarn.

2.  **Update the `Patient` Interface (`src/types/index.ts`):**
    *   Modify the existing `Patient` interface to include fields for the parsed name components as provided by `humanparser`.
    *   Keep the original `name` field, renaming it to `rawName` to store the unparsed input string.
    *   Add fields: `salutation`, `firstName`, `middleName`, `lastName`, `suffix`, and potentially `fullName` (confirming exact fields from `humanparser` output).

    ```typescript
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

    // ... other interfaces remain unchanged
    ```

3.  **Create a Name Parsing Utility (`src/utils/nameParser.ts`):**
    *   Create a new file, `src/utils/nameParser.ts`.
    *   Import the `humanparser` library.
    *   Create a function, e.g., `parsePatientName`, that takes the raw name string as input.
    *   Use `humanparser.parseName()` to parse the input string.
    *   Return an object containing the parsed name components that map to the new fields in the `Patient` interface. Include error handling for parsing failures.

4.  **Integrate Parsing into Patient Creation/Import:**
    *   Modify the code responsible for creating new `Patient` objects (manual input and iCM list import).
    *   Pass the raw name string through the `parsePatientName` utility function.
    *   Assign the returned parsed name components to the corresponding fields of the `Patient` object. Store the original input in `rawName`.

5.  **Update Data Storage:**
    *   Ensure that the data serialization logic (e.g., saving to JSON files) includes the new name fields (`rawName`, `salutation`, `firstName`, `middleName`, `lastName`, `suffix`, `fullName`).

6.  **Data Migration (Consideration):**
    *   Plan for a potential separate task to migrate existing patient data that only has the single `name` field. This would involve loading old data, parsing the existing `name` field using the new utility, and resaving the data with the new structured fields.

7.  **Refactor Code Usage:**
    *   Identify and update all parts of the codebase currently using `patient.name` to use the appropriate structured fields (`patient.firstName`, `patient.lastName`, etc.) for accessing specific name components.

## Data Flow Visualization

```mermaid
graph TD
    A[Raw Name Input (Manual or iCM)] --> B{src/utils/nameParser.ts};
    B --> C[humanparser.parseName()];
    C --> D{Parsed Name Components};
    D --> E[Update Patient Object with Parsed Data];
    E --> F[Store Patient Data (JSON)];
    F --> G[Load Patient Data];
    G --> H[Access Structured Name Fields (firstName, lastName, etc.)];
    H --> I[Application Display/Logic];
```