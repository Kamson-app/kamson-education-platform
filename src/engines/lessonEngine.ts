/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProgressionLesson } from "../types";

/**
 * Les différents statuts possibles d'une leçon.
 */
export const LessonStatus = {
  PLANIFIEE: "PLANIFIEE",
  EN_COURS: "EN_COURS",
  TERMINEE: "TERMINEE",
  REPORTEE: "REPORTEE",
} as const;

export type LessonStatusType =
  (typeof LessonStatus)[keyof typeof LessonStatus];

/**
 * Création d'une nouvelle leçon.
 */
export function createLesson(
  title: string,
  moduleId: string,
  chapterId: string,
  order: number
): ProgressionLesson {
  return {
    id: crypto.randomUUID(),
    title,
    order,
    moduleId,
    chapterId,
    objectives: [],
    competencies: [],
    durationHours: 0,
    supports: [],
    evaluation: "",
    observations: "",
    status: LessonStatus.PLANIFIEE,
    taughtDate: undefined,
  };
}

/**
 * Met à jour une leçon.
 */
export function updateLesson(
  lesson: ProgressionLesson,
  updates: Partial<ProgressionLesson>
): ProgressionLesson {
  return {
    ...lesson,
    ...updates,
  };
}

/**
 * Marquer une leçon comme commencée.
 */
export function startLesson(
  lesson: ProgressionLesson
): ProgressionLesson {
  return {
    ...lesson,
    status: LessonStatus.EN_COURS,
  };
}

/**
 * Marquer une leçon comme terminée.
 */
export function finishLesson(
  lesson: ProgressionLesson,
  taughtDate: string
): ProgressionLesson {
  return {
    ...lesson,
    status: LessonStatus.TERMINEE,
    taughtDate,
  };
}

/**
 * Reporter une leçon.
 */
export function postponeLesson(
  lesson: ProgressionLesson,
  reason?: string
): ProgressionLesson {
  return {
    ...lesson,
    status: LessonStatus.REPORTEE,
    observations: reason ?? lesson.observations,
  };
}

/**
 * Ajouter un objectif pédagogique.
 */
export function addObjective(
  lesson: ProgressionLesson,
  objective: string
): ProgressionLesson {
  return {
    ...lesson,
    objectives: [...(lesson.objectives ?? []), objective],
  };
}

/**
 * Ajouter une compétence.
 */
export function addCompetency(
  lesson: ProgressionLesson,
  competency: string
): ProgressionLesson {
  return {
    ...lesson,
    competencies: [...(lesson.competencies ?? []), competency],
  };
}

/**
 * Définir le volume horaire.
 */
export function setDuration(
  lesson: ProgressionLesson,
  hours: number
): ProgressionLesson {
  return {
    ...lesson,
    durationHours: hours,
  };
}

/**
 * Ajouter un support pédagogique.
 */
export function addSupport(
  lesson: ProgressionLesson,
  support: string
): ProgressionLesson {
  return {
    ...lesson,
    supports: [...(lesson.supports ?? []), support],
  };
}

/**
 * Définir l'évaluation prévue.
 */
export function setEvaluation(
  lesson: ProgressionLesson,
  evaluation: string
): ProgressionLesson {
  return {
    ...lesson,
    evaluation,
  };
}

/**
 * Ajouter une observation.
 */
export function addObservation(
  lesson: ProgressionLesson,
  observation: string
): ProgressionLesson {
  return {
    ...lesson,
    observations: observation,
  };
}

/**
 * Vérifie si une leçon est terminée.
 */
export function isLessonCompleted(
  lesson: ProgressionLesson
): boolean {
  return lesson.status === LessonStatus.TERMINEE;
}

/**
 * Vérifie si une leçon est en cours.
 */
export function isLessonInProgress(
  lesson: ProgressionLesson
): boolean {
  return lesson.status === LessonStatus.EN_COURS;
}

/**
 * Vérifie si une leçon est planifiée.
 */
export function isLessonPlanned(
  lesson: ProgressionLesson
): boolean {
  return lesson.status === LessonStatus.PLANIFIEE;
}

/**
 * Vérifie si une leçon est reportée.
 */
export function isLessonPostponed(
  lesson: ProgressionLesson
): boolean {
  return lesson.status === LessonStatus.REPORTEE;
}