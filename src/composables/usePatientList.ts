import { ref, computed, watch } from 'vue';
import type { Ref } from 'vue';
import type { Patient } from '@/types';
import type { usePatientData } from './usePatientData';
import Sortable from 'sortablejs';

// Define the type for the showSnackbar function
type ShowSnackbar = (text: string, color?: 'success' | 'error' | 'info') => void;

export function usePatientList(
   patientData: ReturnType<typeof usePatientData>,
   showSnackbar: ShowSnackbar,
   selectedPatientId: Ref<string | null>,
   // Need access to the list element ref from the component to initialize SortableJS
   // It's better to return the ref from the composable and let the component
   // bind it to the element and then pass the element back to an init function.
   // Or, the composable can expose an init function that takes the element.
   // Let's expose an init function.
) {
   // Refs for patient list UI state
   const sortMode = ref<'custom' | 'name' | 'location'>('custom');
   const patientsDraggable: Ref<Patient[]> = ref([]); // Used for SortableJS
   const patientListRef: Ref<HTMLUListElement | null> = ref(null); // Ref for the list element (will be bound in component)
   const isEditPatientListMode = ref(false); // Toggle for edit mode (reorder/select)
   const selectedPatientIds = ref<string[]>([]); // For multi-select
   const search = ref(''); // Search input

   // Computed: filtered patient list based on search input
   const filteredPatients = computed(() => {
      if (!patientData || !patientData.patients) {
         // Log for debugging
         console.warn('usePatientList: patientData or patientData.patients is undefined', { patientData });
         return [];
      }
      if (!search.value) {
         // If no search term, use the patients list from usePatientData
         return patientData.patients.value;
      }
      const s = search.value.toLowerCase();
      // Filter the patients list from usePatientData
      return (patientData.patients.value || []).filter(
         p =>
            (p.rawName && p.rawName.toLowerCase().includes(s)) ||
            (p.umrn && p.umrn.toLowerCase().includes(s)) ||
            (p.location && p.location.toLowerCase().includes(s))
      );
   });

   // Keep patientsDraggable in sync with filteredPatients
   // This watcher is necessary because SortableJS modifies the array in place,
   // but we want the source of truth for filtering/searching to remain patientData.patients.
   // patientsDraggable is specifically for the list displayed in the UI that can be reordered.
   // Method to set the sort mode
   function setSortMode(mode: 'custom' | 'name' | 'location') {
      sortMode.value = mode;
      // Re-sort patientsDraggable based on the new sort mode
      sortPatients();
   }

   // Function to sort patients based on the current sortMode
   function sortPatients() {
      const sortFunc = (a: Patient, b: Patient) => {
         switch (sortMode.value) {
            case 'name':
               return a.rawName?.toLowerCase().localeCompare(b.rawName?.toLowerCase() || '') || 0;
            case 'location': {
               // Debug logs to validate ward values and types
               const aLocation = typeof a.location === 'string' ? a.location : (a.location !== undefined && a.location !== null ? String(a.location) : '');
               const bLocation = typeof b.location === 'string' ? b.location : (b.location !== undefined && b.location !== null ? String(b.location) : '');
               console.log('[sortPatients][location] Comparing:', { aLocation, bLocation, aType: typeof a.location, bType: typeof b.location, a, b });
               // Place patients with missing/empty location at the end
               if (!aLocation && !bLocation) return 0;
               if (!aLocation) return 1;
               if (!bLocation) return -1;
               return aLocation.toLowerCase().localeCompare(bLocation.toLowerCase());
            }
            case 'custom':
            default:
               return 0; // Keep current order
         }
      };
      patientsDraggable.value = [...patientsDraggable.value].sort(sortFunc);
   }

   // Watch for changes in filteredPatients and sortMode
   watch(filteredPatients, (newList) => {
      patientsDraggable.value = [...newList];
      sortPatients(); // Apply sorting after filtering
   }, { immediate: true });

   // Multi-select logic for checkboxes
   function checkboxSelect(patientId: string) {
      const idx = selectedPatientIds.value.indexOf(patientId);
      if (idx === -1) {
         selectedPatientIds.value.push(patientId);
      } else {
         selectedPatientIds.value.splice(idx, 1);
      }
   }

   // Handler for removing selected patients
   function removeSelectedPatients() {
      if (selectedPatientIds.value.length === 0) {
         showSnackbar('No patients selected.', 'info');
         return;
      }
      // Use Promise.all to remove all selected patients concurrently
      // patientData.removePatient includes the confirmation dialog for each patient.
      Promise.all(
         selectedPatientIds.value.map(id => patientData.removePatient(id))
      ).then(() => {
         showSnackbar('Selected patients removal process finished.', 'info'); // Snackbar after all dialogs/removals
         selectedPatientIds.value = []; // Clear selection after removal attempts
         // Check if the actively selected patient was removed and clear selection in App.vue
         if (selectedPatientId.value && !patientData.patients.value.some(p => p.id === selectedPatientId.value)) {
            selectedPatientId.value = null;
         }
      });
   }

   // Handler for adding selected patients from a historical list to today's list
   // Requires todayString to be passed from the component
   const addSelectedToToday = async (todayString: string) => {
      if (selectedPatientIds.value.length === 0) {
         showSnackbar('No patients selected.', 'info');
         return;
      }
      // Check if the current list is already today's list
      if (patientData.activePatientListDate.value === todayString) {
         showSnackbar('Cannot add from today\'s list to itself.', 'info');
         return;
      }

      // Get the full patient objects for the selected IDs
      const patientsToAdd: Patient[] = selectedPatientIds.value
         .map(id => patientData.getPatientById(id))
         .filter((p): p is Patient => !!p); // Filter out any undefined results

      if (patientsToAdd.length === 0) {
         showSnackbar('Could not find data for selected patients.', 'error');
         return;
      }

      try {
         // Use the addPatientsToDate method from usePatientData
         const success = await patientData.addPatientsToDate(patientsToAdd, todayString);
         if (success) {
            showSnackbar(`Added ${patientsToAdd.length} patient(s) to today's list.`, 'success');
            // Optionally clear selection after adding
            // selectedPatientIds.value = [];
         } else {
            // Error message should be set by patientData.addPatientsToDate
            showSnackbar(`Failed to add patients to today's list: ${patientData.error.value || 'Unknown error'}`, 'error');
         }
      } catch (e: any) {
         showSnackbar(`Error adding patients to today's list: ${e.message || e}`, 'error');
      }
   };

   // Handler for when sorting ends (from SortableJS)
   const onSortEnd = async (newOrderedList: Patient[] | any) => {
      // Defensive: Only proceed if newOrderedList is an array
      if (!Array.isArray(newOrderedList)) {
         console.error("onSortEnd: Expected Patient[] array, received:", newOrderedList);
         showSnackbar('Failed to update patient order: invalid data.', 'error');
         return;
      }
      // The newOrderedList is the updated array from SortableJS
      // We need to save this new order
      // Optionally, you can add an 'order' property if desired:
      // const orderedPatients = newOrderedList.map((patient, index) => ({ ...patient, order: index }));

      const success = await patientData.savePatients(newOrderedList); // Save the new order
      if (success) {
         // Update the main patients list in usePatientData to reflect the new order
         // This will also trigger the filteredPatients watcher and update patientsDraggable
         patientData.patients.value = newOrderedList;
         showSnackbar('Patient order updated.', 'success');
      } else {
         showSnackbar('Failed to update patient order.', 'error');
      }
   };

   // Handler for removing a single patient (used by the delete icon)
   // This calls the removePatient logic in usePatientData, which includes the confirmation dialog.
   const removePatient = async (patient: Patient) => {
      const success = await patientData.removePatient(patient.id);
      if (success) {
         showSnackbar(`Patient "${patient.rawName}" removed.`, 'info');
         // If the removed patient was selected, clear selection in App.vue's ref
         if (selectedPatientId.value === patient.id) {
            selectedPatientId.value = null;
         }
      } else {
         // Error message should be set by patientData.removePatient
         showSnackbar(`Failed to remove patient: ${patientData.error.value || 'Unknown error'}`, 'error');
      }
   };

   // Function to initialize SortableJS
   const initSortable = (element: HTMLElement) => {
      if (element) {
         Sortable.create(element, {
            handle: '.drag-handle',
            preventDefault: false,
            animation: 150,
            onEnd(evt: any) {
               // Reorder patientsDraggable.value based on drag event
               const currentList = patientsDraggable.value;
               if (Array.isArray(currentList)) {
                  const movedItem = currentList.splice(evt.oldIndex, 1)[0];
                  currentList.splice(evt.newIndex, 0, movedItem);
                  const newOrder = [...currentList];
                  patientsDraggable.value = newOrder;
                  // Call onSortEnd with the new order
                  onSortEnd(newOrder);
               } else {
                  console.error("patientsDraggable.value is not an array.");
               }
            },
         });
      }
   };


   return {
      sortMode,
      patientsDraggable,
      patientListRef, // Export the ref so the component can bind it
      isEditPatientListMode,
      selectedPatientIds,
      search,
      filteredPatients,
      checkboxSelect,
      removeSelectedPatients,
      addSelectedToToday,
      onSortEnd, // Exported for completeness, though primarily used internally by Sortable
      removePatient, // Export the handler for single patient removal
      initSortable, // Export the function to initialize SortableJS
      setSortMode,
   };
}