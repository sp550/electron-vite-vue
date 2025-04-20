<template>
   <v-app>
      <!-- === App Bar === -->
      <v-app-bar app color="primary" dark density="compact">
         <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
         <v-spacer></v-spacer>
         <v-toolbar-title></v-toolbar-title>
         <v-btn icon="mdi-chevron-left" @click="goToPreviousDay"
            :disabled="!selectedPatientId || noteEditor.isLoading.value" title="Previous Day" size="small"></v-btn>
         <span class="text-subtitle-1 mx-2" :title="selectedDate">
            <v-icon start>mdi-calendar</v-icon>
            {{ noteDateDisplay }}
         </span>
         <v-btn icon="mdi-chevron-right" @click="goToNextDay"
            :disabled="!selectedPatientId || noteEditor.isLoading.value" title="Next Day" size="small"></v-btn>
         <!-- Date Picker for Patient List Date Navigation -->
         <v-menu v-model="dateMenu" :close-on-content-click="false" offset-y>
            <template #activator="{ props }">
               <v-btn v-bind="props" icon title="Select Date" aria-label="Select Date">
                  <v-icon>mdi-calendar-search</v-icon>
               </v-btn>
            </template>
            <v-card>
               <v-date-picker
                  v-model="selectedDate"
                  :allowed-dates="allowedDates"
                  @update:model-value="onDateChange"
                  color="primary"
                  show-adjacent-months
                  :max="todayString"
               />
            </v-card>
         </v-menu>
         <!-- Auto-Save Toggle -->
         <v-switch v-model="noteEditor.isAutoSaveEnabled.value" label="Auto-Save" color="primary" hide-details
            density="compact" class="ml-2 mr-2 flex-grow-0" title="Toggle Auto-Save"></v-switch>
         <!-- Overflow Menu -->
         <v-menu location="bottom end" offset-y>
            <template #activator="{ props }">
               <v-btn v-bind="props" icon title="More actions" aria-label="More actions">
                  <v-icon>mdi-dots-vertical</v-icon>
               </v-btn>
            </template>
            <v-list>
               <v-list-item @click="goToSettings">
                  <v-list-item-title>Settings</v-list-item-title>
               </v-list-item>
               <v-list-item @click="selectDataDirectory">
                  <v-list-item-title>Select Data Directory</v-list-item-title>
               </v-list-item>
   
               <v-list-item @click="manualExportNotesForDay">
                  <v-list-item-title>Export Notes</v-list-item-title>
               </v-list-item>
               <v-list-item @click="openDataDirectory">
                  <v-list-item-title>Open Data Directory</v-list-item-title>
               </v-list-item>
               <v-list-item
                 @click="handleImportICMPatientList"
                 :disabled="importICMLoading"
               >
                 <v-list-item-title>
                   Import ICM Patient List (Choose File)
                    <v-progress-circular
                      v-if="importICMLoading"
                      indeterminate
                      size="16"
                      color="primary"
                      class="ml-2"
                    />
                 </v-list-item-title>
               </v-list-item>
            </v-list>
         </v-menu>
      </v-app-bar>

      <!-- === Info Bar (Data Directory not set) === -->
      <v-system-bar v-if="configState.isConfigLoaded.value && !configState.isDataDirectorySet.value" color="warning"
         window>
         <v-icon start>mdi-alert-circle-outline</v-icon>
         <span>Please select a Data Directory to store patient files.</span>
         <v-spacer></v-spacer>
         <v-btn size="small" @click="selectDataDirectory" variant="outlined">Select Directory</v-btn>
      </v-system-bar>

      <!-- === Navigation Drawer (Patient List) === -->
      <v-navigation-drawer app v-model="drawer" :permanent="smAndUp" class="drawer">
         <!-- Search and Multi-Select Controls -->
         <div class="pa-2">
            <v-text-field
               v-model="search"
               label="Search patients"
               prepend-inner-icon="mdi-magnify"
               dense
               hide-details
               clearable
               class="mb-2"
            />
            <v-btn
               v-if="selectedPatientIds.length > 0"
               color="error"
               size="small"
               class="mb-2"
               @click="removeSelectedPatients"
               block
            >
               <v-icon start>mdi-delete</v-icon>
               Remove Selected ({{ selectedPatientIds.length }})
            </v-btn>
            <!-- Add Selected to Today's List Button -->
            <v-btn
               v-if="selectedPatientIds.length > 0 && selectedDate !== todayString"
               color="primary"
               variant="tonal"
               size="small"
               class="mb-2"
               @click="addSelectedToToday"
               block
            >
               <v-icon start>mdi-calendar-plus</v-icon>
               Add Selected to Today ({{ selectedPatientIds.length }})
            </v-btn>
         </div>
         <!-- DEBUG: Check filteredPatients -->
         <pre>Debug Patients: {{ filteredPatients.length }}</pre>
         <ul ref="patientListRef" class="v-list patient-list">
            <li
               v-for="(element, index) in patientsDraggable"
               :key="element.id"
               :data-id="element.id"
               class="patient-list-item"
               :class="{ 'is-dragging': draggingIndex === index }"
            >
               <v-list-item-content>
                  <v-row align="center">
                     <v-col cols="auto">
                        <v-checkbox
                           :model-value="selectedPatientIds.includes(element.id)"
                           @click.stop="togglePatientSelection(element.id)"
                           :ripple="false"
                           density="compact"
                           color="primary"
                        />
                     </v-col>
                     <v-col>
                        <v-list-item-title>{{ element.name }}</v-list-item-title>
                        <v-list-item-subtitle v-if="element.umrn || element.ward" class="umrn-ward">
                           {{ element.umrn ? `UMRN: ${element.umrn}` : '' }} {{ element.ward ? `Ward: ${element.ward}` : '' }}
                        </v-list-item-subtitle>
                     </v-col>
                     <v-col cols="auto" class="button-col">
                        <v-btn
                           icon
                           size="small"
                           color="error"
                           @click.stop="removePatient(element)"
                           title="Remove patient"
                           class="mr-1"
                        >
                           <v-icon>mdi-delete</v-icon>
                        </v-btn>
                        <v-btn
                           icon
                           size="small"
                           class="drag-handle"
                           title="Drag to reorder"
                           @mousedown.stop
                        >
                           <v-icon>mdi-drag</v-icon>
                        </v-btn>
                     </v-col>
                  </v-row>
               </v-list-item-content>
            </li>
         </ul>


         <!-- Add New Patient -->
         <v-list-item @click="addNewPatient" :disabled="!configState.isDataDirectorySet.value"
            class="add-new-patient-button">
            <v-list-item-title>
               <v-icon start>mdi-account-plus-outline</v-icon>
               Add New Patient
            </v-list-item-title>
         </v-list-item>
         <!-- App Info -->
         <v-list-item lines="two" density="compact">
            <v-list-item-subtitle>App Info:</v-list-item-subtitle>
            <v-list-item-title class="text-caption">
               Version: {{ version }}<br>
               Packaged: {{ isPackaged ? 'Yes' : 'No' }}<br>
               Environment: {{ nodeEnv }}<br>
               Config Path: {{ configState.configPath.value || 'Loading...' }}
            </v-list-item-title>
         </v-list-item>
         <!-- Data Directory Info aligned at bottom -->
         <div class="drawer-bottom">
            <v-list-item v-if="configState.config.value.dataDirectory" lines="two" density="compact">
               <v-list-item-subtitle>Data Directory:</v-list-item-subtitle>
               <v-list-item-title class="text-caption wrap-text" :title="configState.config.value.dataDirectory">
                  {{ configState.config.value.dataDirectory }}
               </v-list-item-title>
            </v-list-item>
         </div>
      </v-navigation-drawer>


      <!-- === Main Content Area === -->
      <v-main>
         <v-container fluid class="main-content-container pa-0">
            <!-- Editor View (global single editor) -->
            <div v-if="!selectedPatientId || !configState.isDataDirectorySet.value" class="placeholder-content">
               <v-icon size="64" :color="!configState.isDataDirectorySet.value ? 'orange' : 'grey-lighten-1'">
                  {{ !configState.isDataDirectorySet.value ? 'mdi-folder-alert-outline' : 'mdi-account-heart-outline'
                  }}
               </v-icon>
               <p v-if="!configState.isDataDirectorySet.value" class="text-h6 grey--text text--darken-1 mt-4">
                  Please select your data storage directory.
               </p>
               <p v-else class="text-h6 grey--text text--lighten-1 mt-4">
                  Select or add a patient.
               </p>
               <v-btn v-if="!configState.isDataDirectorySet.value" color="warning" class="mt-4"
                  @click="selectDataDirectory" prepend-icon="mdi-folder-open-outline">
                  Select Data Directory
               </v-btn>
               <v-btn v-else color="primary" class="mt-4" @click="addNewPatient" prepend-icon="mdi-plus">
                  Add New Patient
               </v-btn>
            </div>
            <div v-else class="editor-layout">
               <v-card flat class="editor-card">
                  <v-toolbar density="compact" color="grey-lighten-3">
                     <v-toolbar-title class="text-subtitle-1">
                     </v-toolbar-title>
                     <v-text-field v-model="selectedPatient!.name" label="Patient Name" hide-details single-line
                        @blur="updatePatientName"></v-text-field>
                     <v-text-field v-model="selectedPatient!.umrn" label="Patient UMRN" hide-details single-line
                        @blur="updatePatientUmrn"></v-text-field>
                     <v-spacer></v-spacer>

                     <v-spacer></v-spacer> <!-- Added spacer -->
                     <v-btn :loading="noteEditor.isLoading.value"
                        :disabled="noteEditor.isLoading.value || !isNoteLoaded || !configState.isDataDirectorySet.value"
                        @click="saveCurrentNote" color="primary" variant="tonal" size="small" class="mr-2"
                        title="Save Note">
                        <v-icon start>mdi-content-save</v-icon> Save
                     </v-btn>

                     <v-icon :icon="saveStatusIcon" :color="noteEditor.hasUnsavedChanges.value ? 'warning' : 'success'"
                        size="small" class="ml-2" title="Save Status"></v-icon>
                     <v-btn icon="mdi-delete" :disabled="!selectedPatient"
                        @click="selectedPatient && confirmRemovePatient(selectedPatient)"
                        title="Delete Patient"></v-btn>
                  </v-toolbar>
                  <v-card-text class="pa-0 editor-wrapper">
                     <div v-if="noteEditor.isLoading.value && !isNoteLoaded" class="loading-overlay">
                        <v-progress-circular indeterminate color="primary"></v-progress-circular>
                        <p class="mt-2">Loading note...</p>
                     </div>
                     <div v-else-if="noteEditor.error.value" class="error-message pa-4 text-center text-error">
                        <v-icon start>mdi-alert-circle-outline</v-icon>
                        Error loading note: {{ noteEditor.error.value }}
                        <v-btn @click="loadSelectedNote" small variant="tonal" class="ml-2">Retry</v-btn>
                     </div>
                     <MonacoEditorComponent ref="monacoEditorRef" v-model="noteContent" language="markdown"
                        :options="{ theme: 'vs' }" class="editor-component pa-4" />
                  </v-card-text>
               </v-card>
            </div>

         </v-container>
      </v-main>

      <!-- === Snackbar === -->
      <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="bottom right">
         {{ snackbar.text }}
         <template #actions>
            <v-btn color="white" variant="text" @click="snackbar.show = false">Close</v-btn>
         </template>
      </v-snackbar>

      <!-- Duplicate Patient Dialog -->
      <v-dialog v-model="duplicateDialog" max-width="500">
         <v-card>
            <v-card-title class="text-h5">
               Duplicate Patient Detected
            </v-card-title>
            <v-card-text>
               A patient with similar information already exists.
               <br>
               Name: <b>{{ duplicatePatient?.name }}</b>
               <br>
               UMRN: <b>{{ duplicatePatient?.umrn }}</b>
               <br>
               Do you want to load the existing record?
            </v-card-text>
            <v-card-actions>
               <v-spacer></v-spacer>
               <v-btn color="blue-grey" text @click="duplicateDialog = false">
                  Cancel
               </v-btn>
               <v-btn color="primary" text @click="loadDuplicatePatient">
                  Load Patient
               </v-btn>
            </v-card-actions>
         </v-card>
      </v-dialog>
   </v-app>
</template>

<script setup lang="ts">
import { ref, provide, computed, watch, nextTick, onMounted } from 'vue';
//import { VueDraggableNext } from 'vue-draggable-next';
import {  useNoteExport } from '@/composables/useNoteRetrieval';
// --- In-memory cache for unsaved notes per patient/date ---
const unsavedNotesCache: Record<string, string> = {};

// --- Import ICM Patient List Loading State ---
const importICMLoading = ref(false);

// --- Handler for Import ICM Patient List ---
const handleImportICMPatientList = async () => {
  try {
    importICMLoading.value = true;
    // Open file selection dialog for CSV files
    const filePath = await window.electronAPI.selectCSVFile?.();
    if (!filePath) {
      importICMLoading.value = false;
      return; // User cancelled
    }
    await patientData.importICMPatientListFromFile(filePath);
    showSnackbar('ICM patient list imported successfully.', 'success');
  } catch (e: any) {
    showSnackbar(`Error importing ICM patient list: ${e?.message || e}`, 'error');
  } finally {
    importICMLoading.value = false;
  }
};



// --- Auto-Export Initialization Control ---
const autoExportStarted = ref(false);

declare const window: any;
import packageJson from '../package.json';
import { usePatientData } from '@/composables/usePatientData';
import { useNoteEditor } from '@/composables/useNoteEditor';
import { useConfig } from '@/composables/useConfig';
import { useFileSystemAccess } from '@/composables/useFileSystemAccess';
import type { Patient, Note } from '@/types';
import MonacoEditorComponent from '@/components/MonacoEditorComponent.vue';
import { useDisplay } from 'vuetify';

// --- Draggable state for patient list ---
const hoveredIndex = ref<number | null>(null);
const draggingIndex = ref<number | null>(null);
// Draggable state for patient list
import type { Ref } from 'vue';
import Sortable from 'sortablejs';
const patientsDraggable: Ref<Patient[]> = ref([]);
const patientListRef: Ref<HTMLUListElement | null> = ref(null);

// Remove patient handler for icon
const removePatient = async (patient: Patient) => {
   await confirmRemovePatient(patient);
};

const drawer = ref(false);
const snackbar = ref({ show: false, text: '', color: 'success' });
const selectedPatientId = ref<string | null>(null);
const selectedPatientIds = ref<string[]>([]); // For multi-select
const search = ref('');
const dateMenu = ref(false);
const allowedDates = ref<string[]>([]);
const todayString = new Date().toISOString().split('T')[0];
const selectedDate = ref<string>(todayString);
const noteContent = ref<string>('');
const currentNote = ref<Note | null>(null);
const duplicateDialog = ref(false);
const duplicatePatient = ref<Patient | null>(null);
const isNoteLoaded = ref(false);
const version = packageJson.version;
const isPackaged = (window as any).electronAPI.isPackaged

const configState = useConfig();
const patientData = usePatientData();
const noteEditor = useNoteEditor(); // Includes isAutoSaveEnabled now
const fileSystemAccess = useFileSystemAccess();
const { smAndUp } = useDisplay();
const nodeEnv = computed(() => process.env.NODE_ENV);

// ... showSnackbar is declared below, so move useNoteExport after showSnackbar ...


const saveStatusIcon = computed(() => {
   return noteEditor.hasUnsavedChanges.value ? 'mdi-content-save-edit' : 'mdi-check-circle';
});

const selectedPatient = computed<Patient | undefined>(() => {
   if (!selectedPatientId.value) return undefined;
   return patientData.getPatientById(selectedPatientId.value);
});

// Computed: filtered patient list
const filteredPatients = computed(() => {
   if (!search.value) return patientData.patients.value;
   const s = search.value.toLowerCase();
   return patientData.patients.value.filter(
      p =>
         (p.name && p.name.toLowerCase().includes(s)) ||
         (p.umrn && p.umrn.toLowerCase().includes(s)) ||
         (p.ward && p.ward.toLowerCase().includes(s))
   );
});

// Keep patientsDraggable in sync with filteredPatients
watch(filteredPatients, (newList) => {
  patientsDraggable.value = [...newList];
}, { immediate: true });
const noteDateDisplay = computed(() => {
   try {
      const [year, month, day] = selectedDate.value.split('-');
      const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
   } catch {
      return selectedDate.value;
   }
});

const showSnackbar = (text: string, color: 'success' | 'error' | 'info' = 'info') => {
   snackbar.value.text = text;
   snackbar.value.color = color;
   snackbar.value.show = true;
};

// Multi-select logic
function togglePatientSelection(patientId: string) {
   const idx = selectedPatientIds.value.indexOf(patientId);
   if (idx === -1) {
      selectedPatientIds.value.push(patientId);
   } else {
      selectedPatientIds.value.splice(idx, 1);
   }
   // If only one selected, set as active for editing
   if (selectedPatientIds.value.length === 1) {
      selectedPatientId.value = selectedPatientIds.value[0];
   }
}
function removeSelectedPatients() {
   if (selectedPatientIds.value.length === 0) return;
   Promise.all(
      selectedPatientIds.value.map(id => patientData.removePatient(id))
   ).then(() => {
      showSnackbar('Selected patients removed.', 'info');
      selectedPatientIds.value = [];
      // If the active patient was removed, clear selection
      if (selectedPatientId.value && !patientData.patients.value.some(p => p.id === selectedPatientId.value)) {
         selectedPatientId.value = null;
      }
   });
}

// --- Add Selected Patients from Historical List to Today's List ---
const addSelectedToToday = async () => {
  if (selectedPatientIds.value.length === 0) {
    showSnackbar('No patients selected.', 'info');
    return;
  }
  if (selectedDate.value === todayString) {
    showSnackbar('Cannot add from today\'s list to itself.', 'info');
    return;
  }

  const patientsToAdd: Patient[] = selectedPatientIds.value
    .map(id => patientData.getPatientById(id))
    .filter((p): p is Patient => !!p); // Filter out undefined results

  if (patientsToAdd.length === 0) {
    showSnackbar('Could not find data for selected patients.', 'error');
    return;
  }

  try {
    const success = await patientData.addPatientsToDate(patientsToAdd, todayString);
    if (success) {
      showSnackbar(`Added ${patientsToAdd.length} patient(s) to today's list.`, 'success');
      // Optionally clear selection after adding
      // selectedPatientIds.value = [];
    } else {
      showSnackbar(`Failed to add patients to today's list: ${patientData.error.value || 'Unknown error'}`, 'error');
    }
  } catch (e: any) {
    showSnackbar(`Error adding patients to today's list: ${e.message || e}`, 'error');
  }
};

// Date navigation logic
async function onDateChange(newDate: string) {
   selectedDate.value = newDate;
   await patientData.setActivePatientListDate(newDate);
   selectedPatientId.value = null;
   selectedPatientIds.value = [];
}
provide('showSnackbar', showSnackbar);

const {
   startAutoExport,
   
   manualExportNotesForDay
} = useNoteExport({
   showSnackbar,
   configState,
   patientData,
   fileSystemAccess,
   selectedDate,
   electronAPI: window.electronAPI
});

const selectPatient = (patientId: string) => {
   // Before switching, cache unsaved note if needed
   if (
      noteEditor.isAutoSaveEnabled.value === false &&
      noteEditor.hasUnsavedChanges.value === true &&
      selectedPatientId.value &&
      selectedDate.value
   ) {
      const cacheKey = `${selectedPatientId.value}:${selectedDate.value}`;
      unsavedNotesCache[cacheKey] = noteContent.value;
   }
   selectedPatientId.value = patientId;
   loadSelectedNote();
};

const handlePatientClick = (patientId: string) => {
   selectPatient(patientId);
};

const addNewPatient = async () => {
   if (!configState.isDataDirectorySet.value) {
      showSnackbar("Please select a data directory first.", "error");
      return;
   }
   try {
      const newPatientData: Omit<Patient, 'id'> = { name: 'New Patient', umrn: '', ward: '', type: 'uuid' };
      const newPatient = await patientData.addPatient(newPatientData);
      if (newPatient) {
         showSnackbar(`New patient "${newPatient.name}" created.`, 'success');
         selectPatient(newPatient.id);
      } else {
         showSnackbar(`Failed to add patient: ${patientData.error.value || 'Unknown error'}`, 'error');
      }
   } catch (e: any) {
      showSnackbar(`Error adding patient: ${e.message || e}`, 'error');
   }
};


const loadDuplicatePatient = () => {
   if (duplicatePatient.value) {
      selectPatient(duplicatePatient.value.id);
      duplicateDialog.value = false;
   }
};

const clearSelectedPatientState = () => {
   selectedPatientId.value = null;
   noteContent.value = '';
   currentNote.value = null;
   isNoteLoaded.value = false;
};

const confirmRemovePatient = async (patient: Patient) => {
   const success = await patientData.removePatient(patient.id);
   if (success) {
      showSnackbar(`Patient "${patient.name}" removed.`, 'info');
      // If the removed patient was selected, clear selection
      if (selectedPatientId.value === patient.id) {
         clearSelectedPatientState();
      }
   } else {
      showSnackbar(`Failed to remove patient: ${patientData.error.value || 'Unknown error'}`, 'error');
   }
};

const loadSelectedNote = async () => {
   console.log('loadSelectedNote called');
   if (!selectedPatientId.value) {
      clearSelectedPatientState();
      return;
   }

   isNoteLoaded.value = false; // Set to false before loading
   try {
      if (!selectedPatient.value) {
         // This case should ideally not happen if selectedPatientId is set, but good for safety
         showSnackbar('Cannot load note: Patient data not found.', 'error');
         clearSelectedPatientState();
         return;
      }
      // Call loadNote - it updates internal state (currentNote, error, isLoading)
      await noteEditor.loadNote(selectedPatient.value, selectedDate.value);

      // Check the state *after* loadNote completes
      if (noteEditor.currentNote.value && !noteEditor.error.value) {
         noteEditor.setUnsavedChanges(false); // Set BEFORE watcher trigger
         await nextTick(); // Ensure state update propagates before changing noteContent

         // --- Check cache for unsaved note ---
         const cacheKey = `${selectedPatientId.value}:${selectedDate.value}`;
         if (unsavedNotesCache.hasOwnProperty(cacheKey)) {
            noteContent.value = unsavedNotesCache[cacheKey];
            noteEditor.setUnsavedChanges(true); // Mark as dirty if restored from cache
         } else {
            noteContent.value = noteEditor.currentNote.value.content;
            noteEditor.setUnsavedChanges(false); // Mark as clean if loaded from disk
         }
         currentNote.value = noteEditor.currentNote.value; // Keep local ref synced if needed elsewhere
         isNoteLoaded.value = true;
      } else {
         // Failed to load or determine path, or an error occurred
         noteContent.value = ''; // Clear content on error/failure
         currentNote.value = null;
         isNoteLoaded.value = false;
         // Show snackbar only for actual errors, not 'file not found' which is handled by creating a new note
         if (noteEditor.error.value && !noteEditor.error.value.includes('ENOENT') && !noteEditor.error.value.includes('Data directory not configured')) {
            showSnackbar(`Failed to load note: ${noteEditor.error.value}`, 'error');
         } else if (!noteEditor.currentNote.value && !noteEditor.error.value) {
            // This case might indicate a logic error if loadNote finished without error but currentNote is still null
            console.warn("loadSelectedNote: loadNote completed without error, but currentNote is still null.");
         }
      }
   } catch (e: any) {
      showSnackbar(`Error loading note: ${e.message || e}`, 'error');
      clearSelectedPatientState();
   }
};

const saveCurrentNote = async () => {
   if (!selectedPatientId.value) {
      showSnackbar('Please select a patient first.', 'error');
      return;
   }

   if (!isNoteLoaded.value) {
      showSnackbar('Cannot save: Note not loaded yet or loading.', 'error');
      return;
   }
   const noteToSave: Note = { date: selectedDate.value, content: noteContent.value };
   if (!selectedPatient.value) {
      showSnackbar('Please select a patient first.', 'error');
      return;
   }
   const success = await noteEditor.saveCurrentNote(selectedPatient.value, noteToSave);
   if (success) {
      // showSnackbar('Note saved successfully.', 'success');
      currentNote.value = { ...noteToSave };
      // --- Remove cache entry after successful save ---
      const cacheKey = `${selectedPatientId.value}:${selectedDate.value}`;
      if (unsavedNotesCache.hasOwnProperty(cacheKey)) {
         delete unsavedNotesCache[cacheKey];
      }
   } else {
      showSnackbar(`Failed to save note: ${noteEditor.error.value || 'Unknown error'}`, 'error');
      noteEditor.setUnsavedChanges(false); // Reset on failure
   }
};

const goToPreviousDay = async () => {
   if (!selectedPatient.value) return;
   try {
      // Use the function from the instantiated composable
      const prevDate = await fileSystemAccess.getPreviousDayNote(selectedPatient.value.id, selectedDate.value);
      if (prevDate) {
         selectedDate.value = prevDate;
         // loadSelectedNote will be triggered by the watcher
      } else {
         showSnackbar('No previous note found.', 'info');
      }
   } catch (error: any) {
      showSnackbar(`Error navigating to previous day: ${error.message || 'Unknown error'}`, 'error');
   }
};

const goToNextDay = async () => {
   if (!selectedPatient.value) return;
   try {
      // Use the function from the instantiated composable
      const nextDate = await fileSystemAccess.getNextDayNote(selectedPatient.value.id, selectedDate.value);
      if (nextDate) {
         selectedDate.value = nextDate;
         // loadSelectedNote will be triggered by the watcher
      } else {
         showSnackbar('No next note found.', 'info');
      }
   } catch (error: any) {
      showSnackbar(`Error navigating to next day: ${error.message || 'Unknown error'}`, 'error');
   }
};

const onSortEnd = async (newOrderedList: Patient[]) => {
   // Optionally, you can add an 'order' property if desired:
   const orderedPatients = newOrderedList.map((patient, index) => ({ ...patient, order: index }));
   const success = await patientData.savePatients(orderedPatients);
   if (success) {
      patientData.patients.value = orderedPatients;
      showSnackbar('Patient order updated.', 'success');
   } else {
      showSnackbar('Failed to update patient order.', 'error');
   }
};



const goToSettings = () => {
   showSnackbar('Settings not implemented yet.', 'info');
};



const selectDataDirectory = async () => {
   showSnackbar("Select the folder where patient data should be stored.", "info");
   try {
      const result = await window.electronAPI.showOpenDialog({
         title: 'Select Data Directory',
         properties: ['openDirectory', 'createDirectory'],
      });

      if (result === undefined) {
         // This case indicates an internal issue with the dialog function
         throw new Error("Dialog interaction failed unexpectedly.");
      }

      if (!result.canceled && result.filePaths.length > 0) {
         const selectedPath = result.filePaths[0];
         const success = await configState.setDataDirectory(selectedPath);
         if (success) {
            showSnackbar(`Data directory set to: ${selectedPath}`, 'success');
            loadSelectedNote(); // Load note after data directory is set
         } else {
            showSnackbar('Failed to save the selected data directory.', 'error');
         }
      } // No need for an else block for cancellation, just do nothing.
   } catch (error: any) {
      showSnackbar(`Error selecting directory: ${error.message || 'Unknown error'}`, 'error');
   }
};

const openDataDirectory = async () => {
   const dataDirectory = configState.config.value.dataDirectory;
   let currentDataDir: string = '';
   if (dataDirectory) {
       currentDataDir = dataDirectory;
       await window.electronAPI.openDirectory(currentDataDir);
   }
}

watch(() => [selectedPatientId.value, selectedDate.value, configState.isDataDirectorySet.value], async ([newPatientId, , isDirSet]) => {
   console.log('watch called', selectedPatientId.value, selectedDate.value, configState.isDataDirectorySet.value);
   // Destructure newDate but don't use it directly if loadSelectedNote handles it
   if (newPatientId && isDirSet) {
      await loadSelectedNote();
   } else {
      clearSelectedPatientState();
   }
});

watch(configState.error, (newError) => {
   if (newError) {
      showSnackbar(`Configuration Error: ${newError}`, 'error');
   }
});

// --- Auto-Save Logic ---
const debouncedSaveNote = (() => {
   let timeout: ReturnType<typeof setTimeout> | null = null
   return (): void => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(async () => {
         if (
            noteEditor.isAutoSaveEnabled.value &&
            noteEditor.hasUnsavedChanges.value &&
            selectedPatient.value &&
            isNoteLoaded.value
         ) {
            console.log('App.vue: Triggering debounced auto‑save…')
            await saveCurrentNote()
         }
      }, 500)
   }
})()


watch(noteContent, (newContent, oldContent) => {
   // Trigger save only on actual user edits after initial load and if auto-save is on
   if (isNoteLoaded.value && newContent !== oldContent && oldContent !== undefined) {
      //  console.log('App.vue: noteContent changed, marking unsaved.');
      //   console.log('App.vue watch(noteContent): isAutoSaveEnabled =', noteEditor.isAutoSaveEnabled.value);
      noteEditor.setUnsavedChanges(true)
      //   noteEditor.hasUnsavedChanges.value = true
      // Mark changes
      if (noteEditor.isAutoSaveEnabled.value) {
         debouncedSaveNote(); // Trigger the debounced save
      }
   }
});



// --- Sync unsaved changes with Electron main process/global ---
watch(
   () => noteEditor.hasUnsavedChanges.value,
   (newVal) => {
      // Set global variable for main process check
      window.hasUnsavedChanges = newVal;
      // Notify main process via IPC
      if (window.electronAPI && typeof window.electronAPI.setUnsavedChanges === "function") {
         window.electronAPI.setUnsavedChanges(newVal);
      }
   },
   { immediate: true }
);

// Also watch auto-save toggle to trigger immediate save if turned on with pending changes
watch(noteEditor.isAutoSaveEnabled, (isEnabled) => {
   if (isEnabled && noteEditor.hasUnsavedChanges.value) {
      console.log('App.vue: Auto-save enabled with pending changes, triggering save...');
      debouncedSaveNote(); // Trigger save (or maybe immediate save?)
   }
});
// --- End Auto-Save Logic ---

/**
 * --- Auto-Export Initialization Watcher ---
 * Triggers startAutoExport only after:
 * - Config is loaded
 * - Data directory is set
 * - A patient is selected
 * - The note is fully loaded
 * Ensures it runs only once per app session.
 */
watch(
   [
      () => configState.isConfigLoaded.value,
      () => configState.isDataDirectorySet.value,
      () => selectedPatientId.value,
      () => isNoteLoaded.value
   ],
   ([isConfigLoaded, isDirSet, patientId, noteLoaded]) => {
      if (
         isConfigLoaded &&
         isDirSet &&
         patientId &&
         noteLoaded &&
         !autoExportStarted.value
      ) {
         startAutoExport();
         autoExportStarted.value = true;
      }
   },
   { immediate: false }
);

const updatePatientName = async () => {
   if (selectedPatient.value) {
      const updatedPatient = { ...selectedPatient.value };
      const success = await patientData.updatePatient(updatedPatient);
      if (!success) {
         showSnackbar(`Failed to update patient name: ${patientData.error.value || 'Unknown error'}`, 'error');
      } else {
         showSnackbar(`Patient name updated to: ${selectedPatient.value.name}`, 'success');
      }
   }
};

const updatePatientUmrn = async () => {
   if (!selectedPatient.value) return;

   const patientBeforeUpdate = { ...selectedPatient.value }; // Capture state before potential update
   const oldPatientType = patientBeforeUpdate.type;
   const oldPatientId = patientBeforeUpdate.id; // Use this for merge check

   // The v-model already updated selectedPatient.value.umrn
   const success = await patientData.updatePatient(selectedPatient.value);

   if (!success) {
      showSnackbar(`Failed to update patient UMRN: ${patientData.error.value || 'Unknown error'}`, 'error');
      // Optionally revert the change in the UI if save failed
      // selectedPatient.value.umrn = patientBeforeUpdate.umrn;
   } else {
      showSnackbar(`Patient UMRN updated to: ${selectedPatient.value.umrn}`, 'success');

      // Check if merge is needed (was UUID, now has UMRN)
      if (oldPatientType === 'uuid' && selectedPatient.value.umrn) {
         try {
            const mergeSuccess = await patientData.mergePatientData(oldPatientId, selectedPatient.value.umrn);
            if (mergeSuccess) {
               showSnackbar(`Patient data merged to UMRN ${selectedPatient.value.umrn}.`, 'success');
               // Important: Select the *new* UMRN-based patient ID after merge
               // The merge function should handle removing the old UUID entry and updating the list
               // We need to ensure the patient list is refreshed and then select the correct patient.
               // Assuming patientData.patients updates reactively after merge:
               await nextTick(); // Wait for potential DOM/data updates
               const newPatientRecord = patientData.getPatientByUmrn(selectedPatient.value.umrn);
               if (newPatientRecord) {
                  selectPatient(newPatientRecord.id); // Select using the potentially new ID (which might be the UMRN itself)
               } else {
                  // Fallback if lookup fails, maybe clear selection
                  clearSelectedPatientState();
                  showSnackbar('Could not find merged patient record.', 'error');
               }
            } else {
               showSnackbar(`Failed to merge patient data: ${patientData.error.value || 'Unknown error'}`, 'error');
            }
         } catch (error: any) {
            showSnackbar(`Error merging patient data: ${error.message || 'Unknown error'}`, 'error');
         }
      } else {
         // If no merge was needed, but UMRN changed, we might still need to refresh the selectedPatient
         // to ensure consistency if the ID is derived from UMRN.
         // Re-selecting ensures the computed `selectedPatient` is definitely up-to-date.
         const currentId = selectedPatientId.value;
         selectedPatientId.value = null; // Force computed recalculation
         await nextTick();
         selectedPatientId.value = currentId;
      }
   }
};
onMounted(async () => {
   // Load available patient list dates for date picker
   allowedDates.value = await patientData.listAvailablePatientListDates();
});

watch(selectedDate, async (newDate) => {
   // When selectedDate changes, reload allowedDates (in case new files are added)
   allowedDates.value = await patientData.listAvailablePatientListDates();
});


onMounted(async () => {
  await nextTick();
  if (patientListRef.value) {
    Sortable.create(patientListRef.value as HTMLElement, {
      handle: '.drag-handle',
      onEnd: onSortEnd,
      preventDefault: false,
    });
  }
});
</script>

<style scoped lang="scss">
.patient-list-item {
   .v-btn {
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
   }

   &:hover {
      .v-btn {
         opacity: 1;
      }
   }
}

.wrap-text {
   white-space: normal;
   overflow-wrap: break-word;
   word-wrap: break-word;
   word-break: break-all;
   line-height: 1.2;
}

.v-system-bar {
   z-index: 5;
}

.main-content-container {
   height: 100%;
   display: flex;
   flex-direction: column;
}

.placeholder-content {
   flex-grow: 1;
   display: flex;
   flex-direction: column;
   justify-content: center;
   align-items: center;
   text-align: center;
}

.editor-layout {
   flex-grow: 1;
   display: flex;
   flex-direction: column;
   height: 100%;
}

.editor-card {
   flex-grow: 1;
   display: flex;
   flex-direction: column;
   border: none;
   height: 100%;
}

.editor-wrapper {
   flex-grow: 1;
   position: relative;
   display: flex;
   flex-direction: column;
   min-height: 300px;
}

.editor-component {
   flex-grow: 1;
   border: none;
   height: 100%;
}

.loading-overlay,
.error-message {
   position: absolute;
   top: 0;
   left: 0;
   right: 0;
   bottom: 0;
   display: flex;
   flex-direction: column;
   justify-content: center;
   align-items: center;
   background-color: rgba(255, 255, 255, 0.8);
   z-index: 10;
   padding: 1rem;
}

.add-new-patient-button {
   margin-top: auto;
   border-top: 1px solid rgba(0, 0, 0, 0.12);
}

.drawer-bottom {
   margin-top: 0;
}

.patient-list {
  padding: 0;
  margin: 0;
}

.patient-list-item {
  list-style: none;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
}

.umrn-ward {
  font-size: 0.9em;
  color: gray;
}

.button-col {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

</style>