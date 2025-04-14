import "vuetify/styles";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "@mdi/font/css/materialdesignicons.css"; // Ensure you install @mdi/font

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: "mdi", // This is already the default value - only for display purposes
  },
  theme: {
    defaultTheme: "light", // Or 'dark'
    themes: {
      light: {
        colors: {
          primary: '#3f51b5', // A darker shade of blue
          secondary: '#607d8b', // A muted gray-blue
          accent: '#9fa8da', // A lighter shade of blue
          error: '#f44336', // Standard error color
          info: '#29b6f6', // Standard info color
          success: '#66bb6a', // Standard success color
          warning: '#ffca28', // Standard warning color
        },
      },
    },
  },
});
