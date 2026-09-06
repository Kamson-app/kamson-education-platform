/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WorkingConditionsSection {
  material: string;
  pedagogicalResources: string;
}

export interface TeachingCoverageSection {
  hours: string;
  programs: string;
  digitalCoursesText: string;
}

export interface PedagogicalAnalysisSection {
  results: string;
  teachersDifficulties: string;
  studentsDifficulties: string;
  institutionalDifficulties: string;
  recommendationsTeachers: string;
  recommendationsAnimator: string;
  recommendationsAdministration: string;
  recommendationsHierarchy: string;
}

export interface ReportSections {
  introduction?: string;
  workingConditions?: WorkingConditionsSection;
  teachingCoverage?: TeachingCoverageSection;
  pedagogicalAnalysis?: PedagogicalAnalysisSection;
  observations?: string;
}