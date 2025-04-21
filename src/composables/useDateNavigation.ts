import { ref, computed, watch } from 'vue';
import { useFileSystemAccess } from '@/composables/useFileSystemAccess';
import { useNoteEditor } from '@/composables/useNoteEditor';
import { usePatientData } from '@/composables/usePatientData';
import { useConfig } from '@/composables/useConfig';

export function useDateNavigation() {
    const fileSystemAccess = useFileSystemAccess();
    const noteEditor = useNoteEditor();
    const patientData = usePatientData();
    const configState = useConfig();

    const dateMenu = ref(false);
    const allowedDates = ref<string[]>([]);
    const todayString = new Date().toISOString().split('T')[0];
    const selectedDate = ref<string>(todayString);

    const noteDateDisplay = computed(() => {
        try {
            const [year, month, day] = selectedDate.value.split('-');
            const dateObj = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
            return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        } catch {
            return selectedDate.value;
        }
    });

    async function onDateChange(newDate: string) {
        selectedDate.value = newDate;
        await patientData.setActivePatientListDate(newDate);
        // Note: App.vue watches selectedDate and selectedPatientId to trigger loadSelectedNote
        // We don't need to trigger it here directly.
    }

    const goToPreviousDay = async (selectedPatientId: string | null) => {
        if (!selectedPatientId) return;
        try {
            const prevDate = await fileSystemAccess.getPreviousDayNote(selectedPatientId, selectedDate.value);
            if (prevDate) {
                selectedDate.value = prevDate;
            } else {
                // This composable doesn't have access to showSnackbar,
                // the calling component (App.vue) should handle UI feedback
                console.log('No previous note found.');
            }
        } catch (error: any) {
            console.error(`Error navigating to previous day: ${error.message || 'Unknown error'}`);
            // Handle error in calling component
        }
    };

    const goToNextDay = async (selectedPatientId: string | null) => {
        if (!selectedPatientId) return;
        try {
            const nextDate = await fileSystemAccess.getNextDayNote(selectedPatientId, selectedDate.value);
            if (nextDate) {
                selectedDate.value = nextDate;
            } else {
                // This composable doesn't have access to showSnackbar,
                // the calling component (App.vue) should handle UI feedback
                console.log('No next note found.');
            }
        } catch (error: any) {
            console.error(`Error navigating to next day: ${error.message || 'Unknown error'}`);
            // Handle error in calling component
        }
    };

    // Watch selectedDate to update allowedDates
    watch(selectedDate, async (newDate) => {
        // When selectedDate changes, reload allowedDates (in case new files are added)
        // This might be better handled in App.vue or usePatientData if it's about patient list dates
        // For now, keeping it here as it was in App.vue
        allowedDates.value = await patientData.listAvailablePatientListDates();
    }, { immediate: true }); // Load initially

    return {
        dateMenu,
        allowedDates,
        todayString,
        selectedDate,
        noteDateDisplay,
        onDateChange,
        goToPreviousDay,
        goToNextDay,
    };
}