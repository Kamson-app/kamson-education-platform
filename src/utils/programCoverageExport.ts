import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trimester } from "../types";

export function exportProgramCoverageToPDF(data: {
  establishment: string;
  discipline: string;
  academicYear: string;
  selectedClass: string;
  selectedTrimester: Trimester;
  progressions: any[];
  stats: {
    totalLessons: number;
    completedLessons: number;
    inProgressLessons: number;
    plannedLessons: number;
    trimesterCoveragePercent: number;
    annualCoveragePercent: number;
    totalPlannedHours: number;
    totalCompletedHours: number;
  };
  departmentStats: {
    bestClass: string;
    worstClass: string;
    bestTeacher: string;
    departmentAverage: number;
  };
}) {

  const pdf = new jsPDF();

  pdf.setFontSize(16);
  pdf.text("SUIVI DE LA COUVERTURE DES PROGRAMMES", 105, 15, { align: "center" });

  pdf.setFontSize(11);
  pdf.text(`Établissement : ${data.establishment}`, 14, 28);
  pdf.text(`Discipline : ${data.discipline}`, 14, 35);
  pdf.text(`Classe : ${data.selectedClass}`, 14, 42);
  pdf.text(`Trimestre : ${data.selectedTrimester}`, 14, 49);
  pdf.text(`Année : ${data.academicYear}`, 14, 56);

  autoTable(pdf, {
    startY: 65,
    head: [[
      "Chapitre",
      "Leçon",
      "Prévu",
      "Réalisé",
      "%",
      "Statut"
    ]],
    body: data.progressions.map(p => [
      p.chapter,
      p.lesson,
      p.plannedHours,
      p.completedHours,
      p.progress + "%",
      p.status
    ])
  });

  let y = (pdf as any).lastAutoTable.finalY + 10;

  pdf.text("STATISTIQUES", 14, y);

  y += 8;
  pdf.text(`Leçons : ${data.stats.totalLessons}`, 14, y);

  y += 7;
  pdf.text(`Terminées : ${data.stats.completedLessons}`, 14, y);

  y += 7;
  pdf.text(`En cours : ${data.stats.inProgressLessons}`, 14, y);

  y += 7;
  pdf.text(`Planifiées : ${data.stats.plannedLessons}`, 14, y);

  y += 7;
  pdf.text(`Couverture trimestre : ${data.stats.trimesterCoveragePercent}%`, 14, y);

  y += 7;
  pdf.text(`Couverture annuelle : ${data.stats.annualCoveragePercent}%`, 14, y);

  y += 12;
  pdf.text("STATISTIQUES DU DÉPARTEMENT", 14, y);

  y += 8;
  pdf.text(`Classe la plus avancée : ${data.departmentStats.bestClass}`, 14, y);

  y += 7;
  pdf.text(`Enseignant leader : ${data.departmentStats.bestTeacher}`, 14, y);

  y += 7;
  pdf.text(`Moyenne départementale : ${data.departmentStats.departmentAverage}%`, 14, y);

  pdf.save(
    `Couverture_Programme_${data.selectedClass}_T${data.selectedTrimester}.pdf`
  );
}