/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  StudentGrade,
  Trimester,
  EvaluationCoefficients,
} from "../types";

/* ============================================================
 * RÉCUPÉRATION DES NOTES
 * ============================================================ */

/**
 * Récupère la valeur numérique d'une note pour une séquence.
 *
 * Règles :
 * - note absente → undefined
 * - "-" → undefined
 * - cellule vide → undefined
 * - 0 → 0 (vraie note)
 * - valeur numérique → valeur numérique
 *
 * La fonction prend en charge :
 *
 * 1. Structure actuelle :
 *    evaluations[seq] = {
 *      score,
 *      coefficient
 *    }
 *
 * 2. Ancienne structure :
 *    eval1, eval2, eval3...
 */
export const getStudentScoreValue = (
  student: StudentGrade,
  seq: number
): number | undefined => {

  if (!student) {
    return undefined;
  }

  /* ==========================================================
   * STRUCTURE ACTUELLE
   * ========================================================== */

  if (
    student.evaluations &&
    student.evaluations[seq] !== undefined
  ) {

    const scoreObj = student.evaluations[seq];

    /*
     * Structure :
     *
     * evaluations[seq] = {
     *   score: number,
     *   coefficient: number
     * }
     */

    if (
      scoreObj &&
      typeof scoreObj === "object" &&
      "score" in scoreObj
    ) {

      const val =
        (scoreObj as { score: unknown }).score;

      /*
       * Absence de note.
       *
       * IMPORTANT :
       * 0 n'est PAS considéré comme absent.
       */

      if (
        val === "" ||
        val === null ||
        val === undefined ||
        val === "-"
      ) {
        return undefined;
      }

      const num = Number(val);

      return Number.isNaN(num)
        ? undefined
        : num;
    }

    /*
     * Compatibilité avec une ancienne version
     * où evaluations[seq] pouvait être directement
     * un nombre.
     */

    if (typeof scoreObj === "number") {
      return scoreObj;
    }
  }

  /* ==========================================================
   * COMPATIBILITÉ ANCIENNE STRUCTURE
   * ========================================================== */

  const legacyKey =
    `eval${seq}` as keyof StudentGrade;

  const legacyValue =
    student[legacyKey];

  if (
    legacyValue === undefined ||
    legacyValue === null ||
    legacyValue === "" ||
    legacyValue === "-"
  ) {
    return undefined;
  }

  const num =
    Number(legacyValue);

  return Number.isNaN(num)
    ? undefined
    : num;
};


/* ============================================================
 * AFFICHAGE DES NOTES
 * ============================================================ */

/**
 * Retourne la note sous forme de texte.
 *
 * Une note absente est affichée par "-".
 */
export const getStudentScoreString = (
  student: StudentGrade,
  seq: number
): string => {

  const value =
    getStudentScoreValue(student, seq);

  if (value === undefined) {
    return "-";
  }

  return value.toString();
};


/* ============================================================
 * DÉTECTION D'UNE ÉVALUATION
 * ============================================================ */

/**
 * Vérifie si une séquence contient réellement une note.
 *
 * IMPORTANT :
 * 0 est considéré comme une note valide.
 */
export const hasStudentScore = (
  student: StudentGrade,
  seq: number
): boolean => {

  return (
    getStudentScoreValue(student, seq) !==
    undefined
  );
};


/**
 * Vérifie si l'élève possède au moins une note
 * sur l'ensemble des évaluations.
 *
 * Évaluations prises en compte :
 * 1 à 9.
 */
export const isStudentEvaluated = (
  student: StudentGrade
): boolean => {

  for (let seq = 1; seq <= 9; seq++) {

    if (hasStudentScore(student, seq)) {
      return true;
    }

  }

  return false;
};


/* ============================================================
 * MOYENNE TRIMESTRIELLE
 * ============================================================ */

/**
 * Calcule la moyenne trimestrielle.
 *
 * Trimestre 1 → évaluations 1 et 2
 * Trimestre 2 → évaluations 3 et 4
 * Trimestre 3 → évaluations 5 et 6
 *
 * Règle essentielle :
 *
 * Le coefficient d'une évaluation absente
 * n'est PAS compté.
 *
 * Exemple :
 *
 * Éval 1 = 12
 * Coef 1 = 2
 *
 * Éval 2 = -
 * Coef 2 = 1
 *
 * Résultat :
 *
 * moyenne = 12
 * coefficient utilisé = 2
 *
 * Et non :
 *
 * (12 × 2 + 0 × 1) / 3
 */
export const calculateStudentTrimesterAverage = (
  student: StudentGrade,
  trimester: Trimester,
  evalCoefficients: EvaluationCoefficients
): number => {

  const evaluationsByTrimester: Record<
    Trimester,
    number[]
  > = {

    1: [1, 2],

    2: [3, 4],

    3: [5, 6],

  };

  const sequences =
    evaluationsByTrimester[trimester];

  let weightedTotal = 0;

  let totalCoefficient = 0;

  sequences.forEach((seq) => {

    const score =
      getStudentScoreValue(
        student,
        seq
      );

    /*
     * Pas de note :
     *
     * on ignore complètement
     * cette évaluation ET son coefficient.
     */

    if (score === undefined) {
      return;
    }

    const coefficient =
      Number(
        evalCoefficients[seq] ?? 1
      );

    /*
     * Sécurité :
     * un coefficient invalide ou <= 0
     * est ignoré.
     */

    if (
      !Number.isFinite(coefficient) ||
      coefficient <= 0
    ) {
      return;
    }

    weightedTotal +=
      score * coefficient;

    totalCoefficient +=
      coefficient;

  });

  /*
   * Aucune note valide.
   */

  if (totalCoefficient === 0) {
    return 0;
  }

  return Number(
    (
      weightedTotal /
      totalCoefficient
    ).toFixed(2)
  );
};


/* ============================================================
 * MOYENNE GÉNÉRALE DE L'ÉLÈVE
 * ============================================================ */

/**
 * Calcule la moyenne générale de l'élève.
 *
 * Seules les périodes possédant au moins une note
 * sont prises en compte.
 *
 * Trimestre 1 → évaluations 1 et 2
 * Trimestre 2 → évaluations 3 et 4
 * Trimestre 3 → évaluations 5 et 6
 *
 * Les évaluations 7, 8 et 9 sont traitées comme
 * des évaluations indépendantes.
 */
export const calculateStudentOverallAverage = (
  student: StudentGrade,
  evalCoefficients: EvaluationCoefficients
): number => {

  const trimesterAverages: number[] = [];

  /* ==========================================================
   * TRIMESTRE 1
   * ========================================================== */

  const hasTrimester1 =
    hasStudentScore(student, 1) ||
    hasStudentScore(student, 2);

  if (hasTrimester1) {

    const average =
      calculateStudentTrimesterAverage(
        student,
        1,
        evalCoefficients
      );

    trimesterAverages.push(
      average
    );
  }


  /* ==========================================================
   * TRIMESTRE 2
   * ========================================================== */

  const hasTrimester2 =
    hasStudentScore(student, 3) ||
    hasStudentScore(student, 4);

  if (hasTrimester2) {

    const average =
      calculateStudentTrimesterAverage(
        student,
        2,
        evalCoefficients
      );

    trimesterAverages.push(
      average
    );
  }


  /* ==========================================================
   * TRIMESTRE 3
   * ========================================================== */

  const hasTrimester3 =
    hasStudentScore(student, 5) ||
    hasStudentScore(student, 6);

  if (hasTrimester3) {

    const average =
      calculateStudentTrimesterAverage(
        student,
        3,
        evalCoefficients
      );

    trimesterAverages.push(
      average
    );
  }


  /* ==========================================================
   * ÉVALUATIONS 7, 8 ET 9
   * ========================================================== */

  [7, 8, 9].forEach((seq) => {

    const score =
      getStudentScoreValue(
        student,
        seq
      );

    if (score !== undefined) {

      trimesterAverages.push(
        score
      );

    }

  });


  /* ==========================================================
   * AUCUNE NOTE
   * ========================================================== */

  if (
    trimesterAverages.length === 0
  ) {
    return 0;
  }


  /* ==========================================================
   * CALCUL
   * ========================================================== */

  const total =
    trimesterAverages.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  return Number(
    (
      total /
      trimesterAverages.length
    ).toFixed(2)
  );
};


/* ============================================================
 * STATISTIQUES EFFECTIFS / ÉVALUÉS / RÉUSSITE
 * ============================================================ */

/**
 * Calcule :
 *
 * - effectifs garçons
 * - effectifs filles
 * - effectifs total
 * - élèves évalués
 * - élèves admis
 * - taux d'évaluation
 * - taux de réussite
 * - moyenne par séquence
 * - moyenne générale de classe
 *
 * Seuls les élèves réellement évalués
 * participent aux statistiques de performance.
 */
export const calculateEnrollmentAndPerformanceStats = (
  students: StudentGrade[],
  evalCoefficients: EvaluationCoefficients = {}
) => {

  /* ==========================================================
   * CALCUL DES MOYENNES
   *
   * Ne pas modifier directement students.
   * ========================================================== */

  const studentsWithAverage =
    students.map((student) => ({

      ...student,

      average:
        calculateStudentOverallAverage(
          student,
          evalCoefficients
        ),

    }));


  /* ==========================================================
   * EFFECTIFS INSCRITS
   * ========================================================== */

  const statsEnrollment = {

    boys:
      studentsWithAverage.filter(
        student =>
          student.gender === "M"
      ).length,

    girls:
      studentsWithAverage.filter(
        student =>
          student.gender === "F"
      ).length,

    total:
      studentsWithAverage.length,

  };


  /* ==========================================================
   * ÉLÈVES ÉVALUÉS
   *
   * IMPORTANT :
   *
   * "-" = non évalué
   * 0 = note valide
   * ========================================================== */

  const evaluatedStudents =
    studentsWithAverage.filter(
      student =>
        isStudentEvaluated(student)
    );

  const statsEvaluated = {

    boys:
      evaluatedStudents.filter(
        student =>
          student.gender === "M"
      ).length,

    girls:
      evaluatedStudents.filter(
        student =>
          student.gender === "F"
      ).length,

    total:
      evaluatedStudents.length,

  };


  /* ==========================================================
   * ÉLÈVES AYANT RÉUSSI
   *
   * Seuls les élèves évalués
   * peuvent être admis.
   *
   * Seuil : 10/20
   * ========================================================== */

  const passingStudents =
    evaluatedStudents.filter(
      student =>
        typeof student.average === "number" &&
        student.average >= 10
    );

  const statsPassing = {

    boys:
      passingStudents.filter(
        student =>
          student.gender === "M"
      ).length,

    girls:
      passingStudents.filter(
        student =>
          student.gender === "F"
      ).length,

    total:
      passingStudents.length,

  };


  /* ==========================================================
   * POURCENTAGE DES INSCRITS PAR GENRE
   * ========================================================== */

  const percInscritsBoys =
    statsEnrollment.total > 0

      ? (
          statsEnrollment.boys /
          statsEnrollment.total
        ) * 100

      : 0;


  const percInscritsGirls =
    statsEnrollment.total > 0

      ? (
          statsEnrollment.girls /
          statsEnrollment.total
        ) * 100

      : 0;


  /* ==========================================================
   * TAUX D'ÉVALUATION
   * ========================================================== */

  const percEvaluatedBoys =
    statsEnrollment.boys > 0

      ? (
          statsEvaluated.boys /
          statsEnrollment.boys
        ) * 100

      : 0;


  const percEvaluatedGirls =
    statsEnrollment.girls > 0

      ? (
          statsEvaluated.girls /
          statsEnrollment.girls
        ) * 100

      : 0;


  /* ==========================================================
   * TAUX DE RÉUSSITE PARMI LES ÉVALUÉS
   * ========================================================== */

  const percPassingBoysEvaluated =
    statsEvaluated.boys > 0

      ? (
          statsPassing.boys /
          statsEvaluated.boys
        ) * 100

      : 0;


  const percPassingGirlsEvaluated =
    statsEvaluated.girls > 0

      ? (
          statsPassing.girls /
          statsEvaluated.girls
        ) * 100

      : 0;


  const percPassingOverall =
    statsEvaluated.total > 0

      ? (
          statsPassing.total /
          statsEvaluated.total
        ) * 100

      : 0;


  const boysSuccessRate =
    percPassingBoysEvaluated;


  const girlsSuccessRate =
    percPassingGirlsEvaluated;


  /* ==========================================================
   * MOYENNES PAR SÉQUENCE
   *
   * Les élèves sans note pour la séquence
   * ne sont pas comptés.
   * ========================================================== */

  const classAverageBySeq:
    Record<number, number> = {};


  for (
    let seq = 1;
    seq <= 9;
    seq++
  ) {

    const scores =
      studentsWithAverage

        .map(student =>
          getStudentScoreValue(
            student,
            seq
          )
        )

        .filter(
          (score): score is number =>
            typeof score === "number" &&
            !Number.isNaN(score)
        );


    if (scores.length > 0) {

      const sum =
        scores.reduce(
          (total, score) =>
            total + score,
          0
        );

      classAverageBySeq[seq] =
        Number(
          (
            sum /
            scores.length
          ).toFixed(2)
        );
    }
  }


  /* ==========================================================
   * MOYENNE GÉNÉRALE DE LA CLASSE
   *
   * Les élèves non évalués sont exclus.
   * ========================================================== */

  const allGrades =
    studentsWithAverage

      .filter(student =>
        isStudentEvaluated(student)
      )

      .map(student =>
        student.average
      )

      .filter(
        (average): average is number =>
          typeof average === "number" &&
          !Number.isNaN(average)
      );


  const classGeneralAverage =
    allGrades.length > 0

      ? Number(
          (
            allGrades.reduce(
              (sum, average) =>
                sum + average,
              0
            ) /
            allGrades.length
          ).toFixed(2)
        )

      : 0;


  /* ==========================================================
   * RÉSULTAT
   * ========================================================== */

  return {

    statsEnrollment,

    statsEvaluated,

    statsPassing,

    percInscritsBoys,

    percInscritsGirls,

    percEvaluatedBoys,

    percEvaluatedGirls,

    percPassingBoysEvaluated,

    percPassingGirlsEvaluated,

    percPassingOverall,

    boysSuccessRate,

    girlsSuccessRate,

    classAverageBySeq,

    classGeneralAverage,

  };
};


/* ============================================================
 * MOYENNES DE CLASSE PAR SÉQUENCE
 * ============================================================ */

/**
 * Calcule la moyenne de chaque évaluation.
 *
 * Une évaluation sans note est ignorée.
 */
export const calculateClassAveragesBySeq = (
  students: StudentGrade[]
): Record<number, number> => {

  const averages:
    Record<number, number> = {};


  for (
    let seq = 1;
    seq <= 9;
    seq++
  ) {

    const scores =
      students

        .map(student =>
          getStudentScoreValue(
            student,
            seq
          )
        )

        .filter(
          (score): score is number =>
            typeof score === "number" &&
            !Number.isNaN(score)
        );


    if (scores.length > 0) {

      const sum =
        scores.reduce(
          (total, score) =>
            total + score,
          0
        );

      averages[seq] =
        Number(
          (
            sum /
            scores.length
          ).toFixed(2)
        );
    }
  }


  return averages;
};


/* ============================================================
 * MOYENNE GÉNÉRALE DE LA CLASSE
 * ============================================================ */

/**
 * Calcule la moyenne générale de la classe.
 *
 * Les élèves non évalués sont exclus.
 */
export const calculateClassGeneralAverage = (
  students: StudentGrade[],
  evalCoefficients: EvaluationCoefficients = {}
): number => {

  const averages =
    students

      .filter(student =>
        isStudentEvaluated(student)
      )

      .map(student =>
        calculateStudentOverallAverage(
          student,
          evalCoefficients
        )
      )

      .filter(
        (average): average is number =>
          typeof average === "number" &&
          !Number.isNaN(average)
      );


  if (
    averages.length === 0
  ) {
    return 0;
  }


  const total =
    averages.reduce(
      (sum, average) =>
        sum + average,
      0
    );


  return Number(
    (
      total /
      averages.length
    ).toFixed(2)
  );
};