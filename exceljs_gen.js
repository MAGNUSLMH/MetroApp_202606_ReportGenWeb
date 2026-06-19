// Expect ExcelJS to be loaded from CDN and exposed as window.ExcelJS
(function () {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) {
    console.error("ExcelJS library is not loaded. Include exceljs.min.js before exceljs_gen.js.");
    return;
  }

  // Expose globally so browser scripts can call it
  window.downloadExcel = async function () {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fault Report");

  // Column A width (approx 1000px)
  sheet.columns = [{ width: 120 }];

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
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "FaultReport.xlsx";
  link.click();
  };
})();
