/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { Timestamp } from "firebase/firestore";

/* ============================================================ * TYPES UTILITAIRES DE BASE * ============================================================ */
export type Trimester = 1 | 2 | 3;
export type Gender = "M" | "F";
export type RecordStatus = "BROUILLON" | "EN_ATTENTE" | "VALIDE" | "ARCHIVE";
export type FirestoreDate = string | Date | Timestamp;

/**
 * Interface de base normalisée pour tous les documents Firestore.
 * Garantit l'isolation multi-établissements et multi-départements.
 */
export interface FirestoreDocument {
  id: string;
  establishmentId: string;
  departmentId: string;
  teacherId?: string;
  userId?: string;
  authorId?: string;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

export interface GenderStatistics {
  boys: number;
  girls: number;
  total: number;
}

/* ============================================================ * ROLES ET AUTHENTIFICATION * ============================================================ */
export type UserRole = "ANIMATEUR_PEDAGOGIQUE" | "ENSEIGNANT";
export type AccountStatus = "ACTIF" | "SUSPENDU" | "EN_ATTENTE";

export interface Subscription { 
  plan: "GRATUITE" | "PREMIUM" | "ETABLISSEMENT"; 
  status: "ACTIVE" | "EXPIREE" | "ANNULEE"; 
  endDate: FirestoreDate | null; 
}

/* ============================================================ * UTILISATEUR * ============================================================ */
export interface User { 
  id: string; 
  name: string; 
  email: string; 
  phone?: string;
  matricule?: string;
  weeklyHours?: number;
  role: UserRole; 
  phoneNumber?: string;
  subject?: string; 
  school?: string; 
  discipline?: string; 
  grade?: string;
  department?: string; 
  establishment?: string; 
  academicYear: string; 
  region?: string; 
  city?: string; 
  classes?: string[]; 
  active?: boolean; 
  status?: AccountStatus; 
  provider?: string; 
  photoURL?: string; 
  emailVerified?: boolean; 
  subscription?: Subscription; 
  lastSync?: FirestoreDate | null; 
  createdAt?: FirestoreDate | null; 
  lastLogin?: FirestoreDate | null; 
  establishmentId?: string;
  departmentId?: string;
  uid?: string;
}

/* ============================================================ * NOTIFICATIONS * ============================================================ */
export interface AppNotification extends 
Omit<FirestoreDocument, 'establishmentId' | 'departmentId' | 'teacherId'> { 
  userId: string; 
  title: string; 
  message: string; 
  read: boolean; 
  type: "VALIDATION" | "MESSAGE" | "MISE_A_JOUR" | "ALERTE"; 
  createdAt: FirestoreDate; 
}

/* ============================================================ * PARAMETRES ETABLISSEMENT (BASE COMMUNE) * ============================================================ */
export interface BaseEstablishmentConfig {
  ministry: string;
  region: string;
  delegation: string;
  establishmentName: string;
  town: string;
  motto: string;
  academicYear: string;
  logoUrl?: string;
}

export interface Establishment extends BaseEstablishmentConfig, 
Omit<FirestoreDocument, 'teacherId' | 'userId' | 'authorId'> {}

export interface EstablishmentSettings extends BaseEstablishmentConfig {
  id: string;

  // Département
  departmentId?: string;
  departmentName: string;
  discipline?: string;

  animatorId?: string;
  animatorName?: string;
  teacherIds?: string[];

  // Contact
  teacherName?: string;
  phone?: string;
  email?: string;

  // Divers
  monthlyQuotaPerClass?: number;
  classes?: string[];

  country?: string;
  countryEnglish?: string;

  ministryEnglish?: string;

  delegationEnglish?: string;

  subDelegation?: string;
  subDelegationEnglish?: string;

  schoolName?: string;

  logoUrl?: string;
  logo?: string;

  updatedAt?: FirestoreDate;

  // Conseil
  councilPresidentId?: string;
  councilPresidentName?: string;
  councilPresidentFunction?: string;
  councilPresidentGrade?: string;

  councilRapporteurId?: string;

  councilDate?: string;
  councilLocation?: string;

  // Rapport
  reportSettings?: ReportSettingsConfig;
}
export interface EstablishmentHeaders { 
  id: string; 
  ministry: string; 
  delegation: string; 
  establishmentName: string; 
  departmentName: string; 
  academicYear: string; 
  town: string; 
  logoUrl?: string; 
  
}

export interface FirestoreEstablishmentSettings extends BaseEstablishmentConfig {
  id: string; 
  departmentName: string; 
  bp: string; 
  phone: string; 
  monthlyQuotaPerClass?: number; 
  classes?: string[]; 
  evalCoefficients?: Record<number, number>;
}

/* ============================================================ * DEPARTEMENT * ============================================================ */
export interface Department extends FirestoreDocument {
  establishmentName: string;
  discipline: string;
  departmentName: string;
  description?: string;
  animatorId: string;
  animatorName: string;
  animatorEmail?: string;
  teacherIds: string[];
  academicYear: string;
  phone?: string;
  email?: string;
  councilPresidentId?: string;
  councilRapporteurId?: string;
  councilDate?: string;
  councilLocation?: string;
  reportSettings: ReportSettingsConfig;
  councilPresidentName?: string;
  councilPresidentFunction?: string;
  meetingPlace?: string;
  meetingStartTime?: string;
  meetingEndTime?: string;
}

/* ============================================================ * PARAMETRES RAPPORTS DÉPARTEMENT * ============================================================ */
export interface ReportSettingsConfig {
  headerText: string;
  footerText: string;
  includeStamp: boolean;
  signerName: string;
  paperSize: 'A4' | 'Letter';
}

/* ============================================================ * ENSEIGNANTS NORMALISÉS (Collection teachers) * ============================================================ */
export interface DepartmentTeacherModel {
  id: string;
  uid: string;

  fullName: string;
  email: string;
  phone?: string;

  establishmentId: string;
  departmentId: string | null;

  discipline: string | null;

  grade?: string;               // PCEG, PLEG...
  weeklyHours?: number;         // Volume horaire hebdomadaire
  classes?: string[];           // Classes enseignées

  councilRole?: "PRESIDENT" | "ANIMATEUR_PEDAGOGIQUE" | "MEMBRE";

  role: UserRole;
  isActive: boolean;

  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

/* ============================================================ * HISTORIQUE * ============================================================ */
export interface HistoryEntry extends FirestoreDocument {
  action: string;
  details: string;
}

/* ============================================================ * CAHIER DE TEXTES * ============================================================ */
export interface LogbookEntry extends FirestoreDocument {
  teacherId: string;
  teacherName: string;
  className: string;
  date: string;
  timeSlot: string;
  chapterName: string;
  lessonName: string;
  contentTaught: string;
  homework?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  visaDate?: string;
  visaAuthorId?: string;
}

/* ============================================================ * EMARGEMENT * ============================================================ */
export interface EmargementClaim extends FirestoreDocument {
  teacherId: string;
  teacherName: string;
  className: string;
  month: string;
  hoursClaimed: number;
  hoursValidated: number;
  status: "SUBMITTED" | "APPROVED" | "PAID";
  submittedAt: string;
}

/* ============================================================ * NOTES DES ELEVES * ============================================================ */
export interface StudentEvaluation {
  score: number;
  coefficient: number;
}

export interface StudentGrade {
  id: string;
  studentId?: string;
  name: string;
  gender: Gender;
  evaluations: Record<number, StudentEvaluation>;
  average?: number;
  rank?: number;
  appreciation?: string;
}

/* ============================================================ * RELEVES DE NOTES * ============================================================ */
export interface ClassGradeSheet extends FirestoreDocument {
  teacherId: string;
  teacherName: string;
  discipline: string;
  className: string;
  subject: string;
  trimester: Trimester;
  academicYear: string;
  students: StudentGrade[];
  coefficients?: Record<number, number>;
  settings?: EstablishmentSettings;
}

/* ============================================================ * STATISTIQUES DES CLASSES * ============================================================ */
export interface StudentStats extends FirestoreDocument {
  teacherId: string;
  discipline: string;
  className: string;
  trimester: Trimester;
  academicYear: string;
  totalStudents: number;
  boys: number;
  girls: number;
  average?: number;
  successRate?: number;
  admitted?: number;
  admittedBoys?: number;
  admittedGirls?: number;
  failed?: number;
  highestAverage?: number;
  lowestAverage?: number;
  rank?: number;
  regularStudentsCount?: number;    // NER
  attendanceRate?: number;         // Taux d'assiduité
  ner: number;
}

/* ============================================================ * COUVERTURE PROGRAMME * ============================================================ */
export interface ProgramLesson {
  id: string;
  title: string;
  plannedTrimester: Trimester;
  status: "PLANNED" | "DONE";
  plannedHours?: number;
  actualHours?: number;
  plannedDate?: string;
  doneDate?: string;
  remarks?: string;
}

/* ============================================================ * COUVERTURE HORAIRE * ============================================================ */
export interface HourCoverage extends FirestoreDocument {
  teacherName: string;

  academicYear: string;
  trimester: Trimester;

  className: string;
  discipline: string;
  subject?: string;

  plannedHoursAnnual: number;
  plannedHoursTrimester: number;

  realizedHoursAnnual: number;
  realizedHoursTrimester: number;

  annualCoverageRate: number;
  trimesterCoverageRate: number;
}

/* ============================================================ * COUVERTURE DES PROGRAMMES * ============================================================ */
export interface ProgramCoverage extends FirestoreDocument {
  academicYear: string;
  trimester: Trimester;
  discipline: string;
  className: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  lessons: ProgramLesson[];
  plannedLessons?: number;
  completedLessons?: number;
  completionRate?: number;
  plannedLessonsAnnual?: number;
  plannedLessonsTrimester?: number;
  completedLessonsAnnual?: number;
  completedLessonsTrimester?: number;
  plannedDigitalCoursesAnnual?: number;
  plannedDigitalCoursesTrimester?: number;
  completedDigitalCoursesAnnual?: number;
  completedDigitalCoursesTrimester?: number;
  digitalCoverageRateAnnual?: number;
  digitalCoverageRateTrimester?: number;
}

/* ============================================================ * FICHES DE PREPARATION APC * ============================================================ */
export interface APCPrepStep {
  phase: string;
  duration: string;

  objective?: string;

  teacherActivity: string;
  studentActivity: string;

  teacherQuestions?: string[];
  expectedResponses?: string[];

  possibleErrors?: string[];

  remediation?: string;

  differentiation?: string;

  writtenTrace?: string;

  assessment?: string;
}

export interface APCResources {
  material: string[];
  pedagogical: string[];
  digital?: string[];
  bibliography?: string[];
}

export interface APCPrerequisites {
  reviewQuestions: string[];
  expectedAnswers: string[];
  commonDifficulties: string[];
  transition: string;
}

export interface APCSituationProbleme {
  realLifeContext: string;
  problem: string;
  studentTask: string;
  objective: string;
}

export interface APCPrepFiche extends FirestoreDocument {
  teacherId: string;
  title: string;
  subject: string;
  className: string;
  academicYear: string;
  duration: string;
  teacherName: string;
  effectif?: string;
  date?: string;
  moduleName: string;
  chapterName: string;
  lessonName: string;
  competenceTargeted: string;
  familyOfSituation?: string;
  exampleOfSituation?: string;
  categoryOfAction?: string;
  resources: APCResources;
  prerequisites?: APCPrerequisites;
  situationProbleme?: APCSituationProbleme;
  steps: APCPrepStep[];
  homework?: string;
  diagnostic?: {
    reviewQuestions: string[];
    expectedAnswers: string[];
    commonDifficulties: string[];
    transition: string;
  };
  lessonContent?: {
    definitions: string;
    rules: string;
    examples: string;
    counterExamples: string;
    applications: string;
    summary: string;
  };
  exercises?: {
    easy: string[];
    medium: string[];
    hard: string[];
    corrections: string[];
  };
  evaluation?: {
    questions: string[];
    successCriteria: string[];
    grading: string;
    competences: string[];
  };
  annexes?: {
    tables: string;
    diagrams: string;
    vocabulary: string[];
    remarks: string;
  };
}

/* ============================================================ * SUJETS D'EXAMENS * ============================================================ */
export interface ExamSection { title: string; points: number; content: string; }

export interface ExamSubject extends FirestoreDocument {
  teacherId: string;
  title: string;
  subject: string;
  className: string;
  teacherName?: string;
  examType: "BEPC" | "PROBATOIRE" | "BACCALAUREAT" | "CONTROLE_CONTINU";
  duration: string;
  coefficient: number;
  instructions: string;
  sections: ExamSection[];
  markingScheme?: string;
}

export type ResolutionOrigin = "AI" | "SYSTEM" | "USER";

export interface CouncilResolution {
  id: string;
  text: string;
  origin: ResolutionOrigin;
  editable: boolean;
  createdAt: string;
}

/* ============================================================ * RAPPORTS * ============================================================ */
export interface CouncilReport extends FirestoreDocument {
  teacherId?: string;
  type: "PREMIER_CONSEIL" | "TRIMESTRIEL";
  trimester?: Trimester;
  academicYear: string;
  date: string;
  title?: string;
  teacherName?: string;
  authorName?: string;
  councilPresidentName?: string;
  councilPresidentFunction?: string;
  establishmentName?: string;
  departmentName?: string;
  headOfDepartment?: string;
  classroomClimate?: string;
  competencyStatus?: string;
  reportStatus?: "Brouillon" | "En cours" | "Validé" | "Archivé";
  agenda: string[];
  attendance: string[];
  content: string;
  resolutions: string[];
  councilResolutions?: CouncilResolution[];
  observations?: string;
  recommendations?: string;
  status: "BROUILLON" | "VALIDE" | "ARCHIVE";
  sections?: {
    introduction?: string;

    workingConditions?: {
      material?: string;
      pedagogicalResources?: string;
      generalConditions?: string;
    };

    teachingCoverage?: {
      hours?: string;
      programs?: string;
      digitalCoursesText?: string;
      correlations?: string;
    };

    pedagogicalAnalysis?: {
      attendance?: string;
      exercises?: string;
      results?: string;

      teachersDifficulties?: string;
      studentsDifficulties?: string;
      institutionalDifficulties?: string;

      recommendationsTeachers?: string;
      recommendationsAnimator?: string;
      recommendationsAdministration?: string;
      recommendationsHierarchy?: string;
    };

    observations?: string;
  };
}

/* ============================================================ * MESSAGES DU DEPARTEMENT * ============================================================ */
export interface DepartmentMessage extends FirestoreDocument {
  teacherId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  subject: string;
  category: "CONSEIL" | "RAPPEL" | "NOTE" | "URGENT";
  content: string;
  read?: boolean;
  isPinned?: boolean;
}

/* ============================================================ * ARCHIVES * ============================================================ */
export interface ArchiveReleve extends FirestoreDocument {
  teacherId: string;
  teacherName: string;
  discipline: string;
  className: string;
  subject: string;
  trimester: Trimester;
  academicYear: string;
  students: StudentGrade[];
  archivedAt: FirestoreDate;
}

export interface ArchiveReport extends FirestoreDocument {
  reportId: string;
  reportType: "PREMIER_CONSEIL" | "TRIMESTRIEL";
  title: string;
  archivedAt: FirestoreDate;
}

export interface ArchiveExam extends FirestoreDocument {
  examId: string;
  className: string;
  subject: string;
  archivedAt: FirestoreDate;
}

export interface ArchiveAPC extends FirestoreDocument {
  ficheId: string;
  lessonName: string;
  className: string;
  archivedAt: FirestoreDate;
}

/* ============================================================ * SYNTHÈSES PEDAGOGIQUES * ============================================================ */
export interface AnnualSynthesis extends FirestoreDocument {
  studentStats: StudentStats[];
  classGradeSheets: ClassGradeSheet[];
  hourCoverages: HourCoverage[];
  programCoverages: ProgramCoverage[];
  totalStudents: number;
  admitted: number;
  failed: number;
  average: number;
  successRate: number;
  hourCoverageRate: number;
  programCoverageRate: number;
  health: "EXCELLENT" | "SATISFAISANT" | "A_SURVEILLER" | "CRITIQUE";
  summary: string;
  recommendations: string[];
  discipline?: string;
  generatedAt?: FirestoreDate;
  generatedBy?: string;
}

/* ============================================================ * ALIAS DE COMPATIBILITE * ============================================================ */
export type UserProfile = User;
export type DepartmentInfo = Department;
export type SchoolSettings = EstablishmentSettings;
export type Notification = AppNotification;
export type EvaluationCoefficients = Record<number, number>;

/* ============================================================ * TYPES DASHBOARD & DIVERS * ============================================================ */
export interface DashboardCounters {
  currentUser: User;
  establishmentSettings: EstablishmentSettings;
  teachers: number;
  classes: number;
  students: number;
  boys: number;
  girls: number;
  reports: number;
  globalAverage: number;
  globalSuccessRate: number;
  globalHourCoverage: number;
  globalProgramCoverage: number;
  admitted: number;
  failed: number;
  alertCount: number;
}

export interface SyncStatus {
  lastSync?: FirestoreDate;
  isOnline: boolean;
  canSync: boolean;
}

/* ==========================================================
   PROGRESSIONS PEDAGOGIQUES
   ========================================================== */

export interface ProgressionLesson {
  id: string;

  title: string;

  order: number;

  moduleId: string;

  chapterId?: string;

  objectives?: string[];

  competencies?: string[];

  durationHours?: number;

  supports?: string[];

  evaluation?: string;

  observations?: string;

  status:
    | "PLANIFIEE"
    | "EN_COURS"
    | "TERMINEE"
    | "REPORTEE";

  taughtDate?: string;
}

export interface ProgressionChapter {
  id: string;

  title: string;

  order: number;

  moduleId: string;

  lessons: ProgressionLesson[];
}

export interface ProgressionModule {
  id: string;

  title: string;

  order: number;

  chapters: ProgressionChapter[];
}

export interface Progression {
  id: string;

  establishmentId: string;

  departmentId: string;

  teacherId: string;

  teacherName: string;

  discipline: string;

  className: string;

  trimester: Trimester;

  academicYear: string;

  title: string;

  modules: ProgressionModule[];

  createdAt?: FirestoreDate;

  updatedAt?: FirestoreDate;
}

export interface PedagogicalAlert {
  id: string;
  type: "HOUR_COVERAGE" | "PROGRAM_COVERAGE" | "LOW_SUCCESS_RATE" | "LOW_AVERAGE";
  severity: "INFO" | "WARNING" | "CRITICAL";
  className: string;
  subject: string;
  teacherName: string;
  message: string;
}