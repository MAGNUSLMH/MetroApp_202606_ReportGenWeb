document.addEventListener("DOMContentLoaded", function () {
  const rowsContainer = document.getElementById("rows-container");
  const addRowBtn = document.getElementById("add-row-btn");
  const exportBtn = document.getElementById("export-btn");
  const rowTemplate = document.getElementById("row-template");

  const faultDescriptionInput = document.getElementById("fault-description");
  const findingInput = document.getElementById("finding");
  const rootCauseInput = document.getElementById("root-cause");
  const actionTakenInput = document.getElementById("action-taken");
  const resumeTimeInput = document.getElementById("resume-time");
  const startDateYearSelect = document.getElementById("start-date-year");
  const startDateMonthSelect = document.getElementById("start-date-month");
  const startDateDaySelect = document.getElementById("start-date-day");
  const startDateError = document.getElementById("start-date-error");
  const resetBtn = document.getElementById("reset-btn");

  let rowIdCounter = 0;

  const STORAGE_KEY = "fault_report_form_v1";

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

  function attachRowEvents(rowEl) {
    const timeInput = rowEl.querySelector(".time-input");
    const popup = rowEl.querySelector(".time-popup");
    const hourInput = rowEl.querySelector(".hour-input");
    const minuteInput = rowEl.querySelector(".minute-input");
    const ampmSelect = rowEl.querySelector(".ampm-select");
    const formatRadios = rowEl.querySelectorAll(".time-format-toggle input[type=radio]");
    const okBtn = rowEl.querySelector(".time-ok-btn");
    const cancelBtn = rowEl.querySelector(".time-cancel-btn");
    const errorBox = rowEl.querySelector(".time-error");
    const moveRowBtn = rowEl.querySelector(".move-row-btn");
    const descInput = rowEl.querySelector(".desc-input");

    const radioName = "time-format-" + rowEl.dataset.rowId;
    formatRadios.forEach(function (radio) {
      radio.name = radioName;
    });

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
      let mode = "24";
      formatRadios.forEach(function (radio) {
        if (radio.checked) {
          mode = radio.value;
        }
      });
      return mode;
    }

    function setFormatMode(mode) {
      if (mode === "12") {
        hourInput.min = "1";
        hourInput.max = "12";
        ampmSelect.style.display = "inline-block";
      } else {
        hourInput.min = "0";
        hourInput.max = "23";
        ampmSelect.style.display = "none";
      }
    }

    function initPopupFromCurrentValue() {
      clearError();
      const current = parseTimeString(timeInput.value);
      const mode = getSelectedFormat();

      if (current === null) {
        if (mode === "24") {
          hourInput.value = "";
          minuteInput.value = "";
        } else {
          hourInput.value = "";
          minuteInput.value = "";
          ampmSelect.value = "AM";
        }
        return;
      }

      const h24 = Math.floor(current / 60);
      const m = current % 60;

      if (mode === "24") {
        hourInput.value = h24;
        minuteInput.value = m;
      } else {
        let h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        hourInput.value = h12;
        minuteInput.value = m;
        ampmSelect.value = h24 >= 12 ? "PM" : "AM";
      }
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
      if (mode === "24") {
        if (hRaw < 0 || hRaw > 23) {
          showError("時間無效，請重新輸入");
          return null;
        }
        h24 = hRaw;
      } else {
        if (hRaw < 1 || hRaw > 12) {
          showError("時間無效，請重新輸入");
          return null;
        }
        const ampm = ampmSelect.value;
        if (ampm === "AM") {
          h24 = hRaw === 12 ? 0 : hRaw;
        } else {
          h24 = hRaw === 12 ? 12 : hRaw + 12;
        }
      }

      clearError();
      return h24 * 60 + mRaw;
    }

    function showPopup() {
      hideAllPopups(popup);
      popup.classList.remove("hidden");
      setFormatMode(getSelectedFormat());
      initPopupFromCurrentValue();
    }

    function hidePopup() {
      popup.classList.add("hidden");
      clearError();
    }

    timeInput.addEventListener("click", function (e) {
      e.stopPropagation();
      showPopup();
    });

    formatRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        setFormatMode(getSelectedFormat());
        initPopupFromCurrentValue();
      });
    });

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

    moveRowBtn.addEventListener("click", function () {
      const input = window.prompt(
        "請輸入操作:\nU = 向上\nD = 向下\nDelete = 刪除此列",
        "U"
      );
      if (!input) return;

      const trimmed = input.trim();
      const upper = trimmed.toUpperCase();
      const lower = trimmed.toLowerCase();

      if (lower === "delete") {
        rowEl.remove();
        validateTimeOrder();
        updateExportButtonState();
        return;
      }

      if (upper !== "U" && upper !== "D") {
        window.alert("輸入無效，請輸入 U、D 或 Delete。");
        return;
      }

      if (upper === "U") {
        const prev = rowEl.previousElementSibling;
        if (!prev) {
          window.alert("已在最上方，無法再向上移動。");
          return;
        }
        swapRows(rowEl, prev, "up");
      } else {
        const next = rowEl.nextElementSibling;
        if (!next) {
          window.alert("已在最下方，無法再向下移動。");
          return;
        }
        swapRows(rowEl, next, "down");
      }
    });

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
    attachRowEvents(rowsContainer.querySelector('.note-row:last-child'));
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

    validateTimeOrder();
    updateExportButtonState();
  }

  addRowBtn.addEventListener("click", function () {
    createRow();
  });

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

    const rows = Array.from(rowsContainer.querySelectorAll(".note-row"));
    const lines = [];

    rows.forEach(function (row) {
      const time = row.querySelector(".time-input").value.trim();
      const desc = row.querySelector(".desc-input").value.trim();
      if (!time && !desc) {
        return;
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
    });

    if (lines.length === 0) {
      window.alert("目前沒有可匯出的內容。");
      return;
    }

    const content = lines.join("\n");

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

    rows.forEach(function (row) {
      const time = row.querySelector(".time-input").value.trim();
      const desc = row.querySelector(".desc-input").value.trim();
      if (!time && !desc) {
        return;
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

    return lines.join("\n");
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

  const restored = loadStateFromStorage();
  if (restored) {
    applyState(restored);
  } else {
    updateExportButtonState();
  }

  // Autosave every 5 seconds
  setInterval(saveStateToStorage, 5000);
});
