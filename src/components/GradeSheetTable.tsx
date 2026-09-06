/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  StudentGrade,
  Trimester,
  EvaluationCoefficients,
} from "../types";

import StudentRow from "./StudentRow";

interface GradeSheetTableProps {
  students: StudentGrade[];
  allStudentsCount: number;
  evalCoefficients: EvaluationCoefficients;
  typedGrades: Record<string, string>;
  classAverageBySeq: Record<number, number>;
  classGeneralAverage: number;
  selectedTrimester: Trimester;

  onGradeChange: (
    studentId: string,
    seq: number,
    value: string
  ) => void;

  onGradeBlur: () => void;

  onDeleteStudent: (
    studentId: string
  ) => void;

  getStudentScoreString: (
    student: StudentGrade,
    seq: number
  ) => string;
}

/* ============================================================
 * OUTILS DE CALCUL
 * ============================================================ */

/**
 * Récupère une note numérique réellement disponible.
 *
 * Une cellule vide, "-" ou une valeur invalide est considérée
 * comme non évaluée.
 */
function getScore(
  student: StudentGrade,
  seq: number,
  typedGrades: Record<string, string>,
  getStudentScoreString: (
    student: StudentGrade,
    seq: number
  ) => string
): number | undefined {

  const key = `${student.id}-${seq}`;

  const raw =
    typedGrades[key] !== undefined
      ? typedGrades[key]
      : getStudentScoreString(student, seq);

  if (
    raw === undefined ||
    raw === null ||
    raw.trim() === "" ||
    raw.trim() === "-"
  ) {
    return undefined;
  }

  const value = Number(raw);

  return Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * Calcule la moyenne d'une évaluation pour la classe.
 *
 * Les élèves non évalués ne sont pas comptés.
 */


/**
 * Calcule la moyenne trimestrielle de la classe.
 *
 * IMPORTANT :
 * - une évaluation absente n'est pas comptée ;
 * - son coefficient n'est donc pas compté ;
 * - si une seule évaluation existe, elle constitue la moyenne ;
 * - si les deux existent, leurs coefficients sont utilisés.
 */
function calculateTrimesterClassAverage(
  students: StudentGrade[],
  seq1: number,
  seq2: number,
  evalCoefficients: EvaluationCoefficients,
  typedGrades: Record<string, string>,
  getStudentScoreString: (
    student: StudentGrade,
    seq: number
  ) => string
): number | undefined {

  let weightedTotal = 0;
  let totalCoefficient = 0;

  students.forEach((student) => {

    const score1 = getScore(
      student,
      seq1,
      typedGrades,
      getStudentScoreString
    );

    const score2 = getScore(
      student,
      seq2,
      typedGrades,
      getStudentScoreString
    );

    const coefficient1 =
      Number(evalCoefficients[seq1] ?? 1);

    const coefficient2 =
      Number(evalCoefficients[seq2] ?? 1);

    if (
      score1 !== undefined &&
      Number.isFinite(coefficient1) &&
      coefficient1 > 0
    ) {
      weightedTotal += score1 * coefficient1;
      totalCoefficient += coefficient1;
    }

    if (
      score2 !== undefined &&
      Number.isFinite(coefficient2) &&
      coefficient2 > 0
    ) {
      weightedTotal += score2 * coefficient2;
      totalCoefficient += coefficient2;
    }
  });

  if (totalCoefficient === 0) {
    return undefined;
  }

  return weightedTotal / totalCoefficient;
}

/**
 * Formate une moyenne.
 */
function formatAverage(
  value: number | undefined
): string {

  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "-";
  }

  return value.toFixed(2);
}

/* ============================================================
 * COMPOSANT
 * ============================================================ */

export default function GradeSheetTable({
  students,
  allStudentsCount,
  evalCoefficients,
  typedGrades,
  classAverageBySeq,
  classGeneralAverage,
  selectedTrimester,
  onGradeChange,
  onGradeBlur,
  onDeleteStudent,
  getStudentScoreString,
}: GradeSheetTableProps) {

  /* ==========================================================
   * MOYENNES TRIMESTRIELLES DE LA CLASSE
   * ========================================================== */

  const trimester1ClassAverage =
    calculateTrimesterClassAverage(
      students,
      1,
      2,
      evalCoefficients,
      typedGrades,
      getStudentScoreString
    );

  const trimester2ClassAverage =
    calculateTrimesterClassAverage(
      students,
      3,
      4,
      evalCoefficients,
      typedGrades,
      getStudentScoreString
    );

  const trimester3ClassAverage =
    calculateTrimesterClassAverage(
      students,
      5,
      6,
      evalCoefficients,
      typedGrades,
      getStudentScoreString
    );

  /* ==========================================================
   * RENDU
   * ========================================================== */

  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-xl shadow-sm">

      <table className="w-full text-left border-collapse table-auto">

        {/* ====================================================
            EN-TÊTE
            ==================================================== */}

        <thead>

          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-semibold">

            <th className="py-2.5 px-2 text-center w-10 whitespace-nowrap">
              N°
            </th>

            <th className="py-2.5 px-4 w-full">
              Nom et Prénoms
            </th>

            <th className="py-2.5 px-2 text-center w-12 whitespace-nowrap">
              Sexe
            </th>

            {/* TRIMESTRE 1 */}

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 1
            </th>

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 2
            </th>

            <th className="py-2.5 px-2 text-center w-16 whitespace-nowrap bg-amber-100 text-amber-900 font-bold">
              NOTE TRIM 1
            </th>

            {/* TRIMESTRE 2 */}

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 3
            </th>

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 4
            </th>

            <th className="py-2.5 px-2 text-center w-16 whitespace-nowrap bg-amber-100 text-amber-900 font-bold">
              NOTE TRIM 2
            </th>

            {/* TRIMESTRE 3 */}

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 5
            </th>

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 6
            </th>

            <th className="py-2.5 px-2 text-center w-16 whitespace-nowrap bg-amber-100 text-amber-900 font-bold">
              NOTE TRIM 3
            </th>

            {/* ÉVALUATIONS 7 À 9 */}

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 7
            </th>

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 8
            </th>

            <th className="py-2.5 px-1 text-center w-10 whitespace-nowrap">
              Éval. 9
            </th>

            {/* MOYENNE */}

            <th className="py-2.5 px-2 text-center w-14 whitespace-nowrap bg-slate-100/70">
              MOY.
            </th>

            {/* ACTIONS */}

            <th className="py-2.5 px-2 text-center w-12 whitespace-nowrap no-print">
              Actions
            </th>

          </tr>

        </thead>

        {/* ====================================================
            CORPS
            ==================================================== */}

        <tbody className="divide-y divide-slate-100">

          {students.length === 0 ? (

            <tr>

              <td
                colSpan={18}
                className="py-8 text-center text-slate-400 text-sm"
              >

                {allStudentsCount === 0
                  ? "Aucun élève enregistré dans ce relevé. Utilisez le formulaire ci-dessus pour en ajouter ou importez un fichier CSV."
                  : "Aucun élève ne correspond à votre recherche."
                }

              </td>

            </tr>

          ) : (

            students.map(
              (student, index) => (

                <StudentRow
                  key={student.id}
                  student={student}
                  index={index}
                  selectedTrimester={
                    selectedTrimester
                  }
                  typedGrades={
                    typedGrades
                  }
                  onGradeChange={
                    onGradeChange
                  }
                  onGradeBlur={
                    onGradeBlur
                  }
                  onDeleteStudent={
                    onDeleteStudent
                  }
                  getStudentScoreString={
                    getStudentScoreString
                  }
                />

              )
            )

          )}

        </tbody>

        {/* ====================================================
            PIED DU TABLEAU
            ==================================================== */}

        {students.length > 0 && (

          <tfoot>

            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">

              {/* N° */}

              <td className="p-3 text-center">
                -
              </td>

              {/* NOM */}

              <td className="p-3">
                M.G classe :
              </td>

              {/* SEXE */}

              <td className="p-3 text-center">
                -
              </td>

              {/* =================================================
                  ÉVAL 1
                  ================================================= */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[1]
                )}

              </td>

              {/* ÉVAL 2 */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[2]
                )}

              </td>

              {/* NOTE TRIM 1 */}

              <td className="p-3 text-center bg-amber-100/60 text-amber-900">

                {formatAverage(
                  trimester1ClassAverage
                )}

              </td>

              {/* =================================================
                  ÉVAL 3
                  ================================================= */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[3]
                )}

              </td>

              {/* ÉVAL 4 */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[4]
                )}

              </td>

              {/* NOTE TRIM 2 */}

              <td className="p-3 text-center bg-amber-100/60 text-amber-900">

                {formatAverage(
                  trimester2ClassAverage
                )}

              </td>

              {/* =================================================
                  ÉVAL 5
                  ================================================= */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[5]
                )}

              </td>

              {/* ÉVAL 6 */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[6]
                )}

              </td>

              {/* NOTE TRIM 3 */}

              <td className="p-3 text-center bg-amber-100/60 text-amber-900">

                {formatAverage(
                  trimester3ClassAverage
                )}

              </td>

              {/* =================================================
                  ÉVAL 7
                  ================================================= */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[7]
                )}

              </td>

              {/* ÉVAL 8 */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[8]
                )}

              </td>

              {/* ÉVAL 9 */}

              <td className="p-3 text-center">

                {formatAverage(
                  classAverageBySeq[9]
                )}

              </td>

              {/* =================================================
                  MOYENNE GÉNÉRALE
                  ================================================= */}

              <td className="p-3 text-center font-extrabold text-blue-900 bg-blue-50">

                {formatAverage(
                  classGeneralAverage
                )}

              </td>

              {/* ACTIONS */}

              <td className="p-3 text-center">
                -
              </td>

            </tr>

          </tfoot>

        )}

      </table>

    </div>
  );
}