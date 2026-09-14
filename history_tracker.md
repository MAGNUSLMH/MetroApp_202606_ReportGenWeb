# Report History Tracker Design

This document describes how undo/redo history should work for the report page, so future changes can follow the same model.

## 1. Overall Goals

- Provide **Undo** and **Redo** buttons that apply to all report content.
- Track **differences only**, not full-page snapshots.
- History applies to:
  - Top fault description
  - Start date controls
  - Event rows (time + description, plus row add/delete/move/replace)
  - Memo section (mode, text, delay minutes)
  - Bottom summary fields (Finding, Root Cause, Action Taken, Resume time — each mode + text)
- Do **not** track translation tab or Smartfill UI, except when Smartfill changes report content.
- History persists across page reloads (stored in `localStorage`).
- Redo stack respects branching: performing a new action after one or more undos clears the redo stack (new timeline).


## 2. Data Structures

### 2.0 Current Implementation Snapshot (2026-09)

### 2.0.5 Recent Updates (2026-09-14)

This subsection summarizes the latest changes applied to the codebase so future updates can consider their impact on history.

- **Memo (備注) mode/history fixes**
  - When switching memo mode to **DELAY** ("Train delay XX mins"), the numeric minutes input `memo-delay-mins` is now cleared to an empty string so each DELAY selection starts from a blank minutes box.
  - `attachMemoModeWithHistory()` no longer relies on `_historyPrevText` stored on focus; it reads the previous memo text directly from the DOM at the start of the `change` handler and falls back safely for the previous mode.
  - This stabilizes undo/redo for sequences involving TBC/無字/FREE and DELAY (including changing the minutes), ensuring mode + text history is consistent.

- **Summary (Finding, Root Cause, Action Taken) mode/history fixes**
  - `attachSummaryModeWithHistory()` was updated to mirror the improved memo pattern:
    - Previous mode is taken from `_historyPrevMode` (set on focus), with a fallback to the current value.
    - Previous text is read directly from the associated textarea at the start of `change`.
  - This prevents stale mode/text being recorded and fixes odd undo sequences (e.g. jumping back to TBC too early).

- **Resume time mode/history + FREE behavior**
  - `applyResumeTimeModeFromSelect()` now **always clears the resume-time value** when switching to FREE, giving a brand-new manual textbox with placeholder `"輸入..."`, regardless of whether the previous mode was TBC or RESOLVED.
  - `attachResumeTimeModeWithHistory()` was updated with the same pattern as memo/summary: previous mode from `_historyPrevMode` (with fallback) and previous text from the DOM.
  - Together, these changes make resume-time mode + text history behave consistently and align FREE behavior with other summary fields.

- **History clearing helper and irreversible operations**
  - A new helper `clearHistoryStacks()` was added in `report_script.js` and exported as `window.clearHistoryStacks`:
    - Clears `undoStack` and `redoStack` in memory.
    - Removes `HISTORY_STORAGE_KEY` from `localStorage`.
    - Updates the Undo/Redo toolbar button state.
  - `resetToDefaultState()` now calls `clearHistoryStacks()` so after a full reset, Undo/Redo are disabled and previous history is discarded.
  - `handleCompleteTemplateOverwrite()` in `smartfill_script.js` now calls `clearHistoryStacks()` **after** applying a template, instead of recording a `replaceRows` entry, making full template adoption intentionally **irreversible** via Undo/Redo.

- **History toolbar visibility**
  - In `general_script.js`, `showTab(name)` now toggles the visibility of `.history-toolbar`:
    - Visible only when `name === "report"`.
    - Hidden when switching to the **英文翻譯** (`translate-main`) or **快速輸入** (`smartfill-main`) tabs.
  - This keeps Undo/Redo controls scoped to the report page, avoiding confusion on other tabs.

These updates are reflected in the sections below (memo and summary behavior, template overwrite, toolbar visibility, and history clearing). Future changes should preserve these invariants unless the design is intentionally revised.


This section explains what is already implemented in the codebase as of the latest changes, so the next AI agent can extend or adjust the history system safely.

**Files involved:**
- `report_script.js` — owns history stacks, Undo/Redo button wiring, and most field tracking.
- `general_script.js` — provides `scrollFieldIntoViewWithHeaderOffset` and shared helpers.
- `smartfill_script.js` — calls history helpers for Smartfill adoption and template overwrite.
- `translator_script.js` — adopts translations and scrolls to updated fields.

**Key globals in `report_script.js`:**

```js
const HISTORY_STORAGE_KEY = "fault_report_history_v1";
let undoStack = [];
let redoStack = [];
let isApplyingHistory = false;
```

Undo/Redo buttons:

```js
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
```

Toolbar state:

```js
function updateUndoRedoButtonState() {
  if (undoBtn) {
    undoBtn.disabled = undoStack.length === 0;
  }
  if (redoBtn) {
    redoBtn.disabled = redoStack.length === 0;
  }
}
```

History persistence:

```js
function saveHistoryToStorage() {
  try {
    const payload = { undoStack, redoStack };
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function loadHistoryFromStorage() {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const payload = JSON.parse(raw);
      if (payload && Array.isArray(payload.undoStack) && Array.isArray(payload.redoStack)) {
        undoStack = payload.undoStack;
        redoStack = payload.redoStack;
      }
    } else {
      undoStack = [];
      redoStack = [];
    }
  } catch (e) {
    undoStack = [];
    redoStack = [];
  }
  updateUndoRedoButtonState();
}
```

Timeline integration (new action clears redo):

```js
function pushHistoryEntry(entry) {
  if (!entry || !Array.isArray(entry.changes) || !entry.changes.length) {
    return;
  }
  undoStack.push(entry);
  redoStack = []; // new timeline
  updateUndoRedoButtonState();
  saveHistoryToStorage();
}
```

Undo/Redo handlers:

```js
function handleUndoClick() {
  if (!undoStack.length) return;
  const entry = undoStack.pop();
  redoStack.push(entry);
  applyHistoryEntry(entry, "undo");
  updateUndoRedoButtonState();
  saveHistoryToStorage();
}

function handleRedoClick() {
  if (!redoStack.length) return;
  const entry = redoStack.pop();
  undoStack.push(entry);
  applyHistoryEntry(entry, "redo");
  updateUndoRedoButtonState();
  saveHistoryToStorage();
}
```

Undo/Redo toolbar initial state:

- In `index.html`, both buttons start disabled:

```html
<button id="undo-btn" class="history-btn" type="button" aria-label="復原最近變更" disabled>↩ Undo</button>
<button id="redo-btn" class="history-btn" type="button" aria-label="重做最近復原" disabled>↪ Redo</button>
```

Visibility across tabs:

- The history toolbar (`.history-toolbar`) is only visible on the **report** tab.
- In `general_script.js`, `showTab(name)` toggles its visibility:

```js
const historyToolbar = document.querySelector(".history-toolbar");

function showTab(name) {
  // ... existing section switching logic ...

  if (historyToolbar) {
    if (name === "report") {
      historyToolbar.classList.remove("hidden");
    } else {
      historyToolbar.classList.add("hidden");
    }
  }

  updatePageTitle(name);
}
```

This ensures Undo/Redo controls are hidden on the **英文翻譯** and **快速輸入** pages.

**Exported helpers from `report_script.js` for other scripts:**

```js
window.buildExportClipboardContent =
  window.buildExportClipboardContent || buildExportClipboardContent;
window.pushHistoryEntry = window.pushHistoryEntry || pushHistoryEntry;
window.makeFieldChange = window.makeFieldChange || makeFieldChange;
window.recordSmartfillFieldChange =
  window.recordSmartfillFieldChange || recordSmartfillFieldChange;
```

These are used by `smartfill_script.js` to record Smartfill-related changes.

Additional helper for clearing history:

```js
function clearHistoryStacks() {
  undoStack = [];
  redoStack = [];
  updateUndoRedoButtonState();
  try {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {}
}

window.clearHistoryStacks = window.clearHistoryStacks || clearHistoryStacks;
```

- `clearHistoryStacks()` clears both in-memory stacks and the persisted history, and updates the toolbar state.
- This is used when resetting the report and after full template adoption.


### 2.0.1 Current Change Types Implemented

- `type: "field"` — simple value changes (inputs, textareas, selects).
- `type: "addRow"` — Smartfill appends one new event row.
- `type: "replaceRows"` — Smartfill template overwrite replaces all event rows and related summary content.

The remaining planned types (`deleteRow`, `moveRow`) are not yet implemented, but stubs can be added following the same pattern as `addRow` and `replaceRows`.


### 2.0.2 Field Tracking Helpers

Generic field change creation:

```js
function makeFieldChange(scope, fieldId, rowId, prevValue, nextValue) {
  if (prevValue === nextValue) return null;
  return {
    type: "field",
    target: {
      scope,
      fieldId,
      rowId: rowId || null,
    },
    prev: prevValue,
    next: nextValue,
  };
}
```

Attach tracking to a field:

```js
function attachTrackedField(scope, fieldId, element, rowId) {
  if (!element) return;

  element.addEventListener("focus", function () {
    element.dataset.historyPrevValue = element.value;
  });

  element.addEventListener("change", function () {
    if (isApplyingHistory) return;
    const prev = element.dataset.historyPrevValue;
    const next = element.value;
    const change = makeFieldChange(scope, fieldId, rowId, prev, next);
    if (!change) return;
    pushHistoryEntry({
      timestamp: Date.now(),
      changes: [change],
    });
  });
}
```

**Where this is currently used:**

- Fault Description (top textarea): `scope: "top"`, `fieldId: "fault-description"`.
- Start date selects: `scope: "startDate"`, `fieldId: "start-date-year"`, etc.
- Memo mode/text/delay: `scope: "memo"`, `fieldId: "memo-mode"`, `"memo-text"`, `"memo-delay-mins"`.
- Summary fields (Finding, Root Cause, Action Taken, Resume time):
  - mode selects: `scope: "summary"`, `fieldId: "finding-mode"`, ...
  - textareas: `scope: "summary"`, `fieldId: "finding"`, `"root-cause"`, `"action-taken"`, `"resume-time"`.
- Row descriptions: `scope: "row"`, `fieldId: "desc"`, `rowId: rowEl.dataset.rowId`.
- Row time via popup OK: explicitly calls `makeFieldChange("row", "time", rowId, prev, next)`.


### 2.0.3 Smartfill Field Adoption & Template Overwrite

**Field adoption via Smartfill overlay** (`smartfill_script.js`):

When a Smartfill chip is applied to a field in apply mode:

```js
prepareSummaryFieldForManualModeIfNeeded(field);

if (applyText) {
  const prev = 'value' in field ? field.value : field.textContent;
  const next = applyText;

  if ('value' in field) {
    field.value = next;
  } else {
    field.textContent = next;
  }

  if (field.tagName === 'TEXTAREA') {
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
  }

  flashUpdatedField(field);

  if (typeof window.recordSmartfillFieldChange === 'function') {
    window.recordSmartfillFieldChange(field, prev, next);
  }
}

exitSmartfillApplyFlow();
```

`recordSmartfillFieldChange` maps the DOM element to `scope/fieldId/rowId` via `getHistoryTargetForFieldElement` and pushes a `field` history entry.


**Smartfill add row** (`addSequenceRowFromSmartfill` in `report_script.js`):

```js
const change = {
  type: "addRow",
  rowId,
  index,
  content: { time: "", desc },
};
pushHistoryEntry({ timestamp: Date.now(), changes: [change] });
```

`applyHistoryChange` handles undo/redo for `type: "addRow"`.


**Smartfill template overwrite** (`handleCompleteTemplateOverwrite` in `smartfill_script.js`):

Originally this captured `prevRows`/`nextRows` and recorded a `replaceRows` history entry plus field changes, making template adoption undoable.

As of the latest changes, **full template adoption is intentionally irreversible**:

- After the user confirms both prompts, the template is applied:
  - Fault Description
  - Finding, Root Cause, Action Taken
  - Sequence via `replaceSequenceRowsFromSmartfill`.
- Then history is cleared:

```js
if (typeof window.clearHistoryStacks === 'function') {
  window.clearHistoryStacks();
}
```

This design guarantees that once a template has been fully adopted, previous report content and history cannot be restored via Undo/Redo.


### 2.0.4 Translation Adoption & Scrolling

Translations do **not** contribute to history, but when a translation is adopted for a report field, we:

- Apply the translation to the selected report textarea.
- Flash the field visually with `translate-updated-flash`.
- Switch back to the report tab.
- Resize that textarea.
- Scroll it into view under the fixed header + title bar using `scrollFieldIntoViewWithHeaderOffset`.

`scrollFieldIntoViewWithHeaderOffset` is defined in `general_script.js` and exported as:

```js
window.scrollFieldIntoViewWithHeaderOffset =
  window.scrollFieldIntoViewWithHeaderOffset || scrollFieldIntoViewWithHeaderOffset;
```

In `translator_script.js`, both translation adoption paths now call:

```js
function performResizeAndScroll() {
  // resizeToContent(targetEl) ...
  if (typeof window.scrollFieldIntoViewWithHeaderOffset === "function") {
    window.scrollFieldIntoViewWithHeaderOffset(targetEl);
  }
}
```

This ensures Finding / Root Cause / Action Taken / Resume time and other "轉英文" targets are auto-scrolled into comfortable view when updated.


## 2. Data Structures

### 2.1 History stacks

We keep two stacks in memory:

```js
let undoStack = [];  // past actions we can undo
let redoStack = [];  // actions we can redo (after an undo)
```

Each entry in these stacks is a **history action**:

```js
const historyEntry = {
  timestamp: Date.now(),
  changes: [ /* one or more change objects */ ],
};
```

- `changes` is an array of **delta objects** that know how to undo/redo themselves.
- Each user-visible action (e.g. editing a field, changing a dropdown, adding/removing/moving a row, Smartfill apply) should push **one** `historyEntry`.

### 2.2 Change objects

We use different `type` values for different kinds of changes.

#### 2.2.1 Simple field value change

Used for text inputs/textarea and dropdowns:

- Top fault description
- Start date selects (year/month/day)
- Memo: mode select, text, delay mins
- Summary fields: mode selects + textareas
- Row time and description fields

```js
const change = {
  type: "field",
  target: {
    scope: "top" | "startDate" | "memo" | "summary" | "row",
    fieldId: string,      // e.g. "fault-description", "start-date-year", "memo-mode", "finding", "time", "desc" ...
    rowId: string | null, // only for scope === "row" (rowEl.dataset.rowId)
  },
  prev: string,           // previous field value
  next: string,           // new field value
};
```

- **Undo**: set the target field to `prev`.
- **Redo**: set the target field to `next`.

We record these when an edit is logically complete (e.g. on `change` or batched `input` events).

#### 2.2.2 Add row

For adding a row (manual "向下加行", Smartfill append, etc.):

```js
const change = {
  type: "addRow",
  rowId: string,      // new row's dataset.rowId
  index: number,      // position in rowsContainer.children at time of change
  content: {
    time: string,
    desc: string,
  },
};
```

- **Undo**: remove this row at `index` (if present).
- **Redo**: reinsert row at `index`, restore `content`, reattach row events.

#### 2.2.3 Delete row

For deleting a row (via row actions popup):

```js
const change = {
  type: "deleteRow",
  rowId: string,
  index: number,      // original index before deletion
  content: {
    time: string,
    desc: string,
  },
};
```

- **Undo**: reinsert the row at `index` and restore `content`.
- **Redo**: remove it again.

#### 2.2.4 Move row

For moving rows up/down ("向上" / "向下"):

```js
const change = {
  type: "moveRow",
  rowId: string,
  fromIndex: number,
  toIndex: number,
};
```

- **Undo**: move the row back from `toIndex` to `fromIndex`.
- **Redo**: move from `fromIndex` to `toIndex`.

This change should be created around `swapRows(sourceRow, targetRow, direction)`.

#### 2.2.5 Replace all rows (Smartfill apply mode)

> Note: as of the latest changes, full template adoption via Smartfill **clears history** instead of recording a `replaceRows` change, making it irreversible. The structure below applies to other uses of `replaceRows` if reintroduced.

When `replaceSequenceRowsFromSmartfill(descriptions)` rebuilds all event rows:

```js
const change = {
  type: "replaceRows",
  prevRows: [
    { rowId: string, time: string, desc: string },
    // ... previous rows in order
  ],
  nextRows: [
    { rowId: string, time: string, desc: string },
    // ... new rows in order
  ],
};
```

- **Undo**: rebuild rows from `prevRows` (clear container, recreate rows, reattach events).
- **Redo**: rebuild rows from `nextRows`.

This is still difference-based (old structure vs new structure) but at a batch level.


## 3. What We Track (Scope)

### 3.1 Top field

- Fault Description textarea (`id="fault-description"`)
  - `type: "field"; scope: "top"; fieldId: "fault-description"`

### 3.2 Start date controls

- `start-date-year` select
- `start-date-month` select
- `start-date-day` select

Each as:

```js
{ type: "field", scope: "startDate", fieldId: "start-date-year" /* etc. */ }
```

### 3.3 Event sequence (rows)

For each `.note-row`:

- Time input (`.time-input.value`)
  - `scope: "row"; fieldId: "time"; rowId: rowEl.dataset.rowId`
- Description textarea (`.desc-input.value`)
  - `scope: "row"; fieldId: "desc"; rowId: rowEl.dataset.rowId`

Structural operations on rows:

- `type: "addRow"` (new row inserted)
- `type: "deleteRow"` (row removed)
- `type: "moveRow"` (row order changed)
- `type: "replaceRows"` (Smartfill replaces entire list)

### 3.4 Memo section

- Memo mode select (`id="memo-mode"`)
  - `scope: "memo"; fieldId: "memo-mode"`
- Memo text textarea (`id="memo-text"`)
  - `scope: "memo"; fieldId: "memo-text"`
- Memo delay minutes input (`id="memo-delay-mins"`)
  - `scope: "memo"; fieldId: "memo-delay-mins"`

Special behaviors:

- When switching memo mode to **DELAY** ("Train delay XX mins"):
  - The minutes input (`memo-delay-mins`) is cleared (`value = ""`).
  - The memo text is initialized to `"Train delay  mins"` unless it already matches `Train delay N mins`.
- Memo mode changes are recorded via `attachMemoModeWithHistory()` as a **single history entry containing both mode and text changes**.
- Memo delay minutes changes are tracked separately via `attachTrackedField("memo", "memo-delay-mins", ...)`, and undo/redo for minutes keeps the memo text in sync.

### 3.5 Bottom summary fields

Each summary block has a mode select + textarea.

**Finding**
- Mode select (`id="finding-mode"`)
  - `scope: "summary"; fieldId: "finding-mode"`
- Textarea (`id="finding"`)
  - `scope: "summary"; fieldId: "finding"`

**Root Cause**
- Mode select (`id="root-cause-mode"`)
  - `scope: "summary"; fieldId: "root-cause-mode"`
- Textarea (`id="root-cause"`)
  - `scope: "summary"; fieldId: "root-cause"`

**Action Taken**
- Mode select (`id="action-taken-mode"`)
  - `scope: "summary"; fieldId: "action-taken-mode"`
- Textarea (`id="action-taken"`)
  - `scope: "summary"; fieldId: "action-taken"`

**Resume time**
- Mode select (`id="resume-time-mode"`)
  - `scope: "summary"; fieldId: "resume-time-mode"`
- Textarea (`id="resume-time"`)
  - `scope: "summary"; fieldId: "resume-time"`

Special behaviors:

- Modes:
  - `TBC`: disabled, value and placeholder set to `"TBC"`.
  - `RESOLVED`: disabled, value set to the bottommost event time (`getBottommostEventTime()`), placeholder `"Time in BOTTOMMOST RECORD"`.
  - `FREE`: enabled, placeholder `"輸入..."`, and **value is always cleared to empty** when switching into FREE, to behave as a brand-new manual textbox.
- Mode changes are tracked together with the resume-time text via `attachResumeTimeModeWithHistory()`.


## 4. What We Explicitly Do NOT Track

To keep history focused on report content and avoid translation complexity, we do **not** track:

- Any fields in `translate-main`:
  - `english-original`, `english-edited`, `english-google`,
  - `first-translate-chinese`, `second-translate-chinese`, etc.
- Smartfill-only UI state:
  - `smartfill-search`, `smartfill-sort`, `smartfill-toggle-all`, `smartfill-notes`,
  - Expand/collapse state in `#smartfill-dashboard`.

However, **when Smartfill applies text into report fields**, those edits are tracked because they modify the report-scoped fields listed above.


## 5. Timeline Rules (Undo / Redo Behavior)

The stacks follow the standard branching rule:

- On **new user action** (any tracked change):
  - Push a `historyEntry` to `undoStack`.
  - Clear `redoStack` (start a new timeline).

- On **Undo**:
  - Pop `entry` from `undoStack`.
  - Apply all `entry.changes` in **reverse order**, using each change's `prev` or `prevRows`/`fromIndex`.
  - Push `entry` to `redoStack`.

- On **Redo**:
  - Pop `entry` from `redoStack`.
  - Apply all `entry.changes` in **forward order**, using each change's `next` or `nextRows`/`toIndex`.
  - Push `entry` to `undoStack`.

Example timeline:

- Execute A → `undoStack = [A]`, `redoStack = []`
- Execute B → `undoStack = [A, B]`, `redoStack = []`
- Execute C → `undoStack = [A, B, C]`, `redoStack = []`
- Undo C → `undoStack = [A, B]`, `redoStack = [C]`
- Undo B → `undoStack = [A]`, `redoStack = [C, B]`
- Execute D → `undoStack = [A, D]`, `redoStack = []` (B and C discarded, new timeline)


## 6. Persistence Across Reloads

History should persist across page reloads, alongside the existing content state.

- Existing report content is stored under:
  - `STORAGE_KEY = "fault_report_form_v1"` (from `report_script.js`).

- History stacks will be stored under a new key, e.g.:
  - `HISTORY_STORAGE_KEY = "fault_report_history_v1"`.

Stored structure:

```js
const savedHistory = {
  undoStack: [ /* serialized historyEntry objects */ ],
  redoStack: [ /* serialized historyEntry objects */ ],
};

window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(savedHistory));
```

On load:

1. Restore content using existing `loadStateFromStorage()` / `applyState()`.
2. Restore history stacks from `HISTORY_STORAGE_KEY` (if present).
3. Wire Undo/Redo buttons to operate on the in-memory stacks.


## 7. UI Requirements for Undo/Redo Buttons

- Two rectangular buttons: **Undo** and **Redo**.
- Placed near the top of the screen, fixed so they remain visible on scroll.
- Styling:
  - Background: black
  - Text color: white
  - Border radius: 0 (no rounding)
- Must **not** cause the event rows to touch them:
  - Preserve comfortable spacing similar to the existing cogwheel scroll behavior.


## 8. Implementation Notes

- All history-aware changes should be triggered from `report_script.js` (this script owns the report page state).
- Prefer to group related changes into a single `historyEntry` (e.g. Smartfill replace, moving a row, etc.), rather than one entry per field.
- For typing in textareas, consider:
  - Debouncing or batching multiple keystrokes into one history entry to avoid an excessively long undo stack.
- When applying undo/redo:
  - Use existing helpers (`applyState`, `validateTimeOrder`, `updateExportButtonState`, `setupAutoResize`) as appropriate to keep UI consistent.
- When **resetting** the report (via the 🗑️ button), call `clearHistoryStacks()` so Undo/Redo are disabled and previous history is discarded.
- After **full Smartfill template adoption**, also call `clearHistoryStacks()` to make the adoption irreversible.
