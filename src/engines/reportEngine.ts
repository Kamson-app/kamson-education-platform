/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StatisticsSummary } from "./statisticsEngine";

export interface TeachingReport {
  title: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generatedAt: string;
}

/**
 * Génère automatiquement un rapport pédagogique.
 */
export function generateTeachingReport(
  statistics: StatisticsSummary
): TeachingReport {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  // ---------- Analyse de la couverture ----------

  if (statistics.coverageRate >= 90) {
    strengths.push(
      "Très bonne couverture des programmes."
    );
  } else if (statistics.coverageRate >= 75) {
    strengths.push(
      "Couverture satisfaisante des programmes."
    );
  } else {
    weaknesses.push(
      "La couverture des programmes est insuffisante."
    );
    recommendations.push(
      "Accélérer l'exécution de la progression pédagogique."
    );
  }

  // ---------- Analyse des leçons non achevées ----------

  if (statistics.remainingLessons > 0) {
    weaknesses.push(
      `${statistics.remainingLessons} leçon(s) restante(s).`
    );
    recommendations.push(
      "Programmer des séances de rattrapage."
    );
  }

  // ---------- Analyse des heures ----------

  if (
    statistics.remainingHours >
    statistics.plannedHours * 0.20
  ) {
    weaknesses.push(
      "Un volume horaire important reste à réaliser."
    );
  }

  if (
    statistics.completedHours >=
    statistics.plannedHours * 0.80
  ) {
    strengths.push(
      "Le volume horaire prévu est presque entièrement réalisé."
    );
  }

  // ---------- Résumé ----------

  const summary =
    `Au total, ${statistics.completedLessons} leçons sur ${statistics.totalLessons} ont été achevées. ` +
    `Le taux global de couverture est de ${statistics.coverageRate.toFixed(2)} %. ` +
    `${statistics.completedHours} heure(s) ont été réalisées sur ${statistics.plannedHours} heure(s) prévues.`;

  return {
    title:
      "Rapport pédagogique",
    summary,
    strengths,
    weaknesses,
    recommendations,
    generatedAt:
      new Date().toLocaleString("fr-FR"),
  };
}

/**
 * Génère un commentaire statistique.
 */
export function generateStatisticsComment(
  statistics: StatisticsSummary
): string {
  if (statistics.coverageRate >= 90) {
    return "La progression pédagogique est très satisfaisante.";
  }

  if (statistics.coverageRate >= 75) {
    return "La progression pédagogique est satisfaisante mais peut être améliorée.";
  }

  if (statistics.coverageRate >= 50) {
    return "La progression pédagogique présente un retard nécessitant une attention particulière.";
  }

  return "La progression pédagogique est insuffisante et nécessite des mesures correctives urgentes.";
}

/**
 * Génère les recommandations prioritaires.
 */
export function generatePriorityActions(
  statistics: StatisticsSummary
): string[] {
  const actions: string[] = [];

  if (statistics.remainingLessons > 0) {
    actions.push(
      "Organiser les leçons restantes."
    );
  }

  if (statistics.remainingHours > 0) {
    actions.push(
      "Planifier les heures restantes."
    );
  }

  if (statistics.coverageRate < 80) {
    actions.push(
      "Mettre en place un suivi rapproché de la progression."
    );
  }

  return actions;
}