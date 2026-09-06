/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  StudentGrade,
  StudentEvaluation,
} from "../types";

/**
 * Lit un fichier CSV et retourne les élèves importés.
 */
export async function importStudentsFromCSVFile(
  file: File
): Promise<StudentGrade[]> {
  if (!file) {
    throw new Error("Aucun fichier fourni.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = String(event.target?.result ?? "");

        if (!text.trim()) {
          resolve([]);
          return;
        }

        const lines = text.split(/\r?\n/);

        const students: StudentGrade[] = [];

        for (let index = 0; index < lines.length; index++) {
          const line = lines[index];

          if (!line.trim()) continue;

          if (
            index === 0 &&
            /nom|name|sexe|gender/i.test(line)
          ) {
            continue;
          }

          const separator = line.includes(";") ? ";" : ",";

          const cols = line.split(separator);

          if (cols.length < 3) continue;

          const name = cols[1]
            ?.trim()
            .replace(/^["']|["']$/g, "");

          if (!name) continue;

          const gender =
            cols[2]?.trim().toUpperCase().startsWith("F")
              ? "F"
              : "M";

          const evaluations: Record<number, StudentEvaluation> = {};

          for (let seq = 1; seq <= 9; seq++) {
            const raw = cols[seq + 2]?.trim();

            if (!raw) continue;

            const score = Number(raw);

            if (!Number.isNaN(score)) {
              evaluations[seq] = {
                score,
                coefficient: 1,
              };
            }
          }

          students.push({
            id: crypto.randomUUID(),
            name: name.toUpperCase(),
            gender,
            evaluations,
            average: 0,
          });
        }

        resolve(students);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Erreur de lecture du fichier CSV."));
    };

    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Alias de compatibilité
 */
export const importGradeSheetFromCSV =
  importStudentsFromCSVFile;