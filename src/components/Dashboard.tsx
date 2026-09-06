/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react';

import {
  getUserProfile
} from "../utils/userProfile";

import type {
  UserProfile,
  StudentStats,
  ClassGradeSheet,
  HourCoverage,
  ProgramCoverage,
  EstablishmentSettings,
  DepartmentMessage
} from '../types';

import {
  Users,
  BookOpen,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Trash2,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  UserCheck
} from 'lucide-react';


/* ============================================================================
 * PROPS
 * ========================================================================== */

interface DashboardProps {
  currentUser: UserProfile;

  establishmentSettings: EstablishmentSettings;

  studentsStats?: StudentStats[];

  gradeSheets?: ClassGradeSheet[];

  hourCoverages?: HourCoverage[];

  programCoverages?: ProgramCoverage[];

  departmentMessages?: DepartmentMessage[];

  onSaveDepartmentMessages?: (
    msgs: DepartmentMessage[]
  ) => void;

  /**
   * Liste des enseignants du département.
   *
   * Cette donnée est fournie par App.tsx.
   * Elle reste optionnelle pour conserver la compatibilité
   * avec l'ancien appel du composant.
   */
  departmentTeachers?: UserProfile[];
}


/* ============================================================================
 * TYPES INTERNES
 * ========================================================================== */

type AnyRecord = Record<string, any>;


/* ============================================================================
 * UTILITAIRES
 * ========================================================================== */

/**
 * Convertit de manière sécurisée une date Firestore, un timestamp ou une chaîne en objet Date.
 */
function toDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  // Firestore Timestamp
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }

  // Timestamp sérialisé
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  // Chaîne ou nombre
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}


/**
 * Normalise un texte pour permettre les recherches sans tenir compte
 * des accents et des majuscules.
 */
function normalizeSearchText(
  text: string | undefined | null
): string {
  if (!text) return '';

  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}


/**
 * Retourne l'année scolaire réellement utilisée par l'établissement.
 */
function getAcademicYear(
  establishmentSettings?: EstablishmentSettings | null,
  currentUser?: UserProfile | null
): string {
  return (
    establishmentSettings?.academicYear ||
    (currentUser as AnyRecord)?.academicYear ||
    ''
  );
}


/**
 * Récupère l'identifiant utilisateur en tenant compte des différentes
 * versions du modèle utilisées dans l'application.
 */
function getUserId(
  user?: UserProfile | null
): string {
  if (!user) return '';

  const u = user as AnyRecord;

  return (
    u.uid ||
    u.id ||
    ''
  );
}


/**
 * Vérifie si une donnée appartient au même établissement.
 */
function sameEstablishment(
  item: AnyRecord,
  currentUser: UserProfile
): boolean {
  const establishmentId = currentUser.establishmentId;

  if (!establishmentId) return false;

  return (
    !item.establishmentId ||
    item.establishmentId === establishmentId
  );
}


/**
 * Vérifie si une donnée appartient au même département.
 */
function sameDepartment(
  item: AnyRecord,
  currentUser: UserProfile
): boolean {
  const departmentId = currentUser.departmentId;

  if (!departmentId) return false;

  return (
    !item.departmentId ||
    item.departmentId === departmentId
  );
}


/**
 * Périmètre sécurisé.
 */
function belongsToDepartment(
  item: AnyRecord,
  currentUser: UserProfile
): boolean {
  return (
    sameEstablishment(item, currentUser) &&
    sameDepartment(item, currentUser)
  );
}


/**
 * Vérifie si une donnée appartient à l'enseignant courant.
 */
function belongsToTeacher(
  item: AnyRecord,
  currentUser: UserProfile
): boolean {
  const uid = getUserId(currentUser);

  if (!uid) return false;

  const itemTeacherId =
    item.teacherId ||
    item.teacherUid ||
    item.uid ||
    '';

  const itemAuthorId =
    item.authorId ||
    item.userId ||
    '';

  const teacherName =
    normalizeSearchText(
      currentUser.name
    );

  const itemTeacherName =
    normalizeSearchText(
      item.teacherName ||
      item.authorName ||
      ''
    );

  return (
    itemTeacherId === uid ||
    itemAuthorId === uid ||
    (
      teacherName &&
      itemTeacherName &&
      teacherName === itemTeacherName
    ) ||
    (
      Array.isArray(currentUser.classes) &&
      currentUser.classes.includes(item.className)
    )
  );
}


/**
 * Récupère la moyenne d'un élève.
 */
function getStudentAverage(
  student: AnyRecord
): number {
  const value =
    student.average ??
    student.grade ??
    student.moyenne ??
    0;

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


/**
 * Récupère le genre d'un élève.
 */
function getStudentGender(
  student: AnyRecord
): 'M' | 'F' | null {
  const gender =
    student.gender ??
    student.sexe ??
    student.sex;

  if (!gender) return null;

  const normalized =
    String(gender)
      .trim()
      .toUpperCase();

  if (
    normalized === 'M' ||
    normalized === 'G' ||
    normalized === 'GARCON' ||
    normalized === 'GARÇON' ||
    normalized === 'MALE'
  ) {
    return 'M';
  }

  if (
    normalized === 'F' ||
    normalized === 'FILLE' ||
    normalized === 'FEMALE'
  ) {
    return 'F';
  }

  return null;
}


/**
 * Récupère l'année d'une donnée.
 */
function getItemAcademicYear(
  item: AnyRecord
): string {
  return (
    item.academicYear ||
    item.schoolYear ||
    ''
  );
}


/**
 * Détermine si une donnée appartient à l'année scolaire courante.
 */
function belongsToAcademicYear(
  item: AnyRecord,
  academicYear: string
): boolean {
  if (!academicYear) {
    return true;
  }

  const itemYear =
    getItemAcademicYear(item);

  if (!itemYear) {
    return true;
  }

  return itemYear === academicYear;
}


/**
 * Retourne une valeur numérique en acceptant les anciens
 * et les nouveaux noms de champs utilisés par l'application.
 */
function getNumberField(
  item: AnyRecord,
  ...fieldNames: string[]
): number {
  for (const fieldName of fieldNames) {
    const value = item[fieldName];

    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}


/**
 * Construit une clé stable pour identifier un même relevé.
 */
function gradeSheetKey(
  sheet: ClassGradeSheet
): string {
  const item =
    sheet as AnyRecord;

  const className =
    normalizeSearchText(
      item.className ||
      item.class ||
      item.classe ||
      ''
    );

  const subject =
    normalizeSearchText(
      item.subject ||
      item.discipline ||
      ''
    );

  const teacherId =
    String(
      item.teacherId ||
      item.teacherUid ||
      item.userId ||
      ''
    ).trim();

  const teacherName =
    normalizeSearchText(
      item.teacherName ||
      item.authorName ||
      ''
    );

  const trimester =
    String(
      item.trimester ?? ''
    );

  const academicYear =
    normalizeSearchText(
      getItemAcademicYear(item)
    );

  return [
    academicYear,
    className,
    subject,
    teacherName || teacherId,
    trimester
  ].join('::');
}


/**
 * Pour deux copies d'un même relevé, conserve la plus complète
 * puis la plus récente.
 */
function isBetterGradeSheet(
  candidate: ClassGradeSheet,
  current: ClassGradeSheet
): boolean {
  const candidateStudents =
    Array.isArray(
      (candidate as AnyRecord).students
    )
      ? (candidate as AnyRecord).students.length
      : 0;

  const currentStudents =
    Array.isArray(
      (current as AnyRecord).students
    )
      ? (current as AnyRecord).students.length
      : 0;

  if (
    candidateStudents !==
    currentStudents
  ) {
    return candidateStudents >
      currentStudents;
  }

  const candidateDate =
    toDate(
      (candidate as AnyRecord).updatedAt ||
      (candidate as AnyRecord).createdAt
    )?.getTime() || 0;

  const currentDate =
    toDate(
      (current as AnyRecord).updatedAt ||
      (current as AnyRecord).createdAt
    )?.getTime() || 0;

  return candidateDate > currentDate;
}


/* ============================================================================
 * COMPOSANT
 * ========================================================================== */

export default function Dashboard({
  currentUser,
  establishmentSettings,

  studentsStats = [],
  gradeSheets = [],
  hourCoverages = [],
  programCoverages = [],

  departmentMessages = [],
  onSaveDepartmentMessages,

  departmentTeachers = []
}: DashboardProps) {

  /* --------------------------------------------------------------------------
   * CONTEXTE
   * ------------------------------------------------------------------------ */

  const isTeacher =
    currentUser?.role === 'ENSEIGNANT';

  const currentAcademicYear =
    getAcademicYear(
      establishmentSettings,
      currentUser
    );


  const currentUserId =
    getUserId(currentUser);


  const hasValidContext =
    Boolean(
      currentUser?.establishmentId &&
      currentUser?.departmentId &&
      currentUserId
    );


  const profile =
    getUserProfile(
      currentUser,
      establishmentSettings
    );


  /* ==========================================================================
   * FILTRAGE PAR ÉTABLISSEMENT / DÉPARTEMENT
   * ======================================================================== */

  const departmentFilteredStats =
    useMemo(() => {

      return studentsStats.filter(
        (item) =>
          belongsToDepartment(
            item as AnyRecord,
            currentUser
          ) &&
          belongsToAcademicYear(
            item as AnyRecord,
            currentAcademicYear
          )
      );

    }, [
      studentsStats,
      currentUser,
      currentAcademicYear
    ]);


  const departmentFilteredGradeSheets =
    useMemo(() => {

      return gradeSheets.filter(
        (item) =>
          belongsToDepartment(
            item as AnyRecord,
            currentUser
          ) &&
          belongsToAcademicYear(
            item as AnyRecord,
            currentAcademicYear
          )
      );

    }, [
      gradeSheets,
      currentUser,
      currentAcademicYear
    ]);


  const departmentFilteredHourCoverages =
    useMemo(() => {

      return hourCoverages.filter(
        (item) =>
          belongsToDepartment(
            item as AnyRecord,
            currentUser
          ) &&
          belongsToAcademicYear(
            item as AnyRecord,
            currentAcademicYear
          )
      );

    }, [
      hourCoverages,
      currentUser,
      currentAcademicYear
    ]);


  const departmentFilteredProgramCoverages =
    useMemo(() => {

      return programCoverages.filter(
        (item) =>
          belongsToDepartment(
            item as AnyRecord,
            currentUser
          ) &&
          belongsToAcademicYear(
            item as AnyRecord,
            currentAcademicYear
          )
      );

    }, [
      programCoverages,
      currentUser,
      currentAcademicYear
    ]);


  /* ==========================================================================
   * FILTRAGE ENSEIGNANT
   * ======================================================================== */

  const filteredStats =
    useMemo(() => {

      if (!isTeacher) {
        return departmentFilteredStats;
      }

      return departmentFilteredStats.filter(
        (item) =>
          belongsToTeacher(
            item as AnyRecord,
            currentUser
          )
      );

    }, [
      departmentFilteredStats,
      currentUser,
      isTeacher
    ]);


  const filteredGradeSheets =
    useMemo(() => {

      if (!isTeacher) {
        return departmentFilteredGradeSheets;
      }

      return departmentFilteredGradeSheets.filter(
        (item) =>
          belongsToTeacher(
            item as AnyRecord,
            currentUser
          )
      );

    }, [
      departmentFilteredGradeSheets,
      currentUser,
      isTeacher
    ]);


  const filteredHourCoverages =
    useMemo(() => {

      if (!isTeacher) {
        return departmentFilteredHourCoverages;
      }

      return departmentFilteredHourCoverages.filter(
        (item) =>
          belongsToTeacher(
            item as AnyRecord,
            currentUser
          )
      );

    }, [
      departmentFilteredHourCoverages,
      currentUser,
      isTeacher
    ]);


  const filteredProgramCoverages =
    useMemo(() => {

      if (!isTeacher) {
        return departmentFilteredProgramCoverages;
      }

      return departmentFilteredProgramCoverages.filter(
        (item) =>
          belongsToTeacher(
            item as AnyRecord,
            currentUser
          )
      );

    }, [
      departmentFilteredProgramCoverages,
      currentUser,
      isTeacher
    ]);


  /**
   * Un même relevé peut être présent plusieurs fois dans Firestore
   * avec des identifiants différents. Le Dashboard n'affiche donc
   * qu'une seule fiche par année/classe/matière/enseignant/trimestre.
   */
  const dashboardGradeSheets =
    useMemo(() => {

      const unique =
        new Map<string, ClassGradeSheet>();

      filteredGradeSheets.forEach(
        (sheet) => {

          const key =
            gradeSheetKey(sheet);

          const existing =
            unique.get(key);

          if (
            !existing ||
            isBetterGradeSheet(
              sheet,
              existing
            )
          ) {
            unique.set(
              key,
              sheet
            );
          }
        }
      );

      return Array.from(
        unique.values()
      );

    }, [
      filteredGradeSheets
    ]);


  /* ==========================================================================
   * STATISTIQUES À PARTIR DES RELEVÉS DE NOTES
   * ======================================================================== */

  const gradeSheetClassStats =
    useMemo(() => {

      const map =
        new Map<string, {
          className: string;
          students: AnyRecord[];
          teachers: Set<string>;
          subjects: Set<string>;
        }>();


      dashboardGradeSheets.forEach(
        (sheet) => {

          const sheetAny =
            sheet as AnyRecord;

          const className =
            sheetAny.className ||
            sheetAny.class ||
            sheetAny.classe ||
            '';

          if (!className) {
            return;
          }


          if (!map.has(className)) {

            map.set(
              className,
              {
                className,
                students: [],
                teachers: new Set<string>(),
                subjects: new Set<string>()
              }
            );

          }


          const entry =
            map.get(className)!;


          const students =
            Array.isArray(sheetAny.students)
              ? sheetAny.students
              : [];


          entry.students.push(
            ...students
          );


          const teacherName =
            sheetAny.teacherName ||
            '';

          if (teacherName) {
            entry.teachers.add(
              teacherName
            );
          }


          const subject =
            sheetAny.subject ||
            sheetAny.discipline ||
            '';

          if (subject) {
            entry.subjects.add(
              subject
            );
          }

        }
      );


      return Array.from(
        map.values()
      );

    }, [
      dashboardGradeSheets
    ]);


  /* ==========================================================================
   * CLASSES
   * ======================================================================== */

  const departmentClasses =
    useMemo(() => {

      const names =
        new Set<string>();


      filteredStats.forEach(
        (item) => {

          const className =
            (item as AnyRecord).className;

          if (className) {
            names.add(className);
          }

        }
      );


      gradeSheetClassStats.forEach(
        (item) => {

          if (item.className) {
            names.add(
              item.className
            );
          }

        }
      );


      if (isTeacher) {

        (
          currentUser.classes || []
        ).forEach(
          (className) => {

            if (className) {
              names.add(
                className
              );
            }

          }
        );

      }


      return Array.from(
        names
      ).sort(
        (a, b) =>
          a.localeCompare(
            b,
            'fr',
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
      );

    }, [
      filteredStats,
      gradeSheetClassStats,
      currentUser.classes,
      isTeacher
    ]);

  void departmentClasses;


  /* ==========================================================================
   * EFFECTIFS RECONSTRUITS
   * ======================================================================== */

  const reconstructedClassStats =
    useMemo(() => {

      const map =
        new Map<
          string,
          {
            className: string;
            boys: number;
            girls: number;
            totalStudents: number;
            studentsWithGrades: number;
            passed: number;
            averageSum: number;
          }
        >();


      filteredStats.forEach(
        (stat) => {

          const item =
            stat as AnyRecord;

          const className =
            item.className;

          if (!className) {
            return;
          }


          const current =
            map.get(className) || {
              className,
              boys: 0,
              girls: 0,
              totalStudents: 0,
              studentsWithGrades: 0,
              passed: 0,
              averageSum: 0
            };


          current.boys =
            Math.max(
              current.boys,
              Number(item.boys || 0)
            );

          current.girls =
            Math.max(
              current.girls,
              Number(item.girls || 0)
            );

          current.totalStudents =
            Math.max(
              current.totalStudents,
              Number(item.totalStudents || 0)
            );


          map.set(
            className,
            current
          );

        }
      );


      gradeSheetClassStats.forEach(
        (classData) => {

          const current =
            map.get(
              classData.className
            ) || {
              className:
                classData.className,
              boys: 0,
              girls: 0,
              totalStudents: 0,
              studentsWithGrades: 0,
              passed: 0,
              averageSum: 0
            };


          const uniqueStudents =
            new Map<
              string,
              AnyRecord
            >();


          classData.students.forEach(
            (student, index) => {

              const studentId =
                String(
                  student.id ||
                  student.studentId ||
                  `${student.name || ''}-${index}`
                );


              if (!uniqueStudents.has(studentId)) {
                uniqueStudents.set(
                  studentId,
                  student
                );
              }

            }
          );


          let boys = 0;
          let girls = 0;
          let graded = 0;
          let passed = 0;
          let averageSum = 0;


          uniqueStudents.forEach(
            (student) => {

              const gender =
                getStudentGender(
                  student
                );


              if (gender === 'M') {
                boys++;
              }

              if (gender === 'F') {
                girls++;
              }


              const average =
                getStudentAverage(
                  student
                );


              if (
                student.average !== undefined ||
                student.grade !== undefined ||
                student.moyenne !== undefined
              ) {

                graded++;

                averageSum +=
                  average;

                if (average >= 10) {
                  passed++;
                }

              }

            }
          );


          if (boys + girls > 0) {

            current.boys =
              Math.max(
                current.boys,
                boys
              );

            current.girls =
              Math.max(
                current.girls,
                girls
              );

            current.totalStudents =
              Math.max(
                current.totalStudents,
                boys + girls
              );

          }


          current.totalStudents =
            Math.max(
              current.totalStudents,
              uniqueStudents.size
            );


          current.studentsWithGrades +=
            graded;

          current.passed +=
            passed;

          current.averageSum +=
            averageSum;


          map.set(
            classData.className,
            current
          );

        }
      );


      return Array.from(
        map.values()
      ).sort(
        (a, b) =>
          a.className.localeCompare(
            b.className,
            'fr',
            {
              numeric: true
            }
          )
      );

    }, [
      filteredStats,
      gradeSheetClassStats
    ]);


  /* ==========================================================================
   * KPI PRINCIPAUX
   * ======================================================================== */

  const kpis =
    useMemo(() => {

      const totalClassesCount =
        reconstructedClassStats.length;


      const totalStudents =
        reconstructedClassStats.reduce(
          (total, item) =>
            total +
            Number(
              item.totalStudents || 0
            ),
          0
        );


      const totalBoys =
        reconstructedClassStats.reduce(
          (total, item) =>
            total +
            Number(
              item.boys || 0
            ),
          0
        );


      const totalGirls =
        reconstructedClassStats.reduce(
          (total, item) =>
            total +
            Number(
              item.girls || 0
            ),
          0
        );


      let totalGrades = 0;
      let passedGrades = 0;
      let gradesSum = 0;


      dashboardGradeSheets.forEach(
        (sheet) => {

          const students =
            Array.isArray(
              (sheet as AnyRecord).students
            )
              ? (sheet as AnyRecord).students
              : [];


          students.forEach(
            (student: AnyRecord) => {

              const average =
                getStudentAverage(
                  student
                );


              const hasGrade =
                student.average !== undefined ||
                student.grade !== undefined ||
                student.moyenne !== undefined;


              if (!hasGrade) {
                return;
              }


              totalGrades++;

              gradesSum +=
                average;


              if (average >= 10) {
                passedGrades++;
              }

            }
          );

        }
      );


      const departmentAverage =
        totalGrades > 0
          ? (
              gradesSum /
              totalGrades
            ).toFixed(2)
          : "N/A";


      const successRate =
        totalGrades > 0
          ? (
              (
                passedGrades /
                totalGrades
              ) *
              100
            ).toFixed(1)
          : "N/A";


      const validHourCoverages =
        filteredHourCoverages.filter(
          (item) => {

            const planned =
              getNumberField(
                item as AnyRecord,
                'plannedHoursTrimester',
                'trimesterPlanned'
              );

            const realized =
              getNumberField(
                item as AnyRecord,
                'realizedHoursTrimester',
                'trimesterRealized'
              );

            return planned > 0 ||
              realized > 0;

          }
        );


      const avgHourCoverage =
        validHourCoverages.length > 0
          ? (
              validHourCoverages.reduce(
                (total, item) => {

                  const planned =
                    getNumberField(
                item as AnyRecord,
                'plannedHoursTrimester',
                'trimesterPlanned'
              );

                  const realized =
                    getNumberField(
                item as AnyRecord,
                'realizedHoursTrimester',
                'trimesterRealized'
              );


                  if (planned <= 0) {
                    return total;
                  }


                  return (
                    total +
                    (
                      realized /
                      planned
                    ) *
                    100
                  );

                },
                0
              ) /
              validHourCoverages.length
            ).toFixed(1)
          : "N/A";


      let totalLessonsPlanned = 0;
      let totalLessonsDone = 0;


      filteredProgramCoverages.forEach(
        (coverage) => {

          const item =
            coverage as AnyRecord;

          const lessons =
            Array.isArray(
              item.lessons
            )
              ? item.lessons
              : [];

          const plannedFromFields =
            getNumberField(
              item,
              'plannedLessons',
              'lessonsPlanned'
            );

          const doneFromFields =
            getNumberField(
              item,
              'completedLessons',
              'lessonsDone',
              'realizedLessons'
            );

          const planned =
            lessons.length > 0
              ? lessons.length
              : plannedFromFields;

          let done =
            lessons.length > 0
              ? lessons.filter(
                  (lesson: AnyRecord) =>
                    lesson.status === 'DONE' ||
                    lesson.status === 'REALISE' ||
                    lesson.status === 'RÉALISÉ' ||
                    lesson.status === 'COMPLETED' ||
                    lesson.status === 'TERMINE'
                ).length
              : doneFromFields;

          const completionRate =
            getNumberField(
              item,
              'completionRate'
            );

          if (
            planned > 0 &&
            done <= 0 &&
            completionRate > 0
          ) {
            done =
              Math.round(
                planned *
                Math.min(
                  100,
                  completionRate
                ) /
                100
              );
          }

          totalLessonsPlanned +=
            planned;

          totalLessonsDone +=
            Math.min(
              done,
              planned > 0
                ? planned
                : done
            );

        }
      );


      const avgProgramCoverage =
        totalLessonsPlanned > 0
          ? (
              (
                totalLessonsDone /
                totalLessonsPlanned
              ) *
              100
            ).toFixed(1)
          : "N/A";


      return {
        totalClassesCount,
        totalStudents,
        totalBoys,
        totalGirls,

        departmentAverage,
        successRate,

        avgHourCoverage,

        totalLessonsPlanned,
        totalLessonsDone,

        avgProgramCoverage,

        totalGradesSheets:
          dashboardGradeSheets.length
      };

    }, [
      reconstructedClassStats,
      dashboardGradeSheets,
      filteredHourCoverages,
      filteredProgramCoverages
    ]);


  /* ==========================================================================
   * ENSEIGNANTS DU DÉPARTEMENT
   * ======================================================================== */

  const activeDepartmentTeachers =
    useMemo(() => {

      const teachers =
        departmentTeachers.filter(
          (teacher) => {

            const teacherAny =
              teacher as AnyRecord;

            const role =
              teacherAny.role;

            const status =
              teacherAny.status;

            const sameDept =
              belongsToDepartment(
                teacherAny,
                currentUser
              );

            const validRole =
              role === 'ENSEIGNANT' ||
              role === 'ANIMATEUR_PEDAGOGIQUE';


            const validStatus =
              !status ||
              status === 'ACTIF';


            return (
              sameDept &&
              validRole &&
              validStatus
            );

          }
        );


      return teachers;

    }, [
      departmentTeachers,
      currentUser
    ]);


  /* ==========================================================================
   * MESSAGERIE
   * ======================================================================== */

  const departmentFilteredMessages =
    useMemo(() => {

      if (!hasValidContext) {
        return [];
      }

      return departmentMessages.filter(
        (msg) =>
          belongsToDepartment(
            msg as AnyRecord,
            currentUser
          )
      );

    }, [
      departmentMessages,
      currentUser,
      hasValidContext
    ]);


  const [
    messages,
    setMessages
  ] =
    useState<DepartmentMessage[]>(
      []
    );


  const [
    newMsgContent,
    setNewMsgContent
  ] =
    useState('');


  const [
    newMsgCategory,
    setNewMsgCategory
  ] =
    useState<
      'CONSEIL' |
      'RAPPEL' |
      'NOTE' |
      'URGENT'
    >('NOTE');


  const [
    newMsgPinned,
    setNewMsgPinned
  ] =
    useState(false);


  const [
    activeFilter,
    setActiveFilter
  ] =
    useState<string>('all');


  const [
    searchQuery,
    setSearchQuery
  ] =
    useState('');


  const [
    isFormExpanded,
    setIsFormExpanded
  ] =
    useState(false);


  const [
    actionError,
    setActionError
  ] =
    useState<string | null>(
      null
    );


  const [
    actionSuccess,
    setActionSuccess
  ] =
    useState<string | null>(
      null
    );


  useEffect(() => {

    setMessages(
      departmentFilteredMessages
    );

  }, [
    departmentFilteredMessages
  ]);


  /* ==========================================================================
   * AJOUT MESSAGE
   * ======================================================================== */

  const handleSubmitMessage =
    useCallback(
      (
        e: React.FormEvent
      ) => {

        e.preventDefault();


        if (
          !newMsgContent.trim() ||
          !hasValidContext
        ) {
          return;
        }

        const establishmentId = currentUser.establishmentId;
        const departmentId = currentUser.departmentId;

        if (!establishmentId || !departmentId) {
          setActionError(
            'Impossible d’envoyer le message : établissement ou département non identifié.'
          );
          return;
        }


        try {

          setActionError(
            null
          );


          const now =
            new Date().toISOString();


          const newMessage:
            DepartmentMessage =
          {
            id:
              `msg-${Date.now()}`,

            establishmentId,

            departmentId,

            teacherId:
              currentUserId,

            authorId:
              currentUserId,

            authorName:
              currentUser.name ||
              profile.name,

            authorRole:
              currentUser.role,

            subject:
              (currentUser as AnyRecord)
                .subject ||
              profile.discipline,

            category:
              newMsgCategory,

            content:
              newMsgContent,

            createdAt:
              now,

            updatedAt:
              now,

            isPinned:
              newMsgPinned
          };


          setMessages(
            (prev) => {

              const nextMessages =
                [
                  newMessage,
                  ...prev
                ];


              if (
                onSaveDepartmentMessages
              ) {

                const otherDeptMessages =
                  departmentMessages.filter(
                    (message) =>
                      !belongsToDepartment(
                        message as AnyRecord,
                        currentUser
                      )
                  );


                onSaveDepartmentMessages(
                  [
                    ...otherDeptMessages,
                    ...nextMessages
                  ]
                );

              }


              return nextMessages;

            }
          );


          setNewMsgContent('');

          setNewMsgPinned(false);

          setNewMsgCategory(
            'NOTE'
          );

          setIsFormExpanded(
            false
          );

          setActionSuccess(
            "Note publiée avec succès !"
          );


          setTimeout(
            () =>
              setActionSuccess(null),
            3000
          );

        }
        catch (err) {

          console.error(
            err
          );

          setActionError(
            "Impossible de publier le message. Veuillez réessayer."
          );

        }

      },
      [
        newMsgContent,
        newMsgCategory,
        newMsgPinned,
        currentUser,
        currentUserId,
        profile,
        hasValidContext,
        departmentMessages,
        onSaveDepartmentMessages
      ]
    );


  /* ==========================================================================
   * ÉPINGLER MESSAGE
   * ======================================================================== */

  const handleTogglePin =
    useCallback(
      (
        id: string
      ) => {

        try {

          setActionError(
            null
          );


          setMessages(
            (prev) => {

              const nextMessages =
                prev.map(
                  (message) =>
                    message.id === id
                      ? {
                          ...message,
                          isPinned:
                            !message.isPinned,
                          updatedAt:
                            new Date()
                              .toISOString()
                        }
                      : message
                );


              if (
                onSaveDepartmentMessages
              ) {

                const otherDeptMessages =
                  departmentMessages.filter(
                    (message) =>
                      !belongsToDepartment(
                        message as AnyRecord,
                        currentUser
                      )
                  );


                onSaveDepartmentMessages(
                  [
                    ...otherDeptMessages,
                    ...nextMessages
                  ]
                );

              }


              return nextMessages;

            }
          );

        }
        catch (err) {

          console.error(
            err
          );

          setActionError(
            "Erreur lors de la modification de l'épinglage."
          );

        }

      },
      [
        departmentMessages,
        currentUser,
        onSaveDepartmentMessages
      ]
    );


  /* ==========================================================================
   * SUPPRESSION MESSAGE
   * ======================================================================== */

  const handleDeleteMessage =
    useCallback(
      (
        id: string
      ) => {

        try {

          setActionError(
            null
          );


          setMessages(
            (prev) => {

              const nextMessages =
                prev.filter(
                  (message) =>
                    message.id !== id
                );


              if (
                onSaveDepartmentMessages
              ) {

                const otherDeptMessages =
                  departmentMessages.filter(
                    (message) =>
                      !belongsToDepartment(
                        message as AnyRecord,
                        currentUser
                      )
                  );


                onSaveDepartmentMessages(
                  [
                    ...otherDeptMessages,
                    ...nextMessages
                  ]
                );

              }


              return nextMessages;

            }
          );


          setActionSuccess(
            "Message supprimé."
          );


          setTimeout(
            () =>
              setActionSuccess(null),
            3000
          );

        }
        catch (err) {

          console.error(
            err
          );

          setActionError(
            "Erreur lors de la suppression du message."
          );

        }

      },
      [
        departmentMessages,
        currentUser,
        onSaveDepartmentMessages
      ]
    );


  /* ==========================================================================
   * MATH
   * ======================================================================== */

  const renderContentWithMath =
    useCallback(
      (
        text: string
      ) => {

        const parts =
          text.split(
            /(?:\$([^$]+)\$)/g
          );


        return parts.map(
          (
            part,
            idx
          ) => {

            if (idx % 2 === 1) {
              const mathContent = part;

              const processed =
                mathContent.replace(
                  /\^([0-9a-zA-Z]+)/g,
                  '<sup>$1</sup>'
                );


              return (
                <span
                  key={idx}
                  className="font-mono inline-block bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded text-[11px] font-extrabold italic"
                  dangerouslySetInnerHTML={{
                    __html:
                      processed
                  }}
                />
              );

            }


            return part;

          }
        );

      },
      []
    );


  /* ==========================================================================
   * FILTRES MESSAGES
   * ======================================================================== */

  const filteredMessages =
    useMemo(() => {

      return messages.filter(
        (msg) => {

          if (
            activeFilter ===
            'pinned' &&
            !msg.isPinned
          ) {
            return false;
          }


          if (
            activeFilter !==
              'all' &&
            activeFilter !==
              'pinned' &&
            msg.category !==
              activeFilter
          ) {
            return false;
          }


          if (
            searchQuery.trim()
          ) {

            const q =
              normalizeSearchText(
                searchQuery
              );


            return (
              normalizeSearchText(
                msg.content
              ).includes(q) ||

              normalizeSearchText(
                msg.authorName
              ).includes(q) ||

              normalizeSearchText(
                msg.category
              ).includes(q)
            );

          }


          return true;

        }
      );

    }, [
      messages,
      activeFilter,
      searchQuery
    ]);


  const sortedMessages =
    useMemo(() => {

      return [
        ...filteredMessages
      ].sort(
        (a, b) => {

          if (
            a.isPinned &&
            !b.isPinned
          ) {
            return -1;
          }


          if (
            !a.isPinned &&
            b.isPinned
          ) {
            return 1;
          }


          const dateA = toDate(a.createdAt)?.getTime() || 0;
          const dateB = toDate(b.createdAt)?.getTime() || 0;

          return dateB - dateA;

        }
      );

    }, [
      filteredMessages
    ]);


  /* ==========================================================================
   * SÉCURITÉ
   * ======================================================================== */

  if (!hasValidContext) {

    return (
      <div
        className="p-8 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3"
        role="alert"
      >

        <AlertTriangle
          className="mx-auto text-amber-600"
          size={36}
        />

        <h2 className="text-lg font-bold text-amber-900">
          Contexte utilisateur incomplet
        </h2>

        <p className="text-xs text-amber-700 max-w-md mx-auto">
          Les identifiants d'établissement,
          de département ou d'utilisateur
          sont requis pour afficher
          le tableau de bord sécurisé.
          Veuillez actualiser votre session.
        </p>

      </div>
    );

  }


  /* ==========================================================================
   * AFFICHAGE
   * ======================================================================== */

  return (

    <div
      className="space-y-8 animate-fade-in"
      role="region"
      aria-label="Tableau de bord pédagogique"
    >

      {/* ====================================================================
       * ALERTES
       * ================================================================== */}

      {actionError && (
        <div
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold flex items-center gap-2 shadow-sm"
          role="alert"
        >

          <AlertTriangle
            size={16}
          />

          <span>
            {actionError}
          </span>

        </div>
      )}


      {actionSuccess && (
        <div
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 shadow-sm"
          role="status"
        >

          <CheckCircle2
            size={16}
          />

          <span>
            {actionSuccess}
          </span>

        </div>
      )}


      {/* ====================================================================
       * EN-TÊTE
       * ================================================================== */}

      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">

        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-4">

          <BookOpen
            size={240}
          />

        </div>


        <div className="relative z-10 space-y-2">

          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wider uppercase">

            {isTeacher
              ? `Enseignant • Département de ${profile.discipline}`
              : `Animateur • Département de ${profile.discipline}`
            }

            {' • '}

            {currentAcademicYear ||
              'Année scolaire non configurée'}

          </span>


          <h1 className="text-3xl font-extrabold tracking-tight">

            {isTeacher
              ? "Tableau de bord de l'Enseignant"
              : "Tableau de bord de l'Animateur Pédagogique"
            }

          </h1>


          <p className="text-teal-100 max-w-2xl text-sm leading-relaxed">

            {isTeacher ? (

              <>
                Bienvenue,{' '}
                <span className="font-bold">
                  {currentUser.name}
                </span>
                . Vos données pédagogiques
                sont isolées et sécurisées
                au sein de votre département.
              </>

            ) : (

              <>
                Bienvenue,{' '}
                <span className="font-bold">
                  {currentUser.name}
                </span>
                . Administration centralisée
                et synchronisée des données
                pédagogiques du département.
              </>

            )}

          </p>

        </div>

      </div>


      {/* ====================================================================
       * KPI
       * ================================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">


        {/* CLASSES */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">

          <div className="space-y-1">

            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">

              {isTeacher
                ? "Mes Classes"
                : "Classes du Département"
              }

            </span>


            <div className="text-3xl font-bold text-slate-900">

              {kpis.totalClassesCount}

            </div>


            <p className="text-xs text-slate-400">

              {gradeSheetClassStats.length > 0
                ? "Calculées depuis les relevés"
                : "Données pédagogiques"
              }

            </p>

          </div>


          <div className="h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">

            <BookOpen
              size={24}
            />

          </div>

        </div>


        {/* EFFECTIFS */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">

          <div className="space-y-1">

            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">

              Effectif total

            </span>


            <div className="text-3xl font-bold text-slate-900">

              {kpis.totalStudents}

            </div>


            <div className="flex items-center gap-2 text-xs text-slate-400">

              <span>
                {kpis.totalBoys} G
              </span>

              <span>•</span>

              <span>
                {kpis.totalGirls} F
              </span>

            </div>

          </div>


          <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">

            <Users
              size={24}
            />

          </div>

        </div>


        {/* HEURES */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">

          <div className="space-y-1">

            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">

              Couverture Horaire

            </span>


            <div className="text-3xl font-bold text-slate-900">

              {kpis.avgHourCoverage}
              {kpis.avgHourCoverage !== 'N/A'
                ? '%'
                : ''
              }

            </div>


            <p className="text-xs text-emerald-600 font-medium">

              Heures effectives

            </p>

          </div>


          <div className="h-12 w-12 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">

            <Clock
              size={24}
            />

          </div>

        </div>


        {/* PROGRAMMES */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">

          <div className="space-y-1">

            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">

              Couverture Programmes

            </span>


            <div className="text-3xl font-bold text-slate-900">

              {kpis.avgProgramCoverage}
              {kpis.avgProgramCoverage !== 'N/A'
                ? '%'
                : ''
              }

            </div>


            <p className="text-xs text-teal-600 font-medium">

              {kpis.totalLessonsPlanned > 0
                ? `${kpis.totalLessonsDone}/${kpis.totalLessonsPlanned} leçons`
                : "Aucune donnée"
              }

            </p>

          </div>


          <div className="h-12 w-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">

            <BookOpen
              size={24}
            />

          </div>

        </div>

      </div>


      {/* ====================================================================
       * ENSEIGNANTS DU DÉPARTEMENT
       * ================================================================== */}

      {!isTeacher && (
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">

          <div className="flex items-center justify-between mb-5">

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">

              <UserCheck
                className="text-emerald-600"
                size={20}
              />

              Enseignants du Département

            </h3>


            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">

              {activeDepartmentTeachers.length}
              {' '}
              enseignant(s)

            </span>

          </div>


          {activeDepartmentTeachers.length === 0 ? (

            <div className="text-sm text-slate-400 bg-slate-50 rounded-xl p-5 text-center">

              Aucun enseignant transmis au Dashboard.

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

              {activeDepartmentTeachers.map(
                (teacher) => {

                  const teacherAny =
                    teacher as AnyRecord;


                  return (

                    <div
                      key={
                        teacherAny.id ||
                        teacherAny.uid ||
                        teacherAny.name
                      }
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50"
                    >

                      <div className="h-9 w-9 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">

                        {(teacher.name || 'E')
                          .charAt(0)
                          .toUpperCase()}

                      </div>


                      <div className="min-w-0">

                        <div className="text-sm font-bold text-slate-800 truncate">

                          {teacher.name}

                        </div>


                        <div className="text-[10px] text-slate-400">

                          {teacher.subject ||
                            profile.discipline}

                        </div>

                      </div>

                    </div>

                  );

                }
              )}

            </div>

          )}

        </div>
      )}


      {/* ====================================================================
       * RELEVÉS + ALERTES
       * ================================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">


        {/* RELEVÉS */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-sm space-y-6">

          <div className="flex items-center justify-between">

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">

              <FileSpreadsheet
                className="text-emerald-600"
                size={20}
              />

              {isTeacher
                ? "Vos relevés de notes"
                : "Relevés de notes du département"
              }

            </h3>


            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold">

              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

              Synchronisé

            </span>

          </div>


          <div className="space-y-4">

            {dashboardGradeSheets.length === 0 ? (

              <div className="text-center py-12 text-slate-400 text-sm">

                Aucun relevé de notes disponible
                pour votre périmètre actuel.

              </div>

            ) : (

              dashboardGradeSheets.map(
                (sheet) => {

                  const students =
                    Array.isArray(
                      (sheet as AnyRecord).students
                    )
                      ? (sheet as AnyRecord).students
                      : [];


                  const validStudents =
                    students.filter(
                      (student: AnyRecord) =>
                        student.average !== undefined ||
                        student.grade !== undefined ||
                        student.moyenne !== undefined
                    );


                  const classAverage =
                    validStudents.length > 0
                      ? (
                          validStudents.reduce(
                            (
                              total: number,
                              student: AnyRecord
                            ) =>
                              total +
                              getStudentAverage(
                                student
                              ),
                            0
                          ) /
                          validStudents.length
                        ).toFixed(2)
                      : "N/A";


                  const classPassRate =
                    validStudents.length > 0
                      ? (
                          (
                            validStudents.filter(
                              (student: AnyRecord) =>
                                getStudentAverage(
                                  student
                                ) >= 10
                            ).length /
                            validStudents.length
                          ) *
                          100
                        ).toFixed(0)
                      : "N/A";


                  const sheetAny =
                    sheet as AnyRecord;


                  return (

                    <div
                      key={
                        sheet.id ||
                        `${sheetAny.className}-${sheetAny.subject}`
                      }
                      className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-4"
                    >

                      <div className="space-y-1">

                        <div className="flex items-center gap-2">

                          <span className="font-bold text-slate-800 text-sm">

                            {sheetAny.className ||
                              'Classe non définie'}

                          </span>


                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-semibold">

                            {sheetAny.subject ||
                              sheetAny.discipline ||
                              profile.discipline}

                          </span>

                        </div>


                        <p className="text-xs text-slate-500">

                          Enseignant :{' '}

                          <span className="font-semibold">

                            {sheetAny.teacherName ||
                              'Non renseigné'}

                          </span>

                        </p>


                        <p className="text-[10px] text-slate-400">

                          {currentAcademicYear ||
                            'Année non configurée'}

                          {' • '}

                          {students.length}
                          {' '}
                          élève(s)

                        </p>

                      </div>


                      <div className="flex gap-4">

                        <div className="text-center bg-white px-3 py-1.5 rounded border border-slate-100 min-w-[70px]">

                          <div className="text-xs text-slate-400">
                            Moyenne
                          </div>

                          <div className="text-sm font-bold text-slate-800">

                            {classAverage}
                            {classAverage !== 'N/A'
                              ? '/20'
                              : ''
                            }

                          </div>

                        </div>


                        <div className="text-center bg-white px-3 py-1.5 rounded border border-slate-100 min-w-[70px]">

                          <div className="text-xs text-slate-400">
                            Réussite
                          </div>

                          <div className="text-sm font-bold text-emerald-600">

                            {classPassRate}
                            {classPassRate !== 'N/A'
                              ? '%'
                              : ''
                            }

                          </div>

                        </div>

                      </div>

                    </div>

                  );

                }
              )

            )}

          </div>

        </div>


        {/* ALERTES */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm space-y-6">

          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">

            <Clock
              className="text-amber-500"
              size={20}
            />

            Alertes Pédagogiques

          </h3>


          <div className="space-y-4">

            {filteredHourCoverages.map(
              (hc) => {

                const item =
                  hc as AnyRecord;


                const planned =
                  getNumberField(
                    item,
                    'plannedHoursTrimester',
                    'trimesterPlanned'
                  );


                const realized =
                  getNumberField(
                    item,
                    'realizedHoursTrimester',
                    'trimesterRealized'
                  );


                if (
                  planned <= 0
                ) {
                  return null;
                }


                const rate =
                  (
                    realized /
                    planned
                  ) *
                  100;


                if (
                  rate >= 85
                ) {
                  return null;
                }


                return (

                  <div
                    key={
                      item.id ||
                      `${item.className}-${item.teacherId}`
                    }
                    className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex gap-3"
                  >

                    <AlertCircle
                      className="text-amber-600 flex-shrink-0 mt-0.5"
                      size={18}
                    />


                    <div className="space-y-1">

                      <div className="text-xs font-bold uppercase tracking-wider">

                        Couverture horaire insuffisante

                      </div>


                      <p className="text-xs font-semibold">

                        {item.className ||
                          'Classe non définie'}

                      </p>


                      <p className="text-[11px] text-amber-700">

                        Taux actuel de{' '}
                        {rate.toFixed(0)}
                        %
                        {' '}
                        (
                        {realized}/
                        {planned}
                        {' '}
                        heures).

                      </p>

                    </div>

                  </div>

                );

              }
            )}


            {filteredHourCoverages.filter(
              (hc) => {

                const item =
                  hc as AnyRecord;

                const planned =
                  getNumberField(
                    item,
                    'plannedHoursTrimester',
                    'trimesterPlanned'
                  );

                const realized =
                  getNumberField(
                    item,
                    'realizedHoursTrimester',
                    'trimesterRealized'
                  );

                if (planned <= 0) {
                  return false;
                }

                return (
                  (
                    realized /
                    planned
                  ) *
                  100
                ) < 85;

              }
            ).length === 0 && (

              <div className="text-xs text-slate-500 py-3 bg-slate-50 rounded-lg text-center border border-dashed border-slate-200">

                Aucune alerte horaire active
                pour votre périmètre.

              </div>

            )}


            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 space-y-2">

              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">

                {isTeacher
                  ? "Votre Performance"
                  : "Performance Globale du Département"
                }

              </div>


              <div className="grid grid-cols-2 gap-4 pt-2">

                <div>

                  <div className="text-[10px] text-emerald-600 font-semibold">
                    MOYENNE
                  </div>

                  <div className="text-lg font-extrabold text-emerald-900">

                    {kpis.departmentAverage}
                    {kpis.departmentAverage !== 'N/A'
                      ? '/20'
                      : ''
                    }

                  </div>

                </div>


                <div>

                  <div className="text-[10px] text-emerald-600 font-semibold">
                    TAUX RÉUSSITE
                  </div>

                  <div className="text-lg font-extrabold text-emerald-900">

                    {kpis.successRate}
                    {kpis.successRate !== 'N/A'
                      ? '%'
                      : ''
                    }

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>


      {/* ====================================================================
       * MESSAGERIE
       * ================================================================== */}

      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        id="messagerie-enseignants-container"
      >

        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">

          <div className="space-y-1">

            <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-extrabold rounded text-[9px] uppercase tracking-wider">

              Département de{' '}
              {profile.discipline}

            </span>


            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">

              <MessageSquare
                className="text-emerald-400"
                size={20}
              />

              Messagerie & Conseils du Département

            </h2>


            <p className="text-slate-300 text-xs">

              Échanges sécurisés et restreints
              au département courant.

            </p>

          </div>


          <button
            type="button"
            onClick={() =>
              setIsFormExpanded(
                !isFormExpanded
              )
            }
            className="self-start md:self-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >

            <Plus
              size={14}
            />

            <span>
              Nouveau message
            </span>

          </button>

        </div>


        <div className="p-6 space-y-6">


          {/* FORMULAIRE */}
          {isFormExpanded && (

            <form
              onSubmit={
                handleSubmitMessage
              }
              className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4"
            >

              <div className="flex items-center justify-between border-b border-slate-200 pb-3">

                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">

                  <Sparkles
                    size={14}
                    className="text-emerald-600"
                  />

                  Rédiger une note départementale

                </span>


                <span className="text-[10px] text-slate-400 font-mono">

                  Auteur :{' '}
                  {currentUser.name}

                </span>

              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-1">

                  <label className="block text-[11px] font-bold text-slate-500 uppercase">

                    Catégorie

                  </label>


                  <select
                    value={
                      newMsgCategory
                    }
                    onChange={(e) =>
                      setNewMsgCategory(
                        e.target.value as any
                      )
                    }
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >

                    <option value="NOTE">
                      📝 Note Pédagogique
                    </option>

                    <option value="CONSEIL">
                      📅 Conseil d'Enseignement
                    </option>

                    <option value="RAPPEL">
                      🔔 Rappel général
                    </option>

                    <option value="URGENT">
                      🔥 Urgent / Alerte
                    </option>

                  </select>

                </div>


                <div className="flex items-end justify-between p-2.5 bg-white border border-slate-200 rounded-xl">

                  <div>

                    <span className="block text-[11px] font-bold text-slate-600 uppercase">

                      Épingler le message

                    </span>

                    <span className="text-[10px] text-slate-400">

                      Garder en tête de liste

                    </span>

                  </div>


                  <input
                    type="checkbox"
                    checked={
                      newMsgPinned
                    }
                    onChange={(e) =>
                      setNewMsgPinned(
                        e.target.checked
                      )
                    }
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600 cursor-pointer"
                  />

                </div>

              </div>


              <div className="space-y-1">

                <label className="block text-[11px] font-bold text-slate-500 uppercase">

                  Contenu du message

                </label>


                <textarea
                  value={
                    newMsgContent
                  }
                  onChange={(e) =>
                    setNewMsgContent(
                      e.target.value
                    )
                  }
                  placeholder="Écrivez votre message..."
                  rows={4}
                  required
                  className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl p-3 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

              </div>


              <div className="flex items-center justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setIsFormExpanded(
                      false
                    )
                  }
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >

                  Annuler

                </button>


                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >

                  <Send
                    size={13}
                  />

                  Envoyer

                </button>

              </div>

            </form>

          )}


          {/* FILTRES */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-100 pb-4">

            <div className="flex flex-wrap gap-1.5 self-start">

              <button
                type="button"
                onClick={() =>
                  setActiveFilter(
                    'all'
                  )
                }
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  activeFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-600'
                }`}
              >

                Tous (
                {messages.length}
                )

              </button>


              <button
                type="button"
                onClick={() =>
                  setActiveFilter(
                    'pinned'
                  )
                }
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  activeFilter === 'pinned'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-50 text-slate-600'
                }`}
              >

                📌 Épinglés (
                {
                  messages.filter(
                    m => m.isPinned
                  ).length
                }
                )

              </button>

            </div>


            <div className="relative w-full md:w-64">

              <Search
                className="absolute left-3 top-2.5 text-slate-400"
                size={14}
              />


              <input
                type="text"
                placeholder="Rechercher..."
                value={
                  searchQuery
                }
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

            </div>

          </div>


          {/* LISTE MESSAGES */}
          {sortedMessages.length === 0 ? (

            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">

              <p className="text-slate-400 text-xs font-semibold">

                Aucun message trouvé dans ce département.

              </p>

            </div>

          ) : (

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {sortedMessages.map(
                (msg) => {

                  const isAuthor =
                    msg.authorId ===
                      currentUserId ||
                    msg.teacherId ===
                      currentUserId;


                  const isAP =
                    currentUser.role ===
                    'ANIMATEUR_PEDAGOGIQUE';


                  const canDelete =
                    isAuthor ||
                    isAP;


                  return (

                    <div
                      key={msg.id}
                      className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition-all hover:shadow-md relative ${
                        msg.isPinned
                          ? 'border-amber-300 bg-amber-50/15'
                          : 'border-slate-200 bg-white'
                      }`}
                    >

                      {msg.isPinned && (

                        <span className="absolute top-4 right-4 text-amber-500">

                          <Pin
                            size={16}
                            className="fill-amber-500 rotate-45"
                          />

                        </span>

                      )}


                      <div className="space-y-3">

                        <div className="flex items-center gap-3">

                          <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">

                            {msg.authorName
                              ? msg.authorName
                                  .charAt(0)
                                  .toUpperCase()
                              : 'A'}

                          </div>


                          <div>

                            <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">

                              {msg.authorName}


                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-600">

                                {msg.authorRole ===
                                'ANIMATEUR_PEDAGOGIQUE'
                                  ? 'AP'
                                  : 'Prof'}

                              </span>

                            </div>


                            <div className="text-[10px] text-slate-400 space-y-0.5">
                              <div>
                                Créé le : {toDate(msg.createdAt)?.toLocaleDateString('fr-FR') ?? 'Date inconnue'} à {toDate(msg.createdAt)?.toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) ?? ''}
                              </div>
                              {msg.updatedAt && msg.updatedAt !== msg.createdAt && (
                                <div className="italic opacity-80">
                                  Modifié le : {toDate(msg.updatedAt)?.toLocaleDateString('fr-FR') ?? ''} à {toDate(msg.updatedAt)?.toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) ?? ''}
                                </div>
                              )}
                            </div>

                          </div>

                        </div>


                        <div className="text-xs text-slate-700 leading-relaxed font-semibold whitespace-pre-wrap">

                          {renderContentWithMath(
                            msg.content
                          )}

                        </div>

                      </div>


                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[10px]">

                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider bg-slate-100 text-slate-700">

                          {msg.category}

                        </span>


                        <div className="flex items-center gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              handleTogglePin(
                                msg.id
                              )
                            }
                            className={`p-1.5 rounded-lg ${
                              msg.isPinned
                                ? 'text-amber-600 bg-amber-50'
                                : 'text-slate-400'
                            }`}
                          >

                            <Pin
                              size={13}
                              className={
                                msg.isPinned
                                  ? 'fill-amber-600'
                                  : ''
                              }
                            />

                          </button>


                          {canDelete && (

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteMessage(
                                  msg.id
                                )
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                            >

                              <Trash2
                                size={13}
                              />

                            </button>

                          )}

                        </div>

                      </div>

                    </div>

                  );

                }
              )}

            </div>

          )}

        </div>

      </div>

    </div>

  );

}