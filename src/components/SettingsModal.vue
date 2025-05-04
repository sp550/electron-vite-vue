<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import { useConfig } from '@/composables/useConfig';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  isAutoSaveEnabled: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue', 'update:isAutoSaveEnabled']);

const configState = useConfig();

const closeDialog = () => {
  emit('update:modelValue', false);
};

const selectDataDirectory = () => {
  configState.setDataDirectory(null);
};

const saveSettings = () => {
  configState.saveConfig();
  closeDialog(); // Close after saving
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="closeDialog"
    max-width="600px"
  >
    <v-card>
      <v-card-title>
        Settings
      </v-card-title>
      <v-card-text>
          <div v-if="configState.isLoading.value && !configState.isConfigLoaded.value">
            Loading settings...
          </div>
          <v-container v-if="configState.isConfigLoaded.value">
          <v-card class="mb-4">
            <v-card-title>General Settings</v-card-title>
            <v-card-text>
              <v-switch
                label="Auto-Save"
                :model-value="isAutoSaveEnabled"
                @update:model-value="$emit('update:isAutoSaveEnabled', $event)"
                density="compact"
                hide-details
              ></v-switch>
            </v-card-text>
          </v-card>

          <!-- File Naming Settings -->
          <v-card class="mb-4">
            <v-card-title>File Naming</v-card-title>
            <v-card-text>
              <v-text-field
                label="Patients File Name"
                v-model="configState.config.value.patientsFilename"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-4"
              ></v-text-field>
              <v-text-field
                label="Notes Base Directory"
                v-model="configState.config.value.notesBaseDir"
                density="compact"
                variant="outlined"
                hide-details
              ></v-text-field>
            </v-card-text>
          </v-card>

          <!-- Appearance Settings -->
          <v-card class="mb-4">
            <v-card-title>Appearance</v-card-title>
            <v-card-text>
              <v-select
                label="Theme"
                v-model="configState.config.value.theme"
                :items="['light', 'dark']"
                density="compact"
                variant="outlined"
                hide-details
              ></v-select>
            </v-card-text>
          </v-card>

          <v-card>
            <v-card-title>Data Storage</v-card-title>
            <v-card-text>
              <v-text-field
                label="Data Directory"
                :model-value="configState.config.value.dataDirectory"
                readonly
                density="compact"
                variant="outlined"
                hide-details
                class="mb-4"
              ></v-text-field>
              <v-text-field
                label="ICM List Directory"
                :model-value="configState.config.value.iCMListDirectory"
                readonly
                density="compact"
                variant="outlined"
                hide-details
              ></v-text-field>
              <v-btn
                class="mt-2"
                @click="selectDataDirectory"
                color="secondary"
                variant="outlined"
              >
                Select Data Directory
              </v-btn>
            </v-card-text>
          </v-card>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          text
          @click="saveSettings"
        >
          Save Settings
        </v-btn>
        <v-btn
          color="secondary"
          text
          @click="closeDialog"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Add any specific styles here */
</style>