/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { askAI } from "./AIAgent";
import type { Progression, Trimester } from "../types";

export interface ProgressionAgentRequest {
  discipline: string;
  className: string;
  academicYear: string;
  trimester: Trimester;
  objectives?: string;
  programme?: string;

  teacherId?: string;
  teacherName?: string;
  establishmentId?: string;
  departmentId?: string;
}

export async function generateProgression(
  request: ProgressionAgentRequest
): Promise<Progression | null> {

  const prompt = `
Discipline : ${request.discipline}

Classe : ${request.className}

Année scolaire : ${request.academicYear}

Trimestre : ${request.trimester}

Objectifs :
${request.objectives ?? ""}

Programme :
${request.programme ?? ""}

Construis une progression pédagogique complète organisée en modules,
chapitres et leçons.
`;

  const response = await askAI<Partial<Progression>>({
    title: `Progression ${request.className}`,
    type: "PROGRESSION",
    prompt,
  });

  if (!response.success || !response.data) {
    return null;
  }

  return {
    id: "",

    establishmentId: request.establishmentId ?? "",
    departmentId: request.departmentId ?? "",

    teacherId: request.teacherId ?? "",
    teacherName: request.teacherName ?? "",

    discipline: request.discipline,

    className: request.className,

    trimester: request.trimester,

    academicYear: request.academicYear,

    title:
      response.data.title ??
      `Progression ${request.className}`,

    modules: response.data.modules ?? [],

    createdAt: new Date(),

    updatedAt: new Date(),
  };
}