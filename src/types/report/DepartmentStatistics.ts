/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ClassStatistics {
  classId: string;
  className: string;
  boys: number;
  girls: number;
  total: number;
  anPlanned: number;
  triPlanned: number;
  anCompleted: number;
  triCompleted: number;
  anRate: number;
  triRate: number;
  pAnPlanned: number;
  pTriPlanned: number;
  pAnCompleted: number;
  pTriCompleted: number;
  pAnRate: number;
  pTriRate: number;
  plannedDigitalCoursesAnnual: number;
  plannedDigitalCoursesTrimester: number;
  completedDigitalCoursesAnnual: number;
  completedDigitalCoursesTrimester: number;
  digitalCoverageRateAnnual: number;
  digitalCoverageRateTrimester: number;
  ner: number;
  attendanceRate: number;
  averageAbove10: number;
  successBoys: number;
  successGirls: number;
  successTotal: number;
  generalAverage: number;
  observation: string;
}

export interface DepartmentGlobalStatistics {
  departmentClasses: unknown[];
  nombreClasses: number;
  effectifTotal: number;
  totalGarcons: number;
  totalFilles: number;
  statisticsByClass: ClassStatistics[];
  digitalCoverageRate: number;
  heuresPrevuesAn: number;
  heuresPrevuesTri: number;
  heuresFaitesAn: number;
  heuresFaitesTri: number;
  tauxHeuresAn: number;
  tauxHeuresTri: number;
  couvertureHeures: string;
  chapPrevusAn: number;
  chapPrevusTri: number;
  chapFaitsAn: number;
  chapFaitsTri: number;
  tauxProgrammeAn: number;
  tauxProgrammeTri: number;
  couvertureProgrammes: string;
  totalDigitalPrevusAn: number;
  totalDigitalPrevusTri: number;
  totalDigitalFaitsAn: number;
  totalDigitalFaitsTri: number;
  tauxDigitalAn: number;
  tauxDigitalTri: number;
  nerTotal: number;
  tauxAssiduite: number;
  moyenne10Total: number;
  reussiteGarcons: number;
  reussiteFilles: number;
  tauxReussite: number;
  moyenneGenerale: string;
  commentaireStatistique: string;
}