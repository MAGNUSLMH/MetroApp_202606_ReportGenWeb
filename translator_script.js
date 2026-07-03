// translator_script.js
// Logic specific to the translate UI: calling PHP proxies for translation,
// handling GPT + Google results, and wiring "前往翻譯" buttons.

const englishOriginalInput = document.getElementById("english-original");
const englishGoogleInput = document.getElementById("english-google");
const englishEditedInput = document.getElementById("english-edited");
const englishTranslateBtn = document.getElementById("english-translate-btn");

const selectFirstTranslateBtn = document.getElementById(
  "select-first-translate-btn"
);
const selectSecondTranslateBtn = document.getElementById(
  "select-second-translate-btn"
);

const googleTranslateButtons = document.querySelectorAll(
  ".google-translate-btn"
);
const goTranslateButtons = document.querySelectorAll(".go-translate-btn");

function ensureTranslateProxyCookie() {
  try {
    const hostname = window.location && window.location.hostname;
    if (!hostname || hostname.indexOf("free.nf") === -1) {
      return;
    }

    if (document.cookie && document.cookie.indexOf("__test=") !== -1) {
      return;
    }

    if (!document.body) return;

    if (document.getElementById("translate-proxy-bootstrap-frame")) {
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.id = "translate-proxy-bootstrap-frame";
    iframe.src = "translate_proxy.php";
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");
    iframe.onload = function () {
      setTimeout(function () {
        try {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch (e) {}
      }, 0);
    };

    document.body.appendChild(iframe);
  } catch (e) {
    console.error(
      "Failed to pre-warm translate_proxy.php cookie challenge:",
      e
    );
  }
}

async function translateReport(rawText) {
  try {
    const response = await fetch("translate_proxy.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: rawText }),
      credentials: "same-origin",
    });

    const raw = await response.text().catch(function () {
      return "";
    });

    if (!response.ok) {
      throw new Error(
        "翻譯服務回應錯誤 (" + response.status + ") " + raw
      );
    }

    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("translate_proxy.php returned non-JSON response:", raw);
      throw new Error("翻譯服務回傳非 JSON 內容，請聯絡系統管理員。");
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("翻譯服務回傳格式錯誤，請聯絡系統管理員。");
    }

    if (payload.error) {
      throw new Error("翻譯服務錯誤: " + payload.error);
    }

    const translated = payload.translated || "";
    if (!translated) {
      throw new Error("翻譯服務沒有回傳翻譯結果。");
    }

    console.log("Translated Output:", translated);
    return translated;
  } catch (error) {
    console.error("Translation service error:", error);
    throw new Error("翻譯服務回應錯誤: " + error.message);
  }
}

async function translateWithGPT(chineseText) {
  try {
    const response = await fetch("gpt_proxy.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: chineseText }),
      credentials: "same-origin",
    });

    const raw = await response.text().catch(function () {
      return "";
    });

    if (!response.ok) {
      throw new Error(
        "GPT 服務回應錯誤 (" + response.status + ") " + raw
      );
    }

    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("gpt_proxy.php returned non-JSON response:", raw);
      throw new Error("GPT 服務回傳非 JSON 內容，請聯絡系統管理員。");
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("GPT 服務回傳格式錯誤，請聯絡系統管理員。");
    }

    if (payload.error) {
      throw new Error("GPT 服務錯誤: " + payload.error);
    }

    const translated = payload.translated || "";
    if (!translated) {
      throw new Error("GPT 服務沒有回傳翻譯結果。");
    }

    console.log("GPT Output:", translated);
    return translated;
  } catch (error) {
    console.error("GPT service error:", error);
    throw new Error("GPT 服務回應錯誤: " + error.message);
  }
}

async function translateWithT5(englishText) {
  try {
    const response = await fetch("t5_proxy.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: englishText }),
      credentials: "same-origin",
    });

    const raw = await response.text().catch(function () {
      return "";
    });

    if (!response.ok) {
      throw new Error("T5 服務回應錯誤 (" + response.status + ") " + raw);
    }

    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("t5_proxy.php returned non-JSON response:", raw);
      throw new Error("T5 服務回傳非 JSON 內容，請聯絡系統管理員。");
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("T5 服務回傳格式錯誤，請聯絡系統管理員。");
    }

    if (payload.error) {
      throw new Error("T5 服務錯誤: " + payload.error);
    }

    const data = payload.data;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("T5 服務沒有回傳翻譯結果。");
    }

    const t5Result = data[0];
    const text = typeof t5Result === "string" ? t5Result : String(t5Result);

    console.log("T5 Output:", text);
    return text;
  } catch (error) {
    console.error("T5 service error:", error);
    throw new Error("T5 服務回應錯誤: " + error.message);
  }
}

function ensureLastLineHasFullStop(text) {
  if (!text) return text;

  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const originalLine = lines[i];
    const trimmed = originalLine.trim();
    if (!trimmed) {
      continue;
    }

    const hasPunctuation = /[.!?;:EFFFF]/.test(
      trimmed
    );
    if (hasPunctuation) {
      return text;
    }

    lines[i] = originalLine + ".";
    return lines.join("\n");
  }

  return text;
}

function initGoogleTranslateButtons() {
  if (!englishOriginalInput) return;

  function sendToEnglishOriginal(text) {
    if (!text) return;
    englishOriginalInput.value = text;

    if (typeof window.resizeToContent === "function") {
      window.resizeToContent(englishOriginalInput);
    } else {
      englishOriginalInput.style.height = "auto";
      englishOriginalInput.style.height =
        englishOriginalInput.scrollHeight + "px";
    }

    if (typeof showTab === "function") {
      showTab("translate");
    }
    englishOriginalInput.focus();

    // Automatically start translation when coming from the report UI.
    if (englishTranslateBtn && typeof englishTranslateBtn.click === "function") {
      englishTranslateBtn.click();
    }
  }

  if (googleTranslateButtons && googleTranslateButtons.length) {
    googleTranslateButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const target = btn.dataset ? btn.dataset.translateTarget : null;
        let text = "";
        let targetTextarea = null;
        let label = "";

        if (!target) return;

        const faultDescriptionInputEl =
          document.getElementById("fault-description");
        const findingInputEl = document.getElementById("finding");
        const rootCauseInputEl = document.getElementById("root-cause");
        const actionTakenInputEl = document.getElementById("action-taken");
        const resumeTimeInputEl = document.getElementById("resume-time");

        if (target === "fault-description" && faultDescriptionInputEl) {
          targetTextarea = faultDescriptionInputEl;
          label = "Fault Description";
          text = faultDescriptionInputEl.value.trim();
        } else if (target === "finding" && findingInputEl) {
          targetTextarea = findingInputEl;
          label = "Finding (發現)";
          text = findingInputEl.value.trim();
        } else if (target === "root-cause" && rootCauseInputEl) {
          targetTextarea = rootCauseInputEl;
          label = "Root Cause (原因)";
          text = rootCauseInputEl.value.trim();
        } else if (target === "action-taken" && actionTakenInputEl) {
          targetTextarea = actionTakenInputEl;
          label = "Action Taken";
          text = actionTakenInputEl.value.trim();
        } else if (target === "sequence") {
          let seqText = null;
          if (typeof buildExportClipboardContent === "function") {
            seqText = buildExportClipboardContent();
          } else if (
            typeof window.buildExportClipboardContent === "function"
          ) {
            seqText = window.buildExportClipboardContent();
          }
          if (seqText) {
            text = seqText;
          }
        } else if (target === "resume-time" && resumeTimeInputEl) {
          targetTextarea = resumeTimeInputEl;
          label = "Resume time";
          text = resumeTimeInputEl.value.trim();
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

        sendToEnglishOriginal(text);
      });
    });
  }

  if (goTranslateButtons && goTranslateButtons.length) {
    goTranslateButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const source = btn.dataset ? btn.dataset.source : null;
        let text = "";
        let targetTextarea = null;
        let label = "";

        if (source === "memo") {
          const memoTextInputEl = document.getElementById("memo-text");
          if (memoTextInputEl) {
            targetTextarea = memoTextInputEl;
            label = "備注 文字欄";
            text = memoTextInputEl.value.trim();
          }
        } else if (source === "row-desc") {
          const row = btn.closest(".note-row");
          if (row) {
            const descInput = row.querySelector(".desc-input");
            if (descInput) {
              targetTextarea = descInput;
              const rowsContainerEl =
                document.getElementById("rows-container");
              const rows = rowsContainerEl
                ? Array.from(rowsContainerEl.querySelectorAll(".note-row"))
                : [];
              const index = rows.indexOf(row) + 1;
              if (index > 0) {
                label = "事件記錄第 " + index + " 行的描述欄";
              } else {
                label = "事件記錄的描述欄";
              }
              text = descInput.value.trim();
            }
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

        sendToEnglishOriginal(text);
      });
    });
  }
}

function initEnglishTranslate() {
  if (
    !englishTranslateBtn ||
    !englishOriginalInput ||
    !englishGoogleInput ||
    !englishEditedInput
  )
    return;

  englishTranslateBtn.addEventListener("click", async function () {
    const raw = englishOriginalInput.value.trim();
    if (!raw) {
      window.alert("請先在上方輸入要翻譯的文字。");
      return;
    }

    ensureTranslateProxyCookie();

    englishTranslateBtn.disabled = true;
    englishTranslateBtn.classList.add("translate-btn-animating");

    englishGoogleInput.value = "";
    englishEditedInput.value = "";

    try {
      try {
        const gptTranslated = await translateWithGPT(raw);
        englishGoogleInput.value = gptTranslated || "";
        englishGoogleInput.style.height = "auto";
        englishGoogleInput.style.height =
          englishGoogleInput.scrollHeight + "px";
      } catch (gptErr) {
        console.error(gptErr);
        window.alert(
          "GPT 服務目前無法使用，已僅顯示 Google 翻譯。\n\n" +
            (gptErr && gptErr.message ? gptErr.message : "")
        );
        englishGoogleInput.value = "";
        englishGoogleInput.style.height = "auto";
        englishGoogleInput.style.height =
          englishGoogleInput.scrollHeight + "px";
      }

      const googleTranslatedRaw = await translateReport(raw);
      const googleTranslated = ensureLastLineHasFullStop(
        googleTranslatedRaw || ""
      );

      englishEditedInput.value = googleTranslated || "";
      englishEditedInput.style.height = "auto";
      englishEditedInput.style.height =
        englishEditedInput.scrollHeight + "px";
    } catch (err) {
      console.error(err);
      window.alert(
        "翻譯服務目前無法使用，請稍後再試。\n\n" +
          (err && err.message ? err.message : "")
      );

      englishGoogleInput.value = "";
      englishEditedInput.value = "";
      englishGoogleInput.style.height = "auto";
      englishEditedInput.style.height = "auto";
      englishGoogleInput.style.height =
        englishGoogleInput.scrollHeight + "px";
      englishEditedInput.style.height =
        englishEditedInput.scrollHeight + "px";
    } finally {
      englishTranslateBtn.disabled = false;
      setTimeout(function () {
        englishTranslateBtn.classList.remove("translate-btn-animating");
      }, 200);
    }
  });
}

function initTranslateChoiceButtons() {
  if (!selectFirstTranslateBtn || !selectSecondTranslateBtn) return;

  function resetTranslateTabContent() {
    if (englishOriginalInput) {
      englishOriginalInput.value = "";
      englishOriginalInput.style.height = "";
    }
    if (englishGoogleInput) {
      englishGoogleInput.value = "";
      englishGoogleInput.style.height = "";
    }
    if (englishEditedInput) {
      englishEditedInput.value = "";
      englishEditedInput.style.height = "";
    }
  }

  function applySelectedTranslation(fromTextarea) {
    if (!currentTranslateTargetTextarea) {
      window.alert(
        "請先在事件報表頁按「前往翻譯」，選擇要更新的欄位。\n然後再按這裡選擇翻譯。"
      );
      return;
    }

    if (!fromTextarea) {
      window.alert("目前沒有可用的翻譯內容。");
      return;
    }

    const text = fromTextarea.value.trim();
    if (!text) {
      window.alert("目前選擇的翻譯內容是空白。");
      return;
    }

    const ok = window.confirm(
      "請確認是否套用此翻譯結果並返回事件報表？"
    );
    if (!ok) {
      return;
    }

    const targetEl = currentTranslateTargetTextarea;

    // Apply translated text immediately.
    targetEl.value = text;

    // Visual flash indicating the field was updated.
    try {
      targetEl.classList.add("translate-updated-flash");
      setTimeout(function () {
        try {
          targetEl.classList.remove("translate-updated-flash");
        } catch (e) {}
      }, 5000);
    } catch (e) {}

    // Clear current translate target state.
    if (typeof setTranslateTarget === "function") {
      setTranslateTarget(null, "");
    }

    // Clear translate tab inputs and return to the report tab.
    resetTranslateTabContent();
    if (typeof showTab === "function") {
      showTab("report");
    }

    // Foolproof resize: run after the report tab becomes visible so
    // scrollHeight is accurate even if the section was previously hidden.
    function performResize() {
      try {
        if (typeof window.resizeToContent === "function") {
          window.resizeToContent(targetEl);
        } else {
          targetEl.style.height = "auto";
          targetEl.style.height = targetEl.scrollHeight + "px";
        }
      } catch (e) {}
    }

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(performResize);
    } else {
      setTimeout(performResize, 0);
    }
  }

  selectFirstTranslateBtn.addEventListener("click", function () {
    applySelectedTranslation(englishGoogleInput);
  });

  selectSecondTranslateBtn.addEventListener("click", function () {
    applySelectedTranslation(englishEditedInput);
  });
}

if (englishOriginalInput && typeof setupAutoResize === "function") {
  setupAutoResize(englishOriginalInput);
}
if (englishGoogleInput && typeof setupAutoResize === "function") {
  setupAutoResize(englishGoogleInput);
}
if (englishEditedInput && typeof setupAutoResize === "function") {
  setupAutoResize(englishEditedInput);
}

initGoogleTranslateButtons();
initEnglishTranslate();
initTranslateChoiceButtons();
