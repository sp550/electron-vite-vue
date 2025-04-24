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

    <!-- === Date Navigation Toolbar === -->
    <v-toolbar density="compact" color="grey-lighten-4">
      <v-btn icon="mdi-chevron-left" @click="handlePreviousDayClick" title="Previous Day" size="small"></v-btn>
      <span class="text-subtitle-2 mx-2" :title="activePatientListDate">
        <v-icon start>mdi-calendar</v-icon>
        {{ patientListDateDisplayComputed }}
      </span>
      <v-btn icon="mdi-chevron-right" @click="goToNextPatientListDay" title="Next Day" size="small"></v-btn>

      <v-spacer></v-spacer>

      <!-- Date Picker for Patient List Date Navigation -->
      <v-menu v-model="dateMenu" :close-on-content-click="false" location="bottom end" offset-y>
        <template #activator="{ props }">
          <v-btn v-bind="props" icon="mdi-calendar-search" title="Select Date" aria-label="Select Date" size="small"></v-btn>
        </template>
        <v-card>
          <v-date-picker
            :model-value="activePatientListDate"
            @update:model-value="setActivePatientListDate"
            color="primary"
            show-adjacent-months
          />
        </v-card>
      </v-menu>
    </v-toolbar>

    <v-card-text v-if="isEditPatientListMode" class="py-2">
      {{ selectedPatientIds.length }} patient{{ selectedPatientIds.length === 1 ? '' : 's' }} selected
    </v-card-text>
    <v-list max-height="80vh" style="overflow-y:auto;">
      <template v-if="isEditPatientListMode">
        <v-list
          :selected="selectedPatientIds"
          multiple
          max-height="60vh"
          style="overflow-y:auto;"
          @update:selected="onSelectPatientIds"
        >
          <v-list-item
            v-for="(element, _index) in patientsDraggable"
            :key="(element as any).id"
            :value="(element as any).id"
            :data-id="(element as any).id"
          >
            <template #prepend>
              <v-icon
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
            <template #append>
              <v-list-item-action>
                <v-btn
                  icon="mdi-delete"
                  variant="plain"
                  size="small"
                  color="error"
                  @click.stop="onRemovePatientFromList(element)"
                  title="Remove patient"
                  density="compact"
                  class="me-2"
                />
              </v-list-item-action>
            </template>
          </v-list-item>
        </v-list>
      </template>
      <template v-else>
        <v-list-item
          v-for="(element, _index) in patientsDraggable"
          :key="(element as any).id"
          :data-id="(element as any).id"
          @click="onPatientClick((element as any).id)"
        >
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
        </v-list-item>
      </template>
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
import { defineProps, defineEmits, ref, computed, PropType, watch, } from "vue";
import { usePatientData } from "@/composables/usePatientData"; // Import usePatientData

// Props for presentational PatientList
const props = defineProps({
  patientsDraggable: { type: Array, required: true },
  selectedPatientIds: { type: Array, required: true },
  isEditPatientListMode: { type: Boolean, required: true },
  search: { type: String, required: true },
  todayString: { type: String, required: true },
  configState: { type: Object, required: true },
  version: { type: String, required: true },
  isPackaged: { type: Boolean, required: true },
  nodeEnv: { type: String, required: true },
  sortMode: { type: Object as PropType<import('vue').Ref<any>>, required: true },
  setSortMode: { type: Function as PropType<(mode: "custom" | "name" | "location") => void>, required: true },
});

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
]);

const showSortMenu = ref(false);
const dateMenu = ref(false); // State for the date picker menu

// Use the patient data composable
const {
  activePatientListDate,
  setActivePatientListDate,
  availablePatientListDates,
  goToPreviousPatientListDay,
  goToNextPatientListDay,
} = usePatientData();

// Computed property for displaying the active patient list date
const patientListDateDisplayComputed = computed(() => {
  try {
    const [year, month, day] = activePatientListDate.value.split('-');
    const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return activePatientListDate.value;
  }
});


const sortModeLabel = computed(() => {
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
function onSelectPatientIds(val: unknown[]) {
  // Convert unknown[] to string[]
  const ids = val.map(String);
  emit("update:selectedPatientIds", ids);
}
function onToggleEditMode() {
  emit("update:isEditPatientListMode", !props.isEditPatientListMode);
}
function onPatientClick(patientId: string) {
  // In view mode, emit patientSelected. In edit mode, selection is handled by v-list-item-group.
  if (!props.isEditPatientListMode) {
    emit("patientSelected", patientId);
  }
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

// Date navigation event handlers (now directly using usePatientData functions)
function handlePreviousDayClick() {
  goToPreviousPatientListDay();
}

function handleNextDayClick() {
  goToNextPatientListDay();
}

function handleDateChange(newDate: string) {
  setActivePatientListDate(newDate);
  dateMenu.value = false; // Close the date picker after selection
}
</script>
<style scoped>
/* Add any component-specific styles here if needed */
</style>