/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { askAI } from "./AIAgent";
import { LessonSchema } from "./schemas/LessonSchema";

export interface LessonAgentRequest {

  subject: string;

  className: string;

  academicYear: string;

  chapter: string;

  lesson: string;

  duration: string;

  objectives: string;

  prerequisites?: string;

  teacherName?: string;

}

export interface LessonResult {

  header: {

    countryFr: string;

    countryEn: string;

    ministryFr: string;

    ministryEn: string;

    regionalDelegation: string;

    divisionalDelegation: string;

    school: string;

    department: string;

    subject: string;

    className: string;

    teacher: string;

    academicYear: string;

    duration: string;

    date: string;

    effectif: string;

  };

  administrative: {

    module: string;

    chapter: string;

    lesson: string;

    competence: string;

    familySituation: string;

    exampleSituation: string;

    actionCategory: string;

    materialResources: string[];

    pedagogicalResources: string[];

  };

  diagnostic: {

    reviewQuestions: string[];

    expectedAnswers: string[];

    commonDifficulties: string[];

    transition: string;

  };

  problemSituation: {

    realLifeContext: string;

    problem: string;

    studentTask: string;

    objective: string;

  };

  phases: {

    title: string;

    duration: string;

    objective: string;

    teacherActivities: string;

    studentActivities: string;

    teacherQuestions: string[];

    expectedResponses: string[];

    possibleErrors: string[];

    remediation: string;

    differentiation: string;

    writtenTrace: string;

    assessment: string;

  }[];

  lessonContent: {

    definitions: string;

    rules: string;

    examples: string;

    counterExamples: string;

    applications: string;

    summary: string;

  };

  exercises: {

    easy: string[];

    medium: string[];

    hard: string[];

    corrections: string[];

  };

  evaluation: {

    questions: string[];

    successCriteria: string[];

    grading: string;

    competences: string[];

  };

  homework: {

    title: string;

    instruction: string;

    expectedWork: string;

  };

  annexes: {

    tables: string;

    diagrams: string;

    vocabulary: string[];

    remarks: string;

  };

}

export async function generateLesson(
  request: LessonAgentRequest
): Promise<LessonResult | null> {

  const prompt = `

Tu es Inspecteur Pédagogique National du Cameroun.

Prépare une fiche pédagogique APC conforme au programme officiel du Cameroun.

Informations fournies :

Discipline : ${request.subject}

Classe : ${request.className}

Année scolaire : ${request.academicYear}

Module : ${request.chapter}

Leçon : ${request.lesson}

Durée : ${request.duration}

Objectifs :${request.objectives}

Prérequis :${request.prerequisites ?? ""}

Enseignant :${request.teacherName ?? ""}

Consignes :

- Construire une fiche APC complète.
- Générer exactement six phases.
- Développer les activités de l'enseignant.
- Développer les activités des élèves.
- Produire une véritable trace écrite.
- Générer des exercices progressifs.
- Produire les corrections.
- Générer une évaluation formative.
- Générer un devoir.
- Adapter la leçon au contexte camerounais.

`;

  const response = await askAI<LessonResult>({
    title: `Leçon ${request.lesson}`,
    type: "LESSON",
    prompt,
    responseSchema: LessonSchema
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;

}