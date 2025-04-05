// src/main.ts
import { createApp } from "vue";
import App from "./App.vue";
// import router from './router'; // Remove this line
import vuetify from "./plugins/vuetify";
// import './styles/main.scss'; // Import global styles if you have them

// Log if electronAPI is available (for debugging)
if (window.electronAPI) {
  console.log("electronAPI found on window object.");
} else {
  console.warn(
    "electronAPI NOT found on window object. Check preload script and contextBridge."
  );
}

const app = createApp(App);

// app.use(router); // Remove this line
app.use(vuetify);

app.mount("#app");

console.log("Vue app mounted.");
