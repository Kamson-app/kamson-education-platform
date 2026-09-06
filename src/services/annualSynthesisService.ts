/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

import type {
  StudentStats,
  ClassGradeSheet,
  HourCoverage,
  ProgramCoverage,
  AnnualSynthesis,
} from "../types";
import dashboardCalculationService from "./dashboardCalculationService";

/* ============================================================
 * TYPES
 * ============================================================ */

export interface AnnualSynthesisFilters {
  establishmentId: string;
  academicYear: string;
  discipline: string;
  departmentId?: string;
}

/* ============================================================
 * STUDENT STATS
 * ============================================================ */

export async function fetchStudentStats(
  establishmentId: string,
  academicYear: string,
  discipline: string,
  departmentId?: string
): Promise<StudentStats[]> {

  try {

    const constraints = [
      where(
        "establishmentId",
        "==",
        establishmentId
      ),

      where(
        "academicYear",
        "==",
        academicYear
      ),

      where(
        "discipline",
        "==",
        discipline
      ),
    ];

    if (departmentId) {
      constraints.push(
        where(
          "departmentId",
          "==",
          departmentId
        )
      );
    }

    const q = query(
      collection(db, "studentsStats"),
      ...constraints
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      document =>
        ({
          id: document.id,
          ...document.data(),
        }) as StudentStats
    );

  } catch (error) {

    console.error(
      "Erreur récupération StudentStats :",
      error
    );

    return [];
  }
}

/* ============================================================
 * CLASS GRADE SHEETS
 * ============================================================ */

export async function fetchClassGradeSheets(
  establishmentId: string,
  academicYear: string,
  discipline: string,
  departmentId?: string
): Promise<ClassGradeSheet[]> {

  try {

    const constraints = [
      where(
        "establishmentId",
        "==",
        establishmentId
      ),

      where(
        "academicYear",
        "==",
        academicYear
      ),

      where(
        "discipline",
        "==",
        discipline
      ),
    ];

    if (departmentId) {
      constraints.push(
        where(
          "departmentId",
          "==",
          departmentId
        )
      );
    }

    const q = query(
      collection(db, "classGradeSheets"),
      ...constraints
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      document =>
        ({
          id: document.id,
          ...document.data(),
        }) as ClassGradeSheet
    );

  } catch (error) {

    console.error(
      "Erreur récupération ClassGradeSheets :",
      error
    );

    return [];
  }
}

/* ============================================================
 * COUVERTURE DES HEURES
 * ============================================================ */

export async function fetchHourCoverages(
  establishmentId: string,
  academicYear: string,
  discipline: string,
  departmentId?: string
): Promise<HourCoverage[]> {

  try {

    const constraints = [
      where(
        "establishmentId",
        "==",
        establishmentId
      ),

      where(
        "academicYear",
        "==",
        academicYear
      ),

      where(
        "discipline",
        "==",
        discipline
      ),
    ];

    if (departmentId) {
      constraints.push(
        where(
          "departmentId",
          "==",
          departmentId
        )
      );
    }

    const q = query(
      collection(db, "hourCoverages"),
      ...constraints
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      document =>
        ({
          id: document.id,
          ...document.data(),
        }) as HourCoverage
    );

  } catch (error) {

    console.error(
      "Erreur récupération HourCoverages :",
      error
    );

    return [];
  }
}

/* ============================================================
 * COUVERTURE DES PROGRAMMES
 * ============================================================ */

export async function fetchProgramCoverages(
  establishmentId: string,
  academicYear: string,
  discipline: string,
  departmentId?: string
): Promise<ProgramCoverage[]> {

  try {

    const constraints = [
      where(
        "establishmentId",
        "==",
        establishmentId
      ),

      where(
        "academicYear",
        "==",
        academicYear
      ),

      where(
        "discipline",
        "==",
        discipline
      ),
    ];

    if (departmentId) {
      constraints.push(
        where(
          "departmentId",
          "==",
          departmentId
        )
      );
    }

    const q = query(
      collection(db, "programCoverages"),
      ...constraints
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      document =>
        ({
          id: document.id,
          ...document.data(),
        }) as ProgramCoverage
    );

  } catch (error) {

    console.error(
      "Erreur récupération ProgramCoverages :",
      error
    );

    return [];
  }
}

/* ============================================================
 * RÉCUPÉRATION DE TOUTES LES DONNÉES ANNUELLES
 * ============================================================ */

export async function fetchAnnualSynthesisData(
  establishmentId: string,
  academicYear: string,
  discipline: string,
  departmentId?: string
): Promise<{
  studentStats: StudentStats[];
  classGradeSheets: ClassGradeSheet[];
  hourCoverages: HourCoverage[];
  programCoverages: ProgramCoverage[];
}> {

  const [
    studentStats,
    classGradeSheets,
    hourCoverages,
    programCoverages,
  ] = await Promise.all([

    fetchStudentStats(
      establishmentId,
      academicYear,
      discipline,
      departmentId
    ),

    fetchClassGradeSheets(
      establishmentId,
      academicYear,
      discipline,
      departmentId
    ),

    fetchHourCoverages(
      establishmentId,
      academicYear,
      discipline,
      departmentId
    ),

    fetchProgramCoverages(
      establishmentId,
      academicYear,
      discipline,
      departmentId
    ),

  ]);

  return {
    studentStats,
    classGradeSheets,
    hourCoverages,
    programCoverages,
  };
}

/* ============================================================
 * CONSTRUCTION DE LA SYNTHÈSE ANNUELLE
 * ============================================================ */

export function buildAnnualSynthesis(
  studentStats: StudentStats[],
  classGradeSheets: ClassGradeSheet[],
  hourCoverages: HourCoverage[],
  programCoverages: ProgramCoverage[],
  establishmentId: string,
  discipline: string
): AnnualSynthesis {

  const counters =
    dashboardCalculationService.calculateDashboardCounters(
      studentStats,
      classGradeSheets,
      hourCoverages,
      programCoverages
    );

  const alerts =
    dashboardCalculationService.generatePedagogicalAlerts(
      studentStats,
      hourCoverages,
      programCoverages
    );

  return dashboardCalculationService.calculateDepartmentPerformance(
    counters,
    alerts,
    studentStats,
    classGradeSheets,
    hourCoverages,
    programCoverages,
    establishmentId,
    discipline
  );
}

/* ============================================================
 * UTILITAIRES D'AFFICHAGE
 * ============================================================ */

export function formatPercentage(
  value: number
): string {

  return `${value.toFixed(1)} %`;
}

export function formatAverage(
  value: number
): string {

  return `${value.toFixed(2)} /20`;
}

export function getHealthLabel(
  status:
    | "EXCELLENT"
    | "SATISFAISANT"
    | "A_SURVEILLER"
    | "CRITIQUE"
): string {

  switch (status) {

    case "EXCELLENT":
      return "Excellent";

    case "SATISFAISANT":
      return "Satisfaisant";

    case "A_SURVEILLER":
      return "À surveiller";

    default:
      return "Critique";
  }
}

export function getHealthColor(
  status:
    | "EXCELLENT"
    | "SATISFAISANT"
    | "A_SURVEILLER"
    | "CRITIQUE"
): string {

  switch (status) {

    case "EXCELLENT":
      return "text-green-700";

    case "SATISFAISANT":
      return "text-blue-700";

    case "A_SURVEILLER":
      return "text-yellow-700";

    default:
      return "text-red-700";
  }
}