/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProgressionLesson } from "../types";

export type ExamType =
  | "CONTROLE"
  | "DEVOIR"
  | "EXAMEN"
  | "BEPC"
  | "PROBATOIRE"
  | "BACCALAUREAT";

export interface ExamQuestion {

  id: string;

  statement: string;

  competency?: string;

  score: number;

}

export interface GeneratedExam {

  id: string;

  title: string;

  type: ExamType;

  className: string;

  discipline: string;

  duration: number;

  totalScore: number;

  instructions: string[];

  lessons: ProgressionLesson[];

  questions: ExamQuestion[];

  createdAt: string;

}

/**
 * Création d'une nouvelle épreuve.
 */
export function createExam(
  type: ExamType,
  className: string,
  discipline: string,
  lessons: ProgressionLesson[]
): GeneratedExam {

  return {

    id: crypto.randomUUID(),

    title: `${type} - ${discipline}`,

    type,

    className,

    discipline,

    duration: 120,

    totalScore: 20,

    instructions: [

      "Lire attentivement toutes les consignes.",

      "Répondre clairement à toutes les questions.",

      "Toute réponse doit être justifiée."

    ],

    lessons,

    questions: [],

    createdAt: new Date().toISOString()

  };

}

/**
 * Ajouter une question.
 */
export function addQuestion(
  exam: GeneratedExam,
  statement: string,
  score: number,
  competency?: string
): GeneratedExam {

  return {

    ...exam,

    questions: [

      ...exam.questions,

      {

        id: crypto.randomUUID(),

        statement,

        competency,

        score

      }

    ]

  };

}

/**
 * Modifier la durée.
 */
export function setDuration(
  exam: GeneratedExam,
  minutes: number
): GeneratedExam {

  return {

    ...exam,

    duration: minutes

  };

}

/**
 * Modifier le barème.
 */
export function setTotalScore(
  exam: GeneratedExam,
  score: number
): GeneratedExam {

  return {

    ...exam,

    totalScore: score

  };

}

/**
 * Ajouter une consigne.
 */
export function addInstruction(
  exam: GeneratedExam,
  instruction: string
): GeneratedExam {

  return {

    ...exam,

    instructions: [

      ...exam.instructions,

      instruction

    ]

  };

}

/**
 * Retourner les compétences évaluées.
 */
export function getCompetencies(
  exam: GeneratedExam
): string[] {

  const competencies = new Set<string>();

  exam.questions.forEach(question => {

    if (question.competency) {

      competencies.add(question.competency);

    }

  });

  return [...competencies];

}

/**
 * Calculer le total des points.
 */
export function calculateScore(
  exam: GeneratedExam
): number {

  return exam.questions.reduce(

    (sum, question) => sum + question.score,

    0

  );

}

/**
 * Vérifie si une épreuve est valide.
 */
export function validateExam(
  exam: GeneratedExam
): boolean {

  return (

    exam.questions.length > 0 &&

    calculateScore(exam) === exam.totalScore

  );

}