// general_script.js
// Shared utilities and cross-tab UI behavior for the report generator web app.

// Global pointer to remember which textbox should be updated by translations.
let currentTranslateTargetTextarea = null;
let currentTranslateTargetLabel = "";

// Top-level DOM elements for cross-tab navigation and header/footer.
const reportMain = document.getElementById("report-main");
const translateMain = document.getElementById("translate-main");
const smartfillMain = document.getElementById("smartfill-main");
const smartfillNotesInput = document.getElementById("smartfill-notes");
const footerTabs = document.querySelectorAll(".footer-tab");
const pageTitleTextEl = document.getElementById("page-title-text");
const appFooter = document.querySelector(".app-footer");
const hktClockEl = document.getElementById("hkt-clock");
const historyToolbar = document.querySelector(".history-toolbar");



// Shared auto-resize helper used by multiple pages.
// resizeToContent can be called whenever code updates a textarea's value
// programmatically to keep height in sync with its content.
function resizeToContent(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

function setupAutoResize(textarea) {
  if (!textarea) return;
  function resize() {
    resizeToContent(textarea);
  }
  textarea.addEventListener("input", resize);
  resize();
}

function scrollFieldIntoViewWithHeaderOffset(el) {
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const headerEl = document.querySelector(".app-header");
  const titleBarEl = document.getElementById("page-title-bar");

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
    behavior: "smooth",
  });
}

// HKT clock in the header.
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

// On mobile browsers, the viewport can shrink when the software keyboard appears.
// To avoid the fixed footer visually jumping upward, hide it while an input/textarea/select
// is focused and restore it on blur.
function initFooterKeyboardBehavior() {
  if (!appFooter) return;

  const isProbablyMobile =
    window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  if (!isProbablyMobile) return;

  function maybeHideFooter(target) {
    if (!target) return;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      appFooter.classList.add("footer-hide-when-keyboard");
    }
  }

  function restoreFooter() {
    appFooter.classList.remove("footer-hide-when-keyboard");
  }

  document.addEventListener("focusin", function (e) {
    maybeHideFooter(e.target);
  });

  document.addEventListener("focusout", function () {
    setTimeout(restoreFooter, 50);
  });
}

function updatePageTitle(name) {
  if (!pageTitleTextEl) return;
  if (name === "report") {
    pageTitleTextEl.textContent = "事件報表";
  } else if (name === "translate") {
    pageTitleTextEl.textContent = "英語翻譯";
  } else if (name === "smartfill") {
    pageTitleTextEl.textContent = "快速輸入";
  }
}

function showTab(name) {
  if (!reportMain || !translateMain || !smartfillMain) {
    return;
  }

  const map = {
    report: reportMain,
    translate: translateMain,
    smartfill: smartfillMain,
  };


  // remember which tab was active before change
  const previousActiveTab = Array.from(footerTabs || []).find(function (tab) {
    return tab.classList.contains("footer-tab-active");
  });

  Object.keys(map).forEach(function (key) {
    const section = map[key];
    if (!section) return;
    if (key === name) {
      section.classList.remove("hidden");
    } else {
      section.classList.add("hidden");
    }
  });

    footerTabs.forEach(function (tab) {
    tab.classList.remove("footer-tab-pop-in", "footer-tab-pop-out");

    if (tab.dataset && tab.dataset.tab === name) {
      tab.classList.add("footer-tab-active");
      tab.classList.add("footer-tab-pop-in");
    } else {
      const wasActive = tab.classList.contains("footer-tab-active");
      tab.classList.remove("footer-tab-active");
      if (wasActive && tab === previousActiveTab) {
        tab.classList.add("footer-tab-pop-out");
      }
    }
  });

  if (historyToolbar) {
    if (name === "report") {
      historyToolbar.classList.remove("hidden");
    } else {
      historyToolbar.classList.add("hidden");
    }
  }

  updatePageTitle(name);
}


// Update the visible indicator to show which field will be updated by translation.
function updateTranslateTargetIndicator() {
  const indicator = document.getElementById("translate-target-indicator");
  if (!indicator) return;

  if (!currentTranslateTargetTextarea) {
    indicator.textContent = "尚未選擇要更新的欄位";
  } else {
    indicator.textContent = "目前將更新欄位：\n" + currentTranslateTargetLabel;
  }
}

// Select which textarea should be updated by translations.
function setTranslateTarget(textarea, label) {
  currentTranslateTargetTextarea = textarea || null;
  currentTranslateTargetLabel = textarea ? (label || "（未命名欄位）") : "";

  try {
    window.currentTranslateTargetTextarea = currentTranslateTargetTextarea;
    window.currentTranslateTargetLabel = currentTranslateTargetLabel;
  } catch (e) {}

  updateTranslateTargetIndicator();
}

// Footer tab click behaviour, wired once at startup.
function initFooterTabs() {
  if (footerTabs && footerTabs.length) {
    footerTabs.forEach(function (tab) {
      const targetTab = tab.dataset ? tab.dataset.tab : null;
      tab.addEventListener("click", function () {
        showTab(targetTab || "report");
      });
    });
    showTab("report");
  } else {
    showTab("report");
  }
}

// Initialisation for general UI.
if (smartfillNotesInput) {
  setupAutoResize(smartfillNotesInput);
}
updateTranslateTargetIndicator();
initFooterKeyboardBehavior();
startHktClock();
initFooterTabs();


// Expose shared helpers for other scripts.
window.setupAutoResize = window.setupAutoResize || setupAutoResize;
window.resizeToContent = window.resizeToContent || resizeToContent;
window.setTranslateTarget = window.setTranslateTarget || setTranslateTarget;
window.updateTranslateTargetIndicator =
  window.updateTranslateTargetIndicator || updateTranslateTargetIndicator;
window.showTab = window.showTab || showTab;
window.scrollFieldIntoViewWithHeaderOffset =
  window.scrollFieldIntoViewWithHeaderOffset || scrollFieldIntoViewWithHeaderOffset;

