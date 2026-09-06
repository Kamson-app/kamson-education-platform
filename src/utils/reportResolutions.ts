/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { askAI } from "../ai/AIAgent";
import type { CouncilResolution } from "../types";
import type { DepartmentGlobalStatistics } from "../types/report";

/* ============================================================
 * RÉSULTAT DE L'ANALYSE IA
 * ============================================================ */

export interface AIResolutionAnalysis {
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  resolutions: CouncilResolution[];
}

/* ============================================================
 * ANALYSE IA DES RÉSULTATS DU DÉPARTEMENT
 * ============================================================ */

export async function generateAIResolutions(
  stats: DepartmentGlobalStatistics
): Promise<AIResolutionAnalysis | null> {

  const prompt = `
Tu es un expert en analyse pédagogique et en gestion
des Conseils d'Enseignement.

Tu dois analyser les résultats réels d'un département
d'enseignement et proposer des recommandations ainsi que
des résolutions pour le Conseil d'Enseignement.

IMPORTANT :
- Utilise uniquement les données fournies.
- N'invente aucune statistique.
- Ne transforme pas automatiquement un seuil numérique
  en résolution.
- Interprète les données dans leur ensemble.
- Identifie les forces et les difficultés.
- Explique les problèmes uniquement lorsque les données
  permettent raisonnablement de le faire.
- Les résolutions doivent être concrètes et réalisables.
- Les résolutions sont des PROPOSITIONS de l'IA.
- Elles doivent être vérifiées et éventuellement modifiées
  par l'Animateur pédagogique avant leur adoption par le Conseil.

DONNÉES DU DÉPARTEMENT :

Taux de réussite :
${stats.tauxReussite} %

Moyenne générale :
${stats.moyenneGenerale}

Taux de couverture des heures du trimestre :
${stats.tauxHeuresTri} %

Taux de couverture du programme du trimestre :
${stats.tauxProgrammeTri} %

Taux d'assiduité :
${stats.tauxAssiduite} %

MISSION :

1. Produis une analyse globale des résultats.
2. Identifie les principaux points forts.
3. Identifie les principales difficultés.
4. Propose des recommandations pédagogiques.
5. Produis des résolutions concrètes destinées au Conseil
   d'Enseignement.

Une résolution doit être formulée comme une action décidée
ou proposée par le Conseil.

Exemples de formulation :
- Renforcer les séances de remédiation...
- Mettre en place un suivi régulier...
- Achever la couverture du programme...
- Organiser des activités de consolidation...
- Assurer un suivi particulier des classes présentant
  les plus grandes difficultés...

NE PRODUIS PAS de résolution générique si les données
ne la justifient pas.

Retourne UNIQUEMENT un objet JSON respectant cette structure :

{
  "analysis": "analyse globale",
  "strengths": [
    "point fort 1",
    "point fort 2"
  ],
  "weaknesses": [
    "difficulté 1",
    "difficulté 2"
  ],
  "recommendations": [
    "recommandation 1",
    "recommandation 2"
  ],
  "resolutions": [
    "résolution 1",
    "résolution 2"
  ]
}
`;

  try {

    const response = await askAI<{
      analysis: string;
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
      resolutions: string[];
    }>({
      title: "Analyse IA du Conseil d'Enseignement",
      type: "REPORT",
      prompt,
    });

    if (!response.success || !response.data) {
      return null;
    }

    const data = response.data;

    const resolutions: CouncilResolution[] =
      Array.isArray(data.resolutions)
        ? data.resolutions
            .filter(
              (resolution): resolution is string =>
                typeof resolution === "string" &&
                resolution.trim().length > 0
            )
            .map((resolution) =>
              createAIResolution(resolution)
            )
        : [];

    return {
      analysis:
        typeof data.analysis === "string"
          ? data.analysis
          : "",

      strengths:
        Array.isArray(data.strengths)
          ? data.strengths.filter(
              (item): item is string =>
                typeof item === "string"
            )
          : [],

      weaknesses:
        Array.isArray(data.weaknesses)
          ? data.weaknesses.filter(
              (item): item is string =>
                typeof item === "string"
            )
          : [],

      recommendations:
        Array.isArray(data.recommendations)
          ? data.recommendations.filter(
              (item): item is string =>
                typeof item === "string"
            )
          : [],

      resolutions,
    };

  } catch (error) {

    console.error(
      "Erreur lors de l'analyse IA des résolutions :",
      error
    );

    return null;
  }
}

/* ============================================================
 * CRÉATION D'UNE RÉSOLUTION IA
 * ============================================================ */

function createAIResolution(
  text: string
): CouncilResolution {

  return {
    id: crypto.randomUUID(),

    text: text.trim(),

    origin: "AI",

    editable: true,

    createdAt: new Date().toISOString(),
  };
}