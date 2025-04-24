// src/main.ts
import { createApp } from "vue";
import { isRef } from "vue";
import App from "./App.vue";
// import router from './router'; // Remove this line
import vuetify from "./plugins/vuetify";
// import './styles/main.scss'; // Import global styles if you have them
import Sortable from "sortablejs"

const app = createApp(App);

app.directive("sortable", {
  mounted(el, binding) {
    const listRef = binding.value.list;
    if (!listRef || (!isRef(listRef) && !Array.isArray(listRef))) {
      console.error(
        "v-sortable requires a value with a 'list' property (a ref or array)."
      );
      return;
    }
    new Sortable(el, {
      animation: 150,
      onEnd(evt: any) {
        // Get the current array from the ref (or directly if not a ref)
        const currentList = isRef(listRef) ? listRef.value : listRef;
        if (Array.isArray(currentList)) {
          // Update the array order using splice
          const movedItem = currentList.splice(evt.oldIndex!, 1)[0];
          currentList.splice(evt.newIndex!, 0, movedItem);
          // Create a new copy of the ordered array
          const newOrder = [...currentList];
          // If using a ref, update its value
          if (isRef(listRef)) {
            listRef.value = newOrder;
          }
          // Call the onSortEnd callback with the new order
          if (typeof binding.value.onSortEnd === "function") {
            binding.value.onSortEnd(newOrder);
          }
        } else {
          console.error("currentList is not an array.");
        }
      },
    });
  },
});
app.use(vuetify);

app.mount("#app");

