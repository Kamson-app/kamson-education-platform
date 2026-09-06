/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CouncilReport } from '../../types';

export const reportPdfService = {
  exportToPDF(report: CouncilReport) {
    try {
      console.log("Exportation PDF en cours pour le rapport :", report.id);
      // Déclenchement de l'impression native du navigateur configurée pour l'export PDF du rapport paysager
      window.print();
    } catch (error) {
      console.error("Erreur lors de l'exportation PDF :", error);
      throw error;
    }
  }
};