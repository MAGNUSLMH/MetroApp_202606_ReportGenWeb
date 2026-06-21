document.addEventListener("DOMContentLoaded", function () {
  const rowsContainer = document.getElementById("rows-container");
  const exportBtn = document.getElementById("export-btn");
  const rowTemplate = document.getElementById("row-template");

  const faultDescriptionInput = document.getElementById("fault-description");
  const findingInput = document.getElementById("finding");
  const rootCauseInput = document.getElementById("root-cause");
  const actionTakenInput = document.getElementById("action-taken");
  const resumeTimeInput = document.getElementById("resume-time");
  const resumeTimeModeSelect = document.getElementById("resume-time-mode");
  const startDateYearSelect = document.getElementById("start-date-year");
  const startDateMonthSelect = document.getElementById("start-date-month");
  const startDateDaySelect = document.getElementById("start-date-day");
  const startDateError = document.getElementById("start-date-error");
  const resetBtn = document.getElementById("reset-btn");
  const hktClockEl = document.getElementById("hkt-clock");

  const memoModeSelect = document.getElementById("memo-mode");
  const memoTextInput = document.getElementById("memo-text");
  const memoDelayWrapper = document.getElementById("memo-delay-wrapper");
  const memoDelayMinsInput = document.getElementById("memo-delay-mins");

  let rowIdCounter = 0;

  const STORAGE_KEY = "fault_report_form_v1";

  function startHktClock() {
    if (!hktClockEl) return;
    function update() {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      const hh = h < 10 ? "0" + h : String(h);
      const mm = m < 10 ? "0" + m : String(m);
      const ss = s < 10 ? "0" + s : String(s);
      hktClockEl.textContent = hh + ":" + mm + ":" + ss;
    }
    update();
    setInterval(update, 1000);
  }

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

  function setupAutoResize(textarea) {
    if (!textarea) return;
    function resize() {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
    textarea.addEventListener("input", resize);
    resize();
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
    if (!startDateYearSelect || !startDateMonthSelect || !startDateDaySelect || !startDateError) {
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
      resumeTimeInput.placeholder = "手動輸入文字";
      // Keep whatever user has typed
    }

    // Adjust height manually (setupAutoResize was already wired once at init)
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

    // Reset visibility / disabled states first
    if (hasDelayControls) {
      memoDelayWrapper.classList.add("hidden");
    }

    // Default: free text box off for canned modes
    memoTextInput.disabled = true;

    if (mode === "TBC") {
      memoTextInput.value = "TBC";
      memoTextInput.placeholder = "TBC";
    } else if (mode === "NO_DELAY") {
      memoTextInput.value = "No train delay";
      memoTextInput.placeholder = "No train delay";
    } else if (mode === "DELAY") {
      // For delay mode, show dedicated numeric input and keep textbox read-only
      if (hasDelayControls) {
        memoDelayWrapper.classList.remove("hidden");
        // If textbox doesn't already match the pattern, initialise it
        const currentVal = memoTextInput.value.trim();
        if (!/^Train delay \d+ mins$/.test(currentVal)) {
          memoTextInput.value = "Train delay  mins";
        }
        memoTextInput.placeholder = "Train delay XX mins";
        memoTextInput.disabled = true;

        // Keep textbox synced when user changes the numeric field
        memoDelayMinsInput.addEventListener("input", function () {
          const raw = memoDelayMinsInput.value.replace(/[^0-9]/g, "");
          memoDelayMinsInput.value = raw;
          const mins = raw || "";
          memoTextInput.value = mins ? "Train delay " + mins + " mins" : "Train delay  mins";
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
      memoTextInput.placeholder = "手動輸入文字...";
      if (
        memoTextInput.value === "TBC" ||
        memoTextInput.value === "No train delay" ||
        memoTextInput.value === "No passenger injury" ||
        /^Train delay \d+ mins$/.test(memoTextInput.value)
      ) {
        memoTextInput.value = "";
      }
    }

    // Adjust height to fit content; works together with setupAutoResize
    memoTextInput.style.height = "auto";
    memoTextInput.style.height = memoTextInput.scrollHeight + "px";
  }

  function initMemoControls() {
    if (!memoModeSelect || !memoTextInput) return;

    memoModeSelect.addEventListener("change", applyMemoModeFromSelect);
    applyMemoModeFromSelect();
    setupAutoResize(memoTextInput);

    if (memoDelayMinsInput) {
      memoDelayMinsInput.addEventListener("focus", function () {
        memoDelayMinsInput.select();
      });
    }
  }

  function getMemoExportText() {
    if (!memoModeSelect || !memoTextInput) return "";

    const mode = memoModeSelect.value;
    const val = memoTextInput.value.trim();

    if (mode === "NONE") {
      // 無字: no last line in clipboard
      return "";
    }

    if (mode === "DELAY") {
      if (!memoDelayMinsInput) return "";
      const mins = memoDelayMinsInput.value.replace(/[^0-9]/g, "");
      if (!mins) return "";
      return "Train delay " + mins + " mins";
    }

    // For the canned text modes, use fixed strings to avoid stray edits
    if (mode === "TBC") {
      return "TBC";
    }
    if (mode === "NO_DELAY") {
      return "No train delay";
    }
    if (mode === "NO_INJURY") {
      return "No passenger injury";
    }

    // FREE mode: whatever the user typed
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
      // 正常時間順序：由上到下，時間應該遞增或相同
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
      if (err && !err.classList.contains("hidden") && err.textContent.trim() !== "") {
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

    if (startDateError && !startDateError.classList.contains("hidden") && startDateError.textContent.trim() !== "") {
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

    const radioName = "time-format-" + rowEl.dataset.rowId;

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

    // 24-hour format only; no radio toggle needed

    okBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      const totalMinutes = readTimeFromPopup();
      if (totalMinutes === null) {
        return;
      }
      timeInput.value = formatTime(totalMinutes);
      hidePopup();
      validateTimeOrder();
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

    if (descInput) {
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

  function serializeState() {
    const rows = Array.from(rowsContainer.querySelectorAll('.note-row')).map(function (row) {
      return {
        time: row.querySelector('.time-input').value,
        desc: row.querySelector('.desc-input').value,
      };
    });

    return {
      faultDescription: faultDescriptionInput ? faultDescriptionInput.value : "",
      finding: findingInput ? findingInput.value : "",
      rootCause: rootCauseInput ? rootCauseInput.value : "",
      actionTaken: actionTakenInput ? actionTakenInput.value : "",
      resumeTime: resumeTimeInput ? resumeTimeInput.value : "",
      resumeTimeMode: resumeTimeModeSelect ? resumeTimeModeSelect.value : "TBC",
      startDate: getCurrentStartDateValues(),
      rows: rows,
    };
  }

  function applyState(state) {
    if (!state) return;

    if (faultDescriptionInput) faultDescriptionInput.value = state.faultDescription || "";
    if (findingInput) findingInput.value = state.finding || "";
    if (rootCauseInput) rootCauseInput.value = state.rootCause || "";
    if (actionTakenInput) actionTakenInput.value = state.actionTaken || "";
    if (resumeTimeInput) resumeTimeInput.value = state.resumeTime || "";

    if (state.startDate && startDateYearSelect && startDateMonthSelect && startDateDaySelect) {
      if (state.startDate.year) startDateYearSelect.value = state.startDate.year;
      if (state.startDate.month) startDateMonthSelect.value = state.startDate.month;
      refreshStartDateDays(parseInt(startDateYearSelect.value, 10), parseInt(startDateMonthSelect.value, 10));
      if (state.startDate.day) startDateDaySelect.value = state.startDate.day;
      validateStartDate();
    }

    rowsContainer.innerHTML = "";
    rowIdCounter = 0;
    (state.rows || []).forEach(function (rowData) {
      rowIdCounter += 1;
      const fragment = rowTemplate.content.cloneNode(true);
      const rowEl = fragment.querySelector('.note-row');
      rowEl.dataset.rowId = String(rowIdCounter);
      const timeInput = rowEl.querySelector('.time-input');
      const descInput = rowEl.querySelector('.desc-input');
      timeInput.value = rowData.time || "";
      descInput.value = rowData.desc || "";
      rowsContainer.appendChild(fragment);
      attachRowEvents(rowsContainer.querySelector('.note-row:last-child'));
    });

    // If no rows restored, fall back to default 3 rows
    if (!state.rows || state.rows.length === 0) {
      rowsContainer.innerHTML = "";
      rowIdCounter = 0;
      createRow();
      createRow();
      createRow();
    }

    if (faultDescriptionInput) setupAutoResize(faultDescriptionInput);
    if (findingInput) setupAutoResize(findingInput);
    if (rootCauseInput) setupAutoResize(rootCauseInput);
    if (actionTakenInput) setupAutoResize(actionTakenInput);
    if (resumeTimeInput) setupAutoResize(resumeTimeInput);

    if (resumeTimeModeSelect) {
      if (state.resumeTimeMode) {
        resumeTimeModeSelect.value = state.resumeTimeMode;
      }
      applyResumeTimeModeFromSelect();
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

  function resetToDefaultState() {
    // Clear storage first so autosave does not immediately restore old content
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

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

    // Reset date to today via existing initializer
    initStartDateSelectors();

    if (faultDescriptionInput) setupAutoResize(faultDescriptionInput);
    if (findingInput) setupAutoResize(findingInput);
    if (rootCauseInput) setupAutoResize(rootCauseInput);
    if (actionTakenInput) setupAutoResize(actionTakenInput);
    if (resumeTimeInput) setupAutoResize(resumeTimeInput);
    if (resumeTimeModeSelect) {
      resumeTimeModeSelect.value = "TBC";
      applyResumeTimeModeFromSelect();
    }

    validateTimeOrder();
    updateExportButtonState();
  }

  function initResumeTimeControls() {
    if (!resumeTimeModeSelect || !resumeTimeInput) return;

    resumeTimeModeSelect.addEventListener("change", applyResumeTimeModeFromSelect);
    applyResumeTimeModeFromSelect();
  }

  // 新增一行功能已移至齒輪選單中的「在下方新增一行」按鈕

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
      const line = "At " + (time || "--:--") + (processedDesc ? " " + processedDesc : "");
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
    const headerLine = "Date: " + (headerDate || "----/--/--") + " Time: " + (firstTimeText || "--:--");

    let content = headerLine + "\n\n" + lines.join("\n\n");

    const memoExport = getMemoExportText();
    if (memoExport) {
      content += "\n\n" + memoExport;
    }

    return content;
  }

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
          window.alert("無法自動複製到剪貼簿，請手動複製以下內容：\n\n" + content);
        });
    } else {
      window.alert("請手動複製以下內容：\n\n" + content);
    }
  });

  const excelBtn = document.getElementById("excel-btn");
  const whatsappBtn = document.getElementById("whatsapp-btn");
  const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/Hpseqf55gLrCsgoUtEtTn1?s=cl&p=a&mlu=0&ilr=0";

  function areSummaryFieldsFilled() {
    const fd = faultDescriptionInput ? faultDescriptionInput.value.trim() : "";
    const finding = findingInput ? findingInput.value.trim() : "";
    const rc = rootCauseInput ? rootCauseInput.value.trim() : "";
    const at = actionTakenInput ? actionTakenInput.value.trim() : "";
    const rt = resumeTimeInput ? resumeTimeInput.value.trim() : "";
    return fd && finding && rc && at && rt;
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
      // empty line between records
      lines.push("");
    });

    // Remove trailing blank line if exists
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

    const headerLine = "Date: " + (headerDate || "----/--/--") + " Time: " + (firstTime || "--:--");
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
      console.log(window.downloadExcel)
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
      if (!content) {
        window.alert("目前沒有可匯出的內容。");
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(content)
          .then(function () {
            window.open(WHATSAPP_GROUP_URL, "_blank");
          })
          .catch(function () {
            window.open(WHATSAPP_GROUP_URL, "_blank");
            window.alert("無法自動複製到剪貼簿，請在 WhatsApp 中手動貼上以下內容：\n\n" + content);
          });
      } else {
        window.open(WHATSAPP_GROUP_URL, "_blank");
        window.alert("請在 WhatsApp 中手動貼上以下內容：\n\n" + content);
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      const first = window.confirm("確定要清除目前所有內容嗎？");
      if (!first) return;
      const second = window.confirm("再次確認：清除後將無法還原，確定繼續？");
      if (!second) return;
      resetToDefaultState();
    });
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

  createRow();
  createRow();
  createRow();
  if (faultDescriptionInput) {
    setupAutoResize(faultDescriptionInput);
  }
  if (findingInput) {
    setupAutoResize(findingInput);
  }
  if (rootCauseInput) {
    setupAutoResize(rootCauseInput);
  }
  if (actionTakenInput) {
    setupAutoResize(actionTakenInput);
  }
  if (resumeTimeInput) {
    setupAutoResize(resumeTimeInput);
  }

  initStartDateSelectors();

   initMemoControls();
  initResumeTimeControls();

  const restored = loadStateFromStorage();
  if (restored) {
    applyState(restored);
  } else {
    updateExportButtonState();
  }

  // Autosave every 5 seconds
  setInterval(saveStateToStorage, 5000);

  startHktClock();
});
