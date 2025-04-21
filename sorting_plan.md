# Patient List Sorting Implementation Plan

## Requirements Recap

- Add sorting logic to allow sorting by:
  - Location (using the `location` property)
  - Name (alphabetically)
  - Custom (current/manual order, but no need to restore previous custom order)
- UI: Add a sort icon next to the "Patient List" header. Clicking it shows a dropdown with the 3 options.
- Drag-and-drop reordering remains enabled in all modes.

---

## Implementation Steps

### 1. Composable Changes (`src/composables/usePatientList.ts`)

- Add a `sortMode` ref with possible values: `'custom'`, `'name'`, `'location'`.
- Add a method `setSortMode(mode: string)` to update the sort mode and re-sort `patientsDraggable`.
- Implement sorting logic:
  - `'name'`: Sort by `name` (case-insensitive, fallback to empty string).
  - `'location'`: Sort by `location` (case-insensitive, fallback to empty string).
  - `'custom'`: No sorting; keep current order.
- Expose `sortMode` and `setSortMode` from the composable.

### 2. Component Changes (`src/components/PatientList.vue`)

- Add a sort icon button next to the "Patient List" header.
- On click, show a dropdown menu with:
  - Sort by Name
  - Sort by Location
  - Custom Sort (Manual Order)
- When a sort option is selected, call the composable's `setSortMode` method.
- Optionally, visually indicate the current sort mode.
- Drag-and-drop remains enabled in all modes.

---

## Data Flow

- The sort mode is managed in the composable and passed to the component.
- The component triggers sort changes via the exposed method.
- The patients list displayed is always based on the current sort mode.

---

## Mermaid Diagram

```mermaid
flowchart TD
    A[User clicks sort icon] --> B[Dropdown menu appears]
    B --> C1[Select "Sort by Name"]
    B --> C2[Select "Sort by Location"]
    B --> C3[Select "Custom Sort"]
    C1 --> D[setSortMode('name')]
    C2 --> E[setSortMode('location')]
    C3 --> F[setSortMode('custom')]
    D & E & F --> G[patientsDraggable updated via sorting logic]
    G --> H[Patient list re-renders]
    H --> I[Drag-and-drop enabled in all modes]
```

---

## Notes

- The Patient type has both `location` and `ward`, but sorting will use `location` as per user instruction.
- No need to restore previous custom order when switching back from another sort mode.
- Drag-and-drop is always enabled.

---

## Next Steps

- Please review this plan. Would you like any changes before implementation?
- If approved, I will proceed to switch to code mode for implementation.