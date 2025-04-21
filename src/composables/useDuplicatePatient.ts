import { ref, type Ref } from 'vue';
import type { Patient } from '@/types';

const duplicateDialog = ref(false);
const duplicatePatient: Ref<Patient | null> = ref(null);

const loadDuplicatePatient = (selectPatient: (patientId: string) => void) => {
    if (duplicatePatient.value) {
        selectPatient(duplicatePatient.value.id);
        duplicateDialog.value = false;
    }
};

export function useDuplicatePatient() {
    return {
        duplicateDialog,
        duplicatePatient,
        loadDuplicatePatient,
    };
}