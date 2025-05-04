<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, computed } from 'vue';
import { useConfig } from '@/composables/useConfig';
import { useSnackbar } from '@/composables/useSnackbar';

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
const { showSnackbar } = useSnackbar();

// Local state for theme selection to avoid modifying readonly config directly

// Computed property for theme icon
const themeIcon = computed(() => {
  return configState.config.value.theme === 'dark' ? 'mdi-moon-waning-gibbous' : 'mdi-white-balance-sunny';
});

// Computed property for theme color
const themeColor = computed(() => {
  return configState.config.value.theme === 'dark' ? 'blue-grey' : 'orange';
});

// Watch for dialog visibility changes to sync local state with config

const closeDialog = () => {
  // Reset local state to current config value when closing without saving
  emit('update:modelValue', false);
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
            // Note: The original App.vue code includes logic for loading notes based on selectedPatientId.
            // This logic is specific to App.vue and is not included here as per the scope.
         } else {
            showSnackbar('Failed to save the selected data directory.', 'error');
         }
      }
   } catch (error: any) {
      showSnackbar(`Error selecting directory: ${error.message || 'Unknown error'}`, 'error');
   }
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


          <!-- Appearance Settings -->
          <v-card class="mb-4">
            <v-card-title>Appearance</v-card-title>
            <v-card-text>
              <v-switch
                label="Adapt to System Theme"
                :model-value="configState.config.value.adaptSystemTheme"
                @update:model-value="configState.updateAdaptSystemTheme"
                density="compact"
                hide-details
              ></v-switch>

              <v-switch
                label="Theme"
                :model-value="configState.config.value.theme"
                @update:model-value="async (newValue) => { configState.updateTheme(newValue); await configState.saveConfig(); }"
                true-value="dark"
                false-value="light"
                :append-icon="themeIcon"
                :color="themeColor"
                density="compact"
                hide-details
                :disabled="configState.config.value.adaptSystemTheme"
              ></v-switch>
            </v-card-text>
          </v-card>

          <v-card>
            <v-card-title>Data Storage</v-card-title>
            <v-card-text>
              <v-row no-gutters class="align-center mb-4">
                <v-col cols="9">
                  <v-text-field
                    label="Data Directory"
                    :model-value="configState.config.value.dataDirectory"
                    readonly
                    density="compact"
                    variant="outlined"
                    hide-details
                  ></v-text-field>
                </v-col>
                <v-col cols="3" class="pl-2">
                  <v-btn
                    @click="selectDataDirectory"
                    color="secondary"
                    variant="outlined"
                    block
                  >
                    Select
                  </v-btn>
                </v-col>
              </v-row>
              <v-text-field
                label="ICM List Directory"
                :model-value="configState.config.value.iCMListDirectory"
                readonly
                density="compact"
                variant="outlined"
                hide-details
              ></v-text-field>
            </v-card-text>
          </v-card>
        </v-container>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
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