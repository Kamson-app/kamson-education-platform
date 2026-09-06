/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Progression,
  ProgressionLesson,
  LogbookEntry,
} from "../types";

import {
  calculateCoverage,
  type CoverageAnalysis,
} from "./coverageEngine";

/**
 * Statistiques générales de la plateforme.
 */
export interface StatisticsSummary {
  totalProgressions: number;
  totalModules: number;
  totalChapters: number;
  totalLessons: number;
  completedLessons: number;
  plannedLessons: number;
  remainingLessons: number;
  coverageRate: number;
  plannedHours: number;
  completedHours: number;
  remainingHours: number;
  analysis: CoverageAnalysis;
}

/**
 * Extrait toutes les leçons d'une progression.
 */
function extractLessons(
  progression: Progression
): ProgressionLesson[] {
  const lessons: ProgressionLesson[] = [];
  progression.modules.forEach((module) => {
    module.chapters.forEach((chapter) => {
      lessons.push(...chapter.lessons);
    });
  });
  return lessons;
}

/**
 * Calcule toutes les statistiques.
 */
export function calculateStatistics(
  progressions: Progression[],
  logbook: LogbookEntry[] = []
): StatisticsSummary {
  let totalModules = 0;
  let totalChapters = 0;
  const allLessons: ProgressionLesson[] = [];

  progressions.forEach((progression) => {
    totalModules += progression.modules.length;
    progression.modules.forEach((module) => {
      totalChapters += module.chapters.length;
    });
    allLessons.push(...extractLessons(progression));
  });

  const analysis = calculateCoverage(progressions[0] || { id: "", teacherId: "", departmentId: "", establishmentId: "", discipline: "", className: "", academicYear: "", modules: [] }, logbook);

  return {
    totalProgressions: progressions.length,
    totalModules,
    totalChapters,
    totalLessons: analysis.plannedLessons,
    completedLessons: analysis.completedLessons,
    plannedLessons: analysis.plannedLessons,
    remainingLessons: analysis.remainingLessons,
    coverageRate: analysis.completionRate,
    plannedHours: analysis.plannedHours,
    completedHours: analysis.completedHours,
    remainingHours: analysis.remainingHours,
    analysis,
  };
}

/**
 * Nombre total d'heures prévues.
 */
export function getTotalPlannedHours(
  progressions: Progression[],
  logbook: LogbookEntry[] = []
): number {
  return calculateStatistics(progressions, logbook).plannedHours;
}

/**
 * Nombre total d'heures réalisées.
 */
export function getCompletedHours(
  progressions: Progression[],
  logbook: LogbookEntry[] = []
): number {
  return calculateStatistics(progressions, logbook).completedHours;
}

/**
 * Taux de couverture global.
 */
export function getCoverageRate(
  progressions: Progression[],
  logbook: LogbookEntry[] = []
): number {
  return calculateStatistics(progressions, logbook).coverageRate;
}

/**
 * Nombre total de leçons.
 */
export function getLessonCount(
  progressions: Progression[],
  logbook: LogbookEntry[] = []
): number {
  return calculateStatistics(progressions, logbook).totalLessons;
}

/**
 * Nombre de modules.
 */
export function getModuleCount(
  progressions: Progression[]
): number {
  return calculateStatistics(progressions).totalModules;
}

/**
 * Nombre de chapitres.
 */
export function getChapterCount(
  progressions: Progression[]
): number {
  return calculateStatistics(progressions).totalChapters;
}