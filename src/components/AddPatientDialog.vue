<template>
   <v-dialog v-model="dialog" persistent max-width="600px">
      <v-card>
         <v-card-title>
            <span class="text-h5">Add New Patient</span>
         </v-card-title>
         <v-card-text>
            <v-container>
               <v-form ref="form" v-model="valid" lazy-validation @submit.prevent="submit">
                  <v-text-field v-model="patientName" label="Patient Name*" :rules="nameRules" required
                     variant="outlined" density="compact"></v-text-field>
                  <v-text-field v-model="patientUmrn" label="UMRN (Optional)" variant="outlined"
                     density="compact"></v-text-field>
                  <v-text-field v-model="patientWard" label="Ward (Optional)" variant="outlined"
                     density="compact"></v-text-field>
               </v-form>
            </v-container>
            <small>*indicates required field</small>
         </v-card-text>
         <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue-darken-1" variant="text" @click="closeDialog">
               Cancel
            </v-btn>
            <v-btn color="blue-darken-1" variant="flat" @click="submit" :disabled="!valid || isLoading"
               :loading="isLoading">
               Add Patient
            </v-btn>
         </v-card-actions>
      </v-card>
   </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePatientData } from '@/composables/usePatientData';
import type { Patient } from '@/types';

// Props using defineProps - use modelValue for v-model compatibility
const props = defineProps({
   modelValue: { // Controls dialog visibility
      type: Boolean,
      required: true,
   },
});

// Emits using defineEmits
const emit = defineEmits(['update:modelValue', 'patient-added']);

const { addPatient } = usePatientData();
const isLoading = ref(false);

// Computed property to proxy v-model
const dialog = computed({
   get: () => props.modelValue,
   set: (value) => emit('update:modelValue', value),
});

const form = ref<any>(null); // Ref for the v-form
const valid = ref(false);
const patientName = ref('');
const patientUmrn = ref('');
const patientWard = ref('');

const nameRules = [
   (v: string) => !!v || 'Patient Name is required',
   (v: string) => (v && v.length >= 2) || 'Name must be at least 2 characters',
];

const resetForm = () => {
   patientName.value = '';
   patientUmrn.value = '';
   patientWard.value = '';
   form.value?.resetValidation(); // Reset validation state
   valid.value = false; // Explicitly reset valid state
};

const closeDialog = () => {
   resetForm();
   dialog.value = false; // Use computed property setter
};

const submit = async () => {
   const { valid: formIsValid } = await form.value?.validate();

   if (formIsValid) {
      isLoading.value = true;
      const patientData: Omit<Patient, 'id'> = {
         name: patientName.value.trim(),
         umrn: patientUmrn.value.trim() || undefined, // Store as undefined if empty
         ward: patientWard.value.trim() || undefined,
      };

      const newPatient = await addPatient(patientData);
      isLoading.value = false;
      if (newPatient) {
         emit('patient-added', newPatient);
         closeDialog();
      } else {
         emit('patient-added', null); // Indicate failure
         // Error should be handled/displayed by the calling component or usePatientData error state
      }
   }
};

// Reset form when dialog opens/closes
watch(dialog, (newValue) => {
   if (!newValue) {
      // Ensure form is reset when dialog is closed externally too
      resetForm();
   } else {
      // Autofocus the first field when dialog opens (optional)
      // nextTick(() => form.value?.$el.querySelector('input')?.focus());
   }
})

</script>