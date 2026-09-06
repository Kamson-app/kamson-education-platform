/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { askAI } from "./AIAgent";

export interface StatisticsAgentRequest {

  discipline: string;

  className: string;

  academicYear: string;

  trimester: string;

  students: number;

  boys: number;

  girls: number;

  average: number;

  passRate: number;

  highestAverage: number;

  lowestAverage: number;

  observations?: string;

}

export interface StatisticsResult {

  summary: string;

  strengths: string[];

  weaknesses: string[];

  risks: string[];

  recommendations: string[];

  conclusion: string;

}

export async function analyzeStatistics(
  request: StatisticsAgentRequest
): Promise<StatisticsResult | null> {

  const prompt = `

Analyse les statistiques suivantes.

Discipline : ${request.discipline}

Classe : ${request.className}

Année scolaire : ${request.academicYear}

Trimestre : ${request.trimester}

Effectif : ${request.students}

Garçons : ${request.boys}

Filles : ${request.girls}

Moyenne générale : ${request.average}

Taux de réussite : ${request.passRate} %

Meilleure moyenne : ${request.highestAverage}

Plus faible moyenne : ${request.lowestAverage}

Observations :

${request.observations ?? ""}

Produis :

- un résumé ;
- les points forts ;
- les difficultés ;
- les risques ;
- les recommandations ;
- une conclusion.

Réponds uniquement en JSON.

`;

  const response = await askAI<StatisticsResult>({
    title: `Analyse statistique ${request.className}`,
    type: "STATISTICS",
    prompt,
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;

}