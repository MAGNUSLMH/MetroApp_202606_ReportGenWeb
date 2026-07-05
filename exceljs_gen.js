// Expect ExcelJS to be loaded from CDN and exposed as window.ExcelJS
(function () {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) {
    console.error(
      "ExcelJS library is not loaded. Include exceljs.min.js before exceljs_gen.js."
    );
    // We still define window.downloadExcel so the UI can show a clear
    // message instead of silently doing nothing. The actual guard will
    // run inside the function at call time.
  }

  // Expose globally so browser scripts can call it
  window.downloadExcel = async function () {
  // Guard in case ExcelJS failed to load or is not ready yet.
  if (!window.ExcelJS || !window.ExcelJS.Workbook) {
    window.alert("Excel 產生功能尚未完整載入，請稍後再試。");
    return;
  }

  const ExcelJSLocal = window.ExcelJS;
  const workbook = new ExcelJSLocal.Workbook();
  const sheet = workbook.addWorksheet("Fault Report");

  // Column A width (approx 1000px)
  sheet.columns = [{ width: 75 }];

  // Collect user inputs from the form
  const inputs = [
    { heading: "Fault description", value: document.getElementById("fault-description").value },
    { heading: "Sequency of event", value: document.getElementById("sequence").value },
    { heading: "Finding", value: document.getElementById("finding").value },
    { heading: "Root cause", value: document.getElementById("root-cause").value },
    { heading: "Action Taken", value: document.getElementById("action-taken").value },
    { heading: "Resume time", value: document.getElementById("resume-time").value }
  ];

  // Add headings + values directly under each other in column A
  inputs.forEach(item => {
    // Heading cell
    const headingRow = sheet.addRow([item.heading]);
    const headingCell = headingRow.getCell(1);
    headingCell.font = { name: "Times New Roman", size: 11, color: { argb: "FFFFFFFF" } };
    headingCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
    headingCell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } }
    };
    headingCell.alignment = { wrapText: true };  // <-- add this

    // Value cell
    const valueRow = sheet.addRow([item.value]);
    const valueCell = valueRow.getCell(1);
    valueCell.font = { name: "Times New Roman", size: 11, color: { argb: "FF000000" } }; // black text
    valueCell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } }
    };
    valueCell.alignment = { wrapText: true };  // <-- add this
  });

  // Generate file in browser
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  // Build filename: {yyyymmdd}_{NN}.xls
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePart = yyyy + mm + dd;

  const counterKey = "fault_report_download_counter_" + datePart;
  let counter = 1;
  try {
    const raw = window.localStorage.getItem(counterKey);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed >= 1) {
        counter = parsed + 1;
      }
    }
    window.localStorage.setItem(counterKey, String(counter));
  } catch (e) {
    // Ignore storage errors; fall back to first file name of the day
  }

  const sequence = String(counter).padStart(2, "0");
  const fileName = datePart + "_" + sequence + ".xlsx";

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  // Hint logical folder + filename; actual download folder depends on browser settings
  link.download = "MTR_IR_" + fileName;

  // Attach link to DOM so mobile browsers treat the click as a valid
  // user-initiated download.
  link.style.display = "none";
  document.body.appendChild(link);

  link.click();

  // Clean up DOM and object URL.
  setTimeout(function () {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(link.href);
  }, 0);
  };
})();
