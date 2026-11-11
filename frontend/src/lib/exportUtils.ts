import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";

export type ExportCellValue = string | number | boolean | null | undefined;

const sanitizeCsvCell = (value: ExportCellValue): string => {
  const raw = String(value ?? "");
  // Prefix spreadsheet formula triggers (CWE-1236) including leading whitespace before =,+,-,@
  const neutralized = /^[=+\-@\t\r]|^\s+[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
};

export const exportToCSV = (headers: string[], data: ExportCellValue[][], filename: string) => {
  const csvContent = [
    headers.map((header) => sanitizeCsvCell(header)).join(","),
    ...data.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToPDF = (headers: string[], data: RowInput[], title: string, filename: string) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text(title, 14, 22);
  
  // Timestamp
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 40,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229] }, // Primary brand color
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  doc.save(`${filename}.pdf`);
};
