/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from "jspdf";
import type { HourCoverage, EstablishmentSettings } from "../types";

/* ===========================================================
   EXPORT PDF
=========================================================== */

export function generateHourCoveragePDF(
  coverages: HourCoverage[],
  est: EstablishmentSettings
) {
  const doc = new jsPDF("portrait", "mm", "a4");

  // ---------- En-tête ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RÉPUBLIQUE DU CAMEROUN", 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.text("MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES", 105, 22, {
    align: "center",
  });

  doc.setFontSize(12);
  doc.text(est.establishmentName, 105, 30, {
    align: "center",
  });

  doc.setFontSize(11);
  doc.text(
    "TABLEAU DE COUVERTURE DES HEURES D'ENSEIGNEMENT",
    105,
    42,
    { align: "center" }
  );

  doc.setFontSize(10);

  doc.text(`Année scolaire : ${est.academicYear}`, 15, 55);

  let y = 65;

  // ---------- Tableau ----------
  const headers = [
    "Classe",
    "Discipline",
    "Prévues",
    "Réalisées",
    "Taux (%)",
  ];

  const widths = [50, 55, 25, 25, 30];

  let x = 15;

  doc.setFillColor(220, 220, 220);

  headers.forEach((h, i) => {
    doc.rect(x, y, widths[i], 8, "FD");
    doc.text(h, x + 2, y + 5);
    x += widths[i];
  });

  y += 8;

  coverages.forEach((item) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const taux =
      item.plannedHoursAnnual > 0
        ? ((item.realizedHoursAnnual / item.plannedHoursAnnual) * 100).toFixed(1)
        : "0";

    const values = [
      item.className,
      (item as any).discipline || item.subject || "",
      item.plannedHoursAnnual.toString(),
      item.realizedHoursAnnual.toString(),
      taux + "%",
    ];

    x = 15;

    values.forEach((v, i) => {
      doc.rect(x, y, widths[i], 8);
      doc.text(v, x + 2, y + 5);
      x += widths[i];
    });

    y += 8;
  });

  y += 15;

  doc.text(
    `Fait à ${est.town}, le ${new Date().toLocaleDateString("fr-FR")}`,
    15,
    y
  );

  y += 25;

  doc.text("Animateur Pédagogique", 25, y);

  doc.text("Chef d'Établissement", 135, y);

  doc.save("Couverture_Horaire.pdf");
}

/* ===========================================================
   EXPORT EXCEL (CSV)
=========================================================== */

export function exportHourCoverageExcel(
  coverages: HourCoverage[]
) {
  const rows = [
    [
      "Classe",
      "Discipline",
      "Enseignant",
      "Heures prévues",
      "Heures réalisées",
      "Taux (%)",
    ],
  ];

  coverages.forEach((c) => {
    const taux =
      c.plannedHoursAnnual > 0
        ? ((c.realizedHoursAnnual / c.plannedHoursAnnual) * 100).toFixed(1)
        : "0";

    rows.push([
      c.className,
      (c as any).discipline || c.subject || "",
      c.teacherName,
      c.plannedHoursAnnual.toString(),
      c.realizedHoursAnnual.toString(),
      taux,
    ]);
  });

  const csv = rows
    .map((r) => r.join(";"))
    .join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = "Couverture_Horaire.csv";

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}