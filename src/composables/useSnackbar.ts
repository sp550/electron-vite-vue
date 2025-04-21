import { ref } from 'vue';

const snackbar = ref({ show: false, text: '', color: 'success' });

const showSnackbar = (text: string, color: 'success' | 'error' | 'info' = 'info') => {
  snackbar.value.text = text;
  snackbar.value.color = color;
  snackbar.value.show = true;
};

export function useSnackbar() {
  return {
    snackbar,
    showSnackbar,
  };
}