/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

import { Search, X, Building2 } from "lucide-react";

import type {
  StudentGrade,
  Trimester,
  EstablishmentSettings,
  EvaluationCoefficients,
  ArchiveReleve,
  ClassGradeSheet,
} from "../types";

import {
  calculateEnrollmentAndPerformanceStats,
  calculateClassAveragesBySeq,
  calculateClassGeneralAverage,
  calculateStudentOverallAverage,
} from "../utils/gradeCalculations";

import { exportGradeSheetToPDF } from "../utils/pdfExport";
import { exportGradeSheetToCSV } from "../utils/csvExport";
import { importGradeSheetFromCSV } from "../utils/csvImport";
import { db } from "../firebaseConfig";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import { createWorker } from "tesseract.js";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

import {
  getGradeSheet,
  saveGradeSheet,
} from "../services/gradeSheetService";

import {
  subscribeToArchives,
  restoreArchive,
  deleteArchive,
  saveArchive,
} from "../services/archiveService";

import HeaderPreview from "./HeaderPreview";
import GradeSheetTable from "./GradeSheetTable";
import StatisticsPanel from "./StatisticsPanel";
import ArchiveModal from "./ArchiveModal";

/* ============================================================
 * IDENTIFIANT UNIQUE DU RELEVÉ
 * ============================================================ */

const buildGradeSheetId = (
  establishmentId: string,
  departmentId: string,
  academicYear: string,
  teacherId: string,
  className: string,
  subject: string,
  trimester: Trimester
): string => {
  const clean = (value: unknown) =>
    encodeURIComponent(
      String(value ?? "")
        .trim()
        .toLowerCase()
    );

  return [
    "grades",
    clean(establishmentId),
    clean(departmentId),
    clean(academicYear),
    clean(teacherId),
    clean(className),
    clean(subject),
    clean(trimester),
  ].join("__");
};

/* ============================================================
 * PROPS
 * ============================================================ */

interface GradeEntryViewProps {
  teacherId?: string;
  teacherName?: string;

  isAnimator?: boolean;

  establishmentSettings?: EstablishmentSettings & {
    departmentId?: string;
    academicYear?: string;
    discipline?: string;
  };

  establishmentId?: string;

  departmentId?: string;

  establishment?: EstablishmentSettings & {
    academicYear?: string;
    id?: string;
  };

  currentUser?: {
    academicYear?: string;
  };

  classes?: string[];

  /*
   * Classes que l'utilisateur connecté a réellement le droit de modifier.
   * Pour un enseignant : ses classes.
   * Pour un AP : uniquement ses propres classes, même si availableClasses
   * contient aussi les classes des autres enseignants du département.
   */
  editableClasses?: string[];
}

/* ============================================================
 * COMPOSANT PRINCIPAL
 * ============================================================ */

export default function GradeEntryView({
  teacherId = "",
  teacherName = "",
  isAnimator = false,
  establishmentSettings,
  establishmentId: profileEstablishmentId = "",
  departmentId: profileDepartmentId = "",
  establishment,
  currentUser,
  classes = [],
  editableClasses = [],
}: GradeEntryViewProps) {

  /* ==========================================================
   * ÉTATS
   * ========================================================== */

  const [students, setStudents] =
    useState<StudentGrade[]>([]);

  const availableClasses = useMemo(() => {
    const getClassOrderIndex = (className: string) => {
      const normalized = className
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
        .toLowerCase()
        .replace(/[.']/g, "")
        .replace(/\\s+/g, " ")
        .trim();

      if (/^(6e|6eme|6e annee|sixieme)/.test(normalized)) return 0;
      if (/^(5e|5eme|5e annee|cinquieme)/.test(normalized)) return 1;
      if (/^(4e|4eme|4e annee|quatrieme)/.test(normalized)) return 2;
      if (/^(3e|3eme|3e annee|troisieme)/.test(normalized)) return 3;
      if (/^(2nde|2nd|2de|2e|seconde)/.test(normalized)) return 4;
      if (/^(1ere|1re|1e|premiere)/.test(normalized)) return 5;
      if (/^(tle|t le|terminale|terminal)/.test(normalized)) return 6;

      return 7;
    };

    return Array.from(
      new Set(
        classes
          .map((className) => String(className ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => {
      const orderA = getClassOrderIndex(a);
      const orderB = getClassOrderIndex(b);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.localeCompare(b, "fr", { sensitivity: "base" });
    });
  }, [classes]);

  const editableClassSet = useMemo(
    () =>
      new Set(
        editableClasses
          .map((className) => String(className ?? "").trim().toLowerCase())
          .filter(Boolean)
      ),
    [editableClasses]
  );

  const [selectedClass, setSelectedClass] =
    useState<string>("");

  const canEditSelectedClass = useMemo(() => {
    const normalizedSelectedClass = selectedClass.trim().toLowerCase();

    /*
     * Un enseignant et un AP sont limités aux classes déclarées dans
     * leur propre profil. L'AP peut donc consulter une classe reçue
     * d'un autre enseignant, mais ne peut pas la modifier.
     */
    return Boolean(
      normalizedSelectedClass &&
      editableClassSet.has(normalizedSelectedClass)
    );
  }, [editableClassSet, selectedClass]);

  const [selectedSubject, setSelectedSubject] =
    useState<string>(
      String(establishmentSettings?.discipline ?? "").trim()
    );

  const [selectedTrimester, setSelectedTrimester] =
    useState<Trimester>(1);

  // Fonctionnalités historiques conservées : recherche et personnalisation.
  const [gradeSearchText, setGradeSearchText] = useState("");
  const [isEditingEstablishment, setIsEditingEstablishment] = useState(false);
  const [editableEstablishmentSettings, setEditableEstablishmentSettings] =
    useState<(EstablishmentSettings & { departmentId?: string; academicYear?: string; discipline?: string }) | undefined>(establishmentSettings);

  useEffect(() => {
    setEditableEstablishmentSettings(establishmentSettings);
  }, [establishmentSettings]);

  const currentTeacherName = teacherName;

  const [currentAcademicYear, setCurrentAcademicYear] =
    useState<string>(
      establishmentSettings?.academicYear ||
      establishment?.academicYear ||
      ""
    );

  /*
   * La liste des classes provient directement du profil de l'enseignant.
   * Aucune création de classe n'est effectuée ici.
   */
  useEffect(() => {
    if (availableClasses.length === 0) {
      if (selectedClass) setSelectedClass("");
      return;
    }

    if (!selectedClass || !availableClasses.includes(selectedClass)) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  /*
   * La discipline du relevé reprend automatiquement celle du profil /
   * des paramètres de l'établissement.
   */
  useEffect(() => {
    const discipline = String(
      establishmentSettings?.discipline ?? ""
    ).trim();

    if (discipline && selectedSubject !== discipline) {
      setSelectedSubject(discipline);
    }
  }, [establishmentSettings?.discipline, selectedSubject]);

  /*
   * Coefficients des évaluations.
   */

  const [evalCoefficients, setEvalCoefficients] =
    useState<EvaluationCoefficients>({
      1: 1,
      2: 1,
      3: 1,
      4: 1,
      5: 1,
      6: 1,
      7: 1,
      8: 1,
      9: 1,
    });

  const [typedGrades, setTypedGrades] =
    useState<Record<string, string>>({});

  const [archives, setArchives] =
    useState<ArchiveReleve[]>([]);

  const [classGradeSheets, setClassGradeSheets] =
    useState<ClassGradeSheet[]>([]);

  const [activeSheetId, setActiveSheetId] =
    useState<string | null>(null);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isArchiveModalOpen, setIsArchiveModalOpen] =
    useState<boolean>(false);

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] =
    useState<boolean>(false);

  const [isAddMenuOpen, setIsAddMenuOpen] =
    useState<boolean>(false);

  const [newStudentName, setNewStudentName] =
    useState<string>("");

  const [newStudentGender, setNewStudentGender] =
    useState<"M" | "F">("M");

  /*
   * Empêche de relancer plusieurs fois la création automatique
   * des relevés pour la même configuration.
   */
  const automaticSheetsKeyRef = useRef<string>("");
  const skipNextSheetLoadRef = useRef(false);


  /* ==========================================================
   * ANNÉE SCOLAIRE PAR DÉFAUT
   * ========================================================== */

  useEffect(() => {
    const defaultYear =
      establishmentSettings?.academicYear ||
      establishment?.academicYear ||
      "";

    if (
      defaultYear &&
      !currentAcademicYear
    ) {
      setCurrentAcademicYear(defaultYear);
    }
  }, [
    establishmentSettings?.academicYear,
    establishment?.academicYear,
    currentAcademicYear,
  ]);


  /* ==========================================================
   * CRÉATION AUTOMATIQUE DES RELEVÉS
   * ========================================================== */

  useEffect(() => {
    if (
      isAnimator ||
      !teacherId ||
      !selectedSubject ||
      availableClasses.length === 0
    ) {
      return;
    }

    const effectiveEstablishmentId =
      profileEstablishmentId ||
      establishmentSettings?.id ||
      establishment?.id ||
      "";

    const effectiveDepartmentId =
      profileDepartmentId ||
      establishmentSettings?.departmentId ||
      "";

    const academicYear =
      currentAcademicYear ||
      establishmentSettings?.academicYear ||
      establishment?.academicYear ||
      currentUser?.academicYear ||
      "";

    if (
      !effectiveEstablishmentId ||
      !effectiveDepartmentId ||
      !academicYear
    ) {
      return;
    }

    const initializationKey = [
      effectiveEstablishmentId,
      effectiveDepartmentId,
      academicYear,
      teacherId,
      selectedSubject,
      availableClasses.join("|"),
    ].join("::");

    if (automaticSheetsKeyRef.current === initializationKey) {
      return;
    }

    automaticSheetsKeyRef.current = initializationKey;

    const createMissingSheets = async () => {
      try {
        const defaultCoefficients: EvaluationCoefficients = {
          1: 1,
          2: 1,
          3: 1,
          4: 1,
          5: 1,
          6: 1,
          7: 1,
          8: 1,
          9: 1,
        };

        const trimesters: Trimester[] = [1, 2, 3];

        await Promise.all(
          availableClasses.flatMap((className) =>
            trimesters.map(async (trimester) => {
              const sheetId = buildGradeSheetId(
                effectiveEstablishmentId,
                effectiveDepartmentId,
                academicYear,
                teacherId,
                className,
                selectedSubject,
                trimester
              );

              const existing = await getGradeSheet(sheetId);

              if (existing) {
                return;
              }

              await saveGradeSheet(sheetId, {
                establishmentId: effectiveEstablishmentId,
                departmentId: effectiveDepartmentId,
                teacherId,
                teacherName: currentTeacherName || teacherName,
                discipline: selectedSubject,
                className,
                subject: selectedSubject,
                trimester,
                academicYear,
                students: [],
                coefficients: defaultCoefficients,
                settings: establishmentSettings,
              });
            })
          )
        );
      } catch (error) {
        console.error(
          "Erreur lors de la création automatique des relevés :",
          error
        );
      }
    };

    void createMissingSheets();
  }, [
    isAnimator,
    teacherId,
    teacherName,
    currentTeacherName,
    selectedSubject,
    availableClasses,
    currentAcademicYear,
    currentUser?.academicYear,
    profileEstablishmentId,
    profileDepartmentId,
    establishmentSettings,
    establishmentSettings?.id,
    establishmentSettings?.departmentId,
    establishmentSettings?.academicYear,
    establishment?.id,
    establishment?.academicYear,
  ]);

  /* ==========================================================
   * CHARGEMENT DU RELEVÉ
   * ========================================================== */

  useEffect(() => {
    if (skipNextSheetLoadRef.current) {
      skipNextSheetLoadRef.current = false;
      return;
    }

    if (
      !teacherId ||
      !selectedClass ||
      !selectedSubject
    ) {
      return;
    }

    const effectiveEstablishmentId =
      profileEstablishmentId ||
      establishmentSettings?.id ||
      establishment?.id ||
      "";

    const effectiveDepartmentId =
      profileDepartmentId ||
      establishmentSettings?.departmentId ||
      "";

    const academicYear =
      currentAcademicYear ||
      establishmentSettings?.academicYear ||
      establishment?.academicYear ||
      "";

    if (
      !effectiveEstablishmentId ||
      !effectiveDepartmentId ||
      !academicYear
    ) {
      return;
    }

    const sheetId =
      buildGradeSheetId(
        effectiveEstablishmentId,
        effectiveDepartmentId,
        academicYear,
        teacherId,
        selectedClass,
        selectedSubject,
        selectedTrimester
      );

    const legacySheetId =
      `${teacherId}_${selectedClass}_${selectedSubject}_${selectedTrimester}`;

    const loadSheet = async () => {
      try {
        let data = await getGradeSheet(sheetId);
        let loadedSheetId = sheetId;

        if (!data) {
          data = await getGradeSheet(legacySheetId);
          loadedSheetId = legacySheetId;
        }

        if (data) {
          setActiveSheetId(data.id || loadedSheetId);

          const coefficients =
            data.coefficients || {
              1: 1,
              2: 1,
              3: 1,
              4: 1,
              5: 1,
              6: 1,
              7: 1,
              8: 1,
              9: 1,
            };

          setEvalCoefficients(coefficients);

          const loadedStudents =
            Array.isArray(data.students)
              ? sortStudentsAlphabetically(data.students)
              : [];

          setTypedGrades({});
          setStudents(
            recalculateStudentsGrades(
              loadedStudents,
              {},
              coefficients
            )
          );
        } else {
          // Un nouveau relevé reste vide jusqu'à la saisie des élèves.
          setActiveSheetId(sheetId);
          setStudents([]);
          setTypedGrades({});
        }
      } catch (error) {
        console.error("Erreur chargement feuille de notes :", error);
      }
    };

    void loadSheet();

  }, [
    teacherId,
    selectedClass,
    selectedSubject,
    selectedTrimester,
    currentAcademicYear,
    profileEstablishmentId,
    profileDepartmentId,
    establishmentSettings?.id,
    establishmentSettings?.departmentId,
    establishmentSettings?.academicYear,
    establishment?.id,
    establishment?.academicYear,
  ]);


  /* ==========================================================
   * SYNCHRONISATION DES ARCHIVES
   * - Enseignant : ses archives via le service existant.
   * - AP : archives de sa discipline dans l'établissement, filtrées
   *        par département lorsque departmentId existe.
   * ========================================================== */

  useEffect(() => {
    const effectiveEstablishmentId =
      profileEstablishmentId ||
      establishmentSettings?.id ||
      establishment?.id ||
      "";

    const effectiveDepartmentId =
      profileDepartmentId ||
      establishmentSettings?.departmentId ||
      "";

    if (!effectiveEstablishmentId) return;

    if (!isAnimator) {
      if (!effectiveDepartmentId) return;

      const unsubscribe = subscribeToArchives(
        effectiveEstablishmentId,
        effectiveDepartmentId,
        (data: ArchiveReleve[]) => {
          setArchives(data);
          setClassGradeSheets(data as unknown as ClassGradeSheet[]);
        },
        (error: Error) => {
          console.error("Erreur synchronisation archives :", error);
        }
      );

      return () => unsubscribe();
    }

    const disciplineForArchives = String(
      establishmentSettings?.discipline ?? selectedSubject ?? ""
    ).trim();

    if (!disciplineForArchives) return;

    const archiveQuery = query(
      collection(db, "archiveReleves"),
      where("establishmentId", "==", effectiveEstablishmentId),
      where("discipline", "==", disciplineForArchives)
    );

    const unsubscribe = onSnapshot(
      archiveQuery,
      (snapshot) => {
        const data = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ArchiveReleve, "id">),
          }))
          .filter((archive) => {
            const archiveTeacherId = String(
              (archive as ArchiveReleve & { teacherId?: string }).teacherId ?? ""
            ).trim();
            const currentTeacherId = String(teacherId ?? "").trim();
            const archiveDepartmentId = String(
              (archive as ArchiveReleve & { departmentId?: string }).departmentId ?? ""
            ).trim();

            // Dans « Archive relevé », l'AP ne consulte que ses propres archives.
            // Les relevés des autres enseignants restent disponibles uniquement
            // dans le tableau de bord départemental, sans être mélangés ici.
            if (!currentTeacherId || !archiveTeacherId) return false;
            if (archiveTeacherId !== currentTeacherId) return false;

            return (
              !archiveDepartmentId ||
              !effectiveDepartmentId ||
              archiveDepartmentId === effectiveDepartmentId
            );
          })
          .sort((a, b) =>
            String(
              (b as ArchiveReleve & { archivedAt?: string }).archivedAt ??
              (b as ArchiveReleve & { createdAt?: unknown }).createdAt ??
              ""
            ).localeCompare(
              String(
                (a as ArchiveReleve & { archivedAt?: string }).archivedAt ??
                (a as ArchiveReleve & { createdAt?: unknown }).createdAt ??
                ""
              )
            )
          ) as ArchiveReleve[];

        setArchives(data);
        setClassGradeSheets(data as unknown as ClassGradeSheet[]);
      },
      (error) => {
        console.error("Erreur synchronisation archives AP :", error);
      }
    );

    return () => unsubscribe();
  }, [
    isAnimator,
    teacherId,
    profileEstablishmentId,
    profileDepartmentId,
    establishmentSettings?.id,
    establishmentSettings?.departmentId,
    establishmentSettings?.discipline,
    establishment?.id,
    selectedSubject,
  ]);

  /* ==========================================================
   * TRI ALPHABÉTIQUE
   * ========================================================== */

  const sortStudentsAlphabetically =
    useCallback(
      (list: StudentGrade[]) =>
        [...list].sort(
          (a, b) =>
            a.name.localeCompare(
              b.name,
              "fr",
              { sensitivity: "base" }
            )
        ),
      []
    );


  /* ==========================================================
   * RECALCUL CENTRALISÉ DES NOTES
   * ========================================================== */

  const recalculateStudentsGrades =
    useCallback(
      (
        currentStudents: StudentGrade[],
        currentTypedGrades: Record<string, string>,
        coefficients: EvaluationCoefficients
      ): StudentGrade[] => {

        const updated =
          currentStudents.map(
            (student) => {
              const newEvaluations = {
                ...(student.evaluations || {}),
              };

              for (let seq = 1; seq <= 9; seq++) {
                const key = `${student.id}-${seq}`;

                if (currentTypedGrades[key] === undefined) {
                  continue;
                }

                const rawValue = currentTypedGrades[key];

                if (rawValue.trim() === "") {
                  delete newEvaluations[seq];
                  continue;
                }

                const numericValue =
                  Number(rawValue.replace(",", ".").trim());

                if (Number.isNaN(numericValue)) {
                  continue;
                }

                newEvaluations[seq] = {
                  ...(newEvaluations[seq] || {}),
                  score: numericValue,
                  coefficient: coefficients[seq] ?? 1,
                };
              }

              const recalculatedStudent: StudentGrade = {
                ...student,
                evaluations: newEvaluations,
              };

              const generalAverage =
                calculateStudentOverallAverage(
                  recalculatedStudent,
                  coefficients
                );

              const hasEvaluation =
                Object.keys(newEvaluations).some(
                  (key) => {
                    const seq = Number(key);
                    const evaluation = newEvaluations[seq];
                    return (
                      evaluation &&
                      typeof evaluation.score === "number" &&
                      !Number.isNaN(evaluation.score)
                    );
                  }
                );

              return {
                ...recalculatedStudent,
                average: hasEvaluation ? generalAverage : undefined,
              };
            }
          );

        const evaluatedStudents =
          updated
            .filter(
              (student) =>
                typeof student.average === "number" &&
                !Number.isNaN(student.average)
            )
            .sort(
              (a, b) => (b.average ?? 0) - (a.average ?? 0)
            );

        let rank = 1;
        evaluatedStudents.forEach(
          (student, index) => {
            if (
              index > 0 &&
              student.average !== evaluatedStudents[index - 1].average
            ) {
              rank = index + 1;
            }
            student.rank = rank;
          }
        );

        updated.forEach(
          (student) => {
            if (
              student.average === undefined ||
              Number.isNaN(student.average)
            ) {
              student.rank = undefined;
            }
          }
        );

        return updated;
      },
      []
    );


  /* ==========================================================
   * SAISIE D'UNE NOTE
   * ========================================================== */

  const handleGradeChange =
    useCallback(
      (
        studentId: string,
        seq: number,
        value: string
      ) => {
        if (!canEditSelectedClass) {
          return;
        }

        setTypedGrades(
          (previous) => {
            const next = {
              ...previous,
              [`${studentId}-${seq}`]: value,
            };

            setStudents(
              (currentStudents) =>
                recalculateStudentsGrades(
                  currentStudents,
                  next,
                  evalCoefficients
                )
            );

            return next;
          }
        );
      },
      [evalCoefficients, recalculateStudentsGrades]
    );


  const handleGradeBlur = useCallback(() => {}, []);


  /* ==========================================================
   * SUPPRESSION D'UN ÉLÈVE
   * ========================================================== */

  const handleDeleteStudent =
    useCallback(
      (studentId: string) => {
        if (!canEditSelectedClass) {
          return;
        }

        setStudents(
          (previous) =>
            recalculateStudentsGrades(
              previous.filter((student) => student.id !== studentId),
              typedGrades,
              evalCoefficients
            )
        );

        setTypedGrades(
          (previous) => {
            const next = { ...previous };
            const prefix = `${studentId}-`;
            Object.keys(next).forEach((key) => {
              if (key.startsWith(prefix)) {
                delete next[key];
              }
            });
            return next;
          }
        );
      },
      [typedGrades, evalCoefficients, recalculateStudentsGrades, canEditSelectedClass]
    );


  /* ==========================================================
   * AJOUT MANUEL D'UN ÉLÈVE
   * ========================================================== */

  const handleAddStudentSubmit =
    useCallback(
      (event: React.FormEvent) => {
        event.preventDefault();

        if (!canEditSelectedClass) {
          alert(
            "Consultation uniquement : vous ne pouvez pas ajouter un élève dans la classe d'un autre enseignant."
          );
          return;
        }

        if (!selectedClass || !selectedSubject || !selectedTrimester) {
          alert(
            "Veuillez d'abord sélectionner la classe, le trimestre et configurer les coefficients."
          );
          return;
        }

        if (!newStudentName.trim()) {
          return;
        }

        const newStudent: StudentGrade = {
          id: `stud_${Date.now()}`,
          name: newStudentName.trim(),
          gender: newStudentGender,
          evaluations: {},
          average: undefined,
          rank: undefined,
          appreciation: "",
        };

        setStudents(
          (previous) =>
            sortStudentsAlphabetically(
              recalculateStudentsGrades(
                [...previous, newStudent],
                typedGrades,
                evalCoefficients
              )
            )
        );

        setNewStudentName("");
        setNewStudentGender("M");
        setIsAddStudentModalOpen(false);
      },
      [
        newStudentName,
        newStudentGender,
        selectedClass,
        selectedSubject,
        selectedTrimester,
        typedGrades,
        evalCoefficients,
        recalculateStudentsGrades,
        sortStudentsAlphabetically,
        canEditSelectedClass,
      ]
    );


  /* ==========================================================
   * AFFICHAGE D'UNE NOTE
   * ========================================================== */

  const getStudentScoreString =
    useCallback(
      (student: StudentGrade, seq: number): string => {
        const key = `${student.id}-${seq}`;

        if (typedGrades[key] !== undefined) {
          return typedGrades[key].trim() === "" ? "-" : typedGrades[key];
        }

        const score = student.evaluations?.[seq]?.score;

        if (
          score === undefined ||
          score === null ||
          Number.isNaN(Number(score))
        ) {
          return "-";
        }

        return String(score);
      },
      [typedGrades]
    );


  /* ==========================================================
   * CONFIGURATION DES COEFFICIENTS
   * ========================================================== */

  const handleCoefficientChange = useCallback(
    (seq: number, value: string) => {
      if (!canEditSelectedClass) {
        return;
      }

      const numericValue = Number(value);

      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return;
      }

      setEvalCoefficients((previous) => ({
        ...previous,
        [seq]: numericValue,
      }));

      setStudents((currentStudents) =>
        recalculateStudentsGrades(
          currentStudents,
          typedGrades,
          {
            ...evalCoefficients,
            [seq]: numericValue,
          }
        )
      );
    },
    [evalCoefficients, typedGrades, recalculateStudentsGrades, canEditSelectedClass]
  );

  /* ==========================================================
   * STATISTIQUES ET MOYENNES
   * ========================================================== */

  const stats =
    useMemo(
      () =>
        calculateEnrollmentAndPerformanceStats(
          students,
          evalCoefficients
        ),
      [students, evalCoefficients]
    );

  const classAverageBySeq =
    useMemo(
      () => calculateClassAveragesBySeq(students),
      [students]
    );

  const classGeneralAverage =
    useMemo(
      () =>
        calculateClassGeneralAverage(
          students,
          evalCoefficients
        ),
      [students, evalCoefficients]
    );


  /* ==========================================================
   * EXPORTS & IMPORTS
   * ========================================================== */

  const handleExportPDF =
    useCallback(
      () => {
        if (selectedClass && selectedSubject && establishmentSettings) {
          exportGradeSheetToPDF(
            students,
            selectedClass,
            selectedSubject,
            selectedTrimester,
            establishmentSettings
          );
        }
      },
      [students, selectedClass, selectedSubject, selectedTrimester, establishmentSettings]
    );

  const handleExportCSV =
    useCallback(
      () => {
        if (selectedClass && selectedSubject) {
          exportGradeSheetToCSV(
            students,
            selectedClass,
            selectedSubject,
            selectedTrimester,
            (student, seq) => student.evaluations?.[seq]?.score
          );
        }
      },
      [students, selectedClass, selectedSubject, selectedTrimester]
    );

  /* ==========================================================
   * IMPORT MULTI-FORMATS DE LA LISTE DES ÉLÈVES
   * ========================================================== */
  const createStudentsFromRows = useCallback((rows: unknown[][]): StudentGrade[] => {
    const normalizedRows = rows
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some(Boolean));

    if (normalizedRows.length === 0) return [];

    const normalizeHeader = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    const headerIndex = normalizedRows.findIndex((row) =>
      row.some((cell) => {
        const h = normalizeHeader(cell);
        return h === "nom" || h === "noms" || h === "nomsetprenoms" || h === "nomprenoms" || h === "prenoms" || h === "sexe" || h === "sex" || h === "gender";
      })
    );

    const header = headerIndex >= 0 ? normalizedRows[headerIndex] : [];
    const findColumn = (names: string[]) =>
      header.findIndex((cell) => names.includes(normalizeHeader(cell)));

    const nameIndex = findColumn(["nomsetprenoms", "nomprenoms", "eleve", "student", "nom"]) ;
    const firstNameIndex = findColumn(["prenoms", "prenom", "firstname"]) ;
    const genderIndex = findColumn(["sexe", "sex", "gender", "genre"]) ;
    const startIndex = headerIndex >= 0 ? headerIndex + 1 : 0;

    return normalizedRows.slice(startIndex).flatMap((row, index) => {
      const firstCell = String(row[0] ?? "").trim();
      const strippedFirst = firstCell.replace(/^\s*\d+[.)-]?\s*/, "").trim();
      const lowered = strippedFirst.toLowerCase();
      if (!strippedFirst || /^(n°|no|numero|nom|noms|eleve|student)$/i.test(lowered)) return [];

      let name = "";
      if (nameIndex >= 0) {
        name = row[nameIndex] || "";
        if (firstNameIndex >= 0 && row[firstNameIndex]) {
          name = `${name} ${row[firstNameIndex]}`.trim();
        }
      } else if (firstNameIndex >= 0) {
        name = `${row[0] || ""} ${row[firstNameIndex] || ""}`.trim();
      } else {
        name = strippedFirst;
      }

      const rawGender = genderIndex >= 0 ? row[genderIndex] : row[1];
      const genderText = String(rawGender ?? "").trim().toUpperCase();
      const gender: "M" | "F" =
        genderText === "F" || genderText === "FEMININ" || genderText === "FÉMININ" || genderText === "FEMALE"
          ? "F"
          : "M";

      if (!name.trim()) return [];

      return [{
        id: `stud_${Date.now()}_${index}`,
        name: name.trim(),
        gender,
        evaluations: {},
        average: undefined,
        rank: undefined,
        appreciation: "",
      }];
    });
  }, []);

  const createStudentsFromText = useCallback((text: string): StudentGrade[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const rows = lines.map((line) => {
      const separator = line.includes("\t") ? "\t" : line.includes(";") ? ";" : line.includes(",") ? "," : null;
      if (separator) return line.split(separator).map((cell) => cell.trim());
      const cleaned = line.replace(/^\s*\d+[.)-]?\s*/, "").trim();
      const genderMatch = cleaned.match(/(?:\s|[-–])([MF])\s*$/i);
      if (genderMatch) {
        return [cleaned.slice(0, genderMatch.index).trim(), genderMatch[1].toUpperCase()];
      }
      return [cleaned];
    });

    return createStudentsFromRows(rows);
  }, [createStudentsFromRows]);

  const extractStudentsFromImage = useCallback(async (file: File): Promise<StudentGrade[]> => {
    const worker = await createWorker("fra");
    try {
      const result = await worker.recognize(file);
      return createStudentsFromText(result.data.text);
    } finally {
      await worker.terminate();
    }
  }, [createStudentsFromText]);

  const extractStudentsFromPDF = useCallback(async (file: File): Promise<StudentGrade[]> => {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? String(item.str) : ""))
        .join(" ");

      if (text.trim()) {
        pageTexts.push(text);
        continue;
      }

      // PDF scanné (CamScanner, scanner, photo) : OCR de la page.
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");

      if (!context) continue;

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const worker = await createWorker("fra");
      try {
        const result = await worker.recognize(canvas);
        pageTexts.push(result.data.text);
      } finally {
        await worker.terminate();
      }
    }

    return createStudentsFromText(pageTexts.join("\n"));
  }, [createStudentsFromText]);

  const handleImportStudentsFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!canEditSelectedClass) {
        alert("Consultation uniquement : l'import d'élèves est réservé à l'enseignant de cette classe.");
        event.target.value = "";
        return;
      }

      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        const extension = file.name.split(".").pop()?.toLowerCase();
        let importedStudents: StudentGrade[] = [];

        if (extension === "csv") {
          importedStudents = await importGradeSheetFromCSV(file);
        } else if (extension === "xlsx" || extension === "xls") {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "" });
          importedStudents = createStudentsFromRows(rows);
        } else if (extension === "docx") {
          const buffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          importedStudents = createStudentsFromText(result.value);
        } else if (extension === "pdf") {
          importedStudents = await extractStudentsFromPDF(file);
        } else if (extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "webp") {
          importedStudents = await extractStudentsFromImage(file);
        } else if (extension === "txt") {
          importedStudents = createStudentsFromText(await file.text());
        } else {
          alert("Format non pris en charge. Utilisez CSV, Excel (.xlsx/.xls), PDF, Word (.docx), TXT ou image (.jpg/.jpeg/.png/.webp). Les scans CamScanner exportés en PDF ou image sont également acceptés.");
          return;
        }

        if (importedStudents.length === 0) {
          alert("Aucun élève n'a pu être détecté dans ce fichier.");
          return;
        }

        const recalculated = recalculateStudentsGrades(
          importedStudents,
          {},
          evalCoefficients
        );
        setStudents(sortStudentsAlphabetically(recalculated));
        setTypedGrades({});
        alert(`${importedStudents.length} élève(s) importé(s) avec succès.`);
      } catch (error) {
        console.error("Erreur import liste élèves :", error);
        alert("Impossible de lire ce fichier. Vérifiez son format et son contenu.");
      }
    },
    [canEditSelectedClass, createStudentsFromRows, createStudentsFromText, extractStudentsFromPDF, extractStudentsFromImage, evalCoefficients, recalculateStudentsGrades, sortStudentsAlphabetically]
  );

  /* ==========================================================
   * SAUVEGARDE DU RELEVÉ
   * ========================================================== */

  const handleSaveSheet =
    useCallback(
      async () => {
        if (isSaving) {
          return;
        }

        if (!canEditSelectedClass) {
          alert(
            "Consultation uniquement : vous ne pouvez pas modifier le relevé d'une classe qui n'est pas la vôtre."
          );
          return;
        }

        if (!selectedClass || !selectedSubject) {
          alert("Veuillez sélectionner une classe et une matière.");
          return;
        }

        if (students.length === 0) {
          alert("Relevé vide !");
          return;
        }

        const normalizeValue = (value: unknown) =>
          String(value ?? "").trim().toLowerCase();

        const resolvedYear =
          currentAcademicYear ||
          establishment?.academicYear ||
          currentUser?.academicYear ||
          establishmentSettings?.academicYear ||
          "";

        const currentAcademicYearNormalized =
          normalizeValue(resolvedYear);

        if (!currentAcademicYearNormalized) {
          alert("Veuillez configurer l'année scolaire avant d'enregistrer.");
          return;
        }

        setIsSaving(true);

        const estId =
          profileEstablishmentId ||
          establishmentSettings?.id ||
          establishment?.id ||
          "";

        const depId =
          profileDepartmentId ||
          establishmentSettings?.departmentId ||
          "";

        if (!estId || !depId) {
          setIsSaving(false);
          alert("IDs manquants.");
          return;
        }

        const currentClassName = normalizeValue(selectedClass);
        const currentDiscipline = normalizeValue(
          selectedSubject || establishmentSettings?.discipline
        );
        const currentDepartmentId = normalizeValue(depId);
        const currentEstablishmentId = normalizeValue(estId);
        const currentTrimester = Number(selectedTrimester);

        const existingSheet = classGradeSheets.find(
          (sheet) => {
            if (sheet.id === activeSheetId) {
              return false;
            }

            const sameEstablishment =
              normalizeValue(sheet.establishmentId) === currentEstablishmentId;
            const sameDepartment =
              normalizeValue(sheet.departmentId) === currentDepartmentId;
            const sameClass =
              normalizeValue(sheet.className) === currentClassName;
            const sameDiscipline =
              normalizeValue(sheet.discipline) === currentDiscipline;
            const sameTrimester =
              Number(sheet.trimester) === currentTrimester;
            const sheetYear = normalizeValue(sheet.academicYear);
            const sameAcademicYear =
              sheetYear === currentAcademicYearNormalized;

            return (
              sameEstablishment &&
              sameDepartment &&
              sameClass &&
              sameDiscipline &&
              sameTrimester &&
              sameAcademicYear
            );
          }
        );

        if (existingSheet) {
          const replace = window.confirm(
            `⚠️ Un relevé existe déjà pour cette classe et cette période.

Classe : ${existingSheet.className}
Discipline : ${existingSheet.discipline || selectedSubject}
Trimestre : ${existingSheet.trimester}
Année scolaire : ${existingSheet.academicYear || resolvedYear}

Voulez-vous remplacer le relevé existant ?`
          );

          if (!replace) {
            setIsSaving(false);
            return;
          }
        }

        try {
          const sheetId =
            existingSheet?.id ||
            activeSheetId ||
            buildGradeSheetId(
              estId,
              depId,
              resolvedYear,
              teacherId,
              selectedClass,
              selectedSubject,
              selectedTrimester
            );

          const finalStudents =
            recalculateStudentsGrades(
              students,
              typedGrades,
              evalCoefficients
            );

          const sheetDataBase: Omit<
            ClassGradeSheet,
            "id" | "updatedAt"
          > = {
            establishmentId: estId,
            departmentId: depId,
            teacherId,
            teacherName: currentTeacherName || teacherName,
            discipline: selectedSubject,
            className: selectedClass,
            subject: selectedSubject,
            trimester: selectedTrimester,
            academicYear: resolvedYear,
            students: finalStudents,
            coefficients: evalCoefficients,
            settings: establishmentSettings,
          };

          const sheetToSave = {
            id: sheetId,
            ...sheetDataBase,
            archivedAt: new Date().toISOString(),
          };

          setStudents(finalStudents);

          setClassGradeSheets((previous) => {
            const existingIndex = previous.findIndex(
              (sheet) => sheet.id === sheetToSave.id
            );
            if (existingIndex >= 0) {
              const updated = [...previous];
              updated[existingIndex] = sheetToSave as unknown as ClassGradeSheet;
              return updated;
            }
            return [...previous, sheetToSave as unknown as ClassGradeSheet];
          });

          setActiveSheetId(sheetId);

          await saveGradeSheet(sheetId, sheetDataBase);
          await saveArchive(
            sheetToSave as Omit<ArchiveReleve, "id" | "createdAt">
          );

          alert("Enregistré avec succès !");
        } catch (error) {
          console.error("Erreur d'enregistrement :", error);
          alert("Erreur d'enregistrement.");
        } finally {
          setIsSaving(false);
        }
      },
      [
        isSaving,
        selectedClass,
        selectedSubject,
        students,
        typedGrades,
        currentAcademicYear,
        establishment?.academicYear,
        currentUser?.academicYear,
        establishmentSettings,
        profileEstablishmentId,
        profileDepartmentId,
        classGradeSheets,
        activeSheetId,
        teacherId,
        currentTeacherName,
        teacherName,
        evalCoefficients,
        selectedTrimester,
        recalculateStudentsGrades,
        canEditSelectedClass,
      ]
    );


  /* ==========================================================
   * RESTAURATION ET SUPPRESSION D'ARCHIVES
   * ========================================================== */

  const handleRestoreArchive =
    useCallback(
      (archive: ArchiveReleve) => {
        const archiveTeacherId = String(
          (archive as ArchiveReleve & { teacherId?: string }).teacherId ?? ""
        ).trim();

        if (
          isAnimator &&
          archiveTeacherId &&
          archiveTeacherId !== String(teacherId ?? "").trim()
        ) {
          skipNextSheetLoadRef.current = true;
        }

        const restored = restoreArchive(archive);

        setSelectedClass(restored.className);
        setSelectedSubject(restored.subject);
        setSelectedTrimester(restored.trimester);

        if ((archive as any).id) {
          setActiveSheetId((archive as any).id);
        }

        if (restored.students) {
          const recalculated =
            recalculateStudentsGrades(
              restored.students,
              {},
              evalCoefficients
            );
          setStudents(
            sortStudentsAlphabetically(recalculated)
          );
          setTypedGrades({});
        }

        setIsArchiveModalOpen(false);
      },
      [
        evalCoefficients,
        recalculateStudentsGrades,
        sortStudentsAlphabetically,
        isAnimator,
        teacherId,
      ]
    );

  const handleDeleteArchive =
    useCallback(
      (id: string) => {
        const archive = archives.find((item) => item.id === id);
        const archiveTeacherId = String(
          (archive as ArchiveReleve & { teacherId?: string })?.teacherId ?? ""
        ).trim();

        if (
          isAnimator &&
          archiveTeacherId &&
          archiveTeacherId !== String(teacherId ?? "").trim()
        ) {
          alert(
            "Consultation uniquement : l'Animateur pédagogique ne peut pas supprimer le relevé d'un autre enseignant."
          );
          return;
        }

        if (window.confirm("Supprimer ?")) {
          void deleteArchive(id);
        }
      },
      [archives, isAnimator, teacherId]
    );

  const handleClearReleve = useCallback(() => {
    if (!canEditSelectedClass) {
      alert(
        "Consultation uniquement : vous ne pouvez pas vider le relevé d'un autre enseignant."
      );
      return;
    }

    if (
      window.confirm(
        "Voulez-vous vraiment vider toutes les notes de ce relevé ? Cette opération effacera toutes les notes saisies pour cette classe."
      )
    ) {
      setStudents((previous) =>
        previous.map((student) => ({
          ...student,
          evaluations: {},
          average: undefined,
          rank: undefined,
        }))
      );
      setTypedGrades({});
      alert("Le relevé a été réinitialisé en effaçant toutes les notes.");
    }
  }, [canEditSelectedClass]);

  const saveEstablishmentConfigs = useCallback(async () => {
    if (!canEditSelectedClass) {
      alert("Consultation uniquement : vous ne pouvez pas modifier la configuration.");
      return;
    }

    const effectiveEstablishmentId =
      profileEstablishmentId ||
      establishmentSettings?.id ||
      establishment?.id ||
      "";

    if (!effectiveEstablishmentId) {
      alert("Identifiant de l'établissement manquant.");
      return;
    }

    try {
      const settingsToSave = {
        ...(editableEstablishmentSettings || establishmentSettings || {}),
        academicYear:
          currentAcademicYear ||
          editableEstablishmentSettings?.academicYear ||
          establishmentSettings?.academicYear ||
          "",
        evalCoefficients,
      };

      await setDoc(
        doc(db, "establishmentSettings", effectiveEstablishmentId),
        settingsToSave,
        { merge: true }
      );

      setIsEditingEstablishment(false);
      alert("Configuration de l'établissement sauvegardée.");
    } catch (error) {
      console.error(
        "Erreur lors de la sauvegarde des paramètres de l'établissement :",
        error
      );
      alert("Échec de la sauvegarde de la configuration.");
    }
  }, [
    canEditSelectedClass,
    profileEstablishmentId,
    establishmentSettings,
    editableEstablishmentSettings,
    establishment?.id,
    currentAcademicYear,
    evalCoefficients,
  ]);

  const filteredStudents = useMemo(() => {
    const search = gradeSearchText.trim().toLowerCase();
    if (!search) return students;

    return students.filter((student) =>
      String(student.name ?? "").toLowerCase().includes(search)
    );
  }, [students, gradeSearchText]);

  const formatTrimesterLabel = (trimester: Trimester): string =>
    `Trimestre ${trimester}`;


  /* ==========================================================
   * RENDU
   * ========================================================== */

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

      {/* BARRE D'ACTIONS & SÉLECTION DE CLASSE */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Classe :</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent text-xs font-bold text-blue-600 focus:outline-none cursor-pointer"
            >
              {availableClasses.length === 0 ? (
                <option value="">Aucune classe disponible</option>
              ) : (
                availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Trimestre :</span>
            <select
              value={selectedTrimester}
              onChange={(e) =>
                setSelectedTrimester(Number(e.target.value) as Trimester)
              }
              className="bg-transparent text-xs font-bold text-red-600 focus:outline-none cursor-pointer"
            >
              <option value={1}>Trimestre 1</option>
              <option value={2}>Trimestre 2</option>
              <option value={3}>Trimestre 3</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSaveSheet}
            disabled={isSaving || !canEditSelectedClass}
            className={`px-5 py-2 rounded-xl font-semibold text-xs transition cursor-pointer ${
              isSaving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white shadow-sm"
            }`}
          >
            {isSaving
              ? "Enregistrement en cours…"
              : canEditSelectedClass
                ? "Enregistrer le relevé"
                : "Consultation uniquement"}
          </button>

          <button
            type="button"
            onClick={() => setIsArchiveModalOpen(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Archives ({archives.length})
          </button>

          <button
            type="button"
            onClick={() => setGradeSearchText("")}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Nouveau relevé
          </button>

          <button
            type="button"
            onClick={handleClearReleve}
            disabled={!canEditSelectedClass}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Vider le relevé
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Exporter PDF
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Exporter CSV
          </button>
        </div>
      </div>

      {/* EN-TÊTE */}
      {establishmentSettings && (
        <HeaderPreview
          settings={{
            id: establishmentSettings.id || "",
            ministry: establishmentSettings.ministry || "",
            region: establishmentSettings.region || "",
            delegation: establishmentSettings.delegation || "",
            establishmentName: establishmentSettings.establishmentName || "",
            academicYear: currentAcademicYear || establishmentSettings.academicYear || "",
            motto: establishmentSettings.motto || "",
            town: establishmentSettings.town || "",
            departmentName: establishmentSettings.departmentName || "",
            logoUrl: establishmentSettings.logoUrl || "",
          }}
          selectedClass={selectedClass}
          selectedSubject={selectedSubject}
          selectedTrimester={selectedTrimester}
          teacherName={currentTeacherName || teacherName}
          academicYear={currentAcademicYear || establishmentSettings.academicYear || ""}
        />
      )}

      {/* RECHERCHE DES ÉLÈVES — fonctionnalité conservée */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un élève..."
            value={gradeSearchText}
            onChange={(event) => setGradeSearchText(event.target.value)}
            className="flex-1 bg-transparent focus:outline-none text-sm font-medium text-slate-700"
          />
          {gradeSearchText && (
            <button
              type="button"
              onClick={() => setGradeSearchText("")}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* TITRE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-center">
        <h1 className="text-xl font-extrabold text-slate-900 uppercase tracking-wide">
          RELEVÉ DE NOTES DES ÉLÈVES
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-slate-700 pt-1">
          <div>
            <span className="text-slate-400 font-normal">Classe :</span>{" "}
            <span className="text-blue-600 font-bold">{selectedClass || "Non défini"}</span>
          </div>

          <div>
            <span className="text-slate-400 font-normal">Matière :</span>{" "}
            <span className="text-blue-600 font-bold">{selectedSubject || "Non défini"}</span>
          </div>

          <div>
            <span className="text-slate-400 font-normal">Trimestre :</span>{" "}
            <span className="text-red-600 font-bold">{formatTrimesterLabel(selectedTrimester)}</span>
          </div>
        </div>
      </div>

      {/* COEFFICIENTS — À CONFIGURER AVANT LA SAISIE DES ÉLÈVES */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">
              Configuration des coefficients
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Choisissez les coefficients avant d'ajouter les élèves et de saisir les notes.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
            {selectedClass || "Classe non définie"} · Trimestre {selectedTrimester}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
          {Array.from({ length: 9 }, (_, index) => {
            const seq = index + 1;
            return (
              <label
                key={seq}
                className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600"
              >
                <span>Évaluation {seq}</span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={evalCoefficients[seq] ?? 1}
                  onChange={(event) =>
                    handleCoefficientChange(seq, event.target.value)
                  }
                  disabled={!canEditSelectedClass}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* CONFIGURATION DE L'ÉTABLISSEMENT — fonctionnalité conservée */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm no-print">
        <button
          type="button"
          onClick={() => setIsEditingEstablishment((value) => !value)}
          className="w-full flex justify-between items-center text-xs font-bold text-indigo-900 uppercase tracking-widest cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Building2 size={16} className="text-indigo-600" />
            Personnaliser l'établissement / l'en-tête d'impression
          </span>
          <span className="text-slate-400 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100">
            {isEditingEstablishment ? "Masquer" : "Personnaliser"}
          </span>
        </button>

        {isEditingEstablishment && (
          <div className="pt-4 mt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ["ministry", "Ministère"],
              ["region", "Région"],
              ["delegation", "Délégation"],
              ["establishmentName", "Nom de l'établissement"],
              ["departmentName", "Département pédagogique"],
              ["academicYear", "Année scolaire"],
              ["principalName", "Proviseur / Directeur"],
              ["town", "Ville"],
              ["bp", "B.P."],
              ["phone", "Téléphone"],
            ].map(([field, label]) => (
              <label key={field} className="space-y-1">
                <span className="block text-[10px] font-bold text-slate-500 uppercase">
                  {label}
                </span>
                <input
                  type="text"
                  value={
                    field === "academicYear"
                      ? currentAcademicYear || ""
                      : String(
                          (editableEstablishmentSettings as unknown as Record<string, unknown>)?.[field] ?? ""
                        )
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (field === "academicYear") {
                      setCurrentAcademicYear(value);
                    }
                    setEditableEstablishmentSettings((previous) => {
                      const base = previous ?? establishmentSettings;
                      if (!base) return undefined;
                      return {
                        ...base,
                        [field]: value,
                      };
                    });
                  }}
                  disabled={!canEditSelectedClass}
                  className="w-full bg-white border border-slate-200 px-3 py-2 text-xs rounded-lg font-bold disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
            ))}

            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => void saveEstablishmentConfigs()}
                disabled={!canEditSelectedClass}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Appliquer et sauvegarder
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LISTE DES NOTES */}
      <div className="flex justify-between items-center no-print">
        <h2 className="text-lg font-bold text-slate-800">
          Liste des notes
        </h2>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            disabled={
              !selectedClass ||
              !selectedSubject ||
              !canEditSelectedClass
            }
            className={`px-4 py-2 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2 ${
              !selectedClass || !selectedSubject
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
            }`}
          >
            + Ajouter un élève / Importer ▾
          </button>

          {isAddMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddMenuOpen(false);
                  setIsAddStudentModalOpen(true);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
              >
                👤 Saisie manuelle
              </button>

              <label className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer">
                📄 Importer une liste
                <span className="text-[10px] text-slate-400">CSV · Excel · PDF · Word · TXT · Image · CamScanner</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => {
                    setIsAddMenuOpen(false);
                    void handleImportStudentsFile(event);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ÉTAT VIDE */}
      {availableClasses.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
          <strong>Aucune classe n'est disponible.</strong>
          <p className="mt-1">
            Les classes sont celles enregistrées dans le profil de l'enseignant.
            Il n'y a plus de gestion séparée des classes dans cette page.
          </p>
        </div>
      )}

      {!canEditSelectedClass && selectedClass && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 no-print">
          <strong>Consultation uniquement.</strong>
          <p className="mt-1">
            Cette classe appartient à un autre enseignant. L'Animateur pédagogique
            peut consulter le relevé reçu, mais ne peut ni ajouter/supprimer un élève,
            ni modifier une note, ni enregistrer des changements.
          </p>
        </div>
      )}

      {/* TABLEAU */}
      <GradeSheetTable
        students={filteredStudents}
        allStudentsCount={students.length}
        evalCoefficients={evalCoefficients}
        typedGrades={typedGrades}
        classAverageBySeq={classAverageBySeq}
        classGeneralAverage={classGeneralAverage}
        selectedTrimester={selectedTrimester}
        onGradeChange={canEditSelectedClass ? handleGradeChange : () => {}}
        onGradeBlur={handleGradeBlur}
        onDeleteStudent={canEditSelectedClass ? handleDeleteStudent : () => {}}
        getStudentScoreString={getStudentScoreString}
      />

      {/* STATISTIQUES */}
      <StatisticsPanel {...stats} />

      {/* MODAL AJOUT ÉLÈVE */}
      {isAddStudentModalOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 no-print"
          style={{ pointerEvents: "auto" }}
        >
          <div
            className="relative z-[10000] bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200"
            style={{ pointerEvents: "auto" }}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                Ajouter un nouvel élève
              </h3>
              <button
                type="button"
                onClick={() => setIsAddStudentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom et prénoms <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newStudentName}
                  onChange={(event) => setNewStudentName(event.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sexe <span className="text-red-500">*</span>
                </label>
                <select
                  value={newStudentGender}
                  onChange={(event) =>
                    setNewStudentGender(event.target.value as "M" | "F")
                  }
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-sm cursor-pointer"
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARCHIVES */}
      {isArchiveModalOpen && (
        <ArchiveModal
          archives={archives}
          isAnimator={isAnimator}
          onClose={() => setIsArchiveModalOpen(false)}
          onRestore={handleRestoreArchive}
          onDelete={handleDeleteArchive}
        />
      )}

    </div>
  );
}