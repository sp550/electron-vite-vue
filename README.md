**Priority 1: Core Functionality & Stability**
- Import patient list from external program.
sort by location, name (while retaining the current custom sort)
**Priority 2: Basic UI & Configuration**
- Display config.json for debugging.
- Basic settings/config implementation (perhaps a new vue component)
- Basic common hotkeys.

**Priority 3: Advanced UI & Editor Enhancements**
*ensure the AI knows to use Vuetify3 library*
- Settings icon opens modal/card (move "change data directory" button inside).
- Sidebar on hover; toggle sidebar left/right.
- Title bar display options (small, medium, large).
 - material design z-axis heights for all

 - Patient list
  - FAB for edit patient list
  - footer at the bottom of navbar list containing info about something (currently debug info)
  draggable navbar width
  move patient list related menu options to a new 3 dot menu next to patient list subheader


- Monaco editor integration:
  - Insert options from previous project.
  - Implement templates and snippets.
  - Change font to non-monospace.


Sort by custom order and frag FUnctionality is a Pain to implement becuase it keeps breaking, lets prioritise it for later
**Priority 4: Additional Features**
- Parse additional patient content (issues and plan).
- Quick add feature (inspired by bloodproducts generator).
/- import notes and patient database from plaintext ( i guess this can be used for migration from notepad-helper too!)
**Post Minimal Functional Product**
**Priority 5: Large-Scale Features**
keyboard nav
- Auto-backup for each note (own DB with one-minute backups and history revert icon).
- Todo list for patients.
- Issues extractor.
- Report generator.

- Button with dropdown menu to open various directories.
- Refactor and re-optimize code for clarity and maintainability.