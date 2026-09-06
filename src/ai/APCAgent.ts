/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { askAI } from "./AIAgent";
import type { APCPrepFiche } from "../types";
import type { LessonResult } from "./LessonAgent";

export interface APCAgentRequest {
  subject: string;
  className: string;
  chapterName: string;
  lessonName: string;
  competenceTargeted: string;
  teacherName: string;

  teacherId?: string;
  establishmentId?: string;
  departmentId?: string;
  academicYear?: string;

  lesson?: LessonResult;
}

export async function generateAPCFiche(
  request: APCAgentRequest
): Promise<APCPrepFiche | null> {

  const prompt = `
Leçon générée :${request.lesson
    ? JSON.stringify(request.lesson, null, 2)
    : ""}

Discipline : ${request.subject}

Classe : ${request.className}

Chapitre : ${request.chapterName}

Leçon : ${request.lessonName}

Compétence visée : ${request.competenceTargeted}

Année académique : ${request.academicYear}

Enseignant : ${request.teacherName}
`;

  const response = await askAI<Partial<APCPrepFiche>>({
    title: request.lessonName,
    type: "APC",
    prompt,
  });

  if (!response.success || !response.data) {
    return null;
  }

  const rawResources = response.data.resources as any;

  const material: string[] = Array.isArray(rawResources?.material)
    ? rawResources.material
    : typeof rawResources?.material === 'string' && (rawResources.material as string).trim() !== ''
      ? [rawResources.material]
      : ["Tableau", "Craie"];

  const pedagogical: string[] = Array.isArray(rawResources?.pedagogical)
    ? rawResources.pedagogical
    : typeof rawResources?.pedagogical === 'string' && (rawResources.pedagogical as string).trim() !== ''
      ? [rawResources.pedagogical]
      : ["Méthode active"];

  const digital: string[] | undefined = Array.isArray(rawResources?.digital)
    ? rawResources.digital
    : typeof rawResources?.digital === 'string' && (rawResources.digital as string).trim() !== ''
      ? [rawResources.digital]
      : undefined;

  const bibliography: string[] | undefined = Array.isArray(rawResources?.bibliography)
    ? rawResources.bibliography
    : typeof rawResources?.bibliography === 'string' && (rawResources.bibliography as string).trim() !== ''
      ? [rawResources.bibliography]
      : undefined;

  return {
    id: crypto.randomUUID(),

    teacherId: request.teacherId ?? "",
    establishmentId: request.establishmentId ?? "",
    departmentId: request.departmentId ?? "",
    academicYear: request.academicYear ?? "",

    title: response.data.title ?? request.lessonName,
    subject: request.subject,
    className: request.className,
    duration: response.data.duration ?? "2 heures",
    teacherName: request.teacherName,

    effectif: response.data.effectif ?? "",
    date: response.data.date ?? new Date().toLocaleDateString("fr-FR"),

    moduleName: response.data.moduleName ?? "",
    chapterName: request.chapterName,
    lessonName: request.lessonName,
    competenceTargeted: request.competenceTargeted,

    familyOfSituation: response.data.familyOfSituation ?? "",
    exampleOfSituation: response.data.exampleOfSituation ?? "",
    categoryOfAction: response.data.categoryOfAction ?? "",

    resources: {
      material,
      pedagogical,
      ...(digital ? { digital } : {}),
      ...(bibliography ? { bibliography } : {}),
    },

    prerequisites: response.data.prerequisites,

    situationProbleme: response.data.situationProbleme,

    steps: response.data.steps ?? [],

    homework: response.data.homework ?? "",

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}