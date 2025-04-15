<template>
   <v-app>
      <!-- === App Bar === -->
      <v-app-bar app color="primary" dark density="compact">
         <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
         <v-toolbar-title>Medical Notepad</v-toolbar-title>
         <v-text-field
           v-model="searchQuery"
           label="Search Patient (Name/UMRN)"
           hide-details
           single-line
           class="ml-4"
           @input="searchPatients"
         ></v-text-field>
         <v-spacer></v-spacer>
         <v-btn @click="selectDataDirectory" title="Select Data Directory" icon>
            <v-icon :color="configState.isDataDirectorySet.value ? 'white' : 'yellow'">
               {{ configState.isDataDirectorySet.value ? 'mdi-folder-check-outline' : 'mdi-folder-alert-outline' }}
            </v-icon>
         </v-btn>
         <v-btn icon="mdi-cog-outline" @click="goToSettings" title="Settings (Not Implemented)"></v-btn>
         <v-btn icon="mdi-export" @click="exportData" title="Export Data (Not Implemented)"></v-btn>
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
         <v-list v-sortable="{ list: patientData.patients, onSortEnd: onSortEnd }">
            <v-list-item class="patient-list-item" v-for="patient in patientData.patients.value" :key="patient.id"
               :value="patient.id" :active="patient.id === selectedPatientId" @click="handlePatientClick(patient.id)"
               link>
               <v-list-item-title>{{ patient.name }}</v-list-item-title>
               <v-list-item-subtitle v-if="patient.umrn || patient.ward">
                  {{ patient.umrn ? `UMRN: ${patient.umrn}` : '' }} {{ patient.ward ? `Ward: ${patient.ward}` : '' }}
               </v-list-item-subtitle>
               <template #append>
               </template>
            </v-list-item>
         </v-list>


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
               Environment: {{ nodeEnv }}
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
                           <v-icon start>mdi-account-circle-outline</v-icon>
                        </v-toolbar-title>
                           <v-text-field
                             v-if="selectedPatient"
                             v-model="selectedPatient.name"
                             label="Patient Name"
                             hide-details
                             single-line
                             @blur="updatePatientName"
                           ></v-text-field>
                           <v-text-field
                             v-if="selectedPatient"
                             v-model="selectedPatient.umrn"
                             label="Patient UMRN"
                             hide-details
                             single-line
                             @blur="updatePatientUmrn"
                           ></v-text-field>
                        <v-spacer></v-spacer>
                        <span class="text-subtitle-1 mr-4">
                           <v-icon start>mdi-calendar</v-icon>
                           Note for: {{ noteDateDisplay }}
                        </span>
                        <v-btn :loading="noteEditor.isLoading.value"
                           :disabled="noteEditor.isLoading.value || !isNoteLoaded || !configState.isDataDirectorySet.value"
                           @click="saveCurrentNote" color="primary" variant="tonal" size="small" class="mr-2"
                           title="Save Note">
                           <v-icon start>mdi-content-save</v-icon> Save
                        </v-btn>
                        <v-btn icon="mdi-delete" :disabled="!selectedPatient" @click="selectedPatient && confirmRemovePatient(selectedPatient)" title="Delete Patient"></v-btn>
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
declare const window: any;
import packageJson from '../../package.json';
import { ref, provide, computed, watch, nextTick } from 'vue';
import { usePatientData } from '@/composables/usePatientData';
import { useNoteEditor } from '@/composables/useNoteEditor';
import { useConfig } from '@/composables/useConfig';
import { useFileSystemAccess } from '@/composables/useFileSystemAccess';
import type { Patient, Note } from '@/types';
import MonacoEditorComponent from '@/components/MonacoEditorComponent.vue';
import { useDisplay } from 'vuetify';

const drawer = ref(false);
const snackbar = ref({ show: false, text: '', color: 'success' });
const selectedPatientId = ref<string | null>(null);
const selectedDate = ref<string>(new Date().toISOString().split('T')[0]);
const searchQuery = ref('');
const noteContent = ref<string>('');
const currentNote = ref<Note | null>(null);
const duplicateDialog = ref(false);
const duplicatePatient = ref<Patient | null>(null);
const isNoteLoaded = ref(false);
const version = packageJson.version;
const isPackaged = (window as any).electronAPI.isPackaged
// Composables
const configState = useConfig();
const patientData = usePatientData();
const noteEditor = useNoteEditor();
const { showOpenDialog } = useFileSystemAccess();
const { smAndUp } = useDisplay();
const nodeEnv = computed(() => process.env.NODE_ENV);

// --- Computed ---
const selectedPatient = computed<Patient | undefined>(() => {
   if (!selectedPatientId.value) return undefined;
   return patientData.getPatientById(selectedPatientId.value);
});

const noteDateDisplay = computed(() => {
   try {
      const [year, month, day] = selectedDate.value.split('-');
      const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
   } catch {
      return selectedDate.value;
   }
});

// --- Methods ---
const showSnackbar = (text: string, color: 'success' | 'error' | 'info' = 'info') => {
   snackbar.value.text = text;
   snackbar.value.color = color;
   snackbar.value.show = true;
};
provide('showSnackbar', showSnackbar);

const selectPatient = (patientId: string) => {
   console.log('Selecting patient:', patientId);
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
   } catch (e) {
      console.log("Error:" + e);
   }
};

const searchPatients = () => {
   const query = searchQuery.value.toLowerCase();
   if (!query) {
       duplicateDialog.value = false;
       duplicatePatient.value = null;
       return;
   }

   const foundPatient = patientData.patients.value.find(patient =>
       patient.name.toLowerCase().includes(query) || (patient.umrn && patient.umrn.toLowerCase().includes(query))
   );

   if (foundPatient) {
       duplicatePatient.value = foundPatient;
       duplicateDialog.value = true;
   } else {
       duplicateDialog.value = false;
       duplicatePatient.value = null;
   }
};

const loadDuplicatePatient = () => {
   if (duplicatePatient.value) {
       selectPatient(duplicatePatient.value.id);
       duplicateDialog.value = false;
   }
};

const confirmRemovePatient = async (patient: Patient) => {
   const success = await patientData.removePatient(patient.id);
   if (success) {
      showSnackbar(`Patient "${patient.name}" removed.`, 'info');
      // If the removed patient was selected, clear selection
      if (selectedPatientId.value === patient.id) {
         selectedPatientId.value = null;
         noteContent.value = '';
         currentNote.value = null;
         isNoteLoaded.value = false;
      }
   } else {
      showSnackbar(`Failed to remove patient: ${patientData.error.value || 'Unknown error'}`, 'error');
   }
};

const loadSelectedNote = async () => {
   if (!selectedPatientId.value) {
      noteContent.value = '';
      currentNote.value = null;
      isNoteLoaded.value = false;
      return;
   }

   console.log(`Loading note for patient ID: ${selectedPatientId.value} and date: ${selectedDate.value}`);
   isNoteLoaded.value = false; // Set to false before loading
   try {
      if (!selectedPatient.value) {
         console.warn('No patient selected, cannot load note.');
         return;
      }
      const loadedNote = await noteEditor.loadNote(selectedPatient.value, selectedDate.value);
      if (loadedNote) {
         noteContent.value = loadedNote.content;
         currentNote.value = loadedNote;
         isNoteLoaded.value = true;
         console.log('Note loaded successfully!');
      } else {
         noteContent.value = ''; // Clear content on error
         currentNote.value = null;
         isNoteLoaded.value = false;
         showSnackbar(`Failed to load note: ${noteEditor.error.value || 'Unknown error'}`, 'error');
      }
   } catch (e) {
      console.log("Error:" + e)
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
   const success = await noteEditor.saveNote(selectedPatient.value, noteToSave);
   if (success) {
      showSnackbar('Note saved successfully.', 'success');
      currentNote.value = { ...noteToSave };
   } else {
      showSnackbar(`Failed to save note: ${noteEditor.error.value || 'Unknown error'}`, 'error');
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

const exportData = () => {
   showSnackbar('Data export not implemented yet.', 'info');
};

const selectDataDirectory = async () => {
   showSnackbar("Select the folder where patient data should be stored.", "info");
   try {
      console.log("Awaiting showOpenDialog...");
      const result = await showOpenDialog({
         title: 'Select Data Directory',
         properties: ['openDirectory', 'createDirectory'],
      });
      console.log("showOpenDialog resolved with:", result);

      if (result === undefined) {
         console.error("showOpenDialog resolved with undefined!");
         throw new Error("Dialog did not return a valid result.");
      }

      if (!result.canceled && result.filePaths.length > 0) {
         const selectedPath = result.filePaths[0];
         console.log('Directory selected:', selectedPath);
         const success = await configState.setDataDirectory(selectedPath);
         if (success) {
            showSnackbar(`Data directory set to: ${selectedPath}`, 'success');
            loadSelectedNote(); // Load note after data directory is set
         } else {
            showSnackbar('Failed to save the selected data directory.', 'error');
         }
      } else {
         console.log('Directory selection cancelled.');
      }
   } catch (error: any) {
      console.error('Error selecting directory:', error);
      showSnackbar(`Error selecting directory: ${error.message || 'Unknown error'}`, 'error');
   }
};


// --- Watchers ---
watch(() => [selectedPatientId.value, selectedDate.value, configState.isDataDirectorySet.value], async ([newPatientId, newDate, isDirSet]) => {
   console.log(`Watcher triggered: patientId=${newPatientId}, date=${newDate}, isDirSet=${isDirSet}`);

   if (newPatientId && isDirSet) {
      console.log(`Loading note due to change in patient/date or data directory being set.`);
      await loadSelectedNote();
   } else {
      console.log(`Clearing note: no patient selected or data directory not set.`);
      noteContent.value = '';
      currentNote.value = null;
      isNoteLoaded.value = false;
   }
});

watch(configState.error, (newError) => {
   if (newError) {
      showSnackbar(`Configuration Error: ${newError}`, 'error');
   }
});

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
  if (selectedPatient.value) {
    console.log("updatePatientUmrn: selectedPatient.value:", selectedPatient.value);
    const updatedPatient = { ...selectedPatient.value };
    console.log("updatePatientUmrn: updatedPatient:", updatedPatient);
    const oldPatientType = selectedPatient.value.type;
    console.log("updatePatientUmrn: oldPatientType:", oldPatientType);

    const success = await patientData.updatePatient(updatedPatient);
    console.log("updatePatientUmrn: success:", success);
    // Refetch the patient data to update selectedPatient
    if (!success) {
      showSnackbar(`Failed to update patient UMRN: ${patientData.error.value || 'Unknown error'}`, 'error');
    } else {
      const tempId = selectedPatientId.value;
      selectedPatientId.value = null;
      await nextTick();
      selectedPatientId.value = tempId;
      const patient = selectedPatient.value;
      if (patient) {
        await nextTick(async () => {
          showSnackbar(`Patient UMRN updated to: ${patient.umrn}`, 'success');

          // Call mergePatientData if the patient was initially a UUID and now has a UMRN
          if (oldPatientType === 'uuid' && patient.umrn) {
            try {
              console.log("updatePatientUmrn: Calling mergePatientData with id:", patient.id, "and umrn:", patient.umrn);
              const mergeSuccess = await patientData.mergePatientData(patient.id, patient.umrn);
              console.log("updatePatientUmrn: mergeSuccess:", mergeSuccess);
              if (mergeSuccess) {
                showSnackbar(`Patient data merged to UMRN ${patient.umrn}.`, 'success');
                // Refetch patient data after merge
                selectedPatientId.value = null;
                nextTick(() => {
                  selectedPatientId.value = patient.id;
                });
              } else {
                showSnackbar(`Failed to merge patient data: ${patientData.error.value || 'Unknown error'}`, 'error');
              }
            } catch (error: any) {
              console.error("Error merging patient data:", error);
              showSnackbar(`Error merging patient data: ${error.message || 'Unknown error'}`, 'error');
            }
          }
        });
      }
    }
  } else {
    console.log("updatePatientUmrn: selectedPatient.value is undefined");
  }
};
</script>

<style scoped lang="scss">
/* Existing styles remain */
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
</style>

