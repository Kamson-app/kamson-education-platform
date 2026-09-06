/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIOrchestrator } from '../../ai/AIOrchestrator';

export interface GenerateReportAIParams {
  discipline: string;
  trimester: string;
  academicYear: string;
  establishment: string;
  statistics: {
    nombreClasses: number;
    effectifTotal: number;
    totalGarcons: number;
    totalFilles: number;
    moyenneGenerale: string;
    tauxReussite: number;
    couvertureHeures: string;
    couvertureProgrammes: string;
    tauxAssiduite: string;
    nerTotal: number;
  };
  coverage: string;
  observations: string;
}

export const reportAIService = {
  async generateReportAnalysis(params: GenerateReportAIParams) {
    try {
      const aiReport = await AIOrchestrator.report({
        discipline: params.discipline,
        trimester: params.trimester,
        academicYear: params.academicYear,
        establishment: params.establishment,
        statistics: params.statistics as any,
        coverage: params.coverage,
        observations: params.observations
      });

      if (!aiReport) {
        throw new Error("La génération IA a échoué ou n'a renvoyé aucun résultat.");
      }

      return aiReport;
    } catch (error) {
      console.error("Erreur dans reportAIService :", error);
      throw error;
    }
  }
};