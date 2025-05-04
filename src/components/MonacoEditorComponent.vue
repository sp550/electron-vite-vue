<template>
  <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import type { PropType } from 'vue';
import { monacoService, MonacoServiceOptions } from '@/services/monacoService';
import type * as monaco from 'monaco-editor';
import { useConfig } from '@/composables/useConfig';

const configState = useConfig();

/**
 * Props for MonacoEditorComponent
 */
const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: 'medical-notes',
  },
  theme: {
    type: String,
    default: 'vs-dark',
  },
  options: {
    type: Object as PropType<monaco.editor.IStandaloneEditorConstructionOptions>,
    default: () => ({}),
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
});

/**
 * Emits for MonacoEditorComponent
 */
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'editorMounted', editor: monaco.editor.IStandaloneCodeEditor): void;
  (e: 'onAction', actionId: string): void;
}>();

const editorContainer = ref<HTMLElement | null>(null);
let preventUpdate = false;

/**
 * Register language and theme if needed.
 * This should be replaced with dynamic config loading if required.
 */
/**
 * All custom language, theme, and config registration is handled by
 * monacoService.initializeMonacoCustomizations(editor).
 */

/**
 * Register custom actions and keybindings.
 * Emits 'onAction' when a custom action is triggered.
 */
function registerActionsAndKeybindings(_editor: monaco.editor.IStandaloneCodeEditor) {
  // Example: Save action (Ctrl+S)
  monacoService.registerAction({
    id: 'save',
    label: 'Save Note',
    keybindings: [
      // @ts-ignore
      window.monaco?.KeyMod?.CtrlCmd | window.monaco?.KeyCode?.KeyS || 2048 | 49 // fallback
    ],
    precondition: undefined,
    keybindingContext: undefined,
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 1.5,
    run: (_editor: any, ..._args: any[]) => {
      emit('onAction', 'save');
    },
  });

  // Example: Format action
  monacoService.registerAction({
    id: 'format',
    label: 'Format Note',
    run: (_editor: any, ..._args: any[]) => {
      emit('onAction', 'format');
    },
  });

  // Add more actions/keybindings as needed
}

/**
 * Register completions/templates if needed.
 * This should be replaced with dynamic template loading if required.
 */
/**
 * Custom completions/templates are registered via monacoService.initializeMonacoCustomizations(editor).
 */

onMounted(async () => {
  console.log('MonacoEditorComponent: onMounted');
  await nextTick();
  if (!editorContainer.value) {
    console.error('Monaco Editor container not found.');
    return;
  }

  console.log('MonacoEditorComponent: Creating editor with props:', {
    language: props.language,
    theme: props.theme,
    readOnly: props.readOnly,
    options: props.options,
  });
  // Create editor via service
  const editor = monacoService.createEditor({
    container: editorContainer.value,
    value: props.modelValue,
    language: props.language,
    theme: configState.effectiveTheme.value === 'dark' ? 'medicalLang-dark' : 'medicalLang-light',
    readOnly: props.readOnly,
    options: {
      ...props.options,
    },
  } as MonacoServiceOptions);
  console.log('MonacoEditorComponent: Editor created.');

  // Ensure all custom language, theme, and config is loaded and applied
  console.log('MonacoEditorComponent: Initializing custom customizations.');
  await monacoService.initializeMonacoCustomizations(editor);
  console.log('MonacoEditorComponent: Custom customizations initialized.');

  // Explicitly set theme after initialization
  console.log('MonacoEditorComponent: Explicitly setting theme to', configState.effectiveTheme.value);
  monacoService.setTheme(configState.effectiveTheme.value === 'dark' ? 'medicalLang-dark' : 'medicalLang-light');

  // Log editor options for debugging

  // Register actions and keybindings
  registerActionsAndKeybindings(editor);

  // Listen for content changes and emit update:modelValue
  editor.onDidChangeModelContent(() => {
    if (!preventUpdate) {
      const currentValue = monacoService.getValue();
      if (currentValue !== props.modelValue) {
        emit('update:modelValue', currentValue);
      }
    }
  });

  emit('editorMounted', editor);
});

onBeforeUnmount(() => {
  monacoService.disposeEditor();
});

/**
 * Watch for external changes to modelValue and update the editor.
 */
watch(() => props.modelValue, (newValue) => {
  const currentValue = monacoService.getValue();
  if (newValue !== currentValue) {
    preventUpdate = true;
    monacoService.setValue(newValue);
    preventUpdate = false;
  }
});

/**
 * Watch for changes in language prop and update the editor.
 */
watch(() => props.language, (newLang) => {
  monacoService.setLanguage(newLang);
});

/**
 * Watch for changes in theme prop and update the editor.
 */
watch(() => configState.effectiveTheme.value, (newTheme) => {
  console.log('MonacoEditorComponent: Effective theme changed to', newTheme);
  monacoService.setTheme(newTheme === 'dark' ? 'medicalLang-dark' : 'medicalLang-light');
});

/**
 * Watch for changes in readOnly prop and update the editor.
 */
watch(() => props.readOnly, (newReadOnly) => {
  monacoService.updateOptions({ readOnly: newReadOnly });
});

/**
 * Watch for changes in options prop and update the editor.
 */
watch(() => props.options, (newOptions) => {
  monacoService.updateOptions(newOptions);
});

/**
 * Expose editor instance and utility methods for parent access.
 * All methods are strongly typed and documented.
 */
defineExpose({
  /**
   * The Monaco editor instance.
   */
  get editorInstance(): monaco.editor.IStandaloneCodeEditor | null {
    return monacoService['editor'] ?? null;
  },

  /**
   * Focus the editor programmatically.
   * @returns {void}
   */
  focus(): void {
    monacoService.focus();
  },

  /**
   * Get the current editor content.
   * @returns {string}
   */
  getValue(): string {
    return monacoService.getValue();
  },

  /**
   * Set the editor content.
   * @param {string} value - The new content for the editor.
   * @returns {void}
   */
  setValue(value: string): void {
    monacoService.setValue(value);
  },

  /**
   * Programmatically trigger a registered action.
   * @param {string} actionId - The action's ID.
   * @returns {void}
   */
  triggerAction(actionId: string): void {
    monacoService.triggerAction(actionId);
  },

  /**
   * Change the editor theme at runtime.
   * @param {string} themeName - The name of the registered theme.
   * @returns {void}
   */
  setTheme(themeName: string): void {
    monacoService.setTheme(themeName);
  },

  /**
   * Change the language mode at runtime.
   * @param {string} languageId - The language ID to switch to.
   * @returns {void}
   */
  setLanguage(languageId: string): void {
    monacoService.setLanguage(languageId);
  },

  /**
   * Update editor options dynamically.
   * @param {monaco.editor.IStandaloneEditorConstructionOptions} options - Partial editor options.
   * @returns {void}
   */
  updateOptions(options: monaco.editor.IStandaloneEditorConstructionOptions): void {
    monacoService.updateOptions(options);
  },

  /**
   * Access the current Monaco model for advanced operations.
   * @returns {monaco.editor.ITextModel | null}
   */
  getModel(): monaco.editor.ITextModel | null {
    return monacoService.getModel();
  },
});
</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  height: 100%;
  min-height: 100px;
  border: 1px solid #ccc;
  overflow: hidden;
}
</style>