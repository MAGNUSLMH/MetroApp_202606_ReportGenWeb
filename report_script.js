// report_script.js
// Logic specific to the report UI: event rows, time popups, memo, resume time,
// validation, export, Excel, WhatsApp, and local storage persistence.

const rowsContainer = document.getElementById("rows-container");
const exportBtn = document.getElementById("export-btn");
const rowTemplate = document.getElementById("row-template");

const faultDescriptionInput = document.getElementById("fault-description");
const findingInput = document.getElementById("finding");
const rootCauseInput = document.getElementById("root-cause");
const actionTakenInput = document.getElementById("action-taken");
const resumeTimeInput = document.getElementById("resume-time");
const resumeTimeModeSelect = document.getElementById("resume-time-mode");

const findingModeSelect = document.getElementById("finding-mode");
const rootCauseModeSelect = document.getElementById("root-cause-mode");
const actionTakenModeSelect = document.getElementById("action-taken-mode");

const startDateYearSelect = document.getElementById("start-date-year");
const startDateMonthSelect = document.getElementById("start-date-month");
const startDateDaySelect = document.getElementById("start-date-day");
const startDateError = document.getElementById("start-date-error");

const resetBtn = document.getElementById("reset-btn");

const memoModeSelect = document.getElementById("memo-mode");
const memoTextInput = document.getElementById("memo-text");
const memoDelayWrapper = document.getElementById("memo-delay-wrapper");
const memoDelayMinsInput = document.getElementById("memo-delay-mins");

const excelBtn = document.getElementById("excel-btn");
const whatsappBtn = document.getElementById("whatsapp-btn");
const WHATSAPP_GROUP_URL =
  "https://chat.whatsapp.com/Hpseqf55gLrCsgoUtEtTn1?s=cl&p=a&mlu=0&ilr=0";

// Undo/redo toolbar buttons
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");

let rowIdCounter = 0;

const STORAGE_KEY = "fault_report_form_v1";
const HISTORY_STORAGE_KEY = "fault_report_history_v1";

// In-memory history stacks
let undoStack = [];
let redoStack = [];
let isApplyingHistory = false;


function formatTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hh = h < 10 ? "0" + h : String(h);
  const mm = m < 10 ? "0" + m : String(m);
  return hh + ":" + mm;
}

function parseTimeString(str) {
  if (!str) return null;
  const m = str.trim().match(/^([0-9]{1,2}):([0-9]{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function isValidDateNumeric(year, month, day) {
  if (!year || !month || !day) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

function validateStartDate() {
  if (
    !startDateYearSelect ||
    !startDateMonthSelect ||
    !startDateDaySelect ||
    !startDateError
  ) {
    return true;
  }

  const year = parseInt(startDateYearSelect.value, 10);
  const month = parseInt(startDateMonthSelect.value, 10);
  const day = parseInt(startDateDaySelect.value, 10);

  if (!isValidDateNumeric(year, month, day)) {
    startDateError.textContent = "開始日期無效，請重新選擇。";
    startDateError.classList.remove("hidden");
    updateExportButtonState();
    return false;
  }

  startDateError.textContent = "";
  startDateError.classList.add("hidden");
  updateExportButtonState();
  return true;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function refreshStartDateDays(year, month) {
  if (!startDateDaySelect) return;
  const previousDay = parseInt(startDateDaySelect.value, 10);
  const maxDay = getDaysInMonth(year, month);

  startDateDaySelect.innerHTML = "";
  for (let d = 1; d <= maxDay; d += 1) {
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = String(d);
    startDateDaySelect.appendChild(opt);
  }

  let dayToSet = previousDay;
  if (!dayToSet || dayToSet > maxDay) {
    dayToSet = maxDay;
  }
  startDateDaySelect.value = String(dayToSet);
}

function initStartDateSelectors() {
  if (!startDateYearSelect || !startDateMonthSelect || !startDateDaySelect) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const startYear = currentYear - 1;
  const endYear = currentYear + 1;

  startDateYearSelect.innerHTML = "";
  for (let y = startYear; y <= endYear; y += 1) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    startDateYearSelect.appendChild(opt);
  }
  startDateYearSelect.value = String(currentYear);

  startDateMonthSelect.innerHTML = "";
  for (let m = 1; m <= 12; m += 1) {
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = String(m);
    startDateMonthSelect.appendChild(opt);
  }
  startDateMonthSelect.value = String(currentMonth);

  refreshStartDateDays(currentYear, currentMonth);
  startDateDaySelect.value = String(currentDay);

  validateStartDate();

  startDateYearSelect.addEventListener("change", function () {
    const y = parseInt(startDateYearSelect.value, 10);
    const m = parseInt(startDateMonthSelect.value, 10) || 1;
    refreshStartDateDays(y, m);
    validateStartDate();
  });

  startDateMonthSelect.addEventListener("change", function () {
    const y = parseInt(startDateYearSelect.value, 10) || currentYear;
    const m = parseInt(startDateMonthSelect.value, 10);
    refreshStartDateDays(y, m);
    validateStartDate();
  });

  startDateDaySelect.addEventListener("change", function () {
    validateStartDate();
  });
}

function getCurrentStartDateValues() {
  if (!startDateYearSelect || !startDateMonthSelect || !startDateDaySelect) {
    return null;
  }
  return {
    year: startDateYearSelect.value,
    month: startDateMonthSelect.value,
    day: startDateDaySelect.value,
  };
}

function getBottommostEventTime() {
  const rows = Array.from(rowsContainer.querySelectorAll(".note-row"));
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const timeInputEl = row.querySelector(".time-input");
    if (!timeInputEl) continue;
    const val = timeInputEl.value.trim();
    if (val) {
      return val;
    }
  }
  return "";
}

function applyResumeTimeModeFromSelect() {
  if (!resumeTimeModeSelect || !resumeTimeInput) return;

  const mode = resumeTimeModeSelect.value;

  if (mode === "TBC") {
    resumeTimeInput.disabled = true;
    resumeTimeInput.placeholder = "TBC";
    resumeTimeInput.value = "TBC";
  } else if (mode === "RESOLVED") {
    resumeTimeInput.disabled = true;
    resumeTimeInput.placeholder = "Time in BOTTOMMOST RECORD";
    const lastTime = getBottommostEventTime();
    resumeTimeInput.value = lastTime || "";
  } else {
    // FREE
    resumeTimeInput.disabled = false;
    resumeTimeInput.placeholder = "輸入...";
    // Always give a fresh text box when switching to manual mode
    resumeTimeInput.value = "";
  }

  resumeTimeInput.style.height = "auto";
  resumeTimeInput.style.height = resumeTimeInput.scrollHeight + "px";
}


function syncResumeTimeAutoIfNeeded() {
  if (!resumeTimeModeSelect || !resumeTimeInput) return;
  if (resumeTimeModeSelect.value !== "RESOLVED") return;

  const lastTime = getBottommostEventTime();
  resumeTimeInput.value = lastTime || "";
  resumeTimeInput.style.height = "auto";
  resumeTimeInput.style.height = resumeTimeInput.scrollHeight + "px";
}

function applyMemoModeFromSelect() {
  if (!memoModeSelect || !memoTextInput) return;

  const mode = memoModeSelect.value;
  const hasDelayControls = memoDelayWrapper && memoDelayMinsInput;

  if (hasDelayControls) {
    memoDelayWrapper.classList.add("hidden");
  }

  memoTextInput.disabled = true;

  if (mode === "TBC") {
    memoTextInput.value = "TBC";
    memoTextInput.placeholder = "TBC";
  } else if (mode === "NO_DELAY") {
    memoTextInput.value = "No train delay";
    memoTextInput.placeholder = "No train delay";
    } else if (mode === "DELAY") {
    if (hasDelayControls) {
      memoDelayWrapper.classList.remove("hidden");
      memoDelayMinsInput.value = "";
      const currentVal = memoTextInput.value.trim();
      if (!/^Train delay \d+ mins$/.test(currentVal)) {
        memoTextInput.value = "Train delay  mins";
      }
      memoTextInput.placeholder = "Train delay XX mins";
      memoTextInput.disabled = true;

      memoDelayMinsInput.addEventListener("input", function () {
        const raw = memoDelayMinsInput.value.replace(/[^0-9]/g, "");
        memoDelayMinsInput.value = raw;
        const mins = raw || "";
        memoTextInput.value = mins
          ? "Train delay " + mins + " mins"
          : "Train delay  mins";
      });
    }
  } else if (mode === "NO_INJURY") {

    memoTextInput.value = "No passenger injury";
    memoTextInput.placeholder = "No passenger injury";
  } else if (mode === "NONE") {
    memoTextInput.value = "";
    memoTextInput.placeholder = "(已漏空)";
  } else if (mode === "FREE") {
    memoTextInput.disabled = false;
    memoTextInput.placeholder = "輸入...";
    if (
      memoTextInput.value === "TBC" ||
      memoTextInput.value === "No train delay" ||
      memoTextInput.value === "No passenger injury" ||
      /^Train delay \d+ mins$/.test(memoTextInput.value)
    ) {
      memoTextInput.value = "";
    }
  }

  memoTextInput.style.height = "auto";
  memoTextInput.style.height = memoTextInput.scrollHeight + "px";
}

function attachMemoModeWithHistory() {
  if (!memoModeSelect || !memoTextInput) return;

  memoModeSelect.addEventListener("focus", function () {
    memoModeSelect._historyPrevMode = memoModeSelect.value;
  });

  memoModeSelect.addEventListener("change", function () {
    if (isApplyingHistory) return;

    const prevMode = memoModeSelect._historyPrevMode || memoModeSelect.value;
    const prevText = memoTextInput.value;

    const nextMode = memoModeSelect.value;

    // Apply visual/UI changes for the memo mode, including delay controls
    // and the memo text value.
    applyMemoModeFromSelect();
    const nextText = memoTextInput.value;

    const changes = [];

    const modeChange = makeFieldChange(
      "memo",
      "memo-mode",
      null,
      prevMode,
      nextMode
    );
    if (modeChange) changes.push(modeChange);

    const textChange = makeFieldChange(
      "memo",
      "memo-text",
      null,
      prevText,
      nextText
    );
    if (textChange) changes.push(textChange);

    if (changes.length) {
      pushHistoryEntry({
        timestamp: Date.now(),
        changes: changes,
      });
    }

    // Update stored previous state for subsequent memo mode changes.
    memoModeSelect._historyPrevMode = nextMode;
  });
}



function initMemoControls() {
  if (!memoModeSelect || !memoTextInput) return;

  // Initialize memo UI based on current mode, then attach history-aware
  // handlers that treat mode+text as a single action.
  applyMemoModeFromSelect();
  attachMemoModeWithHistory();

  if (typeof setupAutoResize === "function") {
    setupAutoResize(memoTextInput);
  }

  if (memoDelayMinsInput) {
    memoDelayMinsInput.addEventListener("focus", function () {
      memoDelayMinsInput.select();
    });
  }
}


function applySummaryModeFromSelect(modeSelect, textInput) {
  if (!modeSelect || !textInput) return;

  const mode = modeSelect.value;

  if (mode === "TBC") {
    textInput.disabled = true;
    textInput.value = "TBC";
    textInput.placeholder = "TBC";
  } else {
    // FREE (手動)
    textInput.disabled = false;
    textInput.placeholder = "輸入...";
    if (textInput.value === "TBC") {
      textInput.value = "";
    }
  }

  textInput.style.height = "auto";
  textInput.style.height = textInput.scrollHeight + "px";
}

function attachSummaryModeWithHistory(modeSelect, textInput, baseFieldId) {
  if (!modeSelect || !textInput) return;

  modeSelect.addEventListener("focus", function () {
    modeSelect._historyPrevMode = modeSelect.value;
  });

  modeSelect.addEventListener("change", function () {
    if (isApplyingHistory) return;

    const prevMode = modeSelect._historyPrevMode || modeSelect.value;
    const prevText = textInput.value;

    const nextMode = modeSelect.value;

    // Apply the visual mode change first so the text reflects the
    // mode-specific default (e.g. TBC).
    applySummaryModeFromSelect(modeSelect, textInput);
    const nextText = textInput.value;

    const changes = [];

    const modeChange = makeFieldChange(
      "summary",
      baseFieldId + "-mode",
      null,
      prevMode,
      nextMode
    );
    if (modeChange) changes.push(modeChange);

    const textChange = makeFieldChange(
      "summary",
      baseFieldId,
      null,
      prevText,
      nextText
    );
    if (textChange) changes.push(textChange);

    if (changes.length) {
      pushHistoryEntry({
        timestamp: Date.now(),
        changes: changes,
      });
    }

    // After recording this change, update the stored previous state so
    // subsequent mode changes use the correct "from" values.
    modeSelect._historyPrevMode = nextMode;
  });
}



function initSummaryModeControls() {
  if (findingModeSelect && findingInput) {
    applySummaryModeFromSelect(findingModeSelect, findingInput);
    attachSummaryModeWithHistory(findingModeSelect, findingInput, "finding");
  }

  if (rootCauseModeSelect && rootCauseInput) {
    applySummaryModeFromSelect(rootCauseModeSelect, rootCauseInput);
    attachSummaryModeWithHistory(
      rootCauseModeSelect,
      rootCauseInput,
      "root-cause"
    );
  }

  if (actionTakenModeSelect && actionTakenInput) {
    applySummaryModeFromSelect(actionTakenModeSelect, actionTakenInput);
    attachSummaryModeWithHistory(
      actionTakenModeSelect,
      actionTakenInput,
      "action-taken"
    );
  }
}


function getMemoExportText() {
  if (!memoModeSelect || !memoTextInput) return "";

  const mode = memoModeSelect.value;
  const val = memoTextInput.value.trim();

  if (mode === "NONE") {
    return "";
  }

  if (mode === "DELAY") {
    if (!memoDelayMinsInput) return "";
    const mins = memoDelayMinsInput.value.replace(/[^0-9]/g, "");
    if (!mins) return "";
    return "Train delay " + mins + " mins";
  }

  if (mode === "TBC") {
    return "TBC";
  }
  if (mode === "NO_DELAY") {
    return "No train delay";
  }
  if (mode === "NO_INJURY") {
    return "No passenger injury";
  }

  return val;
}

function clearAllOrderErrors() {
  const inputs = rowsContainer.querySelectorAll(".time-input");
  inputs.forEach(function (input) {
    input.classList.remove("is-order-warning");
  });
}

function validateTimeOrder() {
  clearAllOrderErrors();
  const rows = Array.from(rowsContainer.querySelectorAll(".note-row"));
  let lastTime = null;

  rows.forEach(function (row) {
    const input = row.querySelector(".time-input");
    const t = parseTimeString(input.value);
    if (t === null) {
      return;
    }
    if (lastTime === null) {
      lastTime = t;
      return;
    }
    if (t < lastTime) {
      input.classList.add("is-order-warning");
    } else {
      lastTime = t;
    }
  });
  syncResumeTimeAutoIfNeeded();
  updateExportButtonState();
}

function hasAnyTimeError() {
  if (rowsContainer.querySelector(".time-input.is-invalid")) {
    return true;
  }

  const popups = rowsContainer.querySelectorAll(".time-popup");
  for (const popup of popups) {
    const err = popup.querySelector(".time-error");
    if (
      err &&
      !err.classList.contains("hidden") &&
      err.textContent.trim() !== ""
    ) {
      return true;
    }
  }

  const inputs = rowsContainer.querySelectorAll(".time-input");
  for (const input of inputs) {
    const val = input.value.trim();
    if (val && parseTimeString(val) === null) {
      return true;
    }
  }

  if (
    startDateError &&
    !startDateError.classList.contains("hidden") &&
    startDateError.textContent.trim() !== ""
  ) {
    return true;
  }

  if (startDateYearSelect && startDateMonthSelect && startDateDaySelect) {
    const year = parseInt(startDateYearSelect.value, 10);
    const month = parseInt(startDateMonthSelect.value, 10);
    const day = parseInt(startDateDaySelect.value, 10);
    if (!isValidDateNumeric(year, month, day)) {
      return true;
    }
  }

  return false;
}

function hasAnyTimeWarning() {
  if (rowsContainer.querySelector(".time-input.is-order-warning")) {
    return true;
  }
  return false;
}

function updateExportButtonState() {
  if (!exportBtn) return;
  exportBtn.disabled = hasAnyTimeError();
}

function hideAllPopups(except) {
  const popups = document.querySelectorAll(".time-popup");
  popups.forEach(function (popup) {
    if (popup !== except) {
      popup.classList.add("hidden");
      const err = popup.querySelector(".time-error");
      if (err) {
        err.textContent = "";
        err.classList.add("hidden");
      }
    }
  });
}

function hideAllRowActionPopups(except) {
  const menus = document.querySelectorAll(".row-actions-popup");
  menus.forEach(function (menu) {
    if (menu !== except) {
      menu.classList.add("hidden");
    }
  });
}

function scrollRowToViewportTop(rowEl) {
  if (!rowEl) return;

  const rect = rowEl.getBoundingClientRect();

  // Account for fixed header and page title bar heights
  const headerEl = document.querySelector(".app-header");
  const titleBarEl = document.getElementById("page-title-bar");

  const headerHeight =
    (headerEl ? headerEl.offsetHeight : 0) +
    (titleBarEl ? titleBarEl.offsetHeight : 0);

  // Extra spacing between row and header/title bar
  const extraOffset = 8;

  const targetTopInDocument = rect.top + window.scrollY;
  let targetScrollY = targetTopInDocument - headerHeight - extraOffset;

  if (targetScrollY < 0) {
    targetScrollY = 0;
  }

  window.scrollTo({
    top: targetScrollY,
    behavior: "smooth",
  });
}

function attachRowEvents(rowEl) {

  const timeInput = rowEl.querySelector(".time-input");
  const popup = rowEl.querySelector(".time-popup");
  const hourInput = rowEl.querySelector(".hour-input");
  const minuteInput = rowEl.querySelector(".minute-input");
  const ampmSelect = null;
  const formatRadios = [];
  const okBtn = rowEl.querySelector(".time-ok-btn");
  const cancelBtn = rowEl.querySelector(".time-cancel-btn");
  const errorBox = rowEl.querySelector(".time-error");
  const moveRowBtn = rowEl.querySelector(".move-row-btn");
  const descInput = rowEl.querySelector(".desc-input");
  const actionsPopup = rowEl.querySelector(".row-actions-popup");
  const actionUpBtn = rowEl.querySelector(".row-action-up");
  const actionDownBtn = rowEl.querySelector(".row-action-down");
  const actionAddBelowBtn = rowEl.querySelector(".row-action-add-below");
  const actionDeleteBtn = rowEl.querySelector(".row-action-delete");
  const actionCancelBtn = rowEl.querySelector(".row-action-cancel");
  const actionGoTranslateBtn = rowEl.querySelector(".row-action-go-translate");
  const actionCopyBtn = rowEl.querySelector(".row-action-copy");

  const radioName = "time-format-" + rowEl.dataset.rowId;

  // Attach history tracking for row description field
  if (descInput) {
    attachTrackedField("row", "desc", descInput, rowEl.dataset.rowId);
  }


  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
    timeInput.classList.add("is-invalid");
    updateExportButtonState();
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
    timeInput.classList.remove("is-invalid");
    updateExportButtonState();
  }

  function getSelectedFormat() {
    return "24";
  }

  function setFormatMode(mode) {
    hourInput.min = "0";
    hourInput.max = "23";
  }

  function initPopupFromCurrentValue() {
    clearError();
    const current = parseTimeString(timeInput.value);
    const mode = getSelectedFormat();

    if (current === null) {
      hourInput.value = "";
      minuteInput.value = "";
      return;
    }

    const h24 = Math.floor(current / 60);
    const m = current % 60;

    hourInput.value = h24;
    minuteInput.value = m;
  }

  function readTimeFromPopup() {
    const mode = getSelectedFormat();
    const hRaw = parseInt(hourInput.value, 10);
    const mRaw = parseInt(minuteInput.value, 10);

    if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) {
      showError("請輸入完整時間");
      return null;
    }

    if (mRaw < 0 || mRaw > 59) {
      showError("時間無效，請重新輸入");
      return null;
    }

    let h24;
    if (hRaw < 0 || hRaw > 23) {
      showError("時間無效，請重新輸入");
      return null;
    }
    h24 = hRaw;

    clearError();
    return h24 * 60 + mRaw;
  }

  function wireHourAutoAdvance() {
    if (!hourInput || !minuteInput) return;
    hourInput.addEventListener("input", function () {
      const val = hourInput.value.trim();
      if (val.length >= 2) {
        minuteInput.focus();
        minuteInput.select();
      }
    });
  }

  function showPopup() {
    hideAllPopups(popup);
    popup.classList.remove("hidden");
    setFormatMode(getSelectedFormat());
    initPopupFromCurrentValue();
    if (hourInput) {
      hourInput.focus();
      hourInput.select();
    }
  }

  function hidePopup() {
    popup.classList.add("hidden");
    clearError();
  }

  timeInput.addEventListener("click", function (e) {
    e.stopPropagation();
    showPopup();
  });

  wireHourAutoAdvance();

    okBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    const totalMinutes = readTimeFromPopup();
    if (totalMinutes === null) {
      return;
    }

    const prev = timeInput.value;
    const next = formatTime(totalMinutes);
    timeInput.value = next;
    hidePopup();
    validateTimeOrder();

    const change = makeFieldChange("row", "time", rowEl.dataset.rowId, prev, next);
    if (change) {
      pushHistoryEntry({
        timestamp: Date.now(),
        changes: [change],
      });
    }
  });


  cancelBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    hidePopup();
  });

    if (moveRowBtn) {
    moveRowBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!actionsPopup) return;
      hideAllRowActionPopups(actionsPopup);
      actionsPopup.classList.toggle("hidden");

      // When the settings (move-row) button is clicked, scroll this row so its
      // top aligns just under the fixed header and page title bar.
      scrollRowToViewportTop(rowEl);
    });
  }


  if (actionUpBtn) {
    actionUpBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (actionsPopup) actionsPopup.classList.add("hidden");
      const prev = rowEl.previousElementSibling;
      if (!prev) {
        window.alert("已在最上方，無法再向上移動。");
        return;
      }
      swapRows(rowEl, prev, "up");
    });
  }

  if (actionDownBtn) {
    actionDownBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (actionsPopup) actionsPopup.classList.add("hidden");
      const next = rowEl.nextElementSibling;
      if (!next) {
        window.alert("已在最下方，無法再向下移動。");
        return;
      }
      swapRows(rowEl, next, "down");
    });
  }

  if (actionAddBelowBtn) {
    actionAddBelowBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (actionsPopup) actionsPopup.classList.add("hidden");

      rowIdCounter += 1;
      const fragment = rowTemplate.content.cloneNode(true);
      const newRowEl = fragment.querySelector(".note-row");
      newRowEl.dataset.rowId = String(rowIdCounter);

      if (rowEl.nextSibling) {
        rowsContainer.insertBefore(fragment, rowEl.nextSibling);
      } else {
        rowsContainer.appendChild(fragment);
      }

      attachRowEvents(newRowEl);
      validateTimeOrder();
      updateExportButtonState();
    });
  }

  if (actionGoTranslateBtn) {
    actionGoTranslateBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (actionsPopup) actionsPopup.classList.add("hidden");

      let targetTextarea = null;
      let label = "";
      let text = "";

      const row = rowEl;
      if (row) {
        const desc = row.querySelector(".desc-input");
        if (desc) {
          targetTextarea = desc;
          const rows = Array.from(rowsContainer.querySelectorAll(".note-row"));
          const index = rows.indexOf(row) + 1;
          if (index > 0) {
            label = "事件記錄第 " + index + " 行的描述欄";
          } else {
            label = "事件記錄的描述欄";
          }
          text = desc.value.trim();
        }
      }

      if (typeof setTranslateTarget === "function") {
        if (targetTextarea) {
          setTranslateTarget(targetTextarea, label);
        } else {
          setTranslateTarget(null, "");
        }
      }

      if (!text) {
        window.alert("目前沒有可翻譯的內容。");
        return;
      }

      const englishOriginalInputEl = document.getElementById("english-original");
      if (englishOriginalInputEl) {
        englishOriginalInputEl.value = text;
        englishOriginalInputEl.style.height = "auto";
        englishOriginalInputEl.style.height =
          englishOriginalInputEl.scrollHeight + "px";
      }

      if (typeof showTab === "function") {
        showTab("translate");
      }

      if (englishOriginalInputEl) {
        englishOriginalInputEl.focus();
      }
    });
  }

  if (actionCopyBtn) {
    actionCopyBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (actionsPopup) actionsPopup.classList.add("hidden");

      const text = descInput ? descInput.value : "";
      copyTextWithAlert(text);
    });
  }

  if (actionDeleteBtn) {
    actionDeleteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (actionsPopup) actionsPopup.classList.add("hidden");
      const ok = window.confirm("確定要刪除此列嗎？");
      if (!ok) return;
      rowEl.remove();
      validateTimeOrder();
      updateExportButtonState();
    });
  }

  if (actionCancelBtn) {
    actionCancelBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (actionsPopup) actionsPopup.classList.add("hidden");
    });
  }

  if (descInput && typeof setupAutoResize === "function") {
    setupAutoResize(descInput);
  }
}

function swapRows(sourceRow, targetRow, direction) {
  if (!sourceRow || !targetRow) return;
  const parent = rowsContainer;
  if (direction === "up") {
    parent.insertBefore(sourceRow, targetRow);
    sourceRow.classList.add("swap-up");
    targetRow.classList.add("swap-down");
  } else {
    parent.insertBefore(targetRow, sourceRow);
    sourceRow.classList.add("swap-down");
    targetRow.classList.add("swap-up");
  }

  setTimeout(function () {
    sourceRow.classList.remove("swap-up", "swap-down");
    targetRow.classList.remove("swap-up", "swap-down");
  }, 200);

  validateTimeOrder();
  updateExportButtonState();
}

function createRow() {
  rowIdCounter += 1;
  const fragment = rowTemplate.content.cloneNode(true);
  const rowEl = fragment.querySelector(".note-row");
  rowEl.dataset.rowId = String(rowIdCounter);
  rowsContainer.appendChild(fragment);
  attachRowEvents(rowEl);
  updateExportButtonState();
}

// Used by Smartfill apply mode to append a new event row at the bottom
// with the given description text.
function addSequenceRowFromSmartfill(text) {
  const desc = (text || "").trim();
  if (!desc) return;

  rowIdCounter += 1;
  const fragment = rowTemplate.content.cloneNode(true);
  const rowEl = fragment.querySelector(".note-row");
  const rowId = String(rowIdCounter);
  rowEl.dataset.rowId = rowId;

  const descInput = rowEl.querySelector(".desc-input");
  if (descInput) {
    descInput.value = desc;
    if (typeof setupAutoResize === "function") {
      setupAutoResize(descInput);
    }
    descInput.style.height = "auto";
    descInput.style.height = descInput.scrollHeight + "px";
  }

  rowsContainer.appendChild(fragment);
  attachRowEvents(rowEl);
  validateTimeOrder();
  updateExportButtonState();

  const index = Array.from(rowsContainer.querySelectorAll(".note-row")).indexOf(rowEl);
  const change = {
    type: "addRow",
    rowId: rowId,
    index: index,
    content: {
      time: "",
      desc: desc,
    },
  };
  pushHistoryEntry({
    timestamp: Date.now(),
    changes: [change],
  });
}


function replaceSequenceRowsFromSmartfill(descriptions) {
  if (!rowsContainer || !rowTemplate) return;

  rowsContainer.innerHTML = "";
  rowIdCounter = 0;

  (descriptions || []).forEach(function (description) {
    rowIdCounter += 1;
    const fragment = rowTemplate.content.cloneNode(true);
    const rowEl = fragment.querySelector(".note-row");
    rowEl.dataset.rowId = String(rowIdCounter);

    const descInput = rowEl.querySelector(".desc-input");
    if (descInput) {
      descInput.value = description || "";
    }

    rowsContainer.appendChild(fragment);
    attachRowEvents(rowEl);

  });

  requestAnimationFrame(function () {
    const descriptionInputs = rowsContainer.querySelectorAll(".desc-input");
    descriptionInputs.forEach(function (descriptionInput) {
      descriptionInput.style.height = "auto";
      descriptionInput.style.height = descriptionInput.scrollHeight + "px";
    });
  });

  validateTimeOrder();
  updateExportButtonState();
}


function serializeState() {
  const rows = Array.from(rowsContainer.querySelectorAll(".note-row")).map(
    function (row) {
      return {
        time: row.querySelector(".time-input").value,
        desc: row.querySelector(".desc-input").value,
      };
    }
  );

  return {
    faultDescription: faultDescriptionInput ? faultDescriptionInput.value : "",
    finding: findingInput ? findingInput.value : "",
    rootCause: rootCauseInput ? rootCauseInput.value : "",
    actionTaken: actionTakenInput ? actionTakenInput.value : "",
    resumeTime: resumeTimeInput ? resumeTimeInput.value : "",
    resumeTimeMode: resumeTimeModeSelect ? resumeTimeModeSelect.value : "TBC",
    findingMode: findingModeSelect ? findingModeSelect.value : "FREE",
    rootCauseMode: rootCauseModeSelect ? rootCauseModeSelect.value : "FREE",
    actionTakenMode: actionTakenModeSelect ? actionTakenModeSelect.value : "FREE",
    startDate: getCurrentStartDateValues(),
    rows: rows,
  };
}

function applyState(state) {
  if (!state) return;

  if (faultDescriptionInput)
    faultDescriptionInput.value = state.faultDescription || "";
  if (findingInput) findingInput.value = state.finding || "";
  if (rootCauseInput) rootCauseInput.value = state.rootCause || "";
  if (actionTakenInput) actionTakenInput.value = state.actionTaken || "";
  if (resumeTimeInput) resumeTimeInput.value = state.resumeTime || "";

  if (
    state.startDate &&
    startDateYearSelect &&
    startDateMonthSelect &&
    startDateDaySelect
  ) {
    if (state.startDate.year) startDateYearSelect.value = state.startDate.year;
    if (state.startDate.month)
      startDateMonthSelect.value = state.startDate.month;
    refreshStartDateDays(
      parseInt(startDateYearSelect.value, 10),
      parseInt(startDateMonthSelect.value, 10)
    );
    if (state.startDate.day) startDateDaySelect.value = state.startDate.day;
    validateStartDate();
  }

  rowsContainer.innerHTML = "";
  rowIdCounter = 0;
  (state.rows || []).forEach(function (rowData) {
    rowIdCounter += 1;
    const fragment = rowTemplate.content.cloneNode(true);
    const rowEl = fragment.querySelector(".note-row");
    rowEl.dataset.rowId = String(rowIdCounter);
    const timeInput = rowEl.querySelector(".time-input");
    const descInput = rowEl.querySelector(".desc-input");
    timeInput.value = rowData.time || "";
    descInput.value = rowData.desc || "";
    rowsContainer.appendChild(fragment);
    const newlyAddedRow =
      rowsContainer.querySelector(".note-row:last-child") || rowEl;
    attachRowEvents(newlyAddedRow);
  });

  if (!state.rows || state.rows.length === 0) {
    rowsContainer.innerHTML = "";
    rowIdCounter = 0;
    createRow();
    createRow();
    createRow();
  }

  if (faultDescriptionInput && typeof setupAutoResize === "function") {
    setupAutoResize(faultDescriptionInput);
  }
  if (findingInput && typeof setupAutoResize === "function") {
    setupAutoResize(findingInput);
  }
  if (rootCauseInput && typeof setupAutoResize === "function") {
    setupAutoResize(rootCauseInput);
  }
  if (actionTakenInput && typeof setupAutoResize === "function") {
    setupAutoResize(actionTakenInput);
  }
  if (resumeTimeInput && typeof setupAutoResize === "function") {
    setupAutoResize(resumeTimeInput);
  }

  if (resumeTimeModeSelect) {
    if (state.resumeTimeMode) {
      resumeTimeModeSelect.value = state.resumeTimeMode;
    }
    applyResumeTimeModeFromSelect();
  }

  if (findingModeSelect && findingInput) {
    if (state.findingMode) {
      findingModeSelect.value = state.findingMode;
    }
    applySummaryModeFromSelect(findingModeSelect, findingInput);
  }

  if (rootCauseModeSelect && rootCauseInput) {
    if (state.rootCauseMode) {
      rootCauseModeSelect.value = state.rootCauseMode;
    }
    applySummaryModeFromSelect(rootCauseModeSelect, rootCauseInput);
  }

  if (actionTakenModeSelect && actionTakenInput) {
    if (state.actionTakenMode) {
      actionTakenModeSelect.value = state.actionTakenMode;
    }
    applySummaryModeFromSelect(actionTakenModeSelect, actionTakenInput);
  }

  validateTimeOrder();
  updateExportButtonState();
}

function saveStateToStorage() {
  try {
    const state = serializeState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore
  }
}

function loadStateFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// === History (Undo/Redo) persistence ===
function saveHistoryToStorage() {
  try {
    const payload = {
      undoStack: undoStack,
      redoStack: redoStack,
    };
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // ignore
  }
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
      // no history stored yet; keep stacks empty
      undoStack = [];
      redoStack = [];
    }
  } catch (e) {
    // ignore; fall back to empty stacks
    undoStack = [];
    redoStack = [];
  }
  updateUndoRedoButtonState();
}



function attachResumeTimeModeWithHistory() {
  if (!resumeTimeModeSelect || !resumeTimeInput) return;

  resumeTimeModeSelect.addEventListener("focus", function () {
    resumeTimeModeSelect._historyPrevMode = resumeTimeModeSelect.value;
  });

  resumeTimeModeSelect.addEventListener("change", function () {
    if (isApplyingHistory) return;

    const prevMode =
      resumeTimeModeSelect._historyPrevMode || resumeTimeModeSelect.value;
    const prevText = resumeTimeInput.value;

    const nextMode = resumeTimeModeSelect.value;

    applyResumeTimeModeFromSelect();
    const nextText = resumeTimeInput.value;

    const changes = [];

    const modeChange = makeFieldChange(
      "summary",
      "resume-time-mode",
      null,
      prevMode,
      nextMode
    );
    if (modeChange) changes.push(modeChange);

    const textChange = makeFieldChange(
      "summary",
      "resume-time",
      null,
      prevText,
      nextText
    );
    if (textChange) changes.push(textChange);

    if (changes.length) {
      pushHistoryEntry({
        timestamp: Date.now(),
        changes: changes,
      });
    }

    // Update stored previous state so subsequent mode changes have an
    // accurate starting point.
    resumeTimeModeSelect._historyPrevMode = nextMode;
  });
}



function initResumeTimeControls() {
  if (!resumeTimeModeSelect || !resumeTimeInput) return;

  applyResumeTimeModeFromSelect();
  attachResumeTimeModeWithHistory();
}


function resetToDefaultState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}

  if (typeof clearHistoryStacks === "function") {
    clearHistoryStacks();
  }

  if (faultDescriptionInput) faultDescriptionInput.value = "";

  if (findingInput) findingInput.value = "";
  if (rootCauseInput) rootCauseInput.value = "";
  if (actionTakenInput) actionTakenInput.value = "";
  if (resumeTimeInput) resumeTimeInput.value = "";

  rowsContainer.innerHTML = "";
  rowIdCounter = 0;
  createRow();
  createRow();
  createRow();

  initStartDateSelectors();

  if (faultDescriptionInput && typeof setupAutoResize === "function") {
    setupAutoResize(faultDescriptionInput);
  }
  if (findingInput && typeof setupAutoResize === "function") {
    setupAutoResize(findingInput);
  }
  if (rootCauseInput && typeof setupAutoResize === "function") {
    setupAutoResize(rootCauseInput);
  }
  if (actionTakenInput && typeof setupAutoResize === "function") {
    setupAutoResize(actionTakenInput);
  }
  if (resumeTimeInput && typeof setupAutoResize === "function") {
    setupAutoResize(resumeTimeInput);
  }
  if (resumeTimeModeSelect) {
    resumeTimeModeSelect.value = "TBC";
    applyResumeTimeModeFromSelect();
  }

  if (findingModeSelect && findingInput) {
    findingModeSelect.value = "FREE";
    applySummaryModeFromSelect(findingModeSelect, findingInput);
  }
  if (rootCauseModeSelect && rootCauseInput) {
    rootCauseModeSelect.value = "FREE";
    applySummaryModeFromSelect(rootCauseModeSelect, rootCauseInput);
  }
  if (actionTakenModeSelect && actionTakenInput) {
    actionTakenModeSelect.value = "FREE";
    applySummaryModeFromSelect(actionTakenModeSelect, actionTakenInput);
  }

  validateTimeOrder();
  updateExportButtonState();
}

function buildExportClipboardContent() {
  const rows = Array.from(rowsContainer.querySelectorAll(".note-row"));
  const lines = [];

  let firstTime = "";

  rows.forEach(function (row) {
    const time = row.querySelector(".time-input").value.trim();
    const desc = row.querySelector(".desc-input").value.trim();
    if (!time && !desc) {
      return;
    }

    if (!firstTime && time) {
      firstTime = time;
    }

    let processedDesc = desc.trim();
    if (processedDesc) {
      const lastChar = processedDesc.charAt(processedDesc.length - 1);
      if (lastChar !== "." && lastChar !== "。") {
        processedDesc = processedDesc + ".";
      }
    }
    const line =
      "At " + (time || "--:--") + (processedDesc ? " " + processedDesc : "");
    lines.push(line);
  });

  if (lines.length === 0) {
    return null;
  }

  let headerDate = "";
  const startVals = getCurrentStartDateValues();
  if (startVals && startVals.year && startVals.month && startVals.day) {
    const y = startVals.year;
    const m = String(startVals.month).padStart(2, "0");
    const d = String(startVals.day).padStart(2, "0");
    headerDate = y + "-" + m + "-" + d;
  }

  const firstTimeText = lines.length ? lines[0].slice(3, 8) : "";
  const headerLine =
    "Date: " +
    (headerDate || "----/--/--") +
    " Time: " +
    (firstTimeText || "--:--");

  let content = headerLine + "\n\n" + lines.join("\n\n");

  const memoExport = getMemoExportText();
  if (memoExport) {
    content += "\n\n" + memoExport;
  }

  return content;
}

if (exportBtn) {
  exportBtn.addEventListener("click", function () {
    if (hasAnyTimeError()) {
      window.alert("請先修正所有時間錯誤，再進行匯出。");
      updateExportButtonState();
      return;
    }

    if (hasAnyTimeWarning()) {
      window.alert(
        "注意：時間順序存在警告（事件未完全按由早到晚排序）。" +
          "\n\n系統仍會依目前順序產生文字。"
      );
    }
    const content = buildExportClipboardContent();
    if (!content) {
      window.alert("目前沒有可匯出的內容。");
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(content)
        .then(function () {
          window.alert("已複製到剪貼簿：\n\n" + content);
        })
        .catch(function () {
          window.alert(
            "無法自動複製到剪貼簿，請手動複製以下內容：\n\n" + content
          );
        });
    } else {
      window.alert("請手動複製以下內容：\n\n" + content);
    }
  });
}

// Expose for translator_script.js and smartfill_script.js
window.buildExportClipboardContent =
  window.buildExportClipboardContent || buildExportClipboardContent;
window.pushHistoryEntry = window.pushHistoryEntry || pushHistoryEntry;
window.makeFieldChange = window.makeFieldChange || makeFieldChange;
window.recordSmartfillFieldChange =
  window.recordSmartfillFieldChange || recordSmartfillFieldChange;
window.clearHistoryStacks = window.clearHistoryStacks || clearHistoryStacks;


function sendContentToWhatsapp(content) {

  const trimmed = (content || "").trim();
  if (!trimmed) {
    window.alert("目前沒有可匯出的內容。");
    return;
  }

  // Use WhatsApp's official click-to-chat URL with a prefilled text message.
  // This opens WhatsApp (or WhatsApp Web) with the message already placed
  // in the input box, ready to be sent.
  const encodedText = encodeURIComponent(trimmed);
  const whatsappUrl = "https://wa.me/85266560895?text=" + encodedText;

  // Open WhatsApp with the prefilled message as part of the same user gesture.
  window.open(whatsappUrl, "_blank");

  // Still attempt to copy the content to the clipboard so it is available
  // for manual pasting or other uses, with graceful fallbacks.
  /*if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(trimmed).catch(function () {
      window.alert(
        "無法自動複製到剪貼簿，但 WhatsApp 已預先填入訊息。\n\n" +
          "如果需要在其他地方使用，請自行選取並複製 WhatsApp 內的文字。"
      );
    });
  } else {
    window.alert(
      "此裝置不支援自動複製到剪貼簿，但 WhatsApp 已預先填入訊息。\n\n" +
        "如果需要在其他地方使用，請自行選取並複製 WhatsApp 內的文字。"
    );
  }*/
}

function copyTextWithAlert(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    window.alert("目前沒有可複製的內容。");
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(trimmed)
      .then(function () {
        window.alert("已複製到剪貼簿。");
      })
      .catch(function () {
        window.alert(
          "無法自動複製到剪貼簿，請手動複製以下內容：\n\n" + trimmed
        );
      });
  } else {
    window.alert("請手動複製以下內容：\n\n" + trimmed);
  }
}

function areSummaryFieldsFilled() {
  const fd = faultDescriptionInput ? faultDescriptionInput.value.trim() : "";
  const finding = findingInput ? findingInput.value.trim() : "";
  const rc = rootCauseInput ? rootCauseInput.value.trim() : "";
  const at = actionTakenInput ? actionTakenInput.value.trim() : "";
  const rt = resumeTimeInput ? resumeTimeInput.value.trim() : "";
  return fd && finding && rc && at && rt;
}

function buildSummaryWhatsappContent() {
  const finding = findingInput ? findingInput.value.trim() : "";
  const rc = rootCauseInput ? rootCauseInput.value.trim() : "";
  const at = actionTakenInput ? actionTakenInput.value.trim() : "";
  const rt = resumeTimeInput ? resumeTimeInput.value.trim() : "";

  if (!finding && !rc && !at && !rt) {
    return null;
  }

  // Add subheadings for the WhatsApp 摘要輸出：
  // Subheading 1: Finding
  // Subheading 2: Root Cause
  // Subheading 3: Action Taken
  // Subheading 4: Resume time
  const sections = [];

  if (finding) {
    sections.push("Finding\n" + finding);
  }
  if (rc) {
    sections.push("Root Cause\n" + rc);
  }
  if (at) {
    sections.push("Action Taken\n" + at);
  }
  if (rt) {
    sections.push("Resume time\n" + rt);
  }

  return sections.join("\n\n");
}

function updateUndoRedoButtonState() {
  if (undoBtn) {
    undoBtn.disabled = undoStack.length === 0;
  }
  if (redoBtn) {
    redoBtn.disabled = redoStack.length === 0;
  }
}

function clearHistoryStacks() {
  undoStack = [];
  redoStack = [];
  updateUndoRedoButtonState();
  try {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {}
}

function buildSequenceTextForExcel() {


  const rows = Array.from(rowsContainer.querySelectorAll(".note-row"));
  const lines = [];

  let firstTime = "";

  rows.forEach(function (row) {
    const time = row.querySelector(".time-input").value.trim();
    const desc = row.querySelector(".desc-input").value.trim();
    if (!time && !desc) {
      return;
    }

    if (!firstTime && time) {
      firstTime = time;
    }

    let processedDesc = desc.trim();
    if (processedDesc) {
      const lastChar = processedDesc.charAt(processedDesc.length - 1);
      if (lastChar !== "." && lastChar !== "。") {
        processedDesc = processedDesc + ".";
      }
    }
    const line = "At " + (time || "--:--") + " " + processedDesc;
    lines.push(line);
    lines.push("");
  });

  while (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }

  let headerDate = "";
  const startVals = getCurrentStartDateValues();
  if (startVals && startVals.year && startVals.month && startVals.day) {
    const y = startVals.year;
    const m = String(startVals.month).padStart(2, "0");
    const d = String(startVals.day).padStart(2, "0");
    headerDate = y + "-" + m + "-" + d;
  }

  const headerLine =
    "Date: " +
    (headerDate || "----/--/--") +
    " Time: " +
    (firstTime || "--:--");
  let content = headerLine + "\n\n" + lines.join("\n");

  const memoExport = getMemoExportText();
  if (memoExport) {
    content += "\n\n" + memoExport;
  }

  return content;
}

if (excelBtn) {
  excelBtn.addEventListener("click", function () {
    if (!areSummaryFieldsFilled()) {
      window.alert("請先填寫上方及下方所有文字欄位，再生成 Excel。");
      return;
    }

    const seqHidden = document.getElementById("sequence");
    if (seqHidden) {
      seqHidden.value = buildSequenceTextForExcel();
    }
    if (typeof window.downloadExcel === "function") {
      window.downloadExcel();
    } else {
      window.alert("Excel 產生功能尚未載入。");
    }
  });
}

if (whatsappBtn) {
  whatsappBtn.addEventListener("click", function () {
    if (hasAnyTimeError()) {
      window.alert("請先修正所有時間錯誤，再進行匯出。");
      updateExportButtonState();
      return;
    }

    if (hasAnyTimeWarning()) {
      window.alert(
        "注意：時間順序存在警告（事件未完全按由早到晚排序）。" +
          "\n\n系統仍會依目前順序產生文字。"
      );
    }

    const content = buildExportClipboardContent();
    sendContentToWhatsapp(content);
  });
}

const whatsappSummaryBtn = document.getElementById("whatsapp-summary-btn");

if (whatsappSummaryBtn) {
  whatsappSummaryBtn.addEventListener("click", function () {
    const content = buildSummaryWhatsappContent();
    if (!content) {
      window.alert(
        "請先填寫 Finding, Root Cause, Action Taken 及 Resume time，再透過 WhatsApp 發送摘要。"
      );
      return;
    }
    sendContentToWhatsapp(content);
  });
}

const inlineWhatsappButtons = Array.from(
  document.querySelectorAll(".whatsapp-inline-btn")
);

inlineWhatsappButtons.forEach(function (btn) {
  btn.addEventListener("click", function () {
    const targetId = btn.getAttribute("data-whatsapp-target");
    const label = btn.getAttribute("data-whatsapp-label") || "";
    const targetEl = targetId ? document.getElementById(targetId) : null;

    let rawText = "";
    if (targetEl) {
      if ("value" in targetEl) {
        rawText = String(targetEl.value || "").trim();
      } else {
        rawText = String(targetEl.textContent || "").trim();
      }
    }

    if (!rawText) {
      window.alert("目前沒有可匯出的內容。");
      return;
    }

    const content = label ? label + ": " + rawText : rawText;
    sendContentToWhatsapp(content);
  });
});

const inlineCopyButtons = Array.from(
  document.querySelectorAll(".copy-inline-btn")
);

inlineCopyButtons.forEach(function (btn) {
  btn.addEventListener("click", function () {
    const targetId = btn.getAttribute("data-copy-target");
    const targetEl = targetId ? document.getElementById(targetId) : null;

    let rawText = "";
    if (targetEl) {
      if ("value" in targetEl) {
        rawText = String(targetEl.value || "").trim();
      } else {
        rawText = String(targetEl.textContent || "").trim();
      }
    }

    if (!rawText) {
      window.alert("目前沒有可複製的內容。");
      return;
    }

    copyTextWithAlert(rawText);
  });
});

if (resetBtn) {
  resetBtn.addEventListener("click", function () {
    const first = window.confirm("確定要清除目前所有內容嗎？");
    if (!first) return;
    const second = window.confirm(
      "再次確認：清除後將無法還原，確定繼續？"
    );
    if (!second) return;
    resetToDefaultState();
  });
}

// === History (Undo/Redo) core ===

function getHistoryTargetForFieldElement(el) {
  if (!el) return null;

  const id = el.id || "";
  const isBottom = el.classList.contains("bottom-textarea");
  const isRowDesc = el.classList.contains("desc-input");

  if (id === "fault-description") {
    return { scope: "top", fieldId: "fault-description", rowId: null };
  }

  if (id === "start-date-year") {
    return { scope: "startDate", fieldId: "start-date-year", rowId: null };
  }
  if (id === "start-date-month") {
    return { scope: "startDate", fieldId: "start-date-month", rowId: null };
  }
  if (id === "start-date-day") {
    return { scope: "startDate", fieldId: "start-date-day", rowId: null };
  }

  if (id === "memo-text") {
    return { scope: "memo", fieldId: "memo-text", rowId: null };
  }

  if (isBottom) {
    if (id === "finding") {
      return { scope: "summary", fieldId: "finding", rowId: null };
    }
    if (id === "root-cause") {
      return { scope: "summary", fieldId: "root-cause", rowId: null };
    }
    if (id === "action-taken") {
      return { scope: "summary", fieldId: "action-taken", rowId: null };
    }
    if (id === "resume-time") {
      return { scope: "summary", fieldId: "resume-time", rowId: null };
    }
  }

  if (isRowDesc) {
    const rowEl = el.closest(".note-row");
    if (rowEl && rowEl.dataset && rowEl.dataset.rowId) {
      return {
        scope: "row",
        fieldId: "desc",
        rowId: rowEl.dataset.rowId,
      };
    }
  }

  return null;
}

function recordSmartfillFieldChange(fieldEl, oldValue, newValue) {
  if (!fieldEl) return;
  const target = getHistoryTargetForFieldElement(fieldEl);
  if (!target) return;

  const change = makeFieldChange(
    target.scope,
    target.fieldId,
    target.rowId,
    oldValue || "",
    newValue || ""
  );
  if (!change) return;

  pushHistoryEntry({
    timestamp: Date.now(),
    changes: [change],
  });
}

function applyHistoryChange(change, direction) {
  // direction: "undo" or "redo"
  if (!change || !change.type) return;

  if (change.type === "field") {

    const targetValue = direction === "undo" ? change.prev : change.next;
    const scope = change.target && change.target.scope;
    const fieldId = change.target && change.target.fieldId;
    const rowId = change.target && change.target.rowId;
    let el = null;

    if (scope === "top") {
      if (fieldId === "fault-description") {
        el = faultDescriptionInput;
      }
    } else if (scope === "startDate") {
      if (fieldId === "start-date-year") {
        el = startDateYearSelect;
      } else if (fieldId === "start-date-month") {
        el = startDateMonthSelect;
      } else if (fieldId === "start-date-day") {
        el = startDateDaySelect;
      }
    } else if (scope === "memo") {
      if (fieldId === "memo-mode") {
        el = memoModeSelect;
      } else if (fieldId === "memo-text") {
        el = memoTextInput;
      } else if (fieldId === "memo-delay-mins") {
        el = memoDelayMinsInput;
      }
    } else if (scope === "summary") {
      if (fieldId === "finding-mode") {
        el = findingModeSelect;
      } else if (fieldId === "finding") {
        el = findingInput;
      } else if (fieldId === "root-cause-mode") {
        el = rootCauseModeSelect;
      } else if (fieldId === "root-cause") {
        el = rootCauseInput;
      } else if (fieldId === "action-taken-mode") {
        el = actionTakenModeSelect;
      } else if (fieldId === "action-taken") {
        el = actionTakenInput;
      } else if (fieldId === "resume-time-mode") {
        el = resumeTimeModeSelect;
      } else if (fieldId === "resume-time") {
        el = resumeTimeInput;
      }
    } else if (scope === "row" && rowId) {
      const rowEl = rowsContainer.querySelector(
        '.note-row[data-row-id="' + rowId + '"]'
      );
      if (rowEl) {
        if (fieldId === "time") {
          el = rowEl.querySelector(".time-input");
        } else if (fieldId === "desc") {
          el = rowEl.querySelector(".desc-input");
        }
      }
    }

    if (!el) return;

        // Avoid re-recording this as a new history entry
    isApplyingHistory = true;
    el.value = targetValue || "";

    if (typeof resizeToContent === "function" && el.tagName === "TEXTAREA") {
      resizeToContent(el);
    }

    if (el === startDateYearSelect || el === startDateMonthSelect || el === startDateDaySelect) {
      validateStartDate();
    }

    if (el === resumeTimeModeSelect) {
      applyResumeTimeModeFromSelect();
    }

    if (el === findingModeSelect && findingInput) {
      applySummaryModeFromSelect(findingModeSelect, findingInput);
    }
    if (el === rootCauseModeSelect && rootCauseInput) {
      applySummaryModeFromSelect(rootCauseModeSelect, rootCauseInput);
    }
        if (el === actionTakenModeSelect && actionTakenInput) {
      applySummaryModeFromSelect(actionTakenModeSelect, actionTakenInput);
    }

    if (el === memoModeSelect) {
      // Restoring memo mode should re-apply memo UI (including delay controls
      // and memo text value).
      applyMemoModeFromSelect();
    }

    if (el === memoDelayMinsInput && memoModeSelect && memoModeSelect.value === "DELAY") {
      // When restoring the Train delay minutes value, keep the memo text in
      // sync so Undo/Redo behaves intuitively.
      const raw = memoDelayMinsInput.value.replace(/[^0-9]/g, "");
      const mins = raw || "";
      if (memoTextInput) {
        memoTextInput.value = mins
          ? "Train delay " + mins + " mins"
          : "Train delay  mins";

        if (typeof resizeToContent === "function" && memoTextInput.tagName === "TEXTAREA") {
          resizeToContent(memoTextInput);
        } else {
          memoTextInput.style.height = "auto";
          memoTextInput.style.height = memoTextInput.scrollHeight + "px";
        }
      }
    }

    isApplyingHistory = false;
    validateTimeOrder();
    updateExportButtonState();

  } else if (change.type === "addRow") {
    const idx = change.index;
    if (direction === "undo") {
      const rows = Array.from(rowsContainer.querySelectorAll(".note-row"));
      const rowEl = rows[idx];
      if (rowEl && rowEl.dataset.rowId === change.rowId) {
        rowEl.remove();
        validateTimeOrder();
        updateExportButtonState();
      }
    } else {
      const fragment = rowTemplate.content.cloneNode(true);
      const rowEl = fragment.querySelector(".note-row");
      rowEl.dataset.rowId = change.rowId;
      const timeInput = rowEl.querySelector(".time-input");
      const descInput = rowEl.querySelector(".desc-input");
      if (timeInput) timeInput.value = change.content.time || "";
      if (descInput) {
        descInput.value = change.content.desc || "";
        if (typeof setupAutoResize === "function") {
          setupAutoResize(descInput);
        }
        descInput.style.height = "auto";
        descInput.style.height = descInput.scrollHeight + "px";
      }

      const rows = rowsContainer.querySelectorAll(".note-row");
      const beforeNode = rows[idx] || null;
      if (beforeNode) {
        rowsContainer.insertBefore(fragment, beforeNode);
      } else {
        rowsContainer.appendChild(fragment);
      }
      attachRowEvents(rowEl);
      validateTimeOrder();
      updateExportButtonState();
    }
  } else if (change.type === "replaceRows") {
    const rowsData = direction === "undo" ? change.prevRows : change.nextRows;
    rowsContainer.innerHTML = "";

    (rowsData || []).forEach(function (rowData) {
      const fragment = rowTemplate.content.cloneNode(true);
      const rowEl = fragment.querySelector(".note-row");
      rowEl.dataset.rowId = rowData.rowId || String(++rowIdCounter);
      const timeInput = rowEl.querySelector(".time-input");
      const descInput = rowEl.querySelector(".desc-input");
      if (timeInput) timeInput.value = rowData.time || "";
      if (descInput) {
        descInput.value = rowData.desc || "";
        if (typeof setupAutoResize === "function") {
          setupAutoResize(descInput);
        }
        descInput.style.height = "auto";
        descInput.style.height = descInput.scrollHeight + "px";
      }
      rowsContainer.appendChild(fragment);
      const newlyAddedRow =
        rowsContainer.querySelector(".note-row:last-child") || rowEl;
      attachRowEvents(newlyAddedRow);
    });

    validateTimeOrder();
    updateExportButtonState();
  }
}


function applyHistoryEntry(entry, direction) {
  if (!entry || !Array.isArray(entry.changes)) return;
  const changes = direction === "undo" ? entry.changes.slice().reverse() : entry.changes;
  changes.forEach(function (change) {
    applyHistoryChange(change, direction);
  });
}

function pushHistoryEntry(entry) {
  if (!entry || !Array.isArray(entry.changes) || !entry.changes.length) {
    return;
  }
  undoStack.push(entry);
  // New timeline: clear redo stack
  redoStack = [];
  updateUndoRedoButtonState();
  saveHistoryToStorage();
}

function makeFieldChange(scope, fieldId, rowId, prevValue, nextValue) {
  if (prevValue === nextValue) return null;
  return {
    type: "field",
    target: {
      scope: scope,
      fieldId: fieldId,
      rowId: rowId || null,
    },
    prev: prevValue,
    next: nextValue,
  };
}

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

if (undoBtn) {
  undoBtn.addEventListener("click", handleUndoClick);
}
if (redoBtn) {
  redoBtn.addEventListener("click", handleRedoClick);
}


document.addEventListener("click", function (e) {
  const target = e.target;

  if (!target.closest(".move-cell")) {
    hideAllRowActionPopups(null);
  }

  if (target.closest(".time-popup") || target.closest(".time-input")) {
    return;
  }
  hideAllPopups(null);
});

// Initial rows and auto-resize for report textareas.
createRow();
createRow();
createRow();

// Track top-level fault description field
if (faultDescriptionInput) {
  attachTrackedField("top", "fault-description", faultDescriptionInput, null);
}

if (faultDescriptionInput && typeof setupAutoResize === "function") {
  setupAutoResize(faultDescriptionInput);
}

if (findingInput && typeof setupAutoResize === "function") {
  setupAutoResize(findingInput);
}
if (rootCauseInput && typeof setupAutoResize === "function") {
  setupAutoResize(rootCauseInput);
}
if (actionTakenInput && typeof setupAutoResize === "function") {
  setupAutoResize(actionTakenInput);
}
if (resumeTimeInput && typeof setupAutoResize === "function") {
  setupAutoResize(resumeTimeInput);
}

initStartDateSelectors();
initMemoControls();
initResumeTimeControls();
initSummaryModeControls();

// Attach history tracking to non-row fields
if (startDateYearSelect) {
  attachTrackedField("startDate", "start-date-year", startDateYearSelect, null);
}
if (startDateMonthSelect) {
  attachTrackedField("startDate", "start-date-month", startDateMonthSelect, null);
}
if (startDateDaySelect) {
  attachTrackedField("startDate", "start-date-day", startDateDaySelect, null);
}

if (memoTextInput) {
  attachTrackedField("memo", "memo-text", memoTextInput, null);
}
if (memoDelayMinsInput) {
  attachTrackedField("memo", "memo-delay-mins", memoDelayMinsInput, null);
}

if (findingInput) {
  attachTrackedField("summary", "finding", findingInput, null);
}
if (rootCauseInput) {
  attachTrackedField("summary", "root-cause", rootCauseInput, null);
}
if (actionTakenInput) {
  attachTrackedField("summary", "action-taken", actionTakenInput, null);
}
if (resumeTimeInput) {
  attachTrackedField("summary", "resume-time", resumeTimeInput, null);
}


const restoredState = loadStateFromStorage();
if (restoredState) {
  applyState(restoredState);
} else {
  updateExportButtonState();
}

// Load history stacks (if any) and update toolbar state
loadHistoryFromStorage();

// Autosave every 5 seconds
setInterval(function () {
  saveStateToStorage();
  saveHistoryToStorage();
}, 5000);

