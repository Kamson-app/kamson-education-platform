/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoverageAnalysis } from "../engines/coverageEngine";

export type AlertLevel =
    | "SUCCESS"
    | "INFO"
    | "WARNING"
    | "CRITICAL";

export interface PedagogicalAlert {

    level: AlertLevel;

    title: string;

    message: string;

    recommendation: string;

}

export function analyzeCoverageAlerts(

    coverage: CoverageAnalysis

): PedagogicalAlert[] {

    const alerts: PedagogicalAlert[] = [];

    if (coverage.completionRate >= 80) {

        alerts.push({

            level: "SUCCESS",

            title: "Progression conforme",

            message:
                "La couverture du programme est satisfaisante.",

            recommendation:
                "Poursuivre le rythme actuel."

        });

    }

    else if (coverage.completionRate >= 50) {

        alerts.push({

            level: "WARNING",

            title: "Progression à surveiller",

            message:
                "Le programme avance mais un léger retard est observé.",

            recommendation:
                "Prévoir quelques heures de rattrapage."

        });

    }

    else {

        alerts.push({

            level: "CRITICAL",

            title: "Retard pédagogique",

            message:
                "La couverture du programme est insuffisante.",

            recommendation:
                "Mettre en place immédiatement un plan de rattrapage."

        });

    }

    if (coverage.remainingLessons > 20) {

        alerts.push({

            level: "INFO",

            title: "Volume important restant",

            message:
                `${coverage.remainingLessons} leçons restent à enseigner.`,

            recommendation:
                "Réorganiser la progression."

        });

    }

    return alerts;

}