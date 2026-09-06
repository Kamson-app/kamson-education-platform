/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Progression,
  LogbookEntry,
} from "../types";

/* ============================================================
 * ANALYSE DE LA COUVERTURE
 * ============================================================ */

export interface CoverageAnalysis {
  plannedLessons: number;
  completedLessons: number;
  remainingLessons: number;

  plannedHours: number;
  completedHours: number;
  remainingHours: number;

  completionRate: number;
}

/* ============================================================
 * CALCUL DE LA COUVERTURE
 * ============================================================ */

/**
 * Calcule la couverture d'une progression pédagogique.
 *
 * progression :
 *   programme prévu
 *
 * logbook :
 *   enseignements effectivement réalisés
 *
 * Si aucune progression n'est disponible,
 * une analyse vide est retournée.
 */
export function calculateCoverage(
  progression: Progression | null,
  logbook: LogbookEntry[]
): CoverageAnalysis {

  /* ----------------------------------------------------------
   * Aucune progression
   * ---------------------------------------------------------- */

  if (!progression) {
    return {
      plannedLessons: 0,
      completedLessons: 0,
      remainingLessons: 0,

      plannedHours: 0,
      completedHours: 0,
      remainingHours: 0,

      completionRate: 0,
    };
  }

  /* ----------------------------------------------------------
   * Calcul du programme prévu
   * ---------------------------------------------------------- */

  let plannedLessons = 0;
  let plannedHours = 0;

  progression.modules.forEach((module) => {

    module.chapters.forEach((chapter) => {

      plannedLessons += chapter.lessons.length;

      chapter.lessons.forEach((lesson) => {

        plannedHours += lesson.durationHours ?? 2;

      });

    });

  });

  /* ----------------------------------------------------------
   * Calcul des enseignements réalisés
   * ---------------------------------------------------------- */

  const completedLessons = logbook.length;

  /*
   * LogbookEntry ne possède actuellement pas de
   * durationHours.
   *
   * On utilise donc 2 heures comme durée standard
   * pour une leçon réalisée.
   */
  const completedHours = completedLessons * 2;

  /* ----------------------------------------------------------
   * Leçons restantes
   * ---------------------------------------------------------- */

  const remainingLessons = Math.max(
    0,
    plannedLessons - completedLessons
  );

  /* ----------------------------------------------------------
   * Heures restantes
   * ---------------------------------------------------------- */

  const remainingHours = Math.max(
    0,
    plannedHours - completedHours
  );

  /* ----------------------------------------------------------
   * Taux de couverture
   * ---------------------------------------------------------- */

  const completionRate =
    plannedLessons === 0
      ? 0
      : Number(
          (
            (completedLessons / plannedLessons) *
            100
          ).toFixed(1)
        );

  /* ----------------------------------------------------------
   * Résultat
   * ---------------------------------------------------------- */

  return {
    plannedLessons,
    completedLessons,
    remainingLessons,

    plannedHours,
    completedHours,
    remainingHours,

    completionRate,
  };
}