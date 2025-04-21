<template>
  <!-- Patient List and Controls (Drawer Removed) -->
  <!-- Search and Multi-Select Controls -->
  <v-row class="pa-2">
    <v-text-field
      :model-value="search"
      @update:model-value="onSearchInput"
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
      @click="onRemoveSelectedPatientsFromList"
      block
    >
      <v-icon start>mdi-delete</v-icon>
      Remove Selected ({{ selectedPatientIds.length }})
    </v-btn>
    <v-btn
      v-if="selectedPatientIds.length > 0 && selectedDate !== todayString"
      color="primary"
      variant="tonal"
      size="small"
      class="mb-2"
      @click="onAddSelectedToTodayList"
      block
    >
      <v-icon start>mdi-calendar-plus</v-icon>
      Add Selected to Today ({{ selectedPatientIds.length }})
    </v-btn>
  </v-row>
  <v-list>
    <v-list-subheader class="d-flex align-center">
      <span>Patient List</span>
      <v-btn
        icon
        size="small"
        class="ml-2"
        @click.stop="showSortMenu = true"
        :title="`Sort: ${sortModeLabel}`"
      >
        <v-icon>mdi-sort</v-icon>
      </v-btn>
      <span class="ml-2 text-caption" style="opacity:0.7;">{{ sortModeLabel }}</span>
    </v-list-subheader>
    <v-menu
      v-model="showSortMenu"
      :close-on-content-click="true"
      offset-y
    >
      <v-list>
        <v-list-item @click="handleSortSelect('name')">
          <v-list-item-title>
            <v-icon start v-if="sortMode.value === 'name'" color="primary">mdi-check</v-icon>
            Sort by Name
          </v-list-item-title>
        </v-list-item>
        <v-list-item @click="handleSortSelect('location')">
          <v-list-item-title>
            <v-icon start v-if="sortMode.value === 'location'" color="primary">mdi-check</v-icon>
            Sort by Location
          </v-list-item-title>
        </v-list-item>
        <v-list-item @click="handleSortSelect('custom')">
          <v-list-item-title>
            <v-icon start v-if="sortMode.value === 'custom'" color="primary">mdi-check</v-icon>
            Custom Sort (Manual Order)
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-list-item-group
      :model-value="selectedPatientIds"
      @update:model-value="onSelectPatientIds"
      multiple
      :mandatory="false"
    >
      <v-list-item
        v-for="(element, _index) in patientsDraggable"
        :key="(element as any).id"
        :value="(element as any).id"
        :data-id="(element as any).id"
        @click="onPatientClick((element as any).id)"
      >
        <template v-slot:prepend>
          <v-icon
            v-if="isEditPatientListMode"
            class="drag-handle ma-1 pa-2"
            title="Drag to reorder"
            @mousedown.stop
            >mdi-drag</v-icon
          >
        </template>
        <v-list-item-content>
          <v-list-item-title>{{ (element as any).name }}</v-list-item-title>
          <v-list-item-subtitle
            v-if="(element as any).umrn || (element as any).location"
            class="umrn-location"
          >
            {{ (element as any).umrn ? `${(element as any).umrn}` : "" }}
            {{ (element as any).location ? `Location: ${(element as any).location}` : "" }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <template v-slot:append class="align-center justify-center align-self-center">
          <v-btn
            v-if="isEditPatientListMode"
            icon
            size="small"
            color="error"
            @click.stop="onRemovePatientFromList(element)"
            title="Remove patient"
            class="ma-1 pa-2"
          >
            <v-icon>mdi-delete</v-icon>
          </v-btn>
          <v-checkbox
            v-if="isEditPatientListMode"
            :model-value="selectedPatientIds.includes((element as any).id)"
            @click.stop="onCheckboxSelectPatientList((element as any).id)"
            :ripple="true"
            color="primary"
            class="align-center justify-center align-self-center"
          />
        </template>
      </v-list-item>
    </v-list-item-group>
  </v-list>

  <v-divider class="ma-2"></v-divider>

  <v-row class="ma-2">
    <v-btn
      color="primary"
      size="large"
      @click="onAddNewPatient"
      :disabled="!configState.isDataDirectorySet.value"
    >
      <v-icon start>mdi-account-plus-outline</v-icon>
      Add New Patient
    </v-btn>
  </v-row>
  <v-row class="ma-2">
    <v-btn @click="onToggleEditMode">
      <v-icon>mdi-pencil-plus</v-icon>
      {{ isEditPatientListMode ? "Done Editing" : "Edit Patient List" }}
    </v-btn>
  </v-row>

  <v-row class="mb-2 mt-auto ma-2">
    <v-expansion-panels class="align-end">
      <v-expansion-panel title="Debug Info">
        <v-expansion-panel-text>
          App Info:<br />
          Version: {{ version }}<br />
          Packaged: {{ isPackaged ? "Yes" : "No" }}<br />
          Environment: {{ nodeEnv }}<br />
          Config Path: {{ configState.configPath.value || "Loading..." }}<br />
          <div v-if="configState.config.value.dataDirectory">
            Data Directory:
            <span
              class="text-caption wrap-text"
              :title="configState.config.value.dataDirectory"
            >
              {{ configState.config.value.dataDirectory }}
            </span>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-row>
</template>
<script setup lang="ts">
import { defineProps, defineEmits, ref, computed, PropType, watch } from "vue";
import { usePatientList } from "../composables/usePatientList";

// Props for presentational PatientList
const props = defineProps({
  patientsDraggable: { type: Array, required: true },
  selectedPatientIds: { type: Array, required: true },
  isEditPatientListMode: { type: Boolean, required: true },
  search: { type: String, required: true },
  todayString: { type: String, required: true },
  selectedDate: { type: String, required: true },
  configState: { type: Object, required: true },
  version: { type: String, required: true },
  isPackaged: { type: Boolean, required: true },
  nodeEnv: { type: String, required: true },
  sortMode: { type: Object as PropType<import('vue').Ref<any>>, required: true },
  setSortMode: { type: Function as PropType<(mode: "custom" | "name" | "location") => void>, required: true }
});

// Debug logs to validate type and value of sortMode
console.log("[PatientList] sortMode (raw):", props.sortMode);
console.log("[PatientList] sortMode.value:", props.sortMode.value, "type:", typeof props.sortMode.value);

watch(
  () => props.sortMode.value,
  (newVal, oldVal) => {
    console.log(`[PatientList] sortMode changed from ${oldVal} to ${newVal}`);
  }
);

// Emits for all actions
const emit = defineEmits([
  "update:search",
  "update:selectedPatientIds",
  "update:isEditPatientListMode",
  "patientSelected",
  "patientListChanged",
  "addNewPatient",
  "removePatientFromList",
  "removeSelectedPatientsFromList",
  "addSelectedToTodayList",
  "checkboxSelectPatientList"
]);

const showSortMenu = ref(false);

const sortModeLabel = computed(() => {
  console.log("[PatientList] sortModeLabel computed, sortMode.value:", props.sortMode.value);
  switch (props.sortMode.value) {
    case "name":
      return "Name";
    case "location":
      return "Location";
    case "custom":
      return "Custom Order";
    default:
      return "Custom Order";
  }
});

function handleSortSelect(mode: "custom" | "name" | "location") {
  console.log("[PatientList] handleSortSelect called with mode:", mode);
  props.setSortMode(mode);
  showSortMenu.value = false;
}

// Event handlers to emit up to parent
function onSearchInput(val: string) {
  emit("update:search", val);
}
function onSelectPatientIds(val: string[]) {
  emit("update:selectedPatientIds", val);
}
function onToggleEditMode() {
  emit("update:isEditPatientListMode", !props.isEditPatientListMode);
}
function onPatientClick(patientId: string) {
  emit("patientSelected", patientId);
}
function onAddNewPatient() {
  emit("addNewPatient");
}
function onRemovePatientFromList(patient: any) {
  emit("removePatientFromList", patient);
}
function onRemoveSelectedPatientsFromList() {
  emit("removeSelectedPatientsFromList");
}
function onAddSelectedToTodayList() {
  emit("addSelectedToTodayList");
}
function onCheckboxSelectPatientList(patientId: string) {
  emit("checkboxSelectPatientList", patientId);
}
</script>
<style scoped>
/* Add any component-specific styles here if needed */
</style>