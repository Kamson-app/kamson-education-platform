/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StudentGrade, Trimester } from '../types';

/**
 * Génère le contenu textuel au format CSV avec l'encodage BOM UTF-8.
 */
export const generateGradeSheetCSV = (
  students: StudentGrade[],
  getStudentScoreValue: (
    student: StudentGrade,
    seq: number
  ) => number | undefined
): string => {
  let csvContent = '\uFEFF';
  csvContent += 'ID;Nom complet;Sexe;Éval. 1;Éval. 2;Éval. 3;Éval. 4;Éval. 5;Éval. 6;Éval. 7;Éval. 8;Éval. 9;Moyenne générale\r\n';

  students.forEach(s => {
    const e1 = getStudentScoreValue(s, 1) ?? '';
    const e2 = getStudentScoreValue(s, 2) ?? '';
    const e3 = getStudentScoreValue(s, 3) ?? '';
    const e4 = getStudentScoreValue(s, 4) ?? '';
    const e5 = getStudentScoreValue(s, 5) ?? '';
    const e6 = getStudentScoreValue(s, 6) ?? '';
    const e7 = getStudentScoreValue(s, 7) ?? '';
    const e8 = getStudentScoreValue(s, 8) ?? '';
    const e9 = getStudentScoreValue(s, 9) ?? '';
    csvContent += `${s.id};"${s.name}";${s.gender};${e1};${e2};${e3};${e4};${e5};${e6};${e7};${e8};${e9};${s.average !== undefined ? s.average : ''}\r\n`;
  });

  return csvContent;
};

/**
 * Crée le Blob, l'URL de téléchargement et déclenche le téléchargement du fichier CSV.
 */
export const downloadGradeSheetCSV = (
  students: StudentGrade[],
  selectedClass: string,
  selectedSubject: string,
  selectedTrimester: Trimester,
  getStudentScoreValue: (student: StudentGrade, seq: number) => number | undefined
): void => {
  const filename = `Releve_9_Eval_${selectedClass.replace(/\s+/g, '_')}_${selectedSubject}_Trimestre_${selectedTrimester}.csv`;
  const csvContent = generateGradeSheetCSV(students, getStudentScoreValue);

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
/**
 * Alias pour conserver la compatibilité avec les composants.
 */
export const exportGradeSheetToCSV = downloadGradeSheetCSV;