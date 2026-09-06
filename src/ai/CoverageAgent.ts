/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { askAI } from "./AIAgent";

export interface CoverageAgentRequest {

  discipline: string;

  className: string;

  academicYear: string;

  trimester: string;

  plannedHours: number;

  completedHours: number;

  plannedChapters: number;

  completedChapters: number;

  observations?: string;

}

export interface CoverageResult {

  summary: string;

  hoursCoverage: number;

  programmeCoverage: number;

  completedTopics: string[];

  remainingTopics: string[];

  risks: string[];

  recommendations: string[];

  conclusion: string;

}

export async function analyzeCoverage(
  request: CoverageAgentRequest
): Promise<CoverageResult | null> {

  const prompt = `

Analyse la couverture pédagogique suivante.

Discipline : ${request.discipline}

Classe : ${request.className}

Année scolaire : ${request.academicYear}

Trimestre : ${request.trimester}

Heures prévues : ${request.plannedHours}

Heures réalisées : ${request.completedHours}

Chapitres prévus : ${request.plannedChapters}

Chapitres terminés : ${request.completedChapters}

Observations :

${request.observations ?? ""}

Produis :

- un résumé ;
- le taux de couverture des heures ;
- le taux de couverture du programme ;
- les chapitres terminés ;
- les chapitres restants ;
- les risques éventuels ;
- les recommandations ;
- une conclusion.

Réponds uniquement en JSON.

`;

  const response = await askAI<CoverageResult>({
    title: `Couverture ${request.className}`,
    type: "COVERAGE",
    prompt,
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;

}