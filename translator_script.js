// translator_script.js
// Logic specific to the translate UI: calling PHP proxies for translation,
// handling GPT + Google results, and wiring "轉英文" buttons.

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

const firstTranslateChineseInput = document.getElementById(
  "first-translate-chinese"
);
const secondTranslateChineseInput = document.getElementById(
  "second-translate-chinese"
);
const firstTranslateAdoptBtn = document.getElementById(
  "first-translate-adopt-btn"
);
const secondTranslateAdoptBtn = document.getElementById(
  "second-translate-adopt-btn"
);
const firstTranslateBackBtn = document.getElementById(
  "first-translate-back-btn"
);
const secondTranslateBackBtn = document.getElementById(
  "second-translate-back-btn"
);
const translateCardsWrapper = document.getElementById("translate-cards-wrapper");

// Promise used to coordinate a single pre-warm request so we don't
// start multiple parallel iframe loads and to allow callers to await
// cookie readiness before making the real translation call.
let translateProxyCookieWarmPromise = null;

function ensureTranslateProxyCookie() {
  if (translateProxyCookieWarmPromise) {
    return translateProxyCookieWarmPromise;
  }

  translateProxyCookieWarmPromise = new Promise(function (resolve) {
    try {
      const hostname = window.location && window.location.hostname;
      if (!hostname || hostname.indexOf("free.nf") === -1) {
        resolve();
        return;
      }

      // If the hosting cookie is already present, nothing to do.
      if (document.cookie && document.cookie.indexOf("__test=") !== -1) {
        resolve();
        return;
      }

      if (!document.body) {
        resolve();
        return;
      }

      // If a bootstrap iframe already exists, give it a short window
      // to complete instead of creating another one.
      const existingFrame = document.getElementById(
        "translate-proxy-bootstrap-frame"
      );
      if (existingFrame) {
        setTimeout(resolve, 2000);
        return;
      }

      const iframe = document.createElement("iframe");
      iframe.id = "translate-proxy-bootstrap-frame";
      iframe.src = "translate_proxy.php";
      iframe.style.display = "none";
      iframe.setAttribute("aria-hidden", "true");

      // Safety timeout so we never block the translation flow forever
      // if something goes wrong with the iframe load.
      const timeoutId = setTimeout(function () {
        resolve();
      }, 5000);

      iframe.onload = function () {
        clearTimeout(timeoutId);
        resolve();
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
      // Fail open: continue without blocking the translation request.
      resolve();
    }
  });

  return translateProxyCookieWarmPromise;
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

async function translateEnglishBackToChinese(englishText) {
  try {
    const response = await fetch("translate_proxy.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: englishText, direction: "en_to_zh" }),
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

    console.log("Back-translated Chinese Output:", translated);
    return translated;
  } catch (error) {
    console.error("Back translation service error:", error);
    throw new Error("翻譯服務回應錯誤: " + error.message);
  }
}

function hideDoubleTranslationCards() {
  if (translateCardsWrapper) {
    translateCardsWrapper.classList.add("hidden");
  }
}

async function populateDoubleTranslationCards(gptEnglish, googleEnglish) {
  if (!translateCardsWrapper) {
    return;
  }

  if (firstTranslateChineseInput) {
    firstTranslateChineseInput.value = "";
    firstTranslateChineseInput.classList.remove("double-translate-modified");
    firstTranslateChineseInput.style.height = "auto";
  }
  if (secondTranslateChineseInput) {
    secondTranslateChineseInput.value = "";
    secondTranslateChineseInput.classList.remove("double-translate-modified");
    secondTranslateChineseInput.style.height = "auto";
  }

  const tasks = [];

  // 第一個翻譯 (GPT-5.1, MTR 語言) 的中文回譯已停用，僅保留第二個翻譯的回譯。
  // 原本第一個翻譯的回譯程式碼已被註解以避免呼叫 GPT 相關服務。
  /*
  if (firstTranslateChineseInput && gptEnglish) {
    tasks.push(
      translateEnglishBackToChinese(gptEnglish)
        .then(function (chineseText) {
          firstTranslateChineseInput.value = chineseText || "";
          if (typeof window.resizeToContent === "function") {
            window.resizeToContent(firstTranslateChineseInput);
          } else {
            firstTranslateChineseInput.style.height = "auto";
            firstTranslateChineseInput.style.height =
              firstTranslateChineseInput.scrollHeight + "px";
          }
        })
        .catch(function (error) {
          console.error(error);
          window.alert(
            "第一個翻譯的中文回譯目前無法使用。\n\n" +
              (error && error.message ? error.message : "")
          );
        })
    );
  }
  */

  if (secondTranslateChineseInput && googleEnglish) {
    tasks.push(
      translateEnglishBackToChinese(googleEnglish)
        .then(function (chineseText) {
          secondTranslateChineseInput.value = chineseText || "";
          if (typeof window.resizeToContent === "function") {
            window.resizeToContent(secondTranslateChineseInput);
          } else {
            secondTranslateChineseInput.style.height = "auto";
            secondTranslateChineseInput.style.height =
              secondTranslateChineseInput.scrollHeight + "px";
          }
        })
        .catch(function (error) {
          console.error(error);
          window.alert(
            "第二個翻譯的中文回譯目前無法使用。\n\n" +
              (error && error.message ? error.message : "")
          );
        })
    );
  }

  try {
    if (tasks.length) {
      await Promise.all(tasks);
    }
  } finally {
    translateCardsWrapper.classList.remove("hidden");
  }
}

/**
 * GPT-5.1 (MTR 語言) 第一個翻譯已停用。
 * 保留函式簽名以避免其他程式碼出現 undefined，但不再呼叫 gpt_proxy.php。
 */
async function translateWithGPT(chineseText) {
  // 原本的 GPT 呼叫程式碼已被註解，避免實際對後端發出請求。
  /*
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
  */

  throw new Error("GPT 第一個翻譯 (MTR 語言) 已停用。");
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

    const overlayEl = document.getElementById("translate-overlay");

    // Wait for the hosting provider's cookie challenge (if any) to complete
    // before sending the actual translation request, to avoid racing the
    // pre-warm iframe and the fetch() call to translate_proxy.php.
    try {
      await ensureTranslateProxyCookie();
    } catch (e) {
      // Fail open: if pre-warm fails we still attempt the translation so
      // the user can see the normal error handling path.
      console.error("ensureTranslateProxyCookie failed before translate:", e);
    }

    englishTranslateBtn.disabled = true;
    englishTranslateBtn.classList.add("translate-btn-animating");

    // Overlay should only appear while the 翻譯 button is disabled.
    if (overlayEl) {
      overlayEl.classList.remove("hidden");
    }

    englishGoogleInput.value = "";
    englishEditedInput.value = "";
    englishGoogleInput.style.height = "";
    englishEditedInput.style.height = "";

    // Hide any existing cards and clear back-translated Chinese before
    // starting a new translation run.
    hideDoubleTranslationCards();
    if (firstTranslateChineseInput) {
      firstTranslateChineseInput.value = "";
      firstTranslateChineseInput.classList.remove("double-translate-modified");
      firstTranslateChineseInput.style.height = "";
    }
    if (secondTranslateChineseInput) {
      secondTranslateChineseInput.value = "";
      secondTranslateChineseInput.classList.remove("double-translate-modified");
      secondTranslateChineseInput.style.height = "";
    }

    let googleTranslatedValue = "";

    try {
      // 第一個翻譯 (GPT-5.1, MTR 語言) 已停用，以下原有 GPT 呼叫程式碼已被註解：
      /*
      try {
        const gptTranslated = await translateWithGPT(raw);
        gptTranslatedValue = gptTranslated || "";
        englishGoogleInput.value = gptTranslatedValue;
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
      */

      const googleTranslatedRaw = await translateReport(raw);
      const googleTranslated = ensureLastLineHasFullStop(
        googleTranslatedRaw || ""
      );

      googleTranslatedValue = googleTranslated || "";
      englishEditedInput.value = googleTranslatedValue;
      englishEditedInput.style.height = "auto";
      englishEditedInput.style.height =
        englishEditedInput.scrollHeight + "px";

      // 目前僅依 Google 翻譯結果進行英文 -> 中文回譯並顯示卡片。
      await populateDoubleTranslationCards(
        "",
        googleTranslatedValue
      );
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
      hideDoubleTranslationCards();
    } finally {
      englishTranslateBtn.disabled = false;
      setTimeout(function () {
        englishTranslateBtn.classList.remove("translate-btn-animating");
      }, 200);
      if (overlayEl) {
        overlayEl.classList.add("hidden");
      }
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
        "請先在事件報表頁按「轉英文」，選擇要更新的欄位。\n然後再按這裡選擇翻譯。"
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
      "是否套用此翻譯結果並返回事件報表？"
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

function initDoubleTranslateCardButtons() {
  if (!englishOriginalInput) return;

  function applySelectedTranslationToTarget(fromTextarea) {
    if (!currentTranslateTargetTextarea) {
      window.alert(
        "請先在事件報表頁按「轉英文」，選擇要更新的欄位。\n然後再按卡片上的 ✅ 按鈕。"
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
      "是否套用此翻譯結果並返回事件報表？"
    );
    if (!ok) {
      return;
    }

    const targetEl = currentTranslateTargetTextarea;
    targetEl.value = text;

    try {
      targetEl.classList.add("translate-updated-flash");
      setTimeout(function () {
        try {
          targetEl.classList.remove("translate-updated-flash");
        } catch (e) {}
      }, 5000);
    } catch (e) {}

    if (typeof setTranslateTarget === "function") {
      setTranslateTarget(null, "");
    }

    if (typeof showTab === "function") {
      showTab("report");
    }

    // After adopting any translation, hide the cards so they do not
    // remain visible when the user returns to the translate tab.
    hideDoubleTranslationCards();

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

  function moveChineseToOriginal(sourceTextarea) {
    if (!englishOriginalInput) {
      return;
    }

    if (!sourceTextarea) {
      window.alert("目前沒有可用的雙重翻譯內容。");
      return;
    }

    const text = sourceTextarea.value.trim();
    if (!text) {
      window.alert("目前選擇的中文內容是空白。");
      return;
    }

    const ok = window.confirm(
      "是否再次進行翻譯？"
    );
    if (!ok) {
      return;
    }

    englishOriginalInput.value = text;

    try {
      if (typeof window.resizeToContent === "function") {
        window.resizeToContent(englishOriginalInput);
      } else {
        englishOriginalInput.style.height = "auto";
        englishOriginalInput.style.height =
          englishOriginalInput.scrollHeight + "px";
      }
    } catch (e) {}

    hideDoubleTranslationCards();

    // After moving the double-translated Chinese back to "原本中文文字",
    // automatically re-run the translation process so the cards are
    // regenerated for the updated text.
    if (
      englishTranslateBtn &&
      !englishTranslateBtn.disabled &&
      typeof englishTranslateBtn.click === "function"
    ) {
      englishTranslateBtn.click();
    }
  }

  if (firstTranslateAdoptBtn) {
    firstTranslateAdoptBtn.addEventListener("click", function () {
      applySelectedTranslationToTarget(englishGoogleInput);
    });
  }

  if (secondTranslateAdoptBtn) {
    secondTranslateAdoptBtn.addEventListener("click", function () {
      applySelectedTranslationToTarget(englishEditedInput);
    });
  }

  if (firstTranslateBackBtn) {
    firstTranslateBackBtn.addEventListener("click", function () {
      moveChineseToOriginal(firstTranslateChineseInput);
    });
  }

  if (secondTranslateBackBtn) {
    secondTranslateBackBtn.addEventListener("click", function () {
      moveChineseToOriginal(secondTranslateChineseInput);
    });
  }

  [firstTranslateChineseInput, secondTranslateChineseInput].forEach(function (
    textarea
  ) {
    if (!textarea) return;
    textarea.addEventListener("input", function () {
      textarea.classList.add("double-translate-modified");
    });
  });
}

function startTranslateOverlayWatchdog() {
  // Brutal failsafe:
  // 1. Overlay is *never* allowed to stay visible when the 翻譯 button
  //    is not disabled.
  // 2. Even if the translation flow gets stuck and leaves the button
  //    disabled, we hard-reset everything after a timeout so the overlay
  //    cannot be permanently stuck.

  let lastDisabledAt = null;

  setInterval(function () {
    try {
      const overlayEl = document.getElementById("translate-overlay");
      const btn = document.getElementById("english-translate-btn");

      if (!overlayEl) {
        return;
      }

      // If the button is missing, we treat it as not disabled and
      // force-hide the overlay.
      if (!btn) {
        overlayEl.classList.add("hidden");
        overlayEl.style.display = "none";
        overlayEl.style.visibility = "hidden";
        lastDisabledAt = null;
        return;
      }

      if (btn.disabled) {
        // Button is disabled: overlay should be visible, but we track
        // how long this state has lasted.
        if (!lastDisabledAt) {
          lastDisabledAt = Date.now();
        }

        const disabledForMs = Date.now() - lastDisabledAt;

        overlayEl.classList.remove("hidden");
        overlayEl.style.display = "";
        overlayEl.style.visibility = "";

        // If the button has been disabled for too long, brutally reset
        // the UI so nothing can remain stuck.
        if (disabledForMs > 60000) {
          btn.disabled = false;
          btn.classList.remove("translate-btn-animating");
          overlayEl.classList.add("hidden");
          overlayEl.style.display = "none";
          overlayEl.style.visibility = "hidden";
          lastDisabledAt = null;
        }
      } else {
        // Button is not disabled: overlay must not be shown.
        lastDisabledAt = null;
        overlayEl.classList.add("hidden");
        overlayEl.style.display = "none";
        overlayEl.style.visibility = "hidden";
      }
    } catch (e) {
      // Swallow errors so the watchdog never breaks the app.
    }
  }, 200);
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
if (firstTranslateChineseInput && typeof setupAutoResize === "function") {
  setupAutoResize(firstTranslateChineseInput);
}
if (secondTranslateChineseInput && typeof setupAutoResize === "function") {
  setupAutoResize(secondTranslateChineseInput);
}

// Pre-warm the translate_proxy.php cookie challenge once on page load
// for hosts that use a __test cookie (e.g. free.nf). This reduces the
// likelihood that the first actual translation request will hit the
// "cookies not enabled" challenge page.
try {
  ensureTranslateProxyCookie();
} catch (e) {
  console.error("Initial ensureTranslateProxyCookie failed:", e);
}

initGoogleTranslateButtons();
initEnglishTranslate();
initTranslateChoiceButtons();
initDoubleTranslateCardButtons();
startTranslateOverlayWatchdog();
