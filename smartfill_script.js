// Smartfill dashboard logic
// Assumes extracted_faults_v20260914.json is served in the same directory.

(function () {
  const DATA_URL = './extracted_faults_v20260914.json';

  let rawData = [];
    let groupedData = []; // [{ faultDesc, entries: [{...}] }]
  let currentQuery = '';
  let dashboardEl;
  let searchInputEl;
  let toggleAllBtnEl;
  let sortBtnEl;          // 排序按鈕
  let sortMode = 'id';    // 'id' (編號排序) 或 'az' (A-Z 排序)

  // Smartfill 套用模式狀態

  let applyOverlayEl;
  let applyModeActive = false;
  let applyText = '';
  let applyLabel = '';
  let applyHitboxContainerEl = null;
  let accordionClickTimer = null;


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmartfill);
  } else {
    initSmartfill();
  }

    function initSmartfill() {
        dashboardEl = document.getElementById('smartfill-dashboard');
    searchInputEl = document.getElementById('smartfill-search');
    toggleAllBtnEl = document.getElementById('smartfill-toggle-all');
    applyOverlayEl = document.getElementById('smartfill-apply-overlay');
    sortBtnEl = document.getElementById('smartfill-sort');

    if (!dashboardEl) return;

    wireEvents();

    // Smartfill 套用模式：在捕獲階段攔截點擊
    document.addEventListener('click', handleApplyModeClick, true);

    // 根據目前排序模式更新按鈕文字
    updateSortButtonLabel();

    loadData();
  }




    function wireEvents() {
        if (searchInputEl) {
      searchInputEl.addEventListener('input', () => {
        currentQuery = searchInputEl.value || '';
        render();
      });
    }

    if (toggleAllBtnEl) {

      toggleAllBtnEl.addEventListener('click', handleToggleAll);
    }

    // 排序模式切換
    if (sortBtnEl) {
      sortBtnEl.addEventListener('click', handleSortToggle);
    }

    // Delegate clicks inside dashboard

    if (dashboardEl) {
      dashboardEl.addEventListener('click', (e) => {
        const headerBtn = e.target.closest('.smartfill-accordion-header');
        if (headerBtn) {
          const accordion = headerBtn.closest('.smartfill-accordion');
          if (accordion) {
            clearTimeout(accordionClickTimer);
            accordionClickTimer = setTimeout(() => {
              toggleAccordion(accordion);
              accordionClickTimer = null;
            }, 250);
          }
          return;
        }

        const chip = e.target.closest('.smartfill-chip');
        if (chip) {
          handleChipClick(chip);
          return;
        }
      });

      dashboardEl.addEventListener('dblclick', (e) => {
        const headerBtn = e.target.closest('.smartfill-accordion-header');
        if (!headerBtn) return;

        const accordion = headerBtn.closest('.smartfill-accordion');
        const entryIndex = accordion ? accordion.getAttribute('data-smartfill-entry-index') : null;
        const entry = entryIndex == null ? null : rawData[Number(entryIndex)];
        if (!entry) return;

        clearTimeout(accordionClickTimer);
        accordionClickTimer = null;
        e.preventDefault();
        e.stopPropagation();
        handleCompleteTemplateOverwrite(entry);
      });
    }
  }

  async function loadData() {
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rawData = await res.json();
      groupedData = groupByFaultDescription(rawData);
      render();
    } catch (err) {
      console.error('Failed to load smartfill data:', err);
      if (dashboardEl) {
        dashboardEl.innerHTML = `
          <div class="field-error">無法載入歷史事件資料，請稍後再試。</div>
        `;
      }
    }
  }

  function groupByFaultDescription(data) {
    const map = new Map();
    data.forEach((item, idx) => {
      const faultDesc = item['Fault description'] || 'Unknown fault';
      if (!map.has(faultDesc)) {
        map.set(faultDesc, []);
      }
      map.get(faultDesc).push({
        ...item,
        _id: idx
      });
    });

    const groups = [];
    for (const [faultDesc, entries] of map.entries()) {
      groups.push({ faultDesc, entries });
    }

    // Optional: sort alphabetically by fault description
    groups.sort((a, b) => a.faultDesc.localeCompare(b.faultDesc));
    return groups;
  }

  function render() {
    if (!dashboardEl) return;
    if (!groupedData.length) {
      dashboardEl.innerHTML = `<div>載入中...</div>`;
      return;
    }

    const { filteredGroups, isFiltered } = filterByQuery(groupedData, currentQuery);

    if (!filteredGroups.length) {
      dashboardEl.innerHTML = `
        <div class="field-error">沒有符合「${escapeHtml(currentQuery)}」的紀錄。</div>
      `;
      return;
    }

    // 將過濾後的群組展平為單一陣列，方便排序
    const flatEntries = [];
    filteredGroups.forEach((group, groupIdx) => {
      group.entries.forEach((entry, entryIdx) => {
        flatEntries.push({ groupIdx, entryIdx, entry });
      });
    });

    // 根據目前排序模式排序
    flatEntries.sort((a, b) => {
      const ea = a.entry;
      const eb = b.entry;

      if (sortMode === 'id') {
        return getEntryNumericId(ea) - getEntryNumericId(eb);
      }

      // sortMode === 'az'：先依 Fault description，再依編號
      const ta = (ea['Fault description'] || '').toString();
      const tb = (eb['Fault description'] || '').toString();
      const nameCmp = ta.localeCompare(tb);
      if (nameCmp !== 0) return nameCmp;

      return getEntryNumericId(ea) - getEntryNumericId(eb);
    });

    const accordions = flatEntries.map(({ groupIdx, entryIdx, entry }) =>
      renderAccordion(groupIdx, entryIdx, entry)
    );

    const html = `
      <div class="smartfill-accordion-list">
        ${accordions.join('')}
      </div>
    `;
    dashboardEl.innerHTML = html;
  }

  // 排序模式切換：在「編號」與「A-Z」之間
  function handleSortToggle() {
    sortMode = sortMode === 'id' ? 'az' : 'id';
    updateSortButtonLabel();
    render();
  }

  // 根據 sortMode 更新排序按鈕上的文字
  function updateSortButtonLabel() {
    if (!sortBtnEl) return;
    if (sortMode === 'id') {
      // 目前是以編號排序，按鈕提示切換為 A-Z
      sortBtnEl.textContent = '🅰️🅱️ 變更為以A-Z排序';
    } else {
      // 目前是以 A-Z 排序，按鈕提示切換為編號
      sortBtnEl.textContent = ' 1️⃣2️⃣3️⃣ 變更為以編號排序';
    }
  }

  // 取得用於排序的數值 ID：優先使用 JSON 中的 id，其次用 _id
  function getEntryNumericId(entry) {
    if (!entry) return Infinity;
    if (entry.id != null && !Number.isNaN(Number(entry.id))) {
      return Number(entry.id);
    }
    if (entry._id != null) {
      return entry._id;
    }
    return Infinity;
  }


  function filterByQuery(groups, query) {

    const q = (query || '').trim().toLowerCase();
    if (!q) {
      // no filtering, no match annotations
      return {
        filteredGroups: groups.map((g) => ({
          faultDesc: g.faultDesc,
          entries: g.entries.map((e) => ({ ...e, _matchInfo: null }))
        })),
        isFiltered: false
      };
    }

    const filteredGroups = [];

    groups.forEach((group) => {
      const matchedEntries = [];

      group.entries.forEach((entry) => {
        const matchInfo = {
          hasMatch: false,
          fields: {}, // fieldName -> true
          sequenceRows: {} // rowKey -> true
        };

        function checkField(fieldName) {
          const val = (entry[fieldName] || '').toString();
          if (!val) return;
          if (val.toLowerCase().includes(q)) {
            matchInfo.hasMatch = true;
            matchInfo.fields[fieldName] = true;
          }
        }

        checkField('Fault description');
        checkField('Finding');
        checkField('Root cause');
        checkField('Action Taken');

        const seq = entry['Sequency of event'] || {};
        Object.entries(seq).forEach(([rowKey, text]) => {
          const t = (text || '').toString();
          if (!t) return;
          if (t.toLowerCase().includes(q)) {
            matchInfo.hasMatch = true;
            matchInfo.sequenceRows[rowKey] = true;
          }
        });

        if (matchInfo.hasMatch) {
          matchedEntries.push({ ...entry, _matchInfo: matchInfo });
        }
      });

      if (matchedEntries.length) {
        filteredGroups.push({
          faultDesc: group.faultDesc,
          entries: matchedEntries
        });
      }
    });

    return { filteredGroups, isFiltered: true };
  }

  

    function renderAccordion(groupIdx, entryIdx, entry) {
    const finding = entry['Finding'] || '';
    const rootCause = entry['Root cause'] || '';
    const actionTaken = entry['Action Taken'] || '';
    const seq = entry['Sequency of event'] || {};
    const matchInfo = entry._matchInfo;

    const headerTitle = entry['Fault description'] || '事件詳情';
    const metaText = rootCause ? `Root cause: ${rootCause}` : (actionTaken ? `Action: ${actionTaken}` : '');

    const idBase = `g${groupIdx}-e${entryIdx}`;

    const matchFields = matchInfo && matchInfo.fields ? matchInfo.fields : {};
    const matchRows = matchInfo && matchInfo.sequenceRows ? matchInfo.sequenceRows : {};

    const faultDescChip = renderChip(
      'Fault description',
      entry['Fault description'] || '',
      !!matchFields['Fault description']
    );

    const findingChip = finding
      ? renderChip('Finding', finding, !!matchFields['Finding'])
      : '';

    const rootCauseChip = rootCause
      ? renderChip('Root cause', rootCause, !!matchFields['Root cause'])
      : '';

    const actionChip = actionTaken
      ? renderChip('Action Taken', actionTaken, !!matchFields['Action Taken'])
      : '';

    const seqHtml = renderTimeline(seq, matchRows);

    // Prefer JSON id; fallback to internal _id + 1 if needed
    const displayId =
      entry.id != null
        ? entry.id
        : (entry._id != null ? entry._id + 1 : '');

    const hasDetailChips = !!(findingChip || rootCauseChip || actionChip);

    return `
      <article class="smartfill-accordion" data-accordion-id="${idBase}" data-smartfill-entry-index="${entry._id}">
        <button type="button" class="smartfill-accordion-header">
          <div class="smartfill-accordion-header-main">
            <div class="smartfill-accordion-id">
              ${displayId !== '' ? escapeHtml(displayId.toString()) : ''}
            </div>
            <div class="smartfill-accordion-title">
              ${escapeHtml(truncateText(headerTitle, 80))}
            </div>
            ${metaText ? `<div class="smartfill-accordion-meta">${escapeHtml(truncateText(metaText, 120))}</div>` : ''}
          </div>
          <div class="smartfill-accordion-chevron">▶</div>
        </button>
        <div class="smartfill-accordion-body">
          <div class="smartfill-card-meta-block smartfill-card-meta-block--top">
            ${faultDescChip}
          </div>
          ${seqHtml}
          ${
            hasDetailChips
              ? `
          <div class="smartfill-card-meta-block smartfill-card-meta-block--bottom">
            ${findingChip}
            ${rootCauseChip}
            ${actionChip}
          </div>
          `
              : ''
          }
        </div>
      </article>
    `;
  }


  function renderChip(label, text, isMatch) {
    if (!text) return '';
    const classes = ['smartfill-chip', 'smartfill-chip--labeled'];
    if (isMatch) classes.push('smartfill-chip--match');

    return `
      <button type="button" class="${classes.join(' ')}" data-chip-text="${escapeHtmlAttr(text)}">
        <span class="smartfill-chip-label">${escapeHtml(label)}:</span>
        <span class="smartfill-chip-text">${escapeHtml(text)}</span>
      </button>
    `;
  }

  function renderTimeline(seqObj, matchRows) {
    const entries = Object.entries(seqObj || {});
    if (!entries.length) {
      // still a button to satisfy "each text item should be a button"
      const chip = renderChip('Sequence', 'No sequence of event recorded.', false);
      return `
        <div class="smartfill-empty-sequence">
          ${chip}
        </div>
      `;
    }

        const itemsHtml = entries.map(([rowKey, text], idx) => {
      const isMatch = !!matchRows[rowKey];
      const classes = ['smartfill-chip', 'smartfill-timeline-chip'];
      if (isMatch) classes.push('smartfill-chip--match');

      return `
        <li class="smartfill-timeline-item">
          <div class="smartfill-timeline-marker-wrap">
            <div class="smartfill-timeline-dot"></div>
            <div class="smartfill-timeline-line"></div>
          </div>
          <button
            type="button"
            class="${classes.join(' ')}"
            data-chip-text="${escapeHtmlAttr(text || '')}"
          >
            <span class="smartfill-chip-text">${escapeHtml(text || '')}</span>
          </button>
        </li>
      `;
    }).join('');

    return `
      <div class="smartfill-timeline">
        <div class="smartfill-timeline-label">Sequency of event</div>
        <ol class="smartfill-timeline-list">
          ${itemsHtml}
        </ol>
      </div>
    `;
  }

    function handleChipClick(chipEl) {
    const text = chipEl.getAttribute('data-chip-text') || chipEl.textContent || '';
    if (!text.trim()) return;

    // 綠色 pulse 效果，只在點擊時觸發，動畫結束後移除 class
    triggerChipPulse(chipEl);

    // labeled chip：上方 meta 區域 + timeline chip 都算
    const isLabeled =
      chipEl.classList.contains('smartfill-chip--labeled') ||
      chipEl.classList.contains('smartfill-timeline-chip');

    if (isLabeled) {
      // Smartfill 套用模式：帶著此文字切到報表頁並等待使用者點選欄位
      const labelEl = chipEl.querySelector('.smartfill-chip-label');
      let rawLabel = '';

      if (labelEl) {
        rawLabel = labelEl.textContent || '';
      } else if (chipEl.classList.contains('smartfill-timeline-chip')) {
        // timeline 的 chip 沒有 label span，統一當作「Sequence」
        rawLabel = 'Sequence';
      }

      const label = rawLabel.replace(/:\s*$/, '');
      startSmartfillApplyFlow(text, label);
    } else {
      // 非 labeled chip 保持原有：單純複製到剪貼簿
      copyChipTextToClipboard(text);
    }
  }

  function triggerChipPulse(chipEl) {

    chipEl.classList.remove('smartfill-chip--copied');
    // 重新觸發動畫
    void chipEl.offsetWidth;
    chipEl.classList.add('smartfill-chip--copied');

    // 在動畫結束後移除，避免重新展開 accordion 時自動播放
    setTimeout(() => {
      chipEl.classList.remove('smartfill-chip--copied');
    }, 600);
  }

  function copyChipTextToClipboard(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(trimmed).catch(() => {
        fallbackCopyText(trimmed);
      });
    } else {
      fallbackCopyText(trimmed);
    }
  }

  function fallbackCopyText(text) {

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.warn('Copy failed:', err);
    } finally {
      document.body.removeChild(textarea);
    }
  }

    function toggleAccordion(accordionEl) {
    const isOpen = accordionEl.classList.contains('open');
    if (isOpen) {
      accordionEl.classList.remove('open');
    } else {
      accordionEl.classList.add('open');
    }
  }

    function handleCompleteTemplateOverwrite(entry) {
    const faultDescription = entry['Fault description'] || '';
    const confirmationText = `你確定要抹除現有資料，以使用
報告模板(# ${entry.id != null ? entry.id : entry._id + 1})：
(${faultDescription})
嗎？`;

    if (!window.confirm(confirmationText)) return;
    if (!window.confirm('再次確認：現有進度/資料將無法尋回。繼續套用模板？')) return;

    // Capture previous state: rows + key fields
    const prevRows = [];
    const rowsContainerEl = document.getElementById('rows-container');
    if (rowsContainerEl) {
      Array.from(rowsContainerEl.querySelectorAll('.note-row')).forEach(function (rowEl) {
        const time = (rowEl.querySelector('.time-input') || {}).value || '';
        const desc = (rowEl.querySelector('.desc-input') || {}).value || '';
        const rowId = rowEl.dataset.rowId || '';
        prevRows.push({ rowId, time, desc });
      });
    }

    const faultDescriptionInput = document.getElementById('fault-description');
    const findingInput = document.getElementById('finding');
    const rootCauseInput = document.getElementById('root-cause');
    const actionTakenInput = document.getElementById('action-taken');

    const prevFaultDescription = faultDescriptionInput ? faultDescriptionInput.value : '';
    const prevFinding = findingInput ? findingInput.value : '';
    const prevRootCause = rootCauseInput ? rootCauseInput.value : '';
    const prevActionTaken = actionTakenInput ? actionTakenInput.value : '';

    if (typeof showTab === 'function') {
      showTab('report');
    }

    if (faultDescriptionInput) {
      faultDescriptionInput.value = faultDescription;
    }

    setSmartfillSummaryValue('finding', entry['Finding'] || '');
    setSmartfillSummaryValue('root-cause', entry['Root cause'] || '');
    setSmartfillSummaryValue('action-taken', entry['Action Taken'] || '');

    const sequence = entry['Sequency of event'] || {};
    const descriptions = Object.keys(sequence).map((key) => sequence[key] || '');
    if (typeof replaceSequenceRowsFromSmartfill === 'function') {
      replaceSequenceRowsFromSmartfill(descriptions);
    }

    // Capture next rows after overwrite
    const nextRows = [];
    if (rowsContainerEl) {
      Array.from(rowsContainerEl.querySelectorAll('.note-row')).forEach(function (rowEl) {
        const time = (rowEl.querySelector('.time-input') || {}).value || '';
        const desc = (rowEl.querySelector('.desc-input') || {}).value || '';
        const rowId = rowEl.dataset.rowId || '';
        nextRows.push({ rowId, time, desc });
      });
    }

        // After template adoption, clear history stacks to make this irreversible.
    if (typeof window.clearHistoryStacks === 'function') {
      window.clearHistoryStacks();
    }
  }



  function setSmartfillSummaryValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    prepareSummaryFieldForManualModeIfNeeded(field);
    field.value = value;
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
  }

  function startSmartfillApplyFlow(text, label) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    applyText = trimmed;
    applyLabel = label || '';
    applyModeActive = true;

    // 切換到底部的「事件報表」頁
    if (typeof showTab === 'function') {
      showTab('report');
    }

    // 顯示灰色遮罩，並讓指定欄位浮在上方
    document.body.classList.add('smartfill-apply-active');
    if (applyOverlayEl) {
      applyOverlayEl.classList.remove('hidden');
    }

    // 等 layout 更新後建立欄位 hitbox 並捲動到預設目標，但不主動 focus。
    requestAnimationFrame(() => {
      createSmartfillHitboxes();
      const targetEl = getDefaultTargetElementForLabel(applyLabel) || document.getElementById('report-main');
      if (targetEl) {
        scrollElementIntoViewWithHeaderOffset(targetEl);
      }
    });
  }

  function exitSmartfillApplyFlow() {
    if (applyHitboxContainerEl) {
      applyHitboxContainerEl.remove();
      applyHitboxContainerEl = null;
    }

    applyModeActive = false;
    applyText = '';
    applyLabel = '';
    document.body.classList.remove('smartfill-apply-active');
    if (applyOverlayEl) {
      applyOverlayEl.classList.add('hidden');
    }
  }

        function createSmartfillHitboxes() {
    if (applyHitboxContainerEl) {
      applyHitboxContainerEl.remove();
    }

    applyHitboxContainerEl = document.createElement('div');
    applyHitboxContainerEl.className = 'smartfill-apply-hitbox-container';

    const fields = Array.from(document.querySelectorAll(
      '#fault-description, .desc-input, .bottom-textarea'
    ));

    // 1. 建立每個輸入欄位上的透明 hitbox（點擊後直接套入文字）
    fields.forEach((field) => {
      const rect = field.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const hitbox = document.createElement('div');
      hitbox.className = 'smartfill-apply-hitbox';
      hitbox.style.left = `${rect.left + window.scrollX}px`;
      hitbox.style.top = `${rect.top + window.scrollY}px`;
      hitbox.style.width = `${rect.width}px`;
      hitbox.style.height = `${rect.height}px`;
      hitbox._smartfillField = field;
      applyHitboxContainerEl.appendChild(hitbox);
    });

    // 2. 在「備注」Subheading 那一行中間加上一顆綠色圓形 + 按鈕
    const memoLabel = document.querySelector('label[for="memo-mode"]');
    if (memoLabel) {
      const labelRow = memoLabel.closest('.field-label-row');
      if (labelRow) {
        const rect = labelRow.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const size = 32; // 直徑

          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'smartfill-add-row-btn';
          addBtn.textContent = '+';
          addBtn.setAttribute('aria-label', '使用 Smartfill 文字新增一行事件');
          addBtn.style.pointerEvents = 'auto';
          addBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleSmartfillAddRow();
          });

          // 水平置中於備注 Subheading 那一行，垂直置中
          addBtn.style.left = `${rect.left + window.scrollX + (rect.width - size) / 2}px`;
          addBtn.style.top = `${rect.top + window.scrollY + (rect.height - size) / 2}px`;
          addBtn.style.width = `${size}px`;
          addBtn.style.height = `${size}px`;

          applyHitboxContainerEl.appendChild(addBtn);
        }
      }
    }

    document.body.appendChild(applyHitboxContainerEl);
  }



  function getDefaultTargetElementForLabel(label) {
    const normalized = (label || '').trim().toLowerCase();

    if (normalized === 'fault description') {
      return document.getElementById('fault-description');
    }
    if (normalized === 'finding') {
      return document.getElementById('finding');
    }
    if (normalized === 'root cause') {
      return document.getElementById('root-cause');
    }
    if (normalized === 'action taken') {
      return document.getElementById('action-taken');
    }
    if (normalized === 'sequence') {
      // 簡化：捲到事件表格的 header
      return document.querySelector('.note-header') || document.getElementById('rows-container');
    }

    return null;
  }

    function scrollElementIntoViewWithHeaderOffset(el) {
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const headerEl = document.querySelector('.app-header');
    const titleBarEl = document.getElementById('page-title-bar');

    const headerHeight =
      (headerEl ? headerEl.offsetHeight : 0) +
      (titleBarEl ? titleBarEl.offsetHeight : 0);

    const extraOffset = 8;

    const targetTopInDocument = rect.top + window.scrollY;
    let targetScrollY = targetTopInDocument - headerHeight - extraOffset;

    if (targetScrollY < 0) {
      targetScrollY = 0;
    }

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth'
    });
  }

    function handleApplyModeClick(event) {
    if (!applyModeActive) return;

    const target = event.target;

    // 先處理備注欄位上的綠色「+」按鈕
    const addBtn = target.closest('.smartfill-add-row-btn');
    if (addBtn) {
      // The button has its own handler; leave the event in the target phase.
      return;
    }

    const hitbox = target.closest('.smartfill-apply-hitbox');
    const directField = target.closest('#fault-description, .desc-input, .bottom-textarea');
    const isControl = !!target.closest('select, button, input, label');
    const field = !isControl && ((hitbox && hitbox._smartfillField) || directField);
    if (field) {
      event.preventDefault();
      event.stopPropagation();

      // 對底部 summary 欄位：若目前為 TBC 等模式且 disabled，先切換為「手動輸入文字」模式
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

        // 黃色 flash，表示欄位已更新
        flashUpdatedField(field);

        if (typeof window.recordSmartfillFieldChange === 'function') {
          window.recordSmartfillFieldChange(field, prev, next);
        }
      }

      exitSmartfillApplyFlow();
      return;

    }

    // 點在灰色遮罩上，視為取消
    if (applyOverlayEl && applyOverlayEl.contains(target)) {
      event.preventDefault();
      event.stopPropagation();
      exitSmartfillApplyFlow();
      return;
    }

    // 其它任何點擊在套用模式中都被吃掉，避免誤操作
    event.preventDefault();
    event.stopPropagation();
    exitSmartfillApplyFlow();
  }

  function handleSmartfillAddRow() {
    const textToUse = (applyText || '').trim();
    if (textToUse && typeof addSequenceRowFromSmartfill === 'function') {
      addSequenceRowFromSmartfill(textToUse);
    }

    // Memo is intentionally untouched; only the sequence receives the text.
    exitSmartfillApplyFlow();
  }


  function flashUpdatedField(field) {
    if (!field) return;
    field.classList.remove('translate-updated-flash');
    // 重新觸發動畫
    void field.offsetWidth;
    field.classList.add('translate-updated-flash');
    setTimeout(() => {
      field.classList.remove('translate-updated-flash');
    }, 800);
  }

    function prepareSummaryFieldForManualModeIfNeeded(field) {
    if (!field || !field.classList.contains('bottom-textarea')) {
      return;
    }

    const id = field.id || '';

    if (id === 'finding') {
      const modeSelect = document.getElementById('finding-mode');
      if (modeSelect) {
        modeSelect.value = 'FREE';
        if (typeof applySummaryModeFromSelect === 'function') {
          applySummaryModeFromSelect(modeSelect, field);
        }
        if ('disabled' in field) {
          field.disabled = false;
        }
      }
      return;
    }

    if (id === 'root-cause') {
      const modeSelect = document.getElementById('root-cause-mode');
      if (modeSelect) {
        modeSelect.value = 'FREE';
        if (typeof applySummaryModeFromSelect === 'function') {
          applySummaryModeFromSelect(modeSelect, field);
        }
        if ('disabled' in field) {
          field.disabled = false;
        }
      }
      return;
    }

    if (id === 'action-taken') {
      const modeSelect = document.getElementById('action-taken-mode');
      if (modeSelect) {
        modeSelect.value = 'FREE';
        if (typeof applySummaryModeFromSelect === 'function') {
          applySummaryModeFromSelect(modeSelect, field);
        }
        if ('disabled' in field) {
          field.disabled = false;
        }
      }
      return;
    }

    if (id === 'resume-time') {
      const modeSelect = document.getElementById('resume-time-mode');
      if (modeSelect) {
        modeSelect.value = 'FREE';
        if (typeof applyResumeTimeModeFromSelect === 'function') {
          applyResumeTimeModeFromSelect();
        }
        if ('disabled' in field) {
          field.disabled = false;
        }
      }
      return;
    }

    // Sequency of event 的備註（備注 / memo），同樣在 Smartfill 套用時切換為手動模式
    if (id === 'memo-text') {
      const modeSelect = document.getElementById('memo-mode');
      if (modeSelect) {
        modeSelect.value = 'FREE';
        if (typeof applyMemoModeFromSelect === 'function') {
          applyMemoModeFromSelect();
        }
        if ('disabled' in field) {
          field.disabled = false;
        }
      }
    }
  }


  function handleToggleAll() {



    if (!dashboardEl) return;
    const allAccordions = Array.from(dashboardEl.querySelectorAll('.smartfill-accordion'));
    if (!allAccordions.length) return;

    const anyClosed = allAccordions.some((acc) => !acc.classList.contains('open'));
    if (anyClosed) {
      allAccordions.forEach((acc) => acc.classList.add('open'));
      toggleAllBtnEl.textContent = '摺疊全部';
      toggleAllBtnEl.classList.add('smartfill-toggle-all-collapse');
    } else {
      allAccordions.forEach((acc) => acc.classList.remove('open'));
      toggleAllBtnEl.textContent = '展開全部';
      toggleAllBtnEl.classList.remove('smartfill-toggle-all-collapse');
    }
  }

  // Utility: derive type badge from fault description
  function deriveTypeBadge(faultDesc) {
    const s = (faultDesc || '').toUpperCase();
    if (s.includes('PSD')) return 'PSD';
    if (s.includes('PED')) return 'PED';
    if (s.includes('ESC')) return 'ESCALATOR';
    if (s.includes('LIFT') || s.includes('PL') || s.includes('FL')) return 'LIFT';
    if (s.includes('FIRE')) return 'FIRE ALARM';
    return '';
  }

  function truncateText(str, max) {
    const s = (str || '').toString();
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeHtmlAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }
})();
