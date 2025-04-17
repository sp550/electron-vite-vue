**Priority 1: Core Functionality & Stability**
refactor app.vue
- Import patient list from external program.
- Manual plain text export (including .txt export and automated regular export).
**Priority 2: Basic UI & Configuration**
- Display config.json for debugging.
- Basic settings/config implementation.
- Basic common hotkeys.
- Button with dropdown menu to open various directories.

**Priority 3: Advanced UI & Editor Enhancements**
- Three-dot menu with extended options (toggle auto-save, multiple directories, settings).
- Settings icon opens modal/card (move "change data directory" button inside).
- Sidebar on hover; toggle sidebar left/right.
- Title bar display options (small, medium, large).
- Monaco editor integration:
  - Insert options from previous project.
  - Implement templates and snippets.
  - Change font to non-monospace.

**Priority 4: Additional Features**
- Auto-backup for each note (own DB with one-minute backups and history revert icon).
- Parse additional patient content (issues and plan).
- Quick add feature (inspired by bloodproducts generator).
/- import notes and patient database from plaintext ( i guess this can be used for migration from notepad-helper too!)
**Priority 5: Large-Scale Features**
- Todo list for patients.
- Issues extractor.
- Report generator.

**Post Minimal Functional Product**
- Refactor and re-optimize code for clarity and maintainability.