/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Progression,
  ProgressionLesson,
} from "../types";

import {
  calculateCoverage,
} from "./coverageEngine";

import {
  calculateStatistics,
} from "./statisticsEngine";

import {
  generateTeachingReport,
  generateStatisticsComment,
} from "./reportEngine";

import {
  generateAPCPreparation,
} from "./apcEngine";

import {
  createExam,
  addQuestion,
  type ExamType,
} from "./examEngine";

/**
 * Résultat complet du moteur IA.
 */
export interface AIAnalysisResult {

  coverage: ReturnType<typeof calculateCoverage>;

  statistics: ReturnType<typeof calculateStatistics>;

  report: ReturnType<typeof generateTeachingReport>;

  statisticsComment: string;

}

/**
 * Analyse complète de la plateforme.
 */
export function analyzeProgressions(
  progressions: Progression[]
): AIAnalysisResult {

  const lessons: ProgressionLesson[] = [];

  progressions.forEach((progression) => {

    progression.modules.forEach((module) => {

      module.chapters.forEach((chapter) => {

        lessons.push(...chapter.lessons);

      });

    });

  });

  const coverage =
    calculateCoverage(progressions[0] || { id: "", teacherId: "", departmentId: "", establishmentId: "", discipline: "", className: "", academicYear: "", modules: [] }, []);

  const statistics =
    calculateStatistics(progressions);

  const report =
    generateTeachingReport(statistics);

  const statisticsComment =
    generateStatisticsComment(statistics);

  return {

    coverage,

    statistics,

    report,

    statisticsComment,

  };

}

/**
 * Générer automatiquement une préparation APC.
 */
export function prepareLesson(
  lesson: ProgressionLesson
) {

  return generateAPCPreparation(
    lesson
  );

}

/**
 * Générer automatiquement une épreuve.
 */
export function generateExamFromLessons(
  lessons: ProgressionLesson[],
  type: ExamType,
  className: string,
  discipline: string
) {

  let exam = createExam(
    type,
    className,
    discipline,
    lessons
  );

  lessons.forEach((lesson) => {

    exam = addQuestion(

      exam,

      `Question portant sur : ${lesson.title}`,

      2,

      lesson.competencies?.[0]

    );

  });

  return exam;

}

/**
 * Retourne les leçons terminées.
 */
export function getCompletedLessons(
  progressions: Progression[]
): ProgressionLesson[] {

  const lessons: ProgressionLesson[] = [];

  progressions.forEach((progression) => {

    progression.modules.forEach((module) => {

      module.chapters.forEach((chapter) => {

        chapter.lessons.forEach((lesson) => {

          if (lesson.status === "TERMINEE") {

            lessons.push(lesson);

          }

        });

      });

    });

  });

  return lessons;

}

/**
 * Retourne la prochaine leçon à enseigner.
 */
export function getNextLesson(
  progressions: Progression[]
): ProgressionLesson | null {

  for (const progression of progressions) {

    for (const module of progression.modules) {

      for (const chapter of module.chapters) {

        const lesson = chapter.lessons.find(

          l => l.status === "PLANIFIEE"

        );

        if (lesson) {

          return lesson;

        }

      }

    }

  }

  return null;

}

/**
 * Génère un tableau de bord IA.
 */
export function generateDashboardData(
  progressions: Progression[]
) {

  const analysis =
    analyzeProgressions(progressions);

  return {

    totalLessons:
      analysis.statistics.totalLessons,

    completedLessons:
      analysis.statistics.completedLessons,

    coverageRate:
      analysis.statistics.coverageRate,

    plannedHours:
      analysis.statistics.plannedHours,

    completedHours:
      analysis.statistics.completedHours,

    remainingHours:
      analysis.statistics.remainingHours,

    statisticsComment:
      analysis.statisticsComment,

  };

}