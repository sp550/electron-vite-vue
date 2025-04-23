<template>

  <v-card flat class="">
    <v-toolbar class="" density="compact">
      <v-text-field :model-value="search" @update:model-value="onSearchInput" label="Search patients"
        prepend-inner-icon="mdi-magnify" dense hide-details clearable class="" />

      <v-btn icon size="small" class="ml-2" @click.stop="showSortMenu = true" :title="`Sort: ${sortModeLabel}`" flat>
        <v-icon>mdi-sort</v-icon>
      </v-btn>

      <v-menu v-model="showSortMenu" :close-on-content-click="true" location="bottom center" origin="auto">
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
    </v-toolbar>
    <v-list max-height="60vh" style="overflow-y:auto;">
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
              class="me-2"
              title="Drag to reorder"
              @mousedown.stop
            >mdi-drag</v-icon>
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
          <template v-slot:append>
            <v-list-item-action v-if="isEditPatientListMode">
              <v-btn
                icon="mdi-delete"
                flat
                size="small"
                color="error"
                @click.stop="onRemovePatientFromList(element)"
                title="Remove patient"
                density="compact"
                class="me-2"
              />
              <v-checkbox
                :model-value="selectedPatientIds.includes((element as any).id)"
                @click.stop="onCheckboxSelectPatientList((element as any).id)"
                color="primary"
                density="compact"
                hide-details
              />
            </v-list-item-action>
          </template>
        </v-list-item>
      </v-list-item-group>
    </v-list>
    <v-card-actions>
      <v-spacer></v-spacer>

      <v-btn color="primary" :disabled="!configState.isDataDirectorySet.value" @click="onAddNewPatient"
        prepend-icon="mdi-account-plus-outline">
        Add New
      </v-btn>
      <v-btn :color="isEditPatientListMode ? 'success' : 'secondary'" @click="onToggleEditMode"
        prepend-icon="mdi-pencil-plus">
        {{ isEditPatientListMode ? "Done Editing" : "Edit List" }}
      </v-btn>
    </v-card-actions>
  </v-card>



</template>
<script setup lang="ts">
import { defineProps, defineEmits, ref, computed, PropType, watch } from "vue";

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