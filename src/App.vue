<template>
   <v-app>
      <!-- === App Bar === -->
      <v-app-bar app color="primary" density="comfortable">
         <v-btn icon="mdi-menu" @click="drawer = !drawer" title="Toggle Navigation Drawer"></v-btn>
         <v-spacer></v-spacer>
         <v-toolbar-title></v-toolbar-title>
         <!-- Date navigation moved to PatientList.vue -->
         <!-- Auto-Save Toggle -->
         <v-switch v-model="noteEditor.isAutoSaveEnabled.value" label="Auto-Save" color="primary" hide-details
            density="compact" class="mx-2 flex-shrink-0" title="Toggle Auto-Save"></v-switch>
         <!-- Overflow Menu -->
         <v-menu location="bottom end" offset-y>
            <template #activator="{ props }">
               <v-btn v-bind="props" icon="mdi-dots-vertical" title="More actions" aria-label="More actions"></v-btn>
            </template>
            <v-list>
               <v-list-item @click="goToSettings" title="Settings" prepend-icon="mdi-cog"></v-list-item>
               <v-list-item @click="selectDataDirectory" title="Select Data Directory"
                  prepend-icon="mdi-folder-open-outline"></v-list-item>
               <v-list-item @click="manualExportNotesForDay" title="Export Notes"
                  prepend-icon="mdi-file-export-outline"></v-list-item>
               <v-list-item @click="openDataDirectory" title="Open Data Directory"
                  prepend-icon="mdi-folder-outline"></v-list-item>
               <v-list-item @click="handleImportICMClick" :disabled="importICMLoading"
                  title="Import ICM Patient List (Choose File)" prepend-icon="mdi-file-import-outline">
                  <v-progress-circular v-if="importICMLoading" indeterminate size="16" color="primary" class="ml-2" />
               </v-list-item>
               <v-divider></v-divider>
               <v-list-subheader>Current Patient</v-list-subheader>
               <v-list-item :disabled="!selectedPatient" @click="selectedPatient && confirmRemoveCurrentPatient()"
                  append-icon="mdi-delete" title="Delete Patient from list">
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

      <!-- === Navigation Drawer with Patient List and Controls === -->
      <v-navigation-drawer
        v-model="drawer"
        :permanent="smAndUp"
        :temporary="!smAndUp"
        expand-on-hover
        rail
        rail-width="30"
        app
        :width="drawerWidth"
        @mouseenter="isDrawerRail = false"
        @mouseleave="isDrawerRail = true"
      >
        <v-container class="pa-0 d-flex flex-column" style="height: 100%;">
          <!-- Patient List: hidden in rail mode -->
          <PatientList
            class="flex-grow-1"
            :class="{ 'patient-list-rail-hidden': isDrawerRail }"
            :patientsDraggable="patientsDraggable"
            :selectedPatientIds="selectedPatientIds"
            :isEditPatientListMode="isEditPatientListMode"
            :search="search"
            :todayString="todayString"
            :selectedDate="noteDate"
            :allowedDates="allowedDates"
            :noteDateDisplay="noteDateDisplay"
            :goToPreviousDay="() => goToPreviousDay()"
            :goToNextDay="() => goToNextDay()"
            :onDateChange="handleDateChange"
            :configState="configState"
            :version="version"
            :isPackaged="isPackaged"
            :nodeEnv="nodeEnv"
            :sortMode="sortMode"
            :setSortMode="setSortMode"
            @update:search="val => search = val"
            @update:selectedPatientIds="val => selectedPatientIds = val"
            @update:isEditPatientListMode="val => isEditPatientListMode = val"
            @patientSelected="onPatientSelected"
            @patientListChanged="onPatientListChanged"
            @addNewPatient="handleAddNewPatient"
            @removePatientFromList="handleRemovePatientFromList"
            @removeSelectedPatientsFromList="removeSelectedPatientsFromList"
            @addSelectedToTodayList="addSelectedToTodayList"
            @checkboxSelectPatientList="checkboxSelectPatientList"
            @request-date-change="handleDateChange"
          />
          <!-- Arrow icon shown in rail mode -->
          <div v-if="isDrawerRail" class="rail-arrow-container">
            <v-icon size="36" color="primary" title="Expand drawer">mdi-chevron-right</v-icon>
          </div>
          <div>
            <v-divider class="my-2"></v-divider>
            <v-expansion-panels class="flex-shrink-0">
              <v-expansion-panel title="Debug Info">
                <v-expansion-panel-text>
                  App Info:<br />
                  Version: {{ version }}<br />
                  Packaged: {{ isPackaged ? "Yes" : "No" }}<br />
                  Environment: {{ nodeEnv }}<br />
                  Config Path: {{ configState.configPath.value || "Loading..." }}<br />
                  <div v-if="configState.config.value.dataDirectory">
                    Data Directory:
                    <span class="text-caption text-wrap" :title="configState.config.value.dataDirectory">
                      {{ configState.config.value.dataDirectory }}
                    </span>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </v-container>
        <!-- === Drawer Resize Handle (Vuetify only) === -->
        <v-divider
          vertical
          :thickness="10"
          :inset="false"
          :style="{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            zIndex: 10,
            cursor: isResizing ? 'ew-resize' : 'col-resize',
            opacity: isResizing ? 0 : 0,
            transition: 'opacity 0.1s'
          }"
          tabindex="0"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation drawer"
          :aria-valuenow="drawerWidth"
          aria-valuemin="240"
          aria-valuemax="600"
          @mousedown="onResizeMouseDown"
        >
        </v-divider>
      </v-navigation-drawer>

      <!-- === Main Content Area === -->
      <v-main>
         <v-container v-if="!selectedPatientId || !configState.isDataDirectorySet.value" fluid
            class="pa-0 d-flex align-center justify-center fill-height">
            <v-card v-if="!selectedPatientId || !configState.isDataDirectorySet.value" flat
               class="d-flex flex-column align-center pa-8 justify-center">
               <v-card-text class="d-flex flex-column align-center">
                  <v-icon
                     :icon="!configState.isDataDirectorySet.value ? 'mdi-folder-alert-outline' : 'mdi-account-heart-outline'"
                     :color="!configState.isDataDirectorySet.value ? 'orange' : 'grey-lighten-1'" size="64"
                     class="mb-4" />

                  <div v-if="!configState.isDataDirectorySet.value" class="text-h6 text-grey-darken-1 mt-4 text-center">
                     Please select your data storage directory.
                  </div>
                  <div v-else class="text-h6 text-grey-lighten-1 mt-4 text-center">
                     Select or add a patient
                  </div>
               </v-card-text>
               <v-card-actions class="justify-center">
                  <template v-if="!configState.isDataDirectorySet.value">
                     <v-btn color="warning" class="mt-4" @click="selectDataDirectory"
                        prepend-icon="mdi-folder-open-outline" variant="elevated">
                        Select Data Directory
                     </v-btn>
                  </template>
                  <template v-else>
                     <v-btn color="primary" class="mt-4" @click="handleAddNewPatient" prepend-icon="mdi-plus"
                        variant="elevated">
                        Add New Patient
                     </v-btn>
                  </template>
               </v-card-actions>
            </v-card>
         </v-container>
         <v-container v-else fluid class=" pa-0  px-xl-16 d-flex flex-column fill-height justify-start fill-width">
            <v-toolbar color="grey-lighten-3 " density="comfortable">
               <v-text-field v-model="selectedPatient!.name" label="Patient Name" hide-details single-line
                  @blur="updatePatientName"></v-text-field>
               <!-- Independent Note Date Selector -->
               <v-text-field
                  v-model="selectedNoteDate"
                  label="Note Date"
                  type="date"
                  hide-details
                  single-line
                  style="max-width: 180px; min-width: 140px;"
                  :disabled="noteEditor.isLoading.value || !selectedPatientId"
                  @change="onNoteDateChange"
               ></v-text-field>
               <v-text-field v-model="selectedPatient!.umrn" label="Patient UMRN" hide-details single-line
                  @blur="updatePatientUmrn"></v-text-field>
               <v-spacer></v-spacer>

               <v-spacer></v-spacer> <!-- Added spacer -->
               <v-btn :loading="noteEditor.isLoading.value"
                  :disabled="noteEditor.isLoading.value || !isNoteLoaded || !configState.isDataDirectorySet.value"
                  @click="saveCurrentNote" color="primary" variant="tonal" size="small" class="mr-2" title="Save Note">
                  <v-icon start>mdi-content-save</v-icon> Save
                  <v-icon :icon="saveStatusIcon" :color="noteEditor.hasUnsavedChanges.value ? 'warning' : 'success'"
                     size="small" class="ml-2" title="Save Status"></v-icon>
               </v-btn>



            </v-toolbar>
            <v-overlay v-model="noteEditor.isLoading.value" contained persistent class="align-center justify-center"
               scrim="white">
               <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
               <p class="mt-2 text-center">Loading note...</p>
            </v-overlay>
            <div v-if="!noteEditor.isLoading.value && noteEditor.error.value"
               class="error-message pa-4 text-center text-error">
               <v-icon start>mdi-alert-circle-outline</v-icon>
               Error loading note: {{ noteEditor.error.value }}
               <v-btn @click="loadSelectedNote" small variant="tonal" class="ml-2">Retry</v-btn>
            </div>
            <MonacoEditorComponent v-if="!noteEditor.isLoading.value && !noteEditor.error.value" ref="monacoEditorRef"
               v-model="noteContent" language="markdown" :options="{ theme: 'vs' }" class="pa-4 flex-grow-1"
               style="height: 0;" />
         </v-container>
      </v-main>

      <!-- === Snackbar === -->
      <v-snackbar v-model=" snackbar.show" :color="snackbar.color" timeout="3000" location="bottom right">
         {{ snackbar.text }}
         <template #actions>
            <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
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
               <v-btn color="blue-grey" variant="text" @click="duplicateDialog = false">
                  Cancel
               </v-btn>
               <v-btn color="primary" variant="text" @click="handleLoadDuplicatePatient">
                  Load Patient
               </v-btn>
            </v-card-actions>
         </v-card>
      </v-dialog>
   </v-app>
</template>

<script setup lang="ts">
import { ref, provide, computed, watch, nextTick, onMounted } from 'vue';

function getTodayString() {
   const today = new Date();
   return today.toISOString().slice(0, 10);
}

// Independent note date state
const selectedNoteDate = ref(getTodayString());

// Handler for note date change
function onNoteDateChange() {
   // Defensive: If blank, reset to today
   if (!selectedNoteDate.value) {
      selectedNoteDate.value = getTodayString();
   }
}

const isDrawerRail = ref(true); // true = rail mode, false = expanded

import { useNoteExport } from '@/composables/useNoteRetrieval';
// import { useDateNavigation } from '@/composables/useDateNavigation'; // Removed
import { useSnackbar } from '@/composables/useSnackbar';
import { useDuplicatePatient } from '@/composables/useDuplicatePatient';
import packageJson from '../package.json';
import { usePatientData } from '@/composables/usePatientData';
import { useNoteEditor } from '@/composables/useNoteEditor';
import { useConfig } from '@/composables/useConfig';
import { useFileSystemAccess } from '@/composables/useFileSystemAccess';
import { usePatientList } from '@/composables/usePatientList';
import { useDisplay } from 'vuetify';
import Sortable from 'sortablejs';
import type { Patient, Note } from '@/types';
import MonacoEditorComponent from '@/components/MonacoEditorComponent.vue';
import PatientList from '@/components/PatientList.vue';

const selectedPatientId = ref<string | null>(null); // ID of the currently active patient

// --- Date Navigation Handlers (for PatientList.vue) ---
// These handlers are now managed within usePatientData and PatientList.vue
// and operate on activePatientListDate. Removing redundant handlers in App.vue.

// --- Drawer and Responsive ---
const drawer = ref(true);
const { smAndUp } = useDisplay();

// === Resizable Drawer State (Vuetify only, no custom CSS) ===
const DEFAULT_DRAWER_WIDTH = 350;
const MIN_DRAWER_WIDTH = 240;
const MAX_DRAWER_WIDTH = 600;
const drawerWidth = ref(DEFAULT_DRAWER_WIDTH);
const isResizing = ref(false);
let startX = 0;
let startWidth = 0;

// Mouse events
function onResizeMouseDown(e: MouseEvent) {
  isResizing.value = true;
  startX = e.clientX;
  startWidth = drawerWidth.value;
  document.body.style.cursor = 'ew-resize';
  window.addEventListener('mousemove', onResizeMouseMove);
  window.addEventListener('mouseup', onResizeMouseUp);
}

function onResizeMouseMove(e: MouseEvent) {
  if (!isResizing.value) return;
  const dx = e.clientX - startX;
  let newWidth = startWidth + dx;
  newWidth = Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, newWidth));
  drawerWidth.value = newWidth;
}

function onResizeMouseUp() {
  isResizing.value = false;
  document.body.style.cursor = '';
  window.removeEventListener('mousemove', onResizeMouseMove);
  window.removeEventListener('mouseup', onResizeMouseUp);
}

// Touch events
function onResizeTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) return;
  isResizing.value = true;
  startX = e.touches[0].clientX;
  startWidth = drawerWidth.value;
  document.body.style.cursor = 'ew-resize';
  window.addEventListener('touchmove', onResizeTouchMove);
  window.addEventListener('touchend', onResizeTouchEnd);
}

function onResizeTouchMove(e: TouchEvent) {
  if (!isResizing.value || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - startX;
  let newWidth = startWidth + dx;
  newWidth = Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, newWidth));
  drawerWidth.value = newWidth;
}

function onResizeTouchEnd() {
  isResizing.value = false;
  document.body.style.cursor = '';
  window.removeEventListener('touchmove', onResizeTouchMove);
  window.removeEventListener('touchend', onResizeTouchEnd);
}



// --- Patient List/Drawer/Export State ---
const unsavedNotesCache: Record<string, string> = {};
const importICMLoading = ref(false);
const autoExportStarted = ref(false);

// --- Patient List Event Handlers (for PatientList.vue) ---
function handleRemovePatientFromList(patient: any) {
   removePatient(patient);
   onPatientListChanged();
}
function removeSelectedPatientsFromList() {
   removeSelectedPatients();
   onPatientListChanged();
}
function addSelectedToTodayList() {
   addSelectedToToday(todayString);
   onPatientListChanged();
}
function checkboxSelectPatientList(patientId: string) {
   checkboxSelect(patientId);
   onPatientListChanged();
}

// --- Patient List State/Logic (moved from PatientList.vue) ---
const search = ref('');
const isEditPatientListMode = ref(false);
const selectedPatientIds = ref<string[]>([]);
const patientListRef = ref<HTMLElement | null>(null);

const configState = useConfig();
const patientDataComposable = usePatientData(); // Rename to avoid conflict with patientData in useNoteExport
const noteEditor = useNoteEditor();
const fileSystemAccess = useFileSystemAccess();
const { snackbar, showSnackbar } = useSnackbar();

const {
   noteDate, // Use noteDate instead of selectedDate
   noteDateDisplay,
   dateMenu,
   allowedDates,
   todayString,
   goToPreviousDay,
   goToNextDay,
   onDateChange: handleDateChange
} = patientDataComposable; // Destructure from the merged composable



const {
   duplicateDialog,
   duplicatePatient,
   loadDuplicatePatient: handleLoadDuplicatePatient
} = useDuplicatePatient();

const {
   startAutoExport,
   manualExportNotesForDay
} = useNoteExport({
   showSnackbar,
   configState,
   patientData: patientDataComposable, // Pass the composable instance
   fileSystemAccess,
   selectedDate: selectedNoteDate, // Pass the local selectedNoteDate ref
   electronAPI: window.electronAPI
});

const noteContent = ref<string>('');
const currentNote = ref<Note | null>(null);
const isNoteLoaded = ref(false);
const version = packageJson.version;
const isPackaged = (window as any).electronAPI.isPackaged;
const nodeEnv = process.env.NODE_ENV || '';

provide('showSnackbar', showSnackbar);

// --- Patient List Logic ---
const {
   patientsDraggable,
   removePatient,
   removeSelectedPatients,
   addSelectedToToday,
   checkboxSelect,
   onSortEnd,
   sortMode,
   setSortMode,
} = usePatientList(patientDataComposable, showSnackbar, selectedPatientId) as { // Use patientDataComposable
   patientsDraggable: any,
   removePatient: any,
   removeSelectedPatients: any,
   addSelectedToToday: any,
   checkboxSelect: any,
   onSortEnd: any,
   sortMode: import('vue').Ref<any>,
   setSortMode: any,
};


// --- Patient List Event Handlers ---
/* Patient list event handlers are now defined only once, see below for main handlers */

// --- Drag-and-drop initialization for patient list (if needed) ---
onMounted(async () => {
   await nextTick();
   if (patientListRef.value) {
      Sortable.create(patientListRef.value as HTMLElement, {
         handle: ".drag-handle",
         animation: 150,
         ghostClass: "sortable-ghost",
         chosenClass: "sortable-chosen",
         dragClass: "sortable-drag",
         onEnd: () => {
            onSortEnd(patientsDraggable.value);
            onPatientListChanged();
         },
      });
   }
});

// --- Computed Properties ---
const saveStatusIcon = computed(() => {
   return noteEditor.hasUnsavedChanges.value ? 'mdi-content-save-edit' : 'mdi-check-circle';
});

// Get the full Patient object for the selected ID
const selectedPatient = computed<Patient | undefined>(() => {
   if (!selectedPatientId.value) return undefined;
   return patientDataComposable.getPatientById(selectedPatientId.value); // Use patientDataComposable
});

// --- Core Functions ---

// Function to select a patient and load their note
const selectPatient = (patientId: string) => {
   // Before switching, cache unsaved note if needed (manual save mode)
   if (
      !noteEditor.isAutoSaveEnabled.value &&
      noteEditor.hasUnsavedChanges.value &&
      selectedPatientId.value &&
      selectedNoteDate.value
   ) {
      const cacheKey = `${selectedPatientId.value}:${selectedNoteDate.value}`;
      unsavedNotesCache[cacheKey] = noteContent.value;
   }
   selectedPatientId.value = patientId;
   // Optionally reset note date to today or keep previous
   // selectedNoteDate.value = getTodayString();
   // loadSelectedNote will be triggered by the watcher
};

// Clear local state related to the selected patient/note
const clearSelectedPatientState = () => {
   selectedPatientId.value = null;
   noteContent.value = '';
   currentNote.value = null;
   isNoteLoaded.value = false;
   noteEditor.setUnsavedChanges(false); // Reset unsaved changes flag
};

// Load the note for the currently selected patient and date
const loadSelectedNote = async () => {
    console.log(`[App.vue] loadSelectedNote called for patient: ${selectedPatientId.value}, date: ${selectedNoteDate.value}`);
    if (!selectedPatientId.value || !selectedNoteDate.value) {
       console.log('[App.vue] loadSelectedNote: Clearing state: No patient or date selected.');
       clearSelectedPatientState();
       return;
    }

    isNoteLoaded.value = false; // Set loading state
    try {
       const patient = selectedPatient.value; // Get the computed patient object
       if (!patient) {
          showSnackbar('Cannot load note: Patient data not found.', 'error');
          clearSelectedPatientState();
          return;
       }

       // Call useNoteEditor's loadNote function
       await noteEditor.loadNote(patient, selectedNoteDate.value);

       // Check the state *after* loadNote completes
       if (noteEditor.currentNote.value && !noteEditor.error.value) {
          noteEditor.setUnsavedChanges(false); // Reset flag before updating content
          await nextTick(); // Ensure state update propagates

          // Check cache for unsaved note (manual save mode)
          const cacheKey = `${selectedPatientId.value}:${selectedNoteDate.value}`;
          if (!noteEditor.isAutoSaveEnabled.value && unsavedNotesCache.hasOwnProperty(cacheKey)) {
             noteContent.value = unsavedNotesCache[cacheKey];
             noteEditor.setUnsavedChanges(true); // Mark as dirty if restored from cache
          } else {
             noteContent.value = noteEditor.currentNote.value.content;
             noteEditor.setUnsavedChanges(false); // Mark as clean if loaded from disk/new
          }
          currentNote.value = noteEditor.currentNote.value; // Keep local ref synced if needed
          isNoteLoaded.value = true;
       } else {
          // Failed to load (e.g., file not found, permission error)
          noteContent.value = ''; // Clear content on error/failure
          currentNote.value = null;
          isNoteLoaded.value = false; // Ensure loading state is false
          // Show snackbar only for actual errors, not 'file not found' (ENOENT)
          // or if data directory isn't set yet.
          if (noteEditor.error.value && !noteEditor.error.value.includes('ENOENT') && !noteEditor.error.value.includes('Data directory not configured')) {
             showSnackbar(`Failed to load note: ${noteEditor.error.value}`, 'error');
          } else if (!noteEditor.currentNote.value && !noteEditor.error.value) {
             // This case might indicate a logic error if loadNote finished without error but currentNote is still null
             // Or it could mean a new note needs to be created implicitly
             console.warn("[App.vue] loadSelectedNote: loadNote completed without error/ENOENT, but currentNote is still null. Ready for new note.");
             isNoteLoaded.value = true; // Allow editor to show for new note creation
             noteEditor.setUnsavedChanges(false); // Start clean
          } else {
             console.log(`[App.vue] Note not found for ${selectedPatientId.value} on ${selectedNoteDate.value}. Ready for new note.`);
             isNoteLoaded.value = true; // Allow editor to show for new note creation
             noteEditor.setUnsavedChanges(false); // Start clean
          }
       }
    } catch (e: any) {
       showSnackbar(`[App.vue] Error in loadSelectedNote: ${e.message || e}`, 'error');
       clearSelectedPatientState();
    }
};

// Save the current note content
const saveCurrentNote = async () => {
   if (!selectedPatientId.value || !selectedPatient.value) {
      showSnackbar('Please select a patient first.', 'error');
      return;
   }

   const noteToSave: Note = { date: selectedNoteDate.value, content: noteContent.value };

   // Use noteEditor's save function
   const success = await noteEditor.saveCurrentNote(selectedPatient.value, noteToSave);

   if (success) {
      // showSnackbar('Note saved successfully.', 'success'); // Often too noisy
      currentNote.value = { ...noteToSave }; // Update local state
      // Remove from cache if it existed (manual save mode)
      const cacheKey = `${selectedPatientId.value}:${selectedNoteDate.value}`;
      if (unsavedNotesCache.hasOwnProperty(cacheKey)) {
         delete unsavedNotesCache[cacheKey];
      }
   } else {
      showSnackbar(`Failed to save note: ${noteEditor.error.value || 'Unknown error'}`, 'error');
      // Do not reset unsaved changes on failure, user might want to retry
   }
};

// --- PatientList Event Handlers ---

function onPatientSelected(patientId: string) {
   selectPatient(patientId);
}

function onPatientListChanged() {
   // No direct patient list state management here per requirements.
   // This can be used to trigger a reload or update if needed.
}

//
// === Patient Editor/Toolbar Methods (still needed for template) ===
//

const handleAddNewPatient = async () => {
   if (!configState.isDataDirectorySet.value) {
      showSnackbar("Please select a data directory first.", "error");
      return;
   }
   // Add a new patient directly using patientData composable
   const newPatientData: Omit<Patient, 'id' | 'type'> = { name: 'New Patient', umrn: '', location: '' }; // Corrected type
   const newPatient = await patientDataComposable.addPatient(newPatientData); // Use patientDataComposable
   if (newPatient) {
      selectPatient(newPatient.id);
   }
   // Snackbar messages are handled within the composable
};

const updatePatientName = async () => {
   if (selectedPatient.value) {
      // The v-model already updated the name locally
      const success = await patientDataComposable.updatePatient(selectedPatient.value); // Use patientDataComposable
      if (!success) {
         showSnackbar(`Failed to update patient name: ${patientDataComposable.error.value || 'Unknown error'}`, 'error'); // Use patientDataComposable
         // Optionally revert UI change here if needed
      } else {
         showSnackbar(`Patient name updated to: ${selectedPatient.value.name}`, 'success');
      }
   }
};

const updatePatientUmrn = async () => {
   if (!selectedPatient.value) return;

   const patientBeforeUpdate = { ...selectedPatient.value };
   const oldPatientType = patientBeforeUpdate.type;
   const oldPatientId = patientBeforeUpdate.id;

   // The v-model already updated the UMRN locally
   const success = await patientDataComposable.updatePatient(selectedPatient.value); // Use patientDataComposable

   if (!success) {
      showSnackbar(`Failed to update patient UMRN: ${patientDataComposable.error.value || 'Unknown error'}`, 'error'); // Use patientDataComposable
      // Optionally revert UI change
      // selectedPatient.value.umrn = patientBeforeUpdate.umrn;
   } else {
      showSnackbar(`Patient UMRN updated to: ${selectedPatient.value.umrn}`, 'success');

      // Check if merge is needed (was UUID, now has UMRN)
      if (oldPatientType === 'uuid' && selectedPatient.value.umrn) {
         try {
            const mergeSuccess = await patientDataComposable.mergePatientData(oldPatientId, selectedPatient.value.umrn); // Use patientDataComposable
            if (mergeSuccess) {
               showSnackbar(`Patient data merged to UMRN ${selectedPatient.value.umrn}.`, 'success');
               // Patient list should update reactively. Need to select the *new* ID.
               await nextTick();
               const newPatientRecord = patientDataComposable.getPatientByUmrn(selectedPatient.value.umrn); // Use patientDataComposable
               if (newPatientRecord) {
                  selectPatient(newPatientRecord.id); // Select the merged record
               } else {
                  clearSelectedPatientState();
                  showSnackbar('Could not find merged patient record.', 'error');
               }
            } else {
               showSnackbar(`Failed to merge patient data: ${patientDataComposable.error.value || 'Unknown error'}`, 'error'); // Use patientDataComposable
            }
         } catch (error: any) {
            showSnackbar(`Error merging patient data: ${error.message || 'Unknown error'}`, 'error');
         }
      }
      // No explicit re-selection needed if ID didn't change, computed should update.
   }
};

const confirmRemoveCurrentPatient = async () => {
   if (!selectedPatient.value) return;
   const success = await patientDataComposable.removePatient(selectedPatient.value.id); // Use patientDataComposable
   if (success) {
      showSnackbar(`Patient "${selectedPatient.value.name}" removed.`, 'info');
      // clearSelectedPatientState is called implicitly by the watcher when selectedPatientId becomes invalid
   } else {
      showSnackbar(`Failed to remove patient: ${patientDataComposable.error.value || 'Unknown error'}`, 'error'); // Use patientDataComposable
   }
};

// Handler for the Import ICM Patient List menu item
const handleImportICMClick = async () => {
   try {
      importICMLoading.value = true;
      const filePath = await window.electronAPI.selectCSVFile?.();
      if (!filePath) {
         importICMLoading.value = false;
         return; // User cancelled
      }
      // Use the function from the usePatientList composable
      // Implement import logic directly using patientData composable
      await patientDataComposable.importICMPatientListFromFile(filePath); // Use patientDataComposable
      // Snackbar handled within composable
   } catch (e: any) {
      // Catch errors specific to the dialog/file selection itself
      showSnackbar(`Error selecting ICM file: ${e?.message || e}`, 'error');
   } finally {
      importICMLoading.value = false;
   }
};


// --- System Actions ---
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
         throw new Error("Dialog interaction failed unexpectedly.");
      }

      if (!result.canceled && result.filePaths.length > 0) {
         const selectedPath = result.filePaths[0];
         const success = await configState.setDataDirectory(selectedPath);
         if (success) {
            showSnackbar(`Data directory set to: ${selectedPath}`, 'success');
            // Data directory is now set, attempt to load note if a patient is selected
            if (selectedPatientId.value) {
               await loadSelectedNote();
            }
         } else {
            showSnackbar('Failed to save the selected data directory.', 'error');
         }
      }
   } catch (error: any) {
      showSnackbar(`Error selecting directory: ${error.message || 'Unknown error'}`, 'error');
   }
};

const openDataDirectory = async () => {
   const dataDirectory = configState.config.value.dataDirectory;
   if (dataDirectory) {
      await window.electronAPI.openDirectory(dataDirectory);
   } else {
      showSnackbar('Data directory is not set.', 'info');
   }
};

// --- Watchers ---

// Watch for changes in selected patient, note date, or data directory readiness
watch(
   () => [selectedPatientId.value, selectedNoteDate.value, configState.isDataDirectorySet.value],
   async ([newPatientId, newNoteDate, isDirSet], [oldPatientId, oldNoteDate, oldIsDirSet]) => {
      // Only load if the patient or note date actually changed, and directory is set
      if (isDirSet && (newPatientId !== oldPatientId || newNoteDate !== oldNoteDate)) {
         if (newPatientId) {
            await loadSelectedNote();
         } else {
            // Patient ID became null (e.g., patient deleted)
            clearSelectedPatientState();
         }
      } else if (!isDirSet && oldIsDirSet) {
         // Data directory became unset
         clearSelectedPatientState();
      }
   },
   { immediate: false } // Don't run immediately on mount, let onMounted handle initial load
);


// Watch for configuration errors
watch(configState.error, (newError) => {
   if (newError) {
      showSnackbar(`Configuration Error: ${newError}`, 'error');
   }
});

// --- Auto-Save Logic ---
const debouncedSaveNote = (() => {
   let timeout: ReturnType<typeof setTimeout> | null = null;
   return (): void => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
         if (
            noteEditor.isAutoSaveEnabled.value &&
            noteEditor.hasUnsavedChanges.value &&
            selectedPatient.value &&
            isNoteLoaded.value // Only save if note is considered loaded
         ) {
            console.log('App.vue: Triggering debounced auto-save...');
            await saveCurrentNote();
         }
      }, 60000);
   };
})();

// Watch note content for changes to mark as unsaved and trigger auto-save
watch(noteContent, (newContent, oldContent) => {
   // Trigger only on actual user edits *after* initial load
   if (isNoteLoaded.value && newContent !== oldContent && oldContent !== undefined) {
      noteEditor.setUnsavedChanges(true);
      if (noteEditor.isAutoSaveEnabled.value) {
         debouncedSaveNote();
      }
   }
});

// Watch the global unsaved changes state from the editor composable
watch(
   () => noteEditor.hasUnsavedChanges.value,
   (newVal) => {
      // Update global flag for Electron main process checks (e.g., before closing)
      if (window.electronAPI?.setUnsavedChanges) {
         window.electronAPI.setUnsavedChanges(newVal);
      }
   },
   { immediate: true } // Set initial state on load
);

// Watch auto-save toggle: if enabled with pending changes, save immediately
watch(noteEditor.isAutoSaveEnabled, (isEnabled) => {
   if (isEnabled && noteEditor.hasUnsavedChanges.value) {
      console.log('App.vue: Auto-save enabled with pending changes, triggering save...');
      saveCurrentNote(); // Save immediately, not debounced
   }
});
// --- End Auto-Save Logic ---

// --- Auto-Export Initialization Watcher ---
watch(
   [
      () => configState.isConfigLoaded.value,
      () => configState.isDataDirectorySet.value,
      () => selectedPatientId.value, // Need a patient selected
      () => isNoteLoaded.value       // Need the note loaded
   ],
   ([isConfigLoaded, isDirSet, patientId, noteLoaded]) => {
      if (
         isConfigLoaded &&
         isDirSet &&
         patientId &&
         noteLoaded &&
         !autoExportStarted.value // Only run once
      ) {
         startAutoExport();
         autoExportStarted.value = true;
      }
   },
   { immediate: false } // Don't run on initial mount immediately
);


// --- Lifecycle Hooks ---
onMounted(async () => {
   // Load initial config, patient data etc. (handled by composables)
   // Load available patient list dates for date picker
   // This is now handled within usePatientData's onMounted hook.

   // Attempt initial load if conditions are met (e.g., data dir already set)
   if (configState.isDataDirectorySet.value && selectedPatientId.value) {
      await loadSelectedNote();
   }
});

// Watch selectedDate to update allowed dates (handled in usePatientData)
// watch(selectedDate, async () => {
//    allowedDates.value = await patientDataComposable.listAvailablePatientListDates(); // Use patientDataComposable
// });





</script>

<style>

.patient-list-rail-hidden {
   opacity: 0 !important;
   pointer-events: none !important;
   transition: opacity 0.2s;
}

.rail-arrow-container {
   display: flex;
   align-items: center;
   justify-content: center;
   height: 100%;
   min-height: 80px;
   width: 100%;
   position: absolute;
   top: 0;
   left: 0;
   z-index: 5;
   pointer-events: none;
}
</style>