/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CouncilReport } from '../../types';

const REPORTS_STORAGE_KEY = 'kamson_department_reports_v1';

export const reportStorageService = {
  async saveReport(report: CouncilReport): Promise<void> {
    try {
      const existingReportsJson = localStorage.getItem(REPORTS_STORAGE_KEY);
      const reports: CouncilReport[] = existingReportsJson ? JSON.parse(existingReportsJson) : [];

      const index = reports.findIndex(r => r.id === report.id);
      const reportToSave = {
        ...report,
        updatedAt: new Date().toISOString()
      };

      if (index >= 0) {
        reports[index] = reportToSave;
      } else {
        reports.push({
          ...reportToSave,
          createdAt: new Date().toISOString()
        });
      }

      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
    } catch (error) {
      console.error("Erreur de sauvegarde dans reportStorageService :", error);
      throw error;
    }
  },

  async getReports(): Promise<CouncilReport[]> {
    try {
      const existingReportsJson = localStorage.getItem(REPORTS_STORAGE_KEY);
      return existingReportsJson ? JSON.parse(existingReportsJson) : [];
    } catch (error) {
      console.error("Erreur de récupération dans reportStorageService :", error);
      return [];
    }
  }
};