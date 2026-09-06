/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  StudentGrade,
  Trimester,
} from "../types";

import {
  Trash2,
} from "lucide-react";

interface StudentRowProps {
  student: StudentGrade;

  index: number;

  selectedTrimester: Trimester;

  typedGrades: Record<string, string>;

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

export default function StudentRow({
  student,
  index,
  typedGrades,
  onGradeChange,
  onGradeBlur,
  onDeleteStudent,
  getStudentScoreString,
}: StudentRowProps) {

  /* ==========================================================
   * RÉCUPÉRER LA VALEUR SAISIE
   * ========================================================== */

  const getDisplayValue = (
    seq: number
  ): string => {

    const key =
      `${student.id}-${seq}`;

    /*
     * Si l'utilisateur est actuellement
     * en train de modifier la cellule,
     * on affiche sa saisie.
     */

    if (
      typedGrades[key] !== undefined
    ) {
      return typedGrades[key];
    }

    /*
     * Sinon on récupère la valeur
     * enregistrée.
     */

    return getStudentScoreString(
      student,
      seq
    );
  };


  /* ==========================================================
   * RÉCUPÉRER UNE NOTE NUMÉRIQUE
   * ========================================================== */

  const getNumericValue = (
    seq: number
  ): number | undefined => {

    const value =
      getDisplayValue(seq);

    /*
     * "-" = non évalué
     */

    if (
      value === "-" ||
      value.trim() === ""
    ) {
      return undefined;
    }

    const number =
      Number(value);

    /*
     * NaN = valeur non numérique
     */

    if (
      Number.isNaN(number)
    ) {
      return undefined;
    }

    /*
     * 0 est une vraie note.
     */

    return number;
  };


  /* ==========================================================
   * CALCUL MOYENNE TRIMESTRIELLE
   * ========================================================== */

  const calculateTrimAverage = (
    seq1: number,
    seq2: number
  ): string => {

    const value1 =
      getNumericValue(seq1);

    const value2 =
      getNumericValue(seq2);


    /*
     * Aucune note.
     */

    if (
      value1 === undefined &&
      value2 === undefined
    ) {
      return "-";
    }


    /*
     * Une seule note :
     *
     * son coefficient est le seul
     * coefficient utilisé.
     *
     * La moyenne est donc cette note.
     */

    if (
      value1 !== undefined &&
      value2 === undefined
    ) {
      return value1.toFixed(2);
    }


    if (
      value1 === undefined &&
      value2 !== undefined
    ) {
      return value2.toFixed(2);
    }


    /*
     * Les deux évaluations existent.
     *
     * IMPORTANT :
     *
     * Ici nous utilisons les coefficients
     * enregistrés dans les évaluations.
     */

    const evaluation1 =
      student.evaluations?.[seq1];

    const evaluation2 =
      student.evaluations?.[seq2];


    const coefficient1 =
      evaluation1 &&
      typeof evaluation1 === "object" &&
      "coefficient" in evaluation1
        ? Number(
            (
              evaluation1 as {
                coefficient?: number;
              }
            ).coefficient ?? 1
          )
        : 1;


    const coefficient2 =
      evaluation2 &&
      typeof evaluation2 === "object" &&
      "coefficient" in evaluation2
        ? Number(
            (
              evaluation2 as {
                coefficient?: number;
              }
            ).coefficient ?? 1
          )
        : 1;


    const validCoefficient1 =
      Number.isFinite(coefficient1) &&
      coefficient1 > 0
        ? coefficient1
        : 1;


    const validCoefficient2 =
      Number.isFinite(coefficient2) &&
      coefficient2 > 0
        ? coefficient2
        : 1;


    /*
     * Les deux notes sont présentes.
     */

    const weightedSum =
      (
        (value1 ?? 0) *
        validCoefficient1
      ) +
      (
        (value2 ?? 0) *
        validCoefficient2
      );


    const totalCoefficient =
      validCoefficient1 +
      validCoefficient2;


    if (
      totalCoefficient <= 0
    ) {
      return "-";
    }


    return (
      weightedSum /
      totalCoefficient
    ).toFixed(2);
  };


  /* ==========================================================
   * MOYENNES TRIMESTRIELLES
   * ========================================================== */

  const trim1Average =
    calculateTrimAverage(1, 2);

  const trim2Average =
    calculateTrimAverage(3, 4);

  const trim3Average =
    calculateTrimAverage(5, 6);


  /* ==========================================================
   * CELLULE DE SAISIE D'UNE ÉVALUATION
   * ========================================================== */

  const renderSeqInput = (
    seq: number
  ) => {


      `${student.id}-${seq}`;

    const displayValue =
      getDisplayValue(seq);


    return (
      <td
        key={`seq-${seq}`}
        className="py-1.5 px-2 text-center"
      >

        <input
          type="text"

          inputMode="decimal"

          value={displayValue === "-"
            ? ""
            : displayValue}

          onChange={(event) =>
            onGradeChange(
              student.id,
              seq,
              event.target.value
            )
          }

          onBlur={onGradeBlur}

          className="
            w-12
            h-8
            text-center
            bg-slate-50
            border
            border-slate-200
            rounded-lg
            text-xs
            font-semibold
            focus:bg-white
            focus:border-indigo-500
            focus:ring-1
            focus:ring-indigo-500
            transition-all
          "

          placeholder="-"
        />

      </td>
    );
  };


  /* ==========================================================
   * CELLULE MOYENNE TRIMESTRIELLE
   * ========================================================== */

  const renderTrimTotalCell = (
    value: string,
    keySuffix: string
  ) => {

    return (
      <td
        key={`trim-total-${keySuffix}`}

        className="
          py-2.5
          px-3
          text-center
          font-bold
          text-amber-900
          bg-amber-50/60
          border-x
          border-slate-200/60
          text-xs
        "
      >

        {value}

      </td>
    );
  };


  /* ==========================================================
   * MOYENNE GÉNÉRALE
   * ========================================================== */

  const hasOverallAverage =
    typeof student.average === "number" &&
    !Number.isNaN(student.average);


  const overallAverage =
    hasOverallAverage
      ? student.average!.toFixed(2)
      : "-";


  /* ==========================================================
   * RENDU
   * ========================================================== */

  return (

    <tr
      className="
        hover:bg-slate-50/80
        transition-colors
        border-b
        border-slate-100
        text-xs
      "
    >

      {/* N° */}

      <td
        className="
          py-2.5
          px-3
          text-center
          font-medium
          text-slate-500
        "
      >
        {index + 1}
      </td>


      {/* NOM */}

      <td
        className="
          py-2.5
          px-3
          font-semibold
          text-slate-800
        "
      >
        {student.name}
      </td>


      {/* SEXE */}

      <td
        className="
          py-2.5
          px-3
          text-center
        "
      >

        <span
          className={`
            inline-block
            px-2
            py-0.5
            rounded-full
            text-[10px]
            font-bold
            ${
              student.gender === "F"
                ? "bg-pink-50 text-pink-600"
                : "bg-blue-50 text-blue-600"
            }
          `}
        >

          {student.gender}

        </span>

      </td>


      {/* =====================================================
          TRIMESTRE 1
          ===================================================== */}

      {renderSeqInput(1)}

      {renderSeqInput(2)}

      {renderTrimTotalCell(
        trim1Average,
        "1"
      )}


      {/* =====================================================
          TRIMESTRE 2
          ===================================================== */}

      {renderSeqInput(3)}

      {renderSeqInput(4)}

      {renderTrimTotalCell(
        trim2Average,
        "2"
      )}


      {/* =====================================================
          TRIMESTRE 3
          ===================================================== */}

      {renderSeqInput(5)}

      {renderSeqInput(6)}

      {renderTrimTotalCell(
        trim3Average,
        "3"
      )}


      {/* =====================================================
          ÉVALUATIONS 7, 8, 9
          ===================================================== */}

      {renderSeqInput(7)}

      {renderSeqInput(8)}

      {renderSeqInput(9)}


      {/* =====================================================
          MOYENNE GÉNÉRALE
          ===================================================== */}

      <td
        className="
          py-2.5
          px-3
          text-center
          font-bold
          text-slate-900
          bg-slate-50/50
        "
      >

        {overallAverage}

      </td>


      {/* =====================================================
          ACTIONS
          ===================================================== */}

      <td
        className="
          py-2.5
          px-3
          text-center
          no-print
        "
      >

        <button
          type="button"

          onClick={() =>
            onDeleteStudent(
              student.id
            )
          }

          className="
            p-1.5
            text-slate-400
            hover:text-red-600
            hover:bg-red-50
            rounded-lg
            transition-colors
            cursor-pointer
          "

          title="Supprimer l'élève"
        >

          <Trash2 size={14} />

        </button>

      </td>

    </tr>
  );
}