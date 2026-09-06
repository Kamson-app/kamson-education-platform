/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { askAI } from "./AIAgent";

export interface ReportAgentRequest {
  discipline: string;
  trimester: string;
  academicYear: string;
  establishment: string;
  statistics: any;
  coverage: string;
  observations: string;
}

export interface ReportResult {
  introduction: string;

  manuals: string;
  classrooms: string;
  workingConditions: string;

  hourCoverage: string;
  programCoverage: string;
  digitalCoverage: string;
  correlations: string;

  attendance: string;
  exercises: string;
  evaluations: string;

  teachersDifficulties: string;
  studentsDifficulties: string;
  institutionalDifficulties: string;

  recommendationsAnimator: string;
  recommendationsAdministration: string;
  recommendationsHierarchy: string;

  clubs: string;
}

export async function generateTeachingReport(
  request: ReportAgentRequest
): Promise<ReportResult | null> {

  const prompt = `
Tu es Inspecteur pédagogique principal du MINESEC Cameroun.

Tu dois produire UNIQUEMENT un objet JSON valide.

Aucun commentaire.
Aucun texte avant ou après.
Aucune balise Markdown.

La réponse doit respecter exactement cette structure :

{
  "introduction":"",
  "manuals":"",
  "classrooms":"",
  "workingConditions":"",
  "hourCoverage":"",
  "programCoverage":"",
  "digitalCoverage":"",
  "correlations":"",
  "attendance":"",
  "exercises":"",
  "evaluations":"",
  "teachersDifficulties":"",
  "studentsDifficulties":"",
  "institutionalDifficulties":"",
  "recommendationsAnimator":"",
  "recommendationsAdministration":"",
  "recommendationsHierarchy":"",
  "clubs":""
}

Informations du rapport :

Établissement :
${request.establishment}

Département :
${request.discipline}

Période :
${request.trimester}

Année scolaire :
${request.academicYear}

Statistiques :
${JSON.stringify(request.statistics, null, 2)}

Couverture :
${request.coverage}

Observations :
${request.observations}
`;

  const response = await askAI<ReportResult>({
    title: `Rapport ${request.discipline}`,
    type: "REPORT",
    prompt,

    responseSchema: {
      type: "object",
      properties: {
        introduction: { type: "string" },
        manuals: { type: "string" },
        classrooms: { type: "string" },
        workingConditions: { type: "string" },
        hourCoverage: { type: "string" },
        programCoverage: { type: "string" },
        digitalCoverage: { type: "string" },
        correlations: { type: "string" },
        attendance: { type: "string" },
        exercises: { type: "string" },
        evaluations: { type: "string" },
        teachersDifficulties: { type: "string" },
        studentsDifficulties: { type: "string" },
        institutionalDifficulties: { type: "string" },
        recommendationsAnimator: { type: "string" },
        recommendationsAdministration: { type: "string" },
        recommendationsHierarchy: { type: "string" },
        clubs: { type: "string" }
      },
      required: [
        "introduction",
        "manuals",
        "classrooms",
        "workingConditions",
        "hourCoverage",
        "programCoverage",
        "digitalCoverage",
        "correlations",
        "attendance",
        "exercises",
        "evaluations",
        "teachersDifficulties",
        "studentsDifficulties",
        "institutionalDifficulties",
        "recommendationsAnimator",
        "recommendationsAdministration",
        "recommendationsHierarchy",
        "clubs"
      ]
    }
  });

  if (!response.success) {
    console.error("Erreur IA :", response.error);
    return null;
  }

  if (!response.data) {
    console.error("Réponse Gemini :", response.text);
    return null;
  }

  return response.data;
}