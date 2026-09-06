/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Progression,
  ProgressionLesson,
} from "../types";

export interface ProgressionAnalysis {
  modules: number;
  chapters: number;
  lessons: number;

  plannedHours: number;
  completedHours: number;
  remainingHours: number;

  completedLessons: number;
  remainingLessons: number;

  averageLessonsPerChapter: number;
  averageLessonsPerModule: number;

  completionRate: number;
}

/**
 * Analyse complète d'une progression pédagogique.
 */
export function analyzeProgression(
  progression: Progression
): ProgressionAnalysis {

  const modules = progression.modules.length;

  let chapters = 0;
  let lessons = 0;

  let plannedHours = 0;
  let completedHours = 0;
  let completedLessons = 0;

  progression.modules.forEach((module) => {

    chapters += module.chapters.length;

    module.chapters.forEach((chapter) => {

      lessons += chapter.lessons.length;

      chapter.lessons.forEach((lesson: ProgressionLesson) => {

        const duration = lesson.durationHours ?? 2;

        plannedHours += duration;

        if (lesson.status === "TERMINEE") {
          completedLessons += 1;
          completedHours += duration;
        }

      });

    });

  });

  const remainingLessons =
    Math.max(0, lessons - completedLessons);

  const remainingHours =
    Math.max(0, plannedHours - completedHours);

  const completionRate =
    lessons === 0
      ? 0
      : Number(
          ((completedLessons / lessons) * 100).toFixed(1)
        );

  return {

    modules,

    chapters,

    lessons,

    plannedHours,

    completedHours,

    remainingHours,

    completedLessons,

    remainingLessons,

    averageLessonsPerChapter:
      chapters === 0
        ? 0
        : Number(
            (lessons / chapters).toFixed(2)
          ),

    averageLessonsPerModule:
      modules === 0
        ? 0
        : Number(
            (lessons / modules).toFixed(2)
          ),

    completionRate,

  };
}