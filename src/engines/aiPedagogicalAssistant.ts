/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Progression } from "../types";
import type { CoverageAnalysis } from "./coverageEngine";
import type { ProgressionAnalysis } from "../utils/progressionAnalyzer";
import type { PedagogicalAlert } from "../utils/pedagogicalAlertEngine";

export interface AIReport {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    conclusion: string;
}

export function generatePedagogicalReport(
    _progression: Progression,
    progressionAnalysis: ProgressionAnalysis,
    coverage: CoverageAnalysis,
    alerts: PedagogicalAlert[]
): AIReport {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    if (coverage.completionRate >= 80) {
        strengths.push(
            "La couverture du programme est satisfaisante."
        );
    } else {
        weaknesses.push(
            "La couverture du programme reste insuffisante."
        );
        recommendations.push(
            "Prévoir des séances de rattrapage."
        );
    }

    if (progressionAnalysis.modules > 0) {
        strengths.push(
            `${progressionAnalysis.modules} modules pédagogiques sont correctement structurés.`
        );
    }

    alerts.forEach(alert => {
        if (alert.level === "CRITICAL") {
            weaknesses.push(alert.message);
            recommendations.push(alert.recommendation);
        }
        if (alert.level === "WARNING") {
            recommendations.push(alert.recommendation);
        }
    });

    return {
        summary:
            `La progression pédagogique comporte ${progressionAnalysis.modules} modules, ${progressionAnalysis.chapters} chapitres et ${progressionAnalysis.lessons} leçons.`,
        strengths,
        weaknesses,
        recommendations,
        conclusion:
            coverage.completionRate >= 80
                ? "Les objectifs pédagogiques du trimestre sont en bonne voie d'être atteints."
                : "Le conseil recommande une accélération de la progression afin d'atteindre les objectifs fixés."
    };
}