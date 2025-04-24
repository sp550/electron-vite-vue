**Priority 1: Core Functionality & Stability**
toggle through notes according to day is broken
add new patient - error on entering umrn
patient lists for different days, add and remove functionality.
**Priority 2: Basic UI & Configuration**
- Quick add feature (inspired by bloodproducts generator).
- Display config.json for debugging.
- Basic settings/config implementation (perhaps a new vue component)
- Basic common hotkeys.

**Priority 3: Advanced UI & Editor Enhancements**
*ensure the AI knows to use Vuetify3 library*

 toggle sidebar left/right.
- Title bar display options (small, medium, large).
 - material design z-axis heights for all

 - Patient list
  move patient list related menu options to a new 3 dot menu next to patient list subheader


- Monaco editor integration:
  - Insert options from previous project.
  - Implement templates and snippets.
  - Change font to non-monospace.


Sort by custom order and frag FUnctionality is a Pain to implement becuase it keeps breaking, lets prioritise it for later


**Post Minimal Functional Product**
**Priority 4: Additional Features**
- Parse additional patient content (issues and plan).
/- import notes and patient database from plaintext ( i guess this can be used for migration from notepad-helper too!)
**Priority 5: Large-Scale Features**
keyboard nav
- Auto-backup for each note (own DB with one-minute backups and history revert icon).
- Todo list for patients.
- Issues extractor.
- Report generator.

- Button with dropdown menu to open various directories.
- Refactor and re-optimize code for clarity and maintainability.

****ui polishes****
right click menus
 - patient list for delete, edit etc