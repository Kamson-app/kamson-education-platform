/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProgressionLesson } from "../types";

export interface APCPreparation {

  lessonId: string;

  lessonTitle: string;

  generalObjective: string;

  specificObjectives: string[];

  competencies: string[];

  prerequisites: string[];

  materials: string[];

  teachingMethods: string[];

  learningActivities: string[];

  evaluationActivities: string[];

  homework: string;

  estimatedDuration: number;

}

/**
 * Génère automatiquement une préparation APC.
 */
export function generateAPCPreparation(
  lesson: ProgressionLesson
): APCPreparation {

  return {

    lessonId: lesson.id,

    lessonTitle: lesson.title,

    generalObjective:
      `Amener les élèves à maîtriser : ${lesson.title}.`,

    specificObjectives: lesson.objectives ?? [],

    competencies: lesson.competencies ?? [],

    prerequisites: [],

    materials: lesson.supports ?? [],

    teachingMethods: [

      "Approche par compétences",

      "Travail collaboratif",

      "Recherche guidée",

      "Apprentissage actif"

    ],

    learningActivities: [

      "Situation de départ",

      "Recherche",

      "Mise en commun",

      "Institutionnalisation",

      "Application"

    ],

    evaluationActivities: [

      "Observation",

      "Exercice d'application",

      "Évaluation formative"

    ],

    homework: "",

    estimatedDuration:
      lesson.durationHours ?? 2

  };

}

/**
 * Ajoute un prérequis.
 */
export function addPrerequisite(
  preparation: APCPreparation,
  prerequisite: string
): APCPreparation {

  return {

    ...preparation,

    prerequisites: [

      ...preparation.prerequisites,

      prerequisite

    ]

  };

}

/**
 * Ajoute une activité.
 */
export function addLearningActivity(
  preparation: APCPreparation,
  activity: string
): APCPreparation {

  return {

    ...preparation,

    learningActivities: [

      ...preparation.learningActivities,

      activity

    ]

  };

}

/**
 * Ajoute une activité d'évaluation.
 */
export function addEvaluationActivity(
  preparation: APCPreparation,
  activity: string
): APCPreparation {

  return {

    ...preparation,

    evaluationActivities: [

      ...preparation.evaluationActivities,

      activity

    ]

  };

}

/**
 * Définit le devoir.
 */
export function setHomework(
  preparation: APCPreparation,
  homework: string
): APCPreparation {

  return {

    ...preparation,

    homework

  };

}

/**
 * Modifie la durée.
 */
export function setDuration(
  preparation: APCPreparation,
  duration: number
): APCPreparation {

  return {

    ...preparation,

    estimatedDuration: duration

  };

}