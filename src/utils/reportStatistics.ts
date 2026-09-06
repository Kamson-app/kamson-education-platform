/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StudentStats, HourCoverage, ProgramCoverage, EstablishmentSettings } from '../types';
import type { DepartmentGlobalStatistics, ClassStatistics } from '../types/report/DepartmentStatistics';

export interface ComputeStatisticsParams {
  allStudentStats: StudentStats[];
  allHourCoverages: HourCoverage[];
  allProgramCoverages: ProgramCoverage[];

  activeEstablishment?: EstablishmentSettings | null;

  selectedTrimester: number;

  establishmentId: string;
  departmentId: string;
  academicYear: string;
  discipline?: string;
}

export function computeReportStatistics({
  allStudentStats,
  allHourCoverages,
  allProgramCoverages,
  activeEstablishment,
  selectedTrimester,
  establishmentId,
  departmentId,
  academicYear,
  discipline,
}: ComputeStatisticsParams): DepartmentGlobalStatistics {

  const currentSchoolId = establishmentId;
  const currentDepartmentId = departmentId;
  const currentAcademicYear = academicYear;
  const currentTrimester = selectedTrimester;

  // ============================================================
  // STATISTIQUES ÉLÈVES DU DÉPARTEMENT
  // Une classe ne doit être comptée qu'une seule fois,
  // même si plusieurs enseignants ont enregistré StudentStats.
  // ============================================================
  const departmentStudentStats =
    allStudentStats.filter(stat => {
      const matchSchool =
        stat.establishmentId === currentSchoolId;

      const matchDepartment =
        stat.departmentId === currentDepartmentId;

      const matchYear =
        stat.academicYear === currentAcademicYear;

      const matchTrimester =
        stat.trimester === currentTrimester;

      const matchDiscipline =
        !discipline ||
        stat.discipline ===
        discipline;

      return (
        matchSchool &&
        matchDepartment &&
        matchYear &&
        matchTrimester &&
        matchDiscipline
      );
    });

  // ============================================================
  // DÉDOUBLONNAGE PAR CLASSE
  // ============================================================
  const studentsStatsByClass =
    new Map<string, StudentStats>();
  
  departmentStudentStats.forEach(stat => {
    const classKey =
      stat.className
        .trim()
        .toLowerCase();

    if (!classKey) return;

    const existing =
      studentsStatsByClass.get(classKey);

    /*
     * Si plusieurs enseignants ont enregistré
     * la même classe, on ne conserve qu'une seule
     * statistique pour cette classe.
     *
     * On privilégie l'enregistrement le plus complet.
     */
    if (!existing) {
      studentsStatsByClass.set(
        classKey,
        stat
      );
      return;
    }

    const existingScore =
      Number(existing.totalStudents || 0) +
      Number(existing.admitted || 0) +
      Number(existing.boys || 0) +
      Number(existing.girls || 0);

    const currentScore =
      Number(stat.totalStudents || 0) +
      Number(stat.admitted || 0) +
      Number(stat.boys || 0) +
      Number(stat.girls || 0);

    if (currentScore > existingScore) {
      studentsStatsByClass.set(
        classKey,
        stat
      );
    }
  });

  // ============================================================
  // LISTE FINALE DES CLASSES UNIQUES
  // ============================================================
  const departmentClasses =
    Array.from(
      studentsStatsByClass.values()
    );

  const nombreClasses = departmentClasses.length;
  const effectifTotal = departmentClasses.reduce((sum, c) => sum + (c.totalStudents ?? 0), 0);
  const totalGarcons = departmentClasses.reduce((sum, c) => sum + (c.boys ?? 0), 0);
  const totalFilles = departmentClasses.reduce((sum, c) => sum + (c.girls ?? 0), 0);

  const statisticsByClass: ClassStatistics[] = departmentClasses.map((stat) => {
    const className = stat.className || 'N/A';
    
    const matchingHours =
      allHourCoverages.filter(h => {

        const matchSchool =
          h.establishmentId ===
          currentSchoolId;

        const matchDepartment =
          h.departmentId ===
          currentDepartmentId;

        const matchAcademicYear =
          h.academicYear === currentAcademicYear;

        const matchTrimester =
          h.trimester ===
          currentTrimester;

        const matchClass =
          h.className ===
          className;

        const matchDiscipline =
          !discipline ||
          h.discipline ===
          discipline;

        return (
          matchSchool &&
          matchDepartment &&
          matchAcademicYear &&
          matchTrimester &&
          matchClass &&
          matchDiscipline
        );
      });

    const anPlanned = matchingHours.reduce((sum, h) => sum + Number(h.plannedHoursAnnual ?? 0), 0);
    const triPlanned = matchingHours.reduce((sum, h) => sum + Number(h.plannedHoursTrimester ?? 0), 0);
    const anCompleted = matchingHours.reduce((sum, h) => sum + Number(h.realizedHoursAnnual ?? 0), 0);
    const triCompleted = matchingHours.reduce((sum, h) => sum + Number(h.realizedHoursTrimester ?? 0), 0);

    const anRate =
      anPlanned > 0
        ? Math.round((anCompleted / anPlanned) * 100)
        : 0;

    const triRate =
      triPlanned > 0
        ? Math.round((triCompleted / triPlanned) * 100)
        : 0;

    const matchingPrograms =
      allProgramCoverages.filter(p => {

        const matchSchool =
          p.establishmentId ===
          currentSchoolId;

        const matchDepartment =
          p.departmentId ===
          currentDepartmentId;

        const matchYear =
          p.academicYear ===
          currentAcademicYear;

        const matchTrimester =
          p.trimester ===
          currentTrimester;

        const matchClass =
          p.className ===
          className;

        const matchDiscipline =
          !discipline ||
          p.discipline ===
          discipline;

        return (
          matchSchool &&
          matchDepartment &&
          matchYear &&
          matchTrimester &&
          matchClass &&
          matchDiscipline
        );
      });

    const pAnPlanned = matchingPrograms.reduce((sum, p) => sum + Number(p.plannedLessonsAnnual ?? p.plannedLessons ?? 0), 0);
    const pTriPlanned = matchingPrograms.reduce((sum, p) => sum + Number(p.plannedLessonsTrimester ?? 0), 0);
    const pAnCompleted = matchingPrograms.reduce((sum, p) => sum + Number(p.completedLessonsAnnual ?? p.completedLessons ?? 0), 0);
    const pTriCompleted = matchingPrograms.reduce((sum, p) => sum + Number(p.completedLessonsTrimester ?? 0), 0);

    const pAnRate = pAnPlanned > 0 ? Math.round((pAnCompleted / pAnPlanned) * 100) : 0;
    const pTriRate = pTriPlanned > 0 ? Math.round((pTriCompleted / pTriPlanned) * 100) : 0;

    const plannedDigitalCoursesAnnual = matchingPrograms.reduce((sum, p) => sum + Number(p.plannedDigitalCoursesAnnual ?? 0), 0);
    const plannedDigitalCoursesTrimester = matchingPrograms.reduce((sum, p) => sum + Number(p.plannedDigitalCoursesTrimester ?? 0), 0);
    const completedDigitalCoursesAnnual = matchingPrograms.reduce((sum, p) => sum + Number(p.completedDigitalCoursesAnnual ?? 0), 0);
    const completedDigitalCoursesTrimester = matchingPrograms.reduce((sum, p) => sum + Number(p.completedDigitalCoursesTrimester ?? 0), 0);
    
    const digitalCoverageRateAnnual = plannedDigitalCoursesAnnual > 0 ? Math.round((completedDigitalCoursesAnnual / plannedDigitalCoursesAnnual) * 100) : 0;
    const digitalCoverageRateTrimester = plannedDigitalCoursesTrimester > 0 ? Math.round((completedDigitalCoursesTrimester / plannedDigitalCoursesTrimester) * 100) : 0;

    const ner =
      stat.regularStudentsCount ??
      stat.ner ??
      stat.totalStudents ??
      0;

    const attendanceRate =
      stat.attendanceRate ?? 100;

    const averageAbove10 =
      stat.admitted ?? 0;

    const successRateVal =
      stat.successRate ?? 0;

    const generalAverage =
      stat.average ?? 0;

    const successBoys =
      stat.boys > 0
        ? Math.round(
            ((stat.admittedBoys ?? 0) / stat.boys) * 100
          )
        : 0;

    const successGirls =
      stat.girls > 0
        ? Math.round(
            ((stat.admittedGirls ?? 0) / stat.girls) * 100
          )
        : 0;

    const successTotal =
      stat.totalStudents > 0
        ? Math.round(
            ((stat.admitted ?? 0) / stat.totalStudents) * 100
          )
        : successRateVal;

    let observation = "Correct";
    if (successTotal < 50) {
      observation = "Attention requise (Taux < 50%)";
    } else if (successTotal >= 80) {
      observation = "Excellents résultats";
    }

    return {
      classId: stat.id || className,
      className,
      boys: stat.boys ?? 0,
      girls: stat.girls ?? 0,
      total: stat.totalStudents ?? 0,
      anPlanned,
      triPlanned,
      anCompleted,
      triCompleted,
      anRate,
      triRate,
      pAnPlanned,
      pTriPlanned,
      pAnCompleted,
      pTriCompleted,
      pAnRate,
      pTriRate,
      plannedDigitalCoursesAnnual,
      plannedDigitalCoursesTrimester,
      completedDigitalCoursesAnnual,
      completedDigitalCoursesTrimester,
      digitalCoverageRateAnnual,
      digitalCoverageRateTrimester,
      ner,
      attendanceRate,
      averageAbove10,
      successBoys,
      successGirls,
      successTotal,
      generalAverage,
      observation
    };
  });

  const digitalCoverageRate =
    statisticsByClass.length > 0
      ? statisticsByClass.reduce(
          (sum, item) => sum + (item.digitalCoverageRateTrimester ?? 0),
          0
        ) / statisticsByClass.length
      : 0;

  const heuresPrevuesAn = statisticsByClass.reduce((acc, curr) => acc + curr.anPlanned, 0);
  const heuresPrevuesTri = statisticsByClass.reduce((acc, curr) => acc + curr.triPlanned, 0);
  const heuresFaitesAn = statisticsByClass.reduce((acc, curr) => acc + curr.anCompleted, 0);
  const heuresFaitesTri = statisticsByClass.reduce((acc, curr) => acc + curr.triCompleted, 0);
  const tauxHeuresAn = heuresPrevuesAn > 0 ? Math.round((heuresFaitesAn / heuresPrevuesAn) * 100) : 0;
  const tauxHeuresTri = heuresPrevuesTri > 0 ? Math.round((heuresFaitesTri / heuresPrevuesTri) * 100) : 0;
  const couvertureHeures = `${tauxHeuresTri}%`;

  const chapPrevusAn = statisticsByClass.reduce((acc, curr) => acc + curr.pAnPlanned, 0);
  const chapPrevusTri = statisticsByClass.reduce((acc, curr) => acc + curr.pTriPlanned, 0);
  const chapFaitsAn = statisticsByClass.reduce((acc, curr) => acc + curr.pAnCompleted, 0);
  const chapFaitsTri = statisticsByClass.reduce((acc, curr) => acc + curr.pTriCompleted, 0);
  const tauxProgrammeAn = chapPrevusAn > 0 ? Math.round((chapFaitsAn / chapPrevusAn) * 100) : 0;
  const tauxProgrammeTri = chapPrevusTri > 0 ? Math.round((chapFaitsTri / chapPrevusTri) * 100) : 0;
  const couvertureProgrammes = `${tauxProgrammeTri}%`;

  const totalDigitalPrevusAn = statisticsByClass.reduce((acc, curr) => acc + curr.plannedDigitalCoursesAnnual, 0);
  const totalDigitalPrevusTri = statisticsByClass.reduce((acc, curr) => acc + curr.plannedDigitalCoursesTrimester, 0);
  const totalDigitalFaitsAn = statisticsByClass.reduce((acc, curr) => acc + curr.completedDigitalCoursesAnnual, 0);
  const totalDigitalFaitsTri = statisticsByClass.reduce((acc, curr) => acc + curr.completedDigitalCoursesTrimester, 0);
  const tauxDigitalAn = totalDigitalPrevusAn > 0 ? Math.round((totalDigitalFaitsAn / totalDigitalPrevusAn) * 100) : 0;
  const tauxDigitalTri = totalDigitalPrevusTri > 0 ? Math.round((totalDigitalFaitsTri / totalDigitalPrevusTri) * 100) : 0;

  const nerTotal = statisticsByClass.reduce((acc, curr) => acc + curr.ner, 0);
  const tauxAssiduite = statisticsByClass.length > 0 ? Math.round(statisticsByClass.reduce((acc, curr) => acc + curr.attendanceRate, 0) / statisticsByClass.length) : 0;
  const moyenne10Total = statisticsByClass.reduce((acc, curr) => acc + curr.averageAbove10, 0);

  const reussiteGarcons = statisticsByClass.length > 0 ? Math.round(statisticsByClass.reduce((acc, curr) => acc + curr.successBoys, 0) / statisticsByClass.length) : 0;
  const reussiteFilles = statisticsByClass.length > 0 ? Math.round(statisticsByClass.reduce((acc, curr) => acc + curr.successGirls, 0) / statisticsByClass.length) : 0;
  const tauxReussite = statisticsByClass.length > 0 ? Math.round(statisticsByClass.reduce((acc, curr) => acc + curr.successTotal, 0) / statisticsByClass.length) : 0;

  const moyenneGenerale = statisticsByClass.length > 0 
    ? (statisticsByClass.reduce((acc, curr) => acc + curr.generalAverage, 0) / statisticsByClass.length).toFixed(2) 
    : "0.00";

  const bestClassBySuccess = statisticsByClass.length > 0 ? [...statisticsByClass].sort((a, b) => b.successTotal - a.successTotal)[0] : null;
  const bestClassByHours = statisticsByClass.length > 0 ? [...statisticsByClass].sort((a, b) => b.triRate - a.triRate)[0] : null;
  const classesInaltherables = statisticsByClass.filter(c => c.successTotal < 50);

  const commentaireStatistique = `
Au cours du Trimestre ${selectedTrimester}, le département pédagogique de ${activeEstablishment?.departmentName || 'cette discipline'} de ${activeEstablishment?.schoolName || activeEstablishment?.establishmentName || 'l\'établissement'}
a encadré ${nombreClasses} classe(s) regroupant ${effectifTotal} élève(s) dont ${totalGarcons} garçon(s) et ${totalFilles} fille(s).

Le taux moyen de couverture des heures d'enseignement est de ${tauxHeuresTri}% tandis que la couverture des programmes
atteint ${tauxProgrammeTri}%. ${bestClassByHours ? `La meilleure couverture horaire a été observée en classe de ${bestClassByHours.className} (${bestClassByHours.triRate}%).` : ''}

La moyenne générale départementale est de ${moyenneGenerale}/20 avec un taux global de réussite de ${tauxReussite}%. ${bestClassBySuccess ? `La classe de ${bestClassBySuccess.className} se distingue par les meilleures performances (${bestClassBySuccess.successTotal}% de réussite).` : ''}
${classesInaltherables.length > 0 ? `Une attention particulière est requise pour les classes de ${classesInaltherables.map(c => c.className).join(', ')} dont le taux de réussite est inférieur à 50%.` : ''}
${totalFilles > 0 && totalGarcons > 0 ? `Les résultats comparés montrent une implication active des filles (${reussiteFilles}%) face aux garçons (${reussiteGarcons}%).` : ''}
`.trim();

  return {
    departmentClasses,
    nombreClasses,
    effectifTotal,
    totalGarcons,
    totalFilles,
    statisticsByClass,
    digitalCoverageRate,
    heuresPrevuesAn,
    heuresPrevuesTri,
    heuresFaitesAn,
    heuresFaitesTri,
    tauxHeuresAn,
    tauxHeuresTri,
    couvertureHeures,
    chapPrevusAn,
    chapPrevusTri,
    chapFaitsAn,
    chapFaitsTri,
    tauxProgrammeAn,
    tauxProgrammeTri,
    couvertureProgrammes,
    totalDigitalPrevusAn,
    totalDigitalPrevusTri,
    totalDigitalFaitsAn,
    totalDigitalFaitsTri,
    tauxDigitalAn,
    tauxDigitalTri,
    nerTotal,
    tauxAssiduite,
    moyenne10Total,
    reussiteGarcons,
    reussiteFilles,
    tauxReussite,
    moyenneGenerale,
    commentaireStatistique
  };
}