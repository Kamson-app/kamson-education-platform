/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  generateAPCFiche,
  type APCAgentRequest,
} from "./APCAgent";

import {
  generateTeachingReport,
  type ReportAgentRequest,
} from "./ReportAgent";

import {
  generateProgression,
  type ProgressionAgentRequest,
} from "./ProgressionAgent";

import {
  generateExam,
  type ExamAgentRequest,
} from "./ExamAgent";

import {
  analyzeStatistics,
  type StatisticsAgentRequest,
} from "./StatisticsAgent";

import {
  analyzeCoverage,
  type CoverageAgentRequest,
} from "./CoverageAgent";

import {
  generateLesson,
  type LessonAgentRequest,
} from "./LessonAgent";

export const AIOrchestrator = {

  async apc(request: APCAgentRequest) {

    /*
     * Étape 1
     * Génération pédagogique
     */

    const lesson = await generateLesson({

        subject: request.subject,

        className: request.className,

        academicYear: "",

        chapter: request.chapterName,

        lesson: request.lessonName,

        duration: "",

        objectives: request.competenceTargeted,

        teacherName: request.teacherName

    });

    if (!lesson) {

        return null;

    }

    /*
     * Étape 2
     * Génération APC
     */

    return generateAPCFiche({

        ...request,

        lesson: JSON.stringify(lesson)

    } as any);

  },

  report(request: ReportAgentRequest) {
    return generateTeachingReport(request);
  },

  progression(request: ProgressionAgentRequest) {
    return generateProgression(request);
  },

  exam(request: ExamAgentRequest) {
    return generateExam(request);
  },

  statistics(request: StatisticsAgentRequest) {
    return analyzeStatistics(request);
  },

  coverage(request: CoverageAgentRequest) {
    return analyzeCoverage(request);
  },

  lesson(request: LessonAgentRequest) {
    return generateLesson(request);
  }

};