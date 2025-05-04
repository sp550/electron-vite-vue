<template>
  <Suspense>
    <template #default>
      <App />
    </template>
    <!-- Optional: Fallback content while App is loading -->
    <template #fallback>
      <div>Loading application...</div>
    </template>
  </Suspense>
</template>

<script setup lang="ts">
import App from './App.vue';
</script>

<style scoped>
/* Add any root-specific styles here if needed */
</style>