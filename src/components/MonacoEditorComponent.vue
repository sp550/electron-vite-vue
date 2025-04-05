<template>
   <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { editor, languages, KeyMod, KeyCode } from 'monaco-editor';
import { initializeMedicalTemplates,initializeMedicalLanguage } from '@/monacoLanguage';
// Props using defineProps
const props = defineProps({
   modelValue: {
      type: String,
      required: true,
   },
   language: {
      type: String,
      default: 'markdown', // Default to markdown for MVP
   },
   options: {
      type: Object,
      default: () => ({}),
   },
   readOnly: {
      type: Boolean,
      default: false,
   },
});

// Emits using defineEmits
const emit = defineEmits(['update:modelValue', 'editorMounted']);

const editorContainer = ref<HTMLElement | null>(null);
let editorInstance: editor.IStandaloneCodeEditor | null = null;
let preventUpdate = false; // Flag to prevent feedback loop with v-model

const defaultOptions: editor.IStandaloneEditorConstructionOptions = {
   // theme: 'vs-dark', // or 'vs' for light
   automaticLayout: true, // Adjusts editor layout on container resize
   minimap: { enabled: true },
   wordWrap: 'on', // Enable word wrapping
   scrollBeyondLastLine: false,
   fontSize: 14,
   readOnly: props.readOnly,
};

onMounted(async () => {
   await nextTick(); // Ensure the container is fully rendered

   if (editorContainer.value) {
      // Merge default options with provided options
      const finalOptions = { ...defaultOptions, ...props.options, readOnly: props.readOnly };

      editorInstance = editor.create(editorContainer.value, {
         value: props.modelValue,
         language: props.language,
         ...finalOptions,
      });

      // Listen for content changes and emit update:modelValue
      editorInstance.onDidChangeModelContent(() => {
         if (editorInstance && !preventUpdate) {
            const currentValue = editorInstance.getValue();
            if (currentValue !== props.modelValue) { // Only emit if value actually changed
               emit('update:modelValue', currentValue);
            }
         }
      });

      emit('editorMounted', editorInstance); // Emit event when editor is ready
   } else {
      console.error("Monaco Editor container not found.");
   }

   initializeMedicalLanguage();
   initializeMedicalTemplates();
});

onBeforeUnmount(() => {
   if (editorInstance) {
      editorInstance.dispose();
      editorInstance = null;
   }
});

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
   if (editorInstance) {
      const editorValue = editorInstance.getValue();
      if (newValue !== editorValue) {
         preventUpdate = true; // Prevent emitting the change back
         // Use pushEditOperations for better undo/redo stack handling
         editorInstance.executeEdits('external', [{
            range: editorInstance.getModel()?.getFullModelRange() ?? new editor.Range(1, 1, 1, 1),
            text: newValue,
            forceMoveMarkers: true
         }]);
         // Or simpler way: editorInstance.setValue(newValue); but might reset undo stack
         preventUpdate = false;
      }
   }
});

// Watch for changes in readOnly prop
watch(() => props.readOnly, (newReadOnlyValue) => {
   if (editorInstance) {
      editorInstance.updateOptions({ readOnly: newReadOnlyValue });
   }
});

// Expose editor instance if needed (optional)
// defineExpose({ editorInstance });

</script>

<style scoped>
.monaco-editor-container {
   width: 100%;
   height: 100%;
   /* Ensure container has height */
   min-height: 300px;
   /* Example minimum height */
   border: 1px solid #ccc;
   /* Add a border for visibility */
   overflow: hidden;
   /* Prevent editor overflow issues */
}
</style>