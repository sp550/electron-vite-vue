<template>
   <v-app>
      <!-- === App Bar === -->
      <v-app-bar app color="primary" dark density="compact">
         <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
         <v-spacer></v-spacer>
         <v-toolbar-title></v-toolbar-title>
         <v-btn icon="mdi-chevron-left" @click="navigateToPreviousDay"
            :disabled="!selectedPatientId || noteEditor.isLoading.value" title="Previous Day" size="small"></v-btn>
         <span class="text-subtitle-1 mx-2" :title="selectedDate">
            <v-icon start>mdi-calendar</v-icon>
            {{ noteDateDisplay }}
         </span>
         <v-btn icon="mdi-chevron-right" @click="navigateToNextDay"
            :disabled="!selectedPatientId || noteEditor.isLoading.value" title="Next Day" size="small"></v-btn>
         <!-- Date Picker for Patient List Date Navigation -->
         <v-menu v-model="dateMenu" :close-on-content-click="false" offset-y>
            <template #activator="{ props }">
               <v-btn v-bind="props" icon title="Select Date" aria-label="Select Date">
                  <v-icon>mdi-calendar-search</v-icon>
               </v-btn>
            </template>
            <v-card>
               <v-date-picker v-model="selectedDate" :allowed-dates="allowedDates" @update:model-value="handleDateChange"
                  color="primary" show-adjacent-months :max="todayString" />
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
               <v-list-item @click="handleImportICMClick" :disabled="importICMLoading">
                  <v-list-item-title>
                     Import ICM Patient List (Choose File)
                     <v-progress-circular v-if="importICMLoading" indeterminate size="16" color="primary"
                        class="ml-2" />
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
         <v-row class="pa-2">
            <v-text-field v-model="search" label="Search patients" prepend-inner-icon="mdi-magnify" dense hide-details
               clearable class="mb-2" />
            <v-btn v-if="selectedPatientIds.length > 0" color="error" size="small" class="mb-2"
               @click="removeSelectedPatientsFromList" block>
                  <v-icon start>mdi-delete</v-icon>
                  Remove Selected ({{ selectedPatientIds.length }})
               </v-btn>
               <!-- Add Selected to Today's List Button -->
               <v-btn v-if="selectedPatientIds.length > 0 && selectedDate !== todayString" color="primary" variant="tonal"
                  size="small" class="mb-2" @click="addSelectedToTodayList" block>
                  <v-icon start>mdi-calendar-plus</v-icon>
                  Add Selected to Today ({{ selectedPatientIds.length }})
               </v-btn>
            </v-row>
         <v-list>
            <v-list-subheader>Patient List</v-list-subheader>
            <v-list-item-group v-model="selectedPatientIds" multiple :mandatory="false" ref="patientListRef">
               <v-list-item v-for="(element, _index) in patientsDraggable" :key="element.id" :value="element.id"
                  :data-id="element.id"
                  @click="handlePatientClick(element.id)">
                  <template v-slot:prepend>
                     <v-icon v-if="isEditPatientListMode" class="drag-handle ma-1 pa-2" title="Drag to reorder" @mousedown.stop>mdi-drag</v-icon>
                  </template>
                  <v-list-item-content>
                     <v-list-item-title>{{ element.name }}</v-list-item-title>
                     <v-list-item-subtitle v-if="element.umrn || element.ward" class="umrn-ward">
                        {{ element.umrn ? `${element.umrn}` : '' }} {{ element.ward ? `Ward: ${element.ward}` : '' }}
                     </v-list-item-subtitle>
                  </v-list-item-content>
                  <template v-slot:append class="align-center justify-center align-self-center">
                     <v-btn v-if="isEditPatientListMode" icon size="small" color="error" @click.stop="handleRemovePatientFromList(element)" title="Remove patient"
                        class="ma-1 pa-2">
                        <v-icon>mdi-delete</v-icon>
                     </v-btn>
                     <v-checkbox v-if="isEditPatientListMode" :model-value="selectedPatientIds.includes(element.id)"
                        @click.stop="checkboxSelectPatientList(element.id)" :ripple="true" color="primary"
                        class="align-center justify-center align-self-center" />
                  </template>
               </v-list-item>
            </v-list-item-group>
         </v-list>

         <v-divider class="ma-2"></v-divider>

         <v-row class="ma-2">
            <v-btn color="primary" size="large" @click="handleAddNewPatient"
               :disabled="!configState.isDataDirectorySet.value">
               <v-icon start>mdi-account-plus-outline</v-icon>
               Add New Patient
            </v-btn>
         </v-row>
         <v-row class="ma-2">
            <v-btn @click="isEditPatientListMode = !isEditPatientListMode">
               <v-icon>mdi-pencil-plus</v-icon>
               {{ isEditPatientListMode ? 'Done Editing' : 'Edit Patient List' }}
            </v-btn>
         </v-row>


         <v-row class=" mb-2 mt-auto ma-2 ">
            <v-expansion-panels class="align-end">

               <v-expansion-panel title="Debug Info">

                  <v-expansion-panel-text>
                     App Info:<br>
                     Version: {{ version }}<br>
                     Packaged: {{ isPackaged ? 'Yes' : 'No' }}<br>
                     Environment: {{ nodeEnv }}<br>
                     Config Path: {{ configState.configPath.value || 'Loading...' }}<br>
                     <div v-if="configState.config.value.dataDirectory">
                        Data Directory:
                        <span class="text-caption wrap-text" :title="configState.config.value.dataDirectory">
                           {{ configState.config.value.dataDirectory }}
                        </span>
                     </div>

                  </v-expansion-panel-text>
               </v-expansion-panel>
            </v-expansion-panels>
         </v-row>

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
               <v-btn v-else color="primary" class="mt-4" @click="handleAddNewPatient" prepend-icon="mdi-plus">
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
                        @click="selectedPatient && confirmRemoveCurrentPatient()"
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
               <v-btn color="primary" text @click="handleLoadDuplicatePatient">
                  Load Patient
               </v-btn>
            </v-card-actions>
         </v-card>
      </v-dialog>
   </v-app>
</template>

<script setup lang="ts">
import { ref, provide, computed, watch, nextTick, onMounted } from 'vue';
import { useNoteExport } from '@/composables/useNoteRetrieval';
import { usePatientList } from '@/composables/usePatientList';
import { useDateNavigation } from '@/composables/useDateNavigation';
import { useSnackbar } from '@/composables/useSnackbar';
import { useDuplicatePatient } from '@/composables/useDuplicatePatient';
import packageJson from '../package.json';
import { usePatientData } from '@/composables/usePatientData';
import { useNoteEditor } from '@/composables/useNoteEditor';
import { useConfig } from '@/composables/useConfig';
import { useFileSystemAccess } from '@/composables/useFileSystemAccess';
import type { Patient, Note } from '@/types';
import MonacoEditorComponent from '@/components/MonacoEditorComponent.vue';
import { useDisplay } from 'vuetify';
import Sortable from 'sortablejs';

const selectedPatientId = ref<string | null>(null); // ID of the currently active patient

// --- In-memory cache for unsaved notes per patient/date ---
const unsavedNotesCache: Record<string, string> = {};
const importICMLoading = ref(false);
const autoExportStarted = ref(false);

const configState = useConfig();
const patientData = usePatientData();
const noteEditor = useNoteEditor();
const fileSystemAccess = useFileSystemAccess();
const { smAndUp } = useDisplay();
const { snackbar, showSnackbar } = useSnackbar();

const {
   selectedDate,
   noteDateDisplay,
   dateMenu,
   allowedDates,
   todayString,
   goToPreviousDay: navigateToPreviousDay,
   goToNextDay: navigateToNextDay,
   onDateChange: handleDateChange
} = useDateNavigation();

const {
   patientsDraggable,
   patientListRef,
   selectedPatientIds,
   isEditPatientListMode,
   search,
   removePatient: removePatientFromList,
   removeSelectedPatients: removeSelectedPatientsFromList,
   addSelectedToToday: addSelectedToTodayList,
   checkboxSelect: checkboxSelectPatientList,
   onSortEnd: handleSortEnd
} = usePatientList(patientData, showSnackbar, selectedPatientId);

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
   patientData,
   fileSystemAccess,
   selectedDate,
   electronAPI: window.electronAPI
});

const drawer = ref(false);
const noteContent = ref<string>('');
const currentNote = ref<Note | null>(null);
const isNoteLoaded = ref(false);
const version = packageJson.version;
const isPackaged = (window as any).electronAPI.isPackaged;
const nodeEnv = computed(() => process.env.NODE_ENV);

provide('showSnackbar', showSnackbar);

// --- Computed Properties ---
const saveStatusIcon = computed(() => {
   return noteEditor.hasUnsavedChanges.value ? 'mdi-content-save-edit' : 'mdi-check-circle';
});

// Get the full Patient object for the selected ID
const selectedPatient = computed<Patient | undefined>(() => {
   if (!selectedPatientId.value) return undefined;
   return patientData.getPatientById(selectedPatientId.value);
});

// --- Core Functions ---

// Function to select a patient and load their note
const selectPatient = (patientId: string) => {
   // Before switching, cache unsaved note if needed (manual save mode)
   if (
      !noteEditor.isAutoSaveEnabled.value &&
      noteEditor.hasUnsavedChanges.value &&
      selectedPatientId.value &&
      selectedDate.value
   ) {
      const cacheKey = `${selectedPatientId.value}:${selectedDate.value}`;
      unsavedNotesCache[cacheKey] = noteContent.value;
      console.log(`Cached note for ${cacheKey}`);
   }
   selectedPatientId.value = patientId;
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
   console.log(`loadSelectedNote called for patient: ${selectedPatientId.value}, date: ${selectedDate.value}`);
   if (!selectedPatientId.value || !selectedDate.value) {
      console.log('Clearing state: No patient or date selected.');
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
      await noteEditor.loadNote(patient, selectedDate.value);

      // Check the state *after* loadNote completes
      if (noteEditor.currentNote.value && !noteEditor.error.value) {
         noteEditor.setUnsavedChanges(false); // Reset flag before updating content
         await nextTick(); // Ensure state update propagates

         // Check cache for unsaved note (manual save mode)
         const cacheKey = `${selectedPatientId.value}:${selectedDate.value}`;
         if (!noteEditor.isAutoSaveEnabled.value && unsavedNotesCache.hasOwnProperty(cacheKey)) {
            noteContent.value = unsavedNotesCache[cacheKey];
            noteEditor.setUnsavedChanges(true); // Mark as dirty if restored from cache
            console.log(`Restored note from cache for ${cacheKey}`);
         } else {
            noteContent.value = noteEditor.currentNote.value.content;
            noteEditor.setUnsavedChanges(false); // Mark as clean if loaded from disk/new
         }
         currentNote.value = noteEditor.currentNote.value; // Keep local ref synced if needed
         isNoteLoaded.value = true;
         console.log('Note loaded successfully.');
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
             console.warn("loadSelectedNote: loadNote completed without error/ENOENT, but currentNote is still null. Ready for new note.");
             isNoteLoaded.value = true; // Allow editor to show for new note creation
             noteEditor.setUnsavedChanges(false); // Start clean
         } else {
             console.log(`Note not found for ${selectedPatientId.value} on ${selectedDate.value}. Ready for new note.`);
             isNoteLoaded.value = true; // Allow editor to show for new note creation
             noteEditor.setUnsavedChanges(false); // Start clean
         }
      }
   } catch (e: any) {
      showSnackbar(`Error in loadSelectedNote: ${e.message || e}`, 'error');
      clearSelectedPatientState();
   }
};

// Save the current note content
const saveCurrentNote = async () => {
   if (!selectedPatientId.value || !selectedPatient.value) {
      showSnackbar('Please select a patient first.', 'error');
      return;
   }
   // Allow saving even if isNoteLoaded was false initially (for creating new notes)
   // if (!isNoteLoaded.value) {
   //    showSnackbar('Cannot save: Note not loaded yet or loading.', 'error');
   //    return;
   // }

   const noteToSave: Note = { date: selectedDate.value, content: noteContent.value };

   // Use noteEditor's save function
   const success = await noteEditor.saveCurrentNote(selectedPatient.value, noteToSave);

   if (success) {
      // showSnackbar('Note saved successfully.', 'success'); // Often too noisy
      currentNote.value = { ...noteToSave }; // Update local state
      // Remove from cache if it existed (manual save mode)
      const cacheKey = `${selectedPatientId.value}:${selectedDate.value}`;
      if (unsavedNotesCache.hasOwnProperty(cacheKey)) {
         delete unsavedNotesCache[cacheKey];
         console.log(`Removed note from cache for ${cacheKey} after save.`);
      }
   } else {
      showSnackbar(`Failed to save note: ${noteEditor.error.value || 'Unknown error'}`, 'error');
      // Do not reset unsaved changes on failure, user might want to retry
   }
};

// --- Event Handlers ---

// Handle clicks on patient list items
const handlePatientClick = (patientId: string) => {
   selectPatient(patientId);
};

// Add a new patient using the composable function
const handleAddNewPatient = async () => {
   if (!configState.isDataDirectorySet.value) {
      showSnackbar("Please select a data directory first.", "error");
      return;
   }
   // Add a new patient directly using patientData composable
   const newPatientData: Omit<Patient, 'id'> = { name: 'New Patient', umrn: '', ward: '', type: 'uuid' };
   const newPatient = await patientData.addPatient(newPatientData);
   if (newPatient) {
      selectPatient(newPatient.id);
   }
   // Snackbar messages are handled within the composable
};

// Confirm and remove the currently selected patient (called from toolbar)
const confirmRemoveCurrentPatient = async () => {
    if (!selectedPatient.value) return;
    // Use the patientData directly for removal confirmation logic if needed,
    // or enhance usePatientList to handle confirmation.
    // For now, directly call patientData.removePatient
    const success = await patientData.removePatient(selectedPatient.value.id);
    if (success) {
       showSnackbar(`Patient "${selectedPatient.value.name}" removed.`, 'info');
       // clearSelectedPatientState is called implicitly by the watcher when selectedPatientId becomes invalid
    } else {
       showSnackbar(`Failed to remove patient: ${patientData.error.value || 'Unknown error'}`, 'error');
    }
};

// Remove patient from the list (called from list item button)
const handleRemovePatientFromList = async (patient: Patient) => {
    await removePatientFromList(patient); // Call composable function
    // If the removed patient was selected, clear selection
    if (selectedPatientId.value === patient.id) {
       clearSelectedPatientState();
    }
};

// Update patient name on blur
const updatePatientName = async () => {
   if (selectedPatient.value) {
      // The v-model already updated the name locally
      const success = await patientData.updatePatient(selectedPatient.value);
      if (!success) {
         showSnackbar(`Failed to update patient name: ${patientData.error.value || 'Unknown error'}`, 'error');
         // Optionally revert UI change here if needed
      } else {
         showSnackbar(`Patient name updated to: ${selectedPatient.value.name}`, 'success');
      }
   }
};

// Update patient UMRN on blur and handle potential merge
const updatePatientUmrn = async () => {
   if (!selectedPatient.value) return;

   const patientBeforeUpdate = { ...selectedPatient.value };
   const oldPatientType = patientBeforeUpdate.type;
   const oldPatientId = patientBeforeUpdate.id;

   // The v-model already updated the UMRN locally
   const success = await patientData.updatePatient(selectedPatient.value);

   if (!success) {
      showSnackbar(`Failed to update patient UMRN: ${patientData.error.value || 'Unknown error'}`, 'error');
      // Optionally revert UI change
      // selectedPatient.value.umrn = patientBeforeUpdate.umrn;
   } else {
      showSnackbar(`Patient UMRN updated to: ${selectedPatient.value.umrn}`, 'success');

      // Check if merge is needed (was UUID, now has UMRN)
      if (oldPatientType === 'uuid' && selectedPatient.value.umrn) {
         try {
            const mergeSuccess = await patientData.mergePatientData(oldPatientId, selectedPatient.value.umrn);
            if (mergeSuccess) {
               showSnackbar(`Patient data merged to UMRN ${selectedPatient.value.umrn}.`, 'success');
               // Patient list should update reactively. Need to select the *new* ID.
               await nextTick();
               const newPatientRecord = patientData.getPatientByUmrn(selectedPatient.value.umrn);
               if (newPatientRecord) {
                  selectPatient(newPatientRecord.id); // Select the merged record
               } else {
                  clearSelectedPatientState();
                  showSnackbar('Could not find merged patient record.', 'error');
               }
            } else {
               showSnackbar(`Failed to merge patient data: ${patientData.error.value || 'Unknown error'}`, 'error');
            }
         } catch (error: any) {
            showSnackbar(`Error merging patient data: ${error.message || 'Unknown error'}`, 'error');
         }
      }
      // No explicit re-selection needed if ID didn't change, computed should update.
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
      await patientData.importICMPatientListFromFile(filePath);
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

// Watch for changes in selected patient, date, or data directory readiness
watch(
    () => [selectedPatientId.value, selectedDate.value, configState.isDataDirectorySet.value],
    async ([newPatientId, newDate, isDirSet], [oldPatientId, oldDate, oldIsDirSet]) => {
        console.log('Watcher triggered: ID:', newPatientId, 'Date:', newDate, 'DirSet:', isDirSet);
        // Only load if the patient or date actually changed, and directory is set
        if (isDirSet && (newPatientId !== oldPatientId || newDate !== oldDate)) {
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
      }, 500); // 500ms debounce time
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
         console.log("Conditions met, starting auto-export.");
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
   // This is now handled within useDateNavigation's onMounted hook.

   // Initialize SortableJS for the patient list
   await nextTick(); // Ensure the element exists
   if (patientListRef.value) {
      Sortable.create(patientListRef.value as HTMLElement, {
         handle: '.drag-handle', // Class for drag handle
         animation: 150,
         ghostClass: 'sortable-ghost', // Class for the ghost element
         chosenClass: 'sortable-chosen', // Class for the chosen item
         dragClass: 'sortable-drag', // Class for the dragging item
         onEnd: () => {
            // Always pass the reordered array, not the event, to handleSortEnd
            handleSortEnd(patientsDraggable.value);
         },
      });
      console.log("SortableJS initialized on patient list.");
   } else {
       console.error("Failed to initialize SortableJS: patientListRef not found.");
   }

   // Attempt initial load if conditions are met (e.g., data dir already set)
   if (configState.isDataDirectorySet.value && selectedPatientId.value) {
       await loadSelectedNote();
   }
});

// Watch selectedDate to update allowed dates (handled in useDateNavigation)
// watch(selectedDate, async () => {
//    allowedDates.value = await patientData.listAvailablePatientListDates();
// });





</script>