<template>
   <v-app>
      <!-- === App Bar === -->
      <v-app-bar app color="primary" dark density="compact">
         <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
         <v-toolbar-title>Medical Notepad</v-toolbar-title>
         <v-spacer></v-spacer>
         <v-btn-toggle v-model="activeView" mandatory>
            <v-btn value="editor" title="Editor View">
               <v-icon>mdi-note-edit-outline</v-icon>
            </v-btn>
            <v-btn value="card" title="Card View">
               <v-icon>mdi-card-outline</v-icon>
            </v-btn>
         </v-btn-toggle>
         <v-btn @click="selectDataDirectory" title="Select Data Directory" icon>
            <v-icon :color="configState.isDataDirectorySet.value ? 'white' : 'yellow'">
               {{ configState.isDataDirectorySet.value ? 'mdi-folder-check-outline' : 'mdi-folder-alert-outline' }}
            </v-icon>
      </v-btn>
         <v-btn icon="mdi-cog-outline" @click="goToSettings" title="Settings (Not Implemented)"></v-btn>
         <v-btn icon="mdi-export" @click="exportData" title="Export Data (Not Implemented)"></v-btn>
      </v-app-bar>

    <!-- === Info Bar (Data Directory not set) === -->
    <v-system-bar
      v-if="configState.isConfigLoaded.value && !configState.isDataDirectorySet.value"
      color="warning"
      window
    >
         <v-icon start>mdi-alert-circle-outline</v-icon>
         <span>Please select a Data Directory to store patient files.</span>
         <v-spacer></v-spacer>
      <v-btn size="small" @click="selectDataDirectory" variant="outlined">
        Select Directory
      </v-btn>
      </v-system-bar>


      <!-- === Navigation Drawer (Patient List) === -->
      <v-navigation-drawer app v-model="drawer" :permanent="smAndUp">
      <v-list-item
        v-if="!configState.isDataDirectorySet.value && configState.isConfigLoaded.value"
        title="Directory Not Set"
        subtitle="Select data directory first"
        prepend-icon="mdi-folder-alert-outline"
      ></v-list-item>
         <v-list-item v-else-if="patientData.isLoading.value" key="loading">
        <v-progress-circular indeterminate size="20" class="mr-2"></v-progress-circular>
        Loading...
         </v-list-item>
         <v-list-item v-else-if="patientData.error.value" key="error" class="text-error">
            <v-list-item-title>Error</v-list-item-title>
            <v-list-item-subtitle>{{ patientData.error.value }}</v-list-item-subtitle>
         </v-list-item>
         <template v-else-if="configState.isDataDirectorySet.value">
        <v-list-item
          v-for="patient in patientData.patients.value"
          :key="patient.id"
          :value="patient.id"
          :active="patient.id === selectedPatientId"
          @click="selectPatient(patient.id)"
          link
        >
               <v-list-item-title>{{ patient.name }}</v-list-item-title>
               <v-list-item-subtitle v-if="patient.umrn || patient.ward">
            {{ patient.umrn ? `UMRN: ${patient.umrn}` : '' }}
            {{ patient.ward ? ` Ward: ${patient.ward}` : '' }}
               </v-list-item-subtitle>
               <template v-slot:append>
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              color="grey"
              @click.stop="confirmRemovePatient(patient)"
              title="Remove Patient"
              :disabled="!configState.isDataDirectorySet.value"
            ></v-btn>
               </template>
            </v-list-item>
         </template>
         <v-divider></v-divider>
      <v-list-item
        @click="addNewPatient"
        prepend-icon="mdi-plus-box-outline"
            :disabled="!configState.isDataDirectorySet.value"
        :title="!configState.isDataDirectorySet.value ? 'Select data directory first' : 'Add New Patient'"
      >
            <v-list-item-title v-if="configState.isDataDirectorySet.value">Add New Patient</v-list-item-title>
         </v-list-item>
         <v-divider></v-divider>
      <v-list-item
        v-if="configState.config.value.dataDirectory"
        lines="two"
        density="compact"
      >
            <v-list-item-subtitle>Data Directory:</v-list-item-subtitle>
            <v-list-item-title class="text-caption wrap-text" :title="configState.config.value.dataDirectory">
               {{ configState.config.value.dataDirectory }}
            </v-list-item-title>
         </v-list-item>
      </v-navigation-drawer>

      <!-- === Main Content Area === -->
      <v-main>
         <v-container fluid class="main-content-container pa-0">
        <!-- Editor View (global single editor) -->
        <div v-if="activeView === 'editor'">
          <div
            v-if="!selectedPatientId || !configState.isDataDirectorySet.value"
            class="placeholder-content"
          >
               <v-icon size="64" :color="!configState.isDataDirectorySet.value ? 'orange' : 'grey-lighten-1'">
                  {{ !configState.isDataDirectorySet.value ? 'mdi-folder-alert-outline' : 'mdi-account-heart-outline' }}
               </v-icon>
               <p v-if="!configState.isDataDirectorySet.value" class="text-h6 grey--text text--darken-1 mt-4">
                  Please select your data storage directory.
               </p>
               <p v-else class="text-h6 grey--text text--lighten-1 mt-4">
                  Select or add a patient.
               </p>
            <v-btn
              v-if="!configState.isDataDirectorySet.value"
              color="warning"
              class="mt-4"
              @click="selectDataDirectory"
              prepend-icon="mdi-folder-open-outline"
            >
                  Select Data Directory
               </v-btn>
            <v-btn
              v-else
              color="primary"
              class="mt-4"
              @click="addNewPatient"
              prepend-icon="mdi-plus"
            >
                  Add New Patient
               </v-btn>
            </div>
          <div v-else class="editor-layout">
            <v-card flat class="editor-card">
              <v-toolbar density="compact" color="grey-lighten-3">
                <v-toolbar-title class="text-subtitle-1">
                  <v-icon start>mdi-account-circle-outline</v-icon>
                  {{ selectedPatient?.name || 'Loading...' }}
                  <span v-if="selectedPatient?.umrn" class="text-caption grey--text">
                    ({{ selectedPatient?.umrn }})
                  </span>
                  <span v-if="selectedPatient?.ward" class="text-caption grey--text">
                    - Ward {{ selectedPatient?.ward }}
                  </span>
                </v-toolbar-title>
                <v-spacer></v-spacer>
                <span class="text-subtitle-1 mr-4">
                  <v-icon start>mdi-calendar</v-icon>
                  Note for: {{ noteDateDisplay }}
                </span>
                <v-btn
                  :loading="noteEditor.isLoading.value"
                  :disabled="noteEditor.isLoading.value || !isNoteLoaded || !configState.isDataDirectorySet.value"
                  @click="saveCurrentNote"
                  color="primary"
                  variant="tonal"
                  size="small"
                  class="mr-2"
                  title="Save Note"
                >
                  <v-icon start>mdi-content-save</v-icon> Save
                </v-btn>
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
                <MonacoEditorComponent
                  v-if="!noteEditor.isLoading.value && !noteEditor.error.value"
                  ref="monacoEditorRef"
                  v-model="noteContent"
                  language="markdown"
                  :options="{ theme: 'vs' }"
                  class="editor-component"
                  @editor-mounted="onEditorReady"
                />
              </v-card-text>
            </v-card>
          </div>
        </div>

        <!-- Card View (each patient gets its own Monaco editor instance) -->
        <v-container
          v-else-if="activeView === 'card' && configState.isDataDirectorySet.value"
          class="card-layout"
          style="max-height: 1200px; overflow-y: auto;"
        >
          <v-sheet
            v-for="patient in patientData.patients.value"
            :key="patient.id"
            class="ma-2"
          >
                  <v-card>
                     <v-card-item>
                <v-card-title
                  v-if="editingPatientId !== patient.id"
                  @dblclick="startEditing(patient.id)"
                >
                           {{ patient.name }}
                  <v-icon
                    small
                    color="grey"
                    class="ml-1"
                    @mouseover.stop="showEditIcon[patient.id] = true"
                    @mouseleave.stop="showEditIcon[patient.id] = false"
                    v-if="showEditIcon[patient.id]"
                  >
                              mdi-pencil-outline
                           </v-icon>
                        </v-card-title>
                <v-text-field
                  v-else
                  v-model="editedPatient.name"
                  label="Patient Name"
                  single-line
                  hide-details
                  @blur="savePatient(patient)"
                  @keydown.enter="savePatient(patient)"
                  @keydown.esc="cancelEdit()"
                  autofocus
                ></v-text-field>
                     </v-card-item>
                     <v-card-item>
                <v-card-subtitle
                  v-if="editingPatientId !== patient.id"
                  @dblclick="startEditing(patient.id)"
                >
                           UMRN: {{ patient.umrn }} Ward: {{ patient.ward }}
                  <v-icon
                    small
                    color="grey"
                    class="ml-1"
                    @mouseover.stop="showEditIcon[patient.id] = true"
                    @mouseleave.stop="showEditIcon[patient.id] = false"
                    v-if="showEditIcon[patient.id]"
                  >
                              mdi-pencil-outline
                           </v-icon>
                        </v-card-subtitle>
                        <div v-else>
                  <v-text-field
                    v-model="editedPatient.umrn"
                    label="UMRN"
                    single-line
                    hide-details
                    @blur="savePatient(patient)"
                    @keydown.enter="savePatient(patient)"
                    @keydown.esc="cancelEdit()"
                  ></v-text-field>
                  <v-text-field
                    v-model="editedPatient.ward"
                    label="Ward"
                    single-line
                    hide-details
                    @blur="savePatient(patient)"
                    @keydown.enter="savePatient(patient)"
                    @keydown.esc="cancelEdit()"
                  ></v-text-field>
                        </div>
                     </v-card-item>
                     <v-card-text>
                <MonacoEditorComponent
                  v-model="patientNotes[patient.id]"
                  language="markdown"
                  :options="{ theme: 'vs', readOnly: true }"
                  class="editor-component"
                  @editor-mounted="() => loadNoteForPatient(patient.id)"
                />
                     </v-card-text>
                  </v-card>
               </v-sheet>
            </v-container>
         </v-container>
      </v-main>

    <!-- === Snackbar === -->
      <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="bottom right">
         {{ snackbar.text }}
         <template v-slot:actions>
            <v-btn color="white" variant="text" @click="snackbar.show = false">Close</v-btn>
         </template>
      </v-snackbar>
   </v-app>
</template>

<script setup lang="ts">
import { ref, provide, computed, watch } from 'vue';
import { usePatientData } from '@/composables/usePatientData';
import { useNoteEditor } from '@/composables/useNoteEditor';
import { useConfig } from '@/composables/useConfig';
import { useFileSystemAccess } from '@/composables/useFileSystemAccess';
import type { Patient, Note } from '@/types';
import MonacoEditorComponent from '@/components/MonacoEditorComponent.vue';
import { useDisplay } from 'vuetify';

const activeView = ref('editor'); // Default view
const drawer = ref(false);
const snackbar = ref({ show: false, text: '', color: 'success' });
const selectedPatientId = ref<string | null>(null);
const selectedDate = ref<string>(new Date().toISOString().split('T')[0]);
const noteContent = ref<string>('');
const currentNote = ref<Note | null>(null);
const isNoteLoaded = ref(false);
const monacoEditorRef = ref<InstanceType<typeof MonacoEditorComponent> | null>(null);

// Editing state (for patient list)
const editingPatientId = ref<string | null>(null);
const editedPatient = ref<Partial<Patient>>({});
const showEditIcon = ref<{ [patientId: string]: boolean }>({});

// New state for card view notes (each patient’s note)
const patientNotes = ref<Record<string, string>>({});

// Composables
const configState = useConfig();
const patientData = usePatientData();
const noteEditor = useNoteEditor();
const { showOpenDialog } = useFileSystemAccess();
const { smAndUp } = useDisplay()

// --- Computed ---
const selectedPatient = computed<Patient | undefined>(() => {
   if (!selectedPatientId.value) return undefined;
   return patientData.getPatientById(selectedPatientId.value);
});

const noteDateDisplay = computed(() => {
   try {
      const dateParts = selectedDate.value.split('-');
      const dateObj = new Date(Date.UTC(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])));
      return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
   } catch {
      return selectedDate.value; // Fallback
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
   loadSelectedNote(); // Load note when patient is selected
};

const addNewPatient = async () => {
   if (!configState.isDataDirectorySet.value) {
      showSnackbar("Please select a data directory first.", "error");
      return;
   }
  try {
    const newPatientData: Omit<Patient, 'id'> = { name: 'New Patient', umrn: '', ward: '' };
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
      const loadedNote = await noteEditor.loadNote(selectedPatientId.value, selectedDate.value);
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
   const success = await noteEditor.saveNote(selectedPatientId.value, noteToSave);
   if (success) {
      showSnackbar('Note saved successfully.', 'success');
      currentNote.value = { ...noteToSave };
   } else {
      showSnackbar(`Failed to save note: ${noteEditor.error.value || 'Unknown error'}`, 'error');
   }
};

const loadNoteForPatient = async (patientId: string) => {
  try {
    const loadedNote = await noteEditor.loadNote(patientId, selectedDate.value);
    if (loadedNote) {
      patientNotes.value[patientId] = loadedNote.content;
      console.log(`Note loaded for patient ${patientId}`);
    } else {
      patientNotes.value[patientId] = '';
      console.error(`Failed to load note for patient ${patientId}`);
    }
  } catch (error) {
    console.error(`Error loading note for patient ${patientId}:`, error);
    patientNotes.value[patientId] = '';
  }
};

const onEditorReady = (editorInstance: any) => {
   console.log("Monaco Editor is ready.");
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

// --- Editing Patient Methods ---
const startEditing = (patientId: string) => {
   editingPatientId.value = patientId;
   const patient = patientData.getPatientById(patientId);
   if (patient) {
      editedPatient.value = { ...patient }; // Make a copy for editing
   }
 
};

const cancelEdit = () => {
   editingPatientId.value = null;
   editedPatient.value = {};
};

const savePatient = async (originalPatient: Patient) => {
   if (!editingPatientId.value || editingPatientId.value !== originalPatient.id) {
    return;
   }

   try {
      const updatedPatient: Patient = {
      ...originalPatient,
      name: editedPatient.value.name || originalPatient.name,
      umrn: editedPatient.value.umrn,
      ward: editedPatient.value.ward,
      };

      const success = await patientData.updatePatient(updatedPatient);

      if (success) {
         showSnackbar(`Patient "${updatedPatient.name}" updated.`, 'success');
         editingPatientId.value = null;
         editedPatient.value = {};
      } else {
         showSnackbar(`Failed to update patient: ${patientData.error.value || 'Unknown error'}`, 'error');
      }
   } catch (err: any) {
      console.error("Error updating patient:", err);
      showSnackbar(`Error updating patient: ${err.message || 'Unknown error'}`, 'error');
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
</script>

<style scoped lang="scss">
/* Existing styles remain */
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
</style>