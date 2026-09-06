/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { askAI } from "./AIAgent";

export interface ExamAgentRequest {

  subject: string;

  className: string;

  sequence?: string;

  trimester?: string;

  academicYear: string;

  duration: string;

  totalMarks: number;

  chapters: string[];

  instructions?: string;

}

export interface ExamQuestion {

  title: string;

  statement: string;

  marks: number;

}

export interface ExamResult {

  title: string;

  instructions: string;

  duration: string;

  totalMarks: number;

  questions: ExamQuestion[];

  markingScheme: string;

  correction: string;

}

export async function generateExam(
  request: ExamAgentRequest
): Promise<ExamResult | null> {

  const prompt = `

Discipline : ${request.subject}

Classe : ${request.className}

Séquence : ${request.sequence ?? ""}

Trimestre : ${request.trimester ?? ""}

Année scolaire : ${request.academicYear}

Durée : ${request.duration}

Note totale : ${request.totalMarks}

Chapitres :

${request.chapters.join("\n")}

Consignes supplémentaires :

${request.instructions ?? ""}

Produis un sujet d'examen officiel comprenant :

- les consignes générales ;
- plusieurs exercices progressifs ;
- le barème détaillé ;
- le corrigé complet.

Réponds uniquement en JSON.

`;

  const response = await askAI<ExamResult>({
    title: `Sujet ${request.subject}`,
    type: "EXAM",
    prompt,
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;

}