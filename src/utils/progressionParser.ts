/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ProgressionModule,
  ProgressionChapter,
  ProgressionLesson,
  Trimester,
} from "../types";

export interface ParsedProgression {

  discipline: string;

  className: string;

  academicYear: string;

  trimester: Trimester;

  modules: ProgressionModule[];

}

export function parseProgression(
  text: string
): ParsedProgression {

  const modules: ProgressionModule[] = [];

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let currentModule: ProgressionModule | null = null;

  let currentChapter: ProgressionChapter | null = null;

  let lessonOrder = 1;

  for (const line of lines) {

    const upper = line.toUpperCase();

    // ---------- MODULE ----------

    if (
      upper.startsWith("MODULE") ||
      upper.startsWith("MOD")
    ) {

      currentModule = {

        id: crypto.randomUUID(),

        title: line,

        order: modules.length + 1,

        chapters: []

      };

      modules.push(currentModule);

      currentChapter = null;

      continue;

    }

    // ---------- CHAPITRE ----------

    if (
      upper.startsWith("CHAPITRE") ||
      upper.startsWith("CHAPTER")
    ) {

      if (!currentModule) {

        currentModule = {

          id: crypto.randomUUID(),

          title: "Module général",

          order: 1,

          chapters: []

        };

        modules.push(currentModule);

      }

      currentChapter = {

        id: crypto.randomUUID(),

        title: line,

        order: currentModule.chapters.length + 1,

        moduleId: currentModule.id,

        lessons: []

      };

      currentModule.chapters.push(currentChapter);

      continue;

    }

    // ---------- LEÇON ----------

    if (

      upper.startsWith("LEÇON") ||

      upper.startsWith("LECON") ||

      upper.startsWith("LESSON")

    ) {

      if (!currentModule) {

        currentModule = {

          id: crypto.randomUUID(),

          title: "Module général",

          order: 1,

          chapters: []

        };

        modules.push(currentModule);

      }

      if (!currentChapter) {

        currentChapter = {

          id: crypto.randomUUID(),

          title: "Chapitre général",

          order: 1,

          moduleId: currentModule.id,

          lessons: []

        };

        currentModule.chapters.push(currentChapter);

      }

      const lesson: ProgressionLesson = {

        id: crypto.randomUUID(),

        title: line,

        order: lessonOrder++,

        moduleId: currentModule.id,

        chapterId: currentChapter.id,

        objectives: [],

        competencies: [],

        durationHours: 2,

        supports: [],

        evaluation: "",

        observations: "",

        status: "PLANIFIEE"

      };

      currentChapter.lessons.push(lesson);

    }

  }

  return {

    discipline: "",

    className: "",

    academicYear: "",

    trimester: 1,

    modules

  };

}