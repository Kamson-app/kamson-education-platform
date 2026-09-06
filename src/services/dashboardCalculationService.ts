/** @license SPDX-License-Identifier: Apache-2.0 */
import type { StudentStats, ClassGradeSheet, HourCoverage, ProgramCoverage, DashboardCounters, AnnualSynthesis, PedagogicalAlert } from "../types";

const round = (value: number, decimals = 2): number => Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0;
const percentage = (value: number, total: number): number => total <= 0 ? 0 : round((value / total) * 100, 2);
const average = (values: number[]): number => values.length === 0 ? 0 : round(values.reduce((acc, v) => acc + v, 0) / values.length);
const isValidNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const determineHealth = (success: number, program: number, hour: number): AnnualSynthesis["health"] => {
  const score = (success + program + hour) / 3;
  return score >= 90 ? "EXCELLENT" : score >= 75 ? "SATISFAISANT" : score >= 60 ? "A_SURVEILLER" : "CRITIQUE";
};

export const calculateDashboardCounters = (studentStats: StudentStats[], gradeSheets: ClassGradeSheet[], hourCoverages: HourCoverage[], programCoverages: ProgramCoverage[]): DashboardCounters => {
  let [teachers, students, boys, girls, admitted, failed] = [0, 0, 0, 0, 0, 0];
  const [averages, successRates, hourRates, programRates] = [[], [], [], []] as number[][];
  studentStats.forEach((s) => {
    students += s.totalStudents ?? 0; boys += s.boys ?? 0; girls += s.girls ?? 0; admitted += s.admitted ?? 0; failed += s.failed ?? 0;
    if (isValidNumber(s.average)) averages.push(s.average);
    if (isValidNumber(s.successRate)) successRates.push(s.successRate);
  });
  hourCoverages.forEach((c) => {
    const rate =
      c.plannedHoursAnnual > 0
        ? (c.realizedHoursAnnual / c.plannedHoursAnnual) * 100
        : 0;

    if (isValidNumber(rate)) {
      hourRates.push(rate);
    }
  });
  programCoverages.forEach(c => {
    const rate = c.completionRate ?? percentage(c.completedLessons ?? c.lessons.filter(l => l.status === "DONE").length, c.plannedLessons ?? c.lessons.length);
    if (isValidNumber(rate)) programRates.push(rate);
  });
  return { 
    teachers, 
    classes: studentStats.length, 
    students, 
    boys, 
    girls, 
    reports: gradeSheets.length, 
    globalAverage: average(averages), 
    globalSuccessRate: average(successRates), 
    globalHourCoverage: average(hourRates), 
    globalProgramCoverage: average(programRates), 
    admitted, 
    failed, 
    alertCount: [...hourRates, ...programRates].filter(r => r < 80).length 
  } as DashboardCounters;
};

export const generatePedagogicalAlerts = (
  studentStats: StudentStats[],
  hourCoverages: HourCoverage[],
  programCoverages: ProgramCoverage[]
): PedagogicalAlert[] => {
  const alerts: PedagogicalAlert[] = [];

  hourCoverages.forEach((c) => {
    const rate =
      c.plannedHoursAnnual > 0
        ? (c.realizedHoursAnnual / c.plannedHoursAnnual) * 100
        : 0;

    if (rate < 80) {
      alerts.push({
        id: `HC-${c.id}`,
        type: "HOUR_COVERAGE",
        severity: rate < 60 ? "CRITICAL" : "WARNING",
        className: c.className,
        subject: c.subject ?? "",
        teacherName: c.teacherName,
        message: `Couverture horaire insuffisante (${round(rate)} %).`,
      });
    }
  });

  programCoverages.forEach(c => { const rate = c.completionRate ?? percentage(c.completedLessons ?? c.lessons.filter(l => l.status === "DONE").length, c.plannedLessons ?? c.lessons.length); if (rate < 80) alerts.push({ id: `PC-${c.id}`, type: "PROGRAM_COVERAGE", severity: rate < 60 ? "CRITICAL" : "WARNING", className: c.className, subject: c.subject ?? "", teacherName: c.teacherName, message: `Couverture des programmes insuffisante (${round(rate)} %).` }); });
  studentStats.forEach(s => { if ((s.successRate ?? 100) < 50) alerts.push({ id: `SR-${s.id}`, type: "LOW_SUCCESS_RATE", severity: "CRITICAL", className: s.className, subject: "", teacherName: "", message: `Le taux de réussite est inférieur à 50 %.` }); if ((s.average ?? 20) < 10) alerts.push({ id: `AVG-${s.id}`, type: "LOW_AVERAGE", severity: "WARNING", className: s.className, subject: "", teacherName: "", message: `La moyenne générale est inférieure à 10/20.` }); });
  return alerts;
};

export const calculateDepartmentPerformance = (
  counters: DashboardCounters,
  alerts: PedagogicalAlert[],
  stats: StudentStats[],
  sheets: ClassGradeSheet[],
  hours: HourCoverage[],
  progs: ProgramCoverage[],
  establishmentId?: string,
  discipline?: string
): AnnualSynthesis => {
  const health = determineHealth(counters.globalSuccessRate, counters.globalProgramCoverage, counters.globalHourCoverage);
  const recs: string[] = [];
  if (counters.globalSuccessRate < 60) recs.push("Renforcer les activités de remédiation pour améliorer le taux de réussite.");
  if (counters.globalHourCoverage < 80) recs.push("Accélérer l'exécution des heures d'enseignement restantes.");
  if (counters.globalProgramCoverage < 80) recs.push("Achever les leçons prévues avant la fin du trimestre.");
  if (alerts.length === 0) recs.push("Les indicateurs pédagogiques sont satisfaisants.");
  
  return { 
    id: "",
    departmentId: "",
    studentStats: stats, 
    classGradeSheets: sheets, 
    hourCoverages: hours, 
    programCoverages: progs, 
    totalStudents: counters.students, 
    admitted: counters.admitted, 
    failed: counters.failed, 
    average: counters.globalAverage, 
    successRate: counters.globalSuccessRate, 
    hourCoverageRate: counters.globalHourCoverage, 
    programCoverageRate: counters.globalProgramCoverage, 
    health, 
    summary: `Le département présente une moyenne générale de ${round(counters.globalAverage)} /20, un taux de réussite de ${round(counters.globalSuccessRate)} %, une couverture horaire de ${round(counters.globalHourCoverage)} % et une couverture des programmes de ${round(counters.globalProgramCoverage)} %.`, 
    recommendations: recs,
    establishmentId: establishmentId ?? "",
    discipline,
    generatedAt: new Date().toISOString(),
    generatedBy: "System"
  };
};

export const dashboardCalculationService = { 
  calculateDashboardCounters, 
  generatePedagogicalAlerts, 
  calculateDepartmentPerformance 
};

export default dashboardCalculationService;