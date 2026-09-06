/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EstablishmentSettings,
  EstablishmentHeaders,
  StudentStats,
  ClassGradeSheet,
  HourCoverage,
  ProgramCoverage,
  APCPrepFiche,
  ExamSubject,
  CouncilReport,
  DepartmentMessage,
  LogbookEntry,
  EmargementClaim,
  ArchiveReleve,
  ArchiveReport,
  ArchiveExam,
  ArchiveAPC,
  DashboardCounters,
  SyncStatus,
  User,
  UserRole,
} from "../types";

/* ============================================================
 * PARAMETRES PAR DEFAUT DE L'ETABLISSEMENT
 * ============================================================ */

export const DEFAULT_ESTABLISHMENT: EstablishmentSettings = {
  id: "default",
  ministry: "MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES",
  region: "",
  delegation: "",
  establishmentName: "",
  academicYear: "",
  motto: "Paix - Travail - Patrie",
  town: "",
  departmentName: "",
  logoUrl: "",
};

export const DEFAULT_HEADERS: EstablishmentHeaders = {
  id: "",
  ministry: "MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES",
  delegation: "",
  establishmentName: "",
  departmentName: "",
  academicYear: "",
  town: "",
  logoUrl: "",
};

/* ============================================================
 * COEFFICIENTS DES EVALUATIONS
 * ============================================================ */

export const DEFAULT_EVAL_COEFFICIENTS: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 1,
  7: 1,
  8: 1,
  9: 1,
};

/* ============================================================
 * TABLEAUX VIDES
 * ============================================================ */

export const DEFAULT_STUDENT_STATS: StudentStats[] = [];

export const DEFAULT_GRADE_SHEETS: ClassGradeSheet[] = [];

export const DEFAULT_HOUR_COVERAGES: HourCoverage[] = [];

export const DEFAULT_PROGRAM_COVERAGES: ProgramCoverage[] = [];

export const DEFAULT_APC_PREPS: APCPrepFiche[] = [];

export const DEFAULT_EXAM_SUBJECTS: ExamSubject[] = [];

export const DEFAULT_COUNCIL_REPORTS: CouncilReport[] = [];

export const DEFAULT_MESSAGES: DepartmentMessage[] = [];

export const DEFAULT_LOGBOOK: LogbookEntry[] = [];

export const DEFAULT_EMARGEMENT: EmargementClaim[] = [];

/* ============================================================
 * ARCHIVES
 * ============================================================ */

export const DEFAULT_ARCHIVE_RELEVES: ArchiveReleve[] = [];

export const DEFAULT_ARCHIVE_REPORTS: ArchiveReport[] = [];

export const DEFAULT_ARCHIVE_EXAMS: ArchiveExam[] = [];

export const DEFAULT_ARCHIVE_APC: ArchiveAPC[] = [];

export const DEFAULT_ARCHIVED_FIRST_COUNCIL_REPORTS: CouncilReport[] = [];

const dummyUser: User = {
  id: "",
  name: "",
  email: "",
  role: "ENSEIGNANT" as UserRole,
  academicYear: "",
};

export const DEFAULT_COUNCIL_REPORT: CouncilReport = {
  id: "",
  establishmentId: "",
  departmentId: "",
  type: "TRIMESTRIEL",
  trimester: 1,
  date: "",
  academicYear: "",
  agenda: [],
  content: "",
  resolutions: [],
  attendance: [],
  status: "BROUILLON",
  createdAt: "",
  updatedAt: "",
};

/* ============================================================
 * DASHBOARD
 * ============================================================ */

export const DEFAULT_DASHBOARD_COUNTERS: DashboardCounters = {
  currentUser: dummyUser,
  establishmentSettings: DEFAULT_ESTABLISHMENT,
  teachers: 0,
  classes: 0,
  students: 0,
  boys: 0,
  girls: 0,
  reports: 0,

  globalAverage: 0,
  globalSuccessRate: 0,

  globalHourCoverage: 0,
  globalProgramCoverage: 0,

  admitted: 0,
  failed: 0,

  alertCount: 0,
};

/* ============================================================
 * SYNCHRONISATION
 * ============================================================ */

export const DEFAULT_SYNC_STATUS: SyncStatus = {
  lastSync: undefined,
  isOnline: true,
  canSync: true,
};

export const COMPETENCY_STATUS_OPTIONS = [
  "Non acquis",
  "En cours d'acquisition",
  "Acquis",
  "Maîtrisé",
] as const;

/* ============================================================
 * DIVERS
 * ============================================================ */

export const DEFAULT_ACTIVE_TAB = "dashboard";

export const DEFAULT_TRIMESTER = 1;

export const DEFAULT_PAGE_SIZE = 20;

export const DEFAULT_ANIMATION_DURATION = 300;

export const MAX_NOTIFICATIONS = 20;

export const DEFAULT_THEME = "light";

export const DEFAULT_LANGUAGE = "fr";
export const TRIMESTERS = [1, 2, 3] as const;