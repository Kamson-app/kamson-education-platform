/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/* ============================================================
 * COUVERTURE DES PROGRAMMES D'ENSEIGNEMENT
 * FIRESTORE REALTIME
 * ============================================================ */

import { useEffect, useMemo, useState } from 'react';

import {
  BookOpen,
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  Sparkles
} from 'lucide-react';

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';

import { db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useDepartment } from '../hooks/useDepartment';

import type {
  ProgramCoverage,
  UserProfile,
  EstablishmentSettings,
  Trimester
} from '../types';

import { TRIMESTERS } from '../constants/defaults';

/* ============================================================
 * TYPES
 * ============================================================ */

interface ProgramCoverageViewProps {
  classes?: string[];
  currentUser?: UserProfile | null;
  establishment?: EstablishmentSettings | null;
  academicYear?: string;
  establishmentSettings?: EstablishmentSettings | null;
  customClassesList?: string[];
  allProgramCoverages?: ProgramCoverage[];
  onSaveProgramCoverages?: (
    coverages: ProgramCoverage[]
  ) => Promise<void>;
  isSaving?: boolean;
}

interface CoverageRow {
  id: string;

  className: string;
  discipline: string;
  subject: string;

  teacherId: string;
  teacherName: string;
  userId?: string;

  plannedLessonsAnnual: number;
  plannedLessonsTrimester: number;

  completedLessonsAnnual: number;
  completedLessonsTrimester: number;

  plannedLessons: number;
  completedLessons: number;

  completionRate: number;

  source?: ProgramCoverage;
}

interface ArchiveItem {
  id: string;
  date: string;
  trimester: Trimester;
  rows: CoverageRow[];
}

/* ============================================================
 * OUTILS
 * ============================================================ */

const numberValue = (value: unknown): number => {
  const n = Number(value);

  return Number.isFinite(n) && n >= 0
    ? Math.floor(n)
    : 0;
};

const calculateRate = (
  realized: number,
  planned: number
): number => {
  if (planned <= 0) return 0;

  return Number(
    Math.min(100, (realized / planned) * 100).toFixed(1)
  );
};

/* ============================================================
 * COMPOSANT PRINCIPAL
 * ============================================================ */

export default function ProgramCoverageView({
  classes = [],
  currentUser,
  establishment,
  academicYear,
  establishmentSettings,
  customClassesList = [],
  isSaving = false
}: ProgramCoverageViewProps) {

  /* ============================================================
   * UTILISATEUR / ÉTABLISSEMENT
   * ============================================================ */

  const activeEstablishment =
    establishmentSettings || establishment;

  const { profile } = useUser();

  const effectiveUser =
    currentUser || profile;

  const resolvedEstablishmentId =
    activeEstablishment?.id ||
    effectiveUser?.establishmentId ||
    profile?.establishmentId ||
    '';

  /* ============================================================
   * ANNÉE SCOLAIRE & DÉPARTEMENT
   * ============================================================ */

  const { settings: departmentSettings } =
    useDepartment();

  const resolvedDepartmentId =
    (departmentSettings as { departmentId?: string } | null)
      ?.departmentId ||
    effectiveUser?.departmentId ||
    profile?.departmentId ||
    '';

  const activeAcademicYear =
    academicYear ||
    departmentSettings?.academicYear ||
    activeEstablishment?.academicYear ||
    '2025-2026';

  // Sécurisation de l'année scolaire pour les ID Firestore (remplacement des / par des -)
  const safeAcademicYear = String(activeAcademicYear ?? '')
    .trim()
    .replace(/[\\/]/g, '-');

  /* ============================================================
   * ÉTATS
   * ============================================================ */

  const [
    selectedTrimester,
    setSelectedTrimester
  ] = useState<Trimester>(1);

  const [
    localCoverages,
    setLocalCoverages
  ] = useState<ProgramCoverage[]>([]);

  const [
    rows,
    setRows
  ] = useState<CoverageRow[]>([]);

  const [
    selectedClass,
    setSelectedClass
  ] = useState('');

  const [
    disciplineInput,
    setDisciplineInput
  ] = useState(
    effectiveUser?.subject || ''
  );

  const [
    teacherInput,
    setTeacherInput
  ] = useState(
    effectiveUser?.name || ''
  );

  const [
    annualPlannedInput,
    setAnnualPlannedInput
  ] = useState<number | string>('');

  const [
    trimesterPlannedInput,
    setTrimesterPlannedInput
  ] = useState<number | string>('');

  const [
    annualRealizedInput,
    setAnnualRealizedInput
  ] = useState<number | string>('');

  const [
    trimesterRealizedInput,
    setTrimesterRealizedInput
  ] = useState<number | string>('');

  /* Incrémentation rapide après chaque séance */
  const [
    incrementalValue,
    setIncrementalValue
  ] = useState<number>(1);

  const [
    editingId,
    setEditingId
  ] = useState<string | null>(null);

  const [
    archives,
    setArchives
  ] = useState<ArchiveItem[]>([]);

  const [
    showArchives,
    setShowArchives
  ] = useState(false);

  const [
    isLoadingFirestore,
    setIsLoadingFirestore
  ] = useState(false);

  const [
    isActionLoading,
    setIsActionLoading
  ] = useState(false);

  const [
    showAIModal,
    setShowAIModal
  ] = useState(false);

  const [
    showAddClassForm,
    setShowAddClassForm
  ] = useState(false);

  const [
    message,
    setMessage
  ] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({
    type: null,
    text: ''
  });

  /* ============================================================
   * LISTE DES CLASSES
   * ============================================================ */

  const finalClassesList = useMemo(() => {
    const profileClasses = Array.isArray(effectiveUser?.classes)
      ? effectiveUser.classes
      : [];

    const sourceClasses =
      Array.isArray(classes) && classes.length > 0
        ? classes
        : profileClasses;

    return Array.from(
      new Set(
        [...sourceClasses, ...customClassesList]
          .map(className => String(className).trim())
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' })
    );
  }, [classes, effectiveUser?.classes, customClassesList]);

  // Sélectionner automatiquement la première classe lorsque
  // les classes arrivent depuis Firestore / App.
  useEffect(() => {
    if (
      finalClassesList.length > 0 &&
      !finalClassesList.includes(selectedClass)
    ) {
      setSelectedClass(finalClassesList[0]);
    }
  }, [finalClassesList, selectedClass]);

  /* ============================================================
   * SYNCHRONISATION TEMPS RÉEL FIRESTORE
   * ============================================================ */

  useEffect(() => {

    if (
      !resolvedEstablishmentId ||
      !effectiveUser?.subject ||
      !activeAcademicYear
    ) {
      return;
    }

    setIsLoadingFirestore(true);

    const isAnimator = effectiveUser?.role === 'ANIMATEUR_PEDAGOGIQUE';

    const q = isAnimator 
      ? query(
          collection(db, 'programCoverages'),
          where('establishmentId', '==', resolvedEstablishmentId),
          where('departmentId', '==', resolvedDepartmentId || effectiveUser?.departmentId || ''),
          where('trimester', '==', selectedTrimester),
          where('academicYear', '==', activeAcademicYear)
        )
      : query(
          collection(db, 'programCoverages'),
          where('establishmentId', '==', resolvedEstablishmentId),
          where('discipline', '==', effectiveUser.subject),
          where('trimester', '==', selectedTrimester),
          where('academicYear', '==', activeAcademicYear)
        );

    const unsubscribe = onSnapshot(
      q,

      snapshot => {

        const data =
          snapshot.docs.map(
            document => ({
              id: document.id,
              ...document.data()
            } as ProgramCoverage)
          );

        setLocalCoverages(data);

        setIsLoadingFirestore(false);

      },

      error => {

        console.error(
          'Erreur synchronisation Firestore :',
          error
        );

        setIsLoadingFirestore(false);

      }
    );

    return () => unsubscribe();

  }, [
    resolvedEstablishmentId,
    effectiveUser?.subject,
    effectiveUser?.role,
    effectiveUser?.departmentId,
    resolvedDepartmentId,
    activeAcademicYear,
    selectedTrimester
  ]);

  /* ============================================================
   * CHARGEMENT DES ARCHIVES FIRESTORE
   * ============================================================ */

  useEffect(() => {

    if (
      !resolvedEstablishmentId ||
      !activeAcademicYear
    ) {
      return;
    }

    const q = query(
      collection(
        db,
        'programCoverageArchives'
      ),

      where(
        'establishmentId',
        '==',
        resolvedEstablishmentId
      ),

      where(
        'academicYear',
        '==',
        activeAcademicYear
      )
    );

    const unsubscribe = onSnapshot(
      q,

      snapshot => {

        const data: ArchiveItem[] =
          snapshot.docs.map(document => {

            const value =
              document.data();

            return {
              id: document.id,

              date:
                value.date || '',

              trimester:
                value.trimester,

              rows:
                Array.isArray(value.rows)
                  ? value.rows
                  : []
            };

          });

        setArchives(data);

      },

      error => {

        console.error(
          'Erreur chargement archives programmes :',
          error
        );

        showMessage(
          'error',
          'Impossible de charger les archives.'
        );

      }
    );

    return () => unsubscribe();

  }, [
    resolvedEstablishmentId,
    activeAcademicYear
  ]);

  /* ============================================================
   * CONVERSION FIRESTORE → TABLEAU
   * ============================================================ */

  useEffect(() => {

    const mappedRows: CoverageRow[] =
      localCoverages.map(
        (coverage, index) => {

          const value =
            coverage as any;

          return {
            id:
              coverage.id ||
              `program-${index}`,

            className:
              value.className || '',

            discipline:
              value.discipline || '',

            subject:
              value.subject ||
              value.discipline ||
              '',

            teacherId:
              value.teacherId || '',

            teacherName:
              value.teacherName || '',

            userId:
              value.userId || '',

            plannedLessonsAnnual:
              numberValue(
                value.plannedLessonsAnnual ?? 0
              ),

            plannedLessonsTrimester:
              numberValue(
                value.plannedLessonsTrimester ?? 0
              ),

            completedLessonsAnnual:
              numberValue(
                value.completedLessonsAnnual ?? 0
              ),

            completedLessonsTrimester:
              numberValue(
                value.completedLessonsTrimester ?? 0
              ),

            plannedLessons:
              numberValue(
                value.plannedLessons ?? value.plannedLessonsAnnual ?? 0
              ),

            completedLessons:
              numberValue(
                value.completedLessons ?? value.completedLessonsAnnual ?? 0
              ),

            completionRate:
              numberValue(
                value.completionRate ??
                calculateRate(
                  numberValue(value.completedLessonsAnnual ?? 0),
                  numberValue(value.plannedLessonsAnnual ?? 0)
                )
              ),

            source: coverage
          };

        }
      );

    setRows(mappedRows);

  }, [localCoverages]);

  /* ============================================================
   * STATISTIQUES
   * ============================================================ */

  const stats = useMemo(() => {

    const total = rows.length;

    const excellent =
      rows.filter(
        row =>
          row.completionRate >= 90
      );

    const monitor =
      rows.filter(
        row =>
          row.completionRate >= 70 &&
          row.completionRate < 90
      );

    const critical =
      rows.filter(
        row =>
          row.completionRate < 70
      );

    const avgAnn =
      total > 0
        ? rows.reduce(
            (sum, row) =>
              sum + row.completionRate,
            0
          ) / total
        : 0;

    const avgTrim =
      total > 0
        ? rows.reduce(
            (sum, row) =>
              sum + calculateRate(row.completedLessonsTrimester, row.plannedLessonsTrimester),
            0
          ) / total
        : 0;

    const best =
      total > 0
        ? [...rows].reduce(
            (previous, current) =>
              current.completionRate >
              previous.completionRate
                ? current
                : previous
          )
        : null;

    const worst =
      total > 0
        ? [...rows].reduce(
            (previous, current) =>
              current.completionRate <
              previous.completionRate
                ? current
                : previous
          )
        : null;

    return {
      total,
      excellent: excellent.length,
      monitor: monitor.length,
      critical: critical.length,
      avgAnn,
      avgTrim,
      best,
      worst
    };

  }, [rows]);

  /* ============================================================
   * ANALYSE IA LOCALE
   * ============================================================ */

  const aiAnalysis = useMemo(() => {

    return {

      diagnostic:
        `La couverture des programmes annuelle moyenne est de ${stats.avgAnn.toFixed(1)}%.`,

      forces:
        stats.excellent > 0
          ? `Plusieurs classes (${stats.excellent}) présentent une excellente couverture des programmes.`
          : 'La progression des programmes est stable.',

      faiblesses:
        stats.critical > 0
          ? `Attention, ${stats.critical} classe(s) présentent une couverture des programmes inférieure à 70%.`
          : 'Aucun retard important dans la couverture des programmes.',

      recommandations:
        'Renforcer le suivi de la progression pédagogique et prévoir des séances de rattrapage lorsque cela est nécessaire.',

      planAction:
        'Priorité : suivre régulièrement les contenus réalisés et ajuster la programmation pour atteindre les objectifs trimestriels.',

      best:
        stats.best?.className || 'N/A',

      worst:
        stats.worst?.className || 'N/A'

    };

  }, [stats]);

  /* ============================================================
   * MESSAGE
   * ============================================================ */

  const showMessage = (
    type: 'success' | 'error',
    text: string
  ) => {

    setMessage({
      type,
      text
    });

    window.setTimeout(() => {

      setMessage({
        type: null,
        text: ''
      });

    }, 3500);

  };

  /* ============================================================
   * RÉINITIALISATION
   * ============================================================ */

  const resetForm = () => {

    setSelectedClass('');

    setDisciplineInput(
      effectiveUser?.subject || ''
    );

    setTeacherInput(
      effectiveUser?.name || ''
    );

    setAnnualPlannedInput('');
    setTrimesterPlannedInput('');

    setAnnualRealizedInput('');
    setTrimesterRealizedInput('');

    setIncrementalValue(1);

    setEditingId(null);

  };

  /* ============================================================
   * AJOUT / MODIFICATION
   * ============================================================ */

  const handleAddOrUpdate = async () => {

    if (!selectedClass.trim()) {

      showMessage(
        'error',
        'Veuillez sélectionner la classe.'
      );

      return;
    }

    if (!disciplineInput.trim()) {

      showMessage(
        'error',
        'Veuillez renseigner la discipline.'
      );

      return;
    }

    if (
      !resolvedEstablishmentId ||
      !resolvedDepartmentId ||
      !activeAcademicYear ||
      !effectiveUser?.id
    ) {

      showMessage(
        'error',
        'Paramètres d’établissement, département, année scolaire ou utilisateur manquants.'
      );

      return;
    }

    const pAn =
      numberValue(
        annualPlannedInput
      );

    const pTri =
      numberValue(
        trimesterPlannedInput
      );

    const rAn =
      numberValue(
        annualRealizedInput
      );

    const rTri =
      numberValue(
        trimesterRealizedInput
      );

    /* ----------------------------------------------------------
     * VALIDATIONS
     * ---------------------------------------------------------- */

    if (pTri > pAn) {

      showMessage(
        'error',
        'Les programmes prévus trimestriellement ne peuvent pas dépasser les programmes prévus annuellement.'
      );

      return;
    }

    if (rAn > pAn) {

      showMessage(
        'error',
        'Les programmes réalisés annuellement ne peuvent pas dépasser les programmes prévus annuellement.'
      );

      return;
    }

    if (rTri > pTri) {

      showMessage(
        'error',
        'Les programmes réalisés trimestriellement ne peuvent pas dépasser les programmes prévus trimestriellement.'
      );

      return;
    }

    setIsActionLoading(true);

    try {

      const cleanClassName =
        selectedClass
          .trim()
          .replace(/\s+/g, '_');

      const cleanDiscipline =
        disciplineInput
          .trim()
          .replace(/\s+/g, '_');

      const deterministicId =
        editingId ||
        `pc_${resolvedEstablishmentId}_${safeAcademicYear}_${cleanClassName}_${cleanDiscipline}_${selectedTrimester}`;

      const payload = {
        id: deterministicId,

        establishmentId:
          resolvedEstablishmentId,

        departmentId:
          resolvedDepartmentId,

        userId:
          effectiveUser?.id || '',

        teacherId:
          effectiveUser?.id || 'teacher_unknown',

        teacherName:
          teacherInput.trim() ||
          effectiveUser?.name ||
          '',

        academicYear:
          activeAcademicYear,

        trimester:
          selectedTrimester,

        className:
          selectedClass.trim(),

        discipline:
          disciplineInput.trim(),

        subject:
          disciplineInput.trim(),

        // ============================================================
        // COUVERTURE DES PROGRAMMES — FORMAT UNIQUE
        // ============================================================

        plannedLessonsAnnual: pAn,
        plannedLessonsTrimester: pTri,

        completedLessonsAnnual: rAn,
        completedLessonsTrimester: rTri,

        plannedLessons: pAn,
        completedLessons: rAn,

        completionRate:
          calculateRate(rAn, pAn),

        updatedAt:
          serverTimestamp(),
      };

      /* --------------------------------------------------------
       * SAUVEGARDE PRINCIPALE
       * -------------------------------------------------------- */

      await setDoc(
        doc(
          db,
          'programCoverages',
          deterministicId
        ),
        payload,
        {
          merge: true
        }
      );

      /* --------------------------------------------------------
       * HISTORIQUE
       * -------------------------------------------------------- */

      try {

        await addDoc(
          collection(
            db,
            'programCoverageHistory'
          ),
          {

            establishmentId:
              resolvedEstablishmentId,
            departmentId:
              resolvedDepartmentId,

            userId:
              effectiveUser?.id ||
              '',

            teacherId:
              effectiveUser?.id ||
              'teacher_unknown',

            teacherName:
              teacherInput.trim() ||
              effectiveUser?.name ||
              '',

            discipline:
              disciplineInput.trim(),

            className:
              selectedClass.trim(),

            trimester:
              selectedTrimester,

            plannedLessonsAnnual:
              pAn,

            completedLessonsAnnual:
              rAn,

            plannedLessonsTrimester:
              pTri,

            completedLessonsTrimester:
              rTri,

            savedAt:
              serverTimestamp()

          }
        );

      } catch (historyError) {

        console.warn(
          'Le suivi est enregistré mais l’historique n’a pas pu être enregistré :',
          historyError
        );

      }

      showMessage(
        'success',
        editingId
          ? 'La couverture des programmes a été mise à jour avec succès.'
          : 'La classe a été enregistrée avec succès.'
      );

      resetForm();

      setShowAddClassForm(false);

    } catch (error) {

      console.error(
        'Erreur lors de l’enregistrement Firestore :',
        error
      );

      showMessage(
        'error',
        'Une erreur est survenue lors de l’enregistrement.'
      );

    } finally {

      setIsActionLoading(false);

    }

  };

  /* ============================================================
   * ARCHIVAGE DU TRIMESTRE
   * ============================================================ */

  const handleArchive = async () => {

    if (
      !resolvedEstablishmentId ||
      rows.length === 0
    ) {

      showMessage(
        'error',
        'Aucune donnée à archiver.'
      );

      return;
    }

    if (!effectiveUser?.id) {

      showMessage(
        'error',
        'Utilisateur non identifié.'
      );

      return;
    }

    setIsActionLoading(true);

    try {

      /*
       * Un seul document par :
       * établissement + année + trimestre + enseignant
       */

      const archiveId =
        `pa_${resolvedEstablishmentId}_${safeAcademicYear}_${selectedTrimester}_${effectiveUser.id}`;

      const archiveData = {
        establishmentId:
          resolvedEstablishmentId,

        departmentId:
          resolvedDepartmentId,

        userId:
          effectiveUser.id,

        academicYear:
          activeAcademicYear,

        trimester:
          selectedTrimester,

        teacherId:
          effectiveUser.id,

        teacherName:
          effectiveUser.name ||
          teacherInput ||
          '',

        discipline:
          effectiveUser.subject ||
          disciplineInput ||
          '',

        date:
          new Date().toLocaleDateString(
            'fr-FR'
          ),

        rows: rows.map(row => ({
          id: row.id,

          className: row.className,
          discipline: row.discipline,
          subject: row.subject,

          teacherId: row.teacherId,
          teacherName: row.teacherName,

          plannedLessonsAnnual:
            numberValue(row.plannedLessonsAnnual),

          plannedLessonsTrimester:
            numberValue(row.plannedLessonsTrimester),

          completedLessonsAnnual:
            numberValue(row.completedLessonsAnnual),

          completedLessonsTrimester:
            numberValue(row.completedLessonsTrimester),

          plannedLessons:
            numberValue(row.plannedLessons),

          completedLessons:
            numberValue(row.completedLessons),

          completionRate:
            calculateRate(
              numberValue(row.completedLessonsAnnual),
              numberValue(row.plannedLessonsAnnual)
            ),
        })),

        archivedAt:
          serverTimestamp(),
      };

      await setDoc(
        doc(
          db,
          'programCoverageArchives',
          archiveId
        ),
        archiveData,
        {
          merge: true
        }
      );

      showMessage(
        'success',
        `Le Trimestre ${selectedTrimester} a été archivé avec succès.`
      );

    } catch (error) {

      console.error(
        'Erreur archivage Firestore :',
        error
      );

      showMessage(
        'error',
        'Impossible d’archiver le suivi des programmes.'
      );

    } finally {

      setIsActionLoading(false);

    }

  };

  /* ============================================================
   * AJOUT RAPIDE APRÈS UNE SÉANCE
   * ============================================================ */

  const handleQuickAddSession = async (
    rowId: string,
    addValue: number
  ) => {

    const row =
      rows.find(
        item => item.id === rowId
      );

    if (!row) return;

    const newTrimesterRealized =
      numberValue(
        row.completedLessonsTrimester
      ) + addValue;

    const newAnnualRealized =
      numberValue(
        row.completedLessonsAnnual
      ) + addValue;

    if (
      newTrimesterRealized >
      numberValue(row.plannedLessonsTrimester)
    ) {

      showMessage(
        'error',
        'Les programmes réalisés ne peuvent pas dépasser les programmes prévus pour le trimestre.'
      );

      return;
    }

    setIsActionLoading(true);

    try {

      const cleanClassName =
        row.className
          .trim()
          .replace(/\s+/g, '_');

      const cleanDiscipline =
        row.discipline
          .trim()
          .replace(/\s+/g, '_');

      const deterministicId =
        row.id.includes('pc_')
          ? row.id
          : `pc_${resolvedEstablishmentId}_${safeAcademicYear}_${cleanClassName}_${cleanDiscipline}_${selectedTrimester}`;

      const pAn =
        numberValue(
          row.plannedLessonsAnnual
        );

      const pTri =
        numberValue(
          row.plannedLessonsTrimester
        );

      const payload = {
        id: deterministicId,

        establishmentId:
          resolvedEstablishmentId,

        departmentId:
          resolvedDepartmentId,

        userId:
          row.source?.userId ||
          effectiveUser?.id ||
          '',

        academicYear:
          activeAcademicYear,

        className:
          row.className,

        discipline:
          row.discipline,

        subject:
          row.subject ||
          row.discipline,

        teacherId:
          row.teacherId ||
          effectiveUser?.id ||
          'teacher_unknown',

        teacherName:
          row.teacherName ||
          effectiveUser?.name ||
          '',

        trimester:
          selectedTrimester,

        /* ============================================================
         * FORMAT UNIQUE — COUVERTURE DES PROGRAMMES
         * ============================================================ */

        plannedLessonsAnnual:
          pAn,

        plannedLessonsTrimester:
          pTri,

        completedLessonsAnnual:
          newAnnualRealized,

        completedLessonsTrimester:
          newTrimesterRealized,

        /* Compatibilité générale */
        plannedLessons:
          pAn,

        completedLessons:
          newAnnualRealized,

        completionRate:
          calculateRate(
            newAnnualRealized,
            pAn
          ),

        updatedAt:
          serverTimestamp(),
      };

      await setDoc(
        doc(
          db,
          'programCoverages',
          deterministicId
        ),
        payload,
        {
          merge: true
        }
      );

      showMessage(
        'success',
        `+${addValue} programme(s) ajouté(s) pour la classe ${row.className}.`
      );

    } catch (error) {

      console.error(
        'Erreur incrémentation programme :',
        error
      );

      showMessage(
        'error',
        'Erreur lors de l’ajout de la progression.'
      );

    } finally {

      setIsActionLoading(false);

    }

  };

  /* ============================================================
   * MODIFICATION
   * ============================================================ */

  const handleEdit = (
    row: CoverageRow
  ) => {

    setEditingId(row.id);

    setSelectedClass(
      row.className
    );

    setDisciplineInput(
      row.discipline
    );

    setTeacherInput(
      row.teacherName
    );

    setAnnualPlannedInput(
      row.plannedLessonsAnnual
    );

    setTrimesterPlannedInput(
      row.plannedLessonsTrimester
    );

    setAnnualRealizedInput(
      row.completedLessonsAnnual
    );

    setTrimesterRealizedInput(
      row.completedLessonsTrimester
    );

    setShowAddClassForm(true);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  };

  /* ============================================================
   * SUPPRESSION
   * ============================================================ */

  const handleDelete = async (
    id: string
  ) => {

    const row =
      rows.find(
        item => item.id === id
      );

    if (!row) return;

    const confirmed =
      window.confirm(
        `Voulez-vous supprimer définitivement le suivi des programmes de la classe « ${row.className} » ?`
      );

    if (!confirmed) return;

    setIsActionLoading(true);

    try {

      await deleteDoc(
        doc(
          db,
          'programCoverages',
          id
        )
      );

      if (
        editingId === id
      ) {
        resetForm();
        setShowAddClassForm(false);
      }

      showMessage(
        'success',
        'La ligne a été supprimée avec succès.'
      );

    } catch (error) {

      console.error(
        'Erreur lors de la suppression Firestore :',
        error
      );

      showMessage(
        'error',
        'Erreur lors de la suppression.'
      );

    } finally {

      setIsActionLoading(false);

    }

  };

  /* ============================================================
   * CHARGER UNE ARCHIVE
   * ============================================================ */

  const handleLoadArchive = (
    archive: ArchiveItem
  ) => {

    if (
      !archive ||
      !Array.isArray(archive.rows)
    ) {

      showMessage(
        'error',
        'Cette archive ne contient aucune donnée.'
      );

      return;
    }

    setRows(
      archive.rows
    );

    setSelectedTrimester(
      archive.trimester
    );

    setShowArchives(false);

    setEditingId(null);

    setSelectedClass('');

    setDisciplineInput(
      effectiveUser?.subject || ''
    );

    setTeacherInput(
      effectiveUser?.name || ''
    );

    setAnnualPlannedInput('');
    setTrimesterPlannedInput('');
    setAnnualRealizedInput('');
    setTrimesterRealizedInput('');

    setIncrementalValue(1);

    showMessage(
      'success',
      `Archive du Trimestre ${archive.trimester} chargée avec succès.`
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  };

  /* ============================================================
   * SUPPRIMER UNE ARCHIVE
   * ============================================================ */

  const handleDeleteArchive = async (
    id: string
  ) => {

    if (
      !window.confirm(
        'Supprimer définitivement cette archive ?'
      )
    ) {
      return;
    }

    try {

      await deleteDoc(
        doc(
          db,
          'programCoverageArchives',
          id
        )
      );

      showMessage(
        'success',
        'Archive supprimée.'
      );

    } catch (error) {

      console.error(
        'Erreur suppression archive :',
        error
      );

      showMessage(
        'error',
        'Impossible de supprimer l’archive.'
      );

    }

  };

  /* ============================================================
   * COULEUR DES TAUX
   * ============================================================ */

  const getRateColor = (
    rate: number
  ) => {

    if (rate >= 90) {
      return 'text-emerald-600 bg-emerald-100';
    }

    if (rate >= 70) {
      return 'text-amber-600 bg-amber-100';
    }

    return 'text-red-600 bg-red-100';

  };

  /* ============================================================
   * RENDU
   * ============================================================ */

  return (

    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">

      <div className="max-w-7xl mx-auto space-y-6">

        {/* ======================================================
         * EN-TÊTE
         * ====================================================== */}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4">

          <div className="flex items-center gap-3">

            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
              <BookOpen size={28} />
            </div>

            <div>

              <h1 className="text-2xl font-bold text-slate-900">
                Couverture des Programmes d'Enseignement
              </h1>

              <p className="text-sm text-slate-500 mt-0.5">
                Suivi et avancement des programmes en temps réel
              </p>

            </div>

          </div>

          <div className="flex flex-wrap items-center gap-3">

            {isLoadingFirestore && (

              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full animate-pulse">

                <RefreshCw
                  size={14}
                  className="animate-spin"
                />

                Synchronisation...

              </span>

            )}

            <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 border border-slate-200">

              Trimestre :

              <span className="text-amber-600 ml-1">
                {selectedTrimester}
                {selectedTrimester === 1
                  ? 'er'
                  : 'e'}{' '}
                Tr.
              </span>

            </div>

            <div className="bg-amber-50 px-4 py-2 rounded-lg text-sm font-semibold text-amber-900 border border-amber-200 flex items-center gap-2">

              <Calendar
                size={16}
                className="text-amber-600"
              />

              <span>
                Année :{' '}
                <strong>
                  {activeAcademicYear}
                </strong>
              </span>

            </div>

          </div>

        </div>

        {/* ======================================================
         * CARTES STATISTIQUES
         * ====================================================== */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 border-l-blue-500">

            <div className="text-sm font-medium text-slate-500">
              Classes suivies
            </div>

            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {stats.total}
            </div>

          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">

            <div className="text-sm font-medium text-slate-500">
              Taux global Annuel
            </div>

            <div className="text-3xl font-extrabold text-emerald-600 mt-1">
              {stats.avgAnn.toFixed(1)}%
            </div>

          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 border-l-indigo-500">

            <div className="text-sm font-medium text-slate-500">
              Taux global Trimestriel
            </div>

            <div className="text-3xl font-extrabold text-indigo-600 mt-1">
              {stats.avgTrim.toFixed(1)}%
            </div>

          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 border-l-purple-500">

            <div className="text-sm font-medium text-slate-500">
              Diagnostic IA
            </div>

            <button
              type="button"
              onClick={() =>
                setShowAIModal(true)
              }
              className="mt-2 w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-purple-200"
            >

              <Sparkles size={16} />

              Voir le rapport IA

            </button>

          </div>

        </div>

        {/* ======================================================
         * TRIMESTRE + ARCHIVES
         * ====================================================== */}

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap justify-between items-center gap-4">

          <div className="flex items-center gap-3">

            <label
              htmlFor="program-trimester-select"
              className="font-semibold text-sm text-slate-700"
            >
              Période d'évaluation :
            </label>

            <select
              id="program-trimester-select"
              value={selectedTrimester}
              onChange={event =>
                setSelectedTrimester(
                  Number(
                    event.target.value
                  ) as Trimester
                )
              }
              className="border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 font-semibold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
            >

              {TRIMESTERS.map(
                (_, index) => {

                  const value =
                    (index + 1) as Trimester;

                  return (

                    <option
                      key={value}
                      value={value}
                    >
                      Trimestre {value}
                    </option>

                  );

                }
              )}

            </select>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <button
              type="button"
              onClick={handleArchive}
              disabled={
                rows.length === 0 ||
                isActionLoading
              }
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >

              <FolderOpen size={16} />

              Archiver le trimestre

            </button>

            <button
              type="button"
              onClick={() =>
                setShowArchives(
                  previous => !previous
                )
              }
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 border border-slate-300 cursor-pointer"
            >

              <FolderOpen
                size={16}
                className="text-amber-600"
              />

              Archives ({archives.length})

            </button>

          </div>

        </div>

        {/* ======================================================
         * MESSAGE
         * ====================================================== */}

        {message.type && (

          <div
            className={`p-4 rounded-xl border flex items-center gap-3 shadow-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >

            {message.type === 'success'
              ? (
                <CheckCircle
                  size={20}
                  className="text-emerald-600 shrink-0"
                />
              )
              : (
                <AlertCircle
                  size={20}
                  className="text-rose-600 shrink-0"
                />
              )}

            <span className="font-medium text-sm">
              {message.text}
            </span>

          </div>

        )}

        {/* ======================================================
         * FORMULAIRE
         * ====================================================== */}

        <div>

          {!showAddClassForm && (

            <button
              type="button"
              onClick={() => {

                resetForm();

                setShowAddClassForm(
                  true
                );

              }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition cursor-pointer shadow-sm"
            >

              <span className="text-xl">
                ＋
              </span>

              Ajouter une classe au suivi des programmes

            </button>

          )}

          {showAddClassForm && (

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 mt-4">

              <div className="flex items-center justify-between border-b pb-3">

                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">

                  {editingId
                    ? (
                      <Pencil
                        size={18}
                        className="text-amber-600"
                      />
                    )
                    : (
                      <Plus
                        size={18}
                        className="text-emerald-600"
                      />
                    )}

                  {editingId
                    ? 'Modifier la couverture des programmes'
                    : 'Ajouter une classe au suivi des programmes'}

                </h2>

                <button
                  type="button"
                  onClick={() => {

                    resetForm();

                    setShowAddClassForm(
                      false
                    );

                  }}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >

                  <X size={20} />

                </button>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* CLASSE */}

                <div>

                  <label
                    htmlFor="program-coverage-class"
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    Classe *
                  </label>

                  <select
                    id="program-coverage-class"
                    value={selectedClass}
                    onChange={e =>
                      setSelectedClass(
                        e.target.value
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >

                    <option value="">
                      Sélectionner une classe
                    </option>

                    {finalClassesList.map(
                      className => (

                        <option
                          key={className}
                          value={className}
                        >
                          {className}
                        </option>

                      )
                    )}

                  </select>

                </div>

                {/* DISCIPLINE */}

                <div>

                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Discipline *
                  </label>

                  <input
                    type="text"
                    value={disciplineInput}
                    onChange={event =>
                      setDisciplineInput(
                        event.target.value
                      )
                    }
                    placeholder="Discipline"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-50"
                  />

                </div>

                {/* ENSEIGNANT */}

                <div>

                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Enseignant
                  </label>

                  <input
                    type="text"
                    value={teacherInput}
                    onChange={event =>
                      setTeacherInput(
                        event.target.value
                      )
                    }
                    placeholder="Nom de l'enseignant"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-50"
                  />

                </div>

                {/* PRÉVUS ANNUEL */}

                <div>

                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Programmes prévus Annuel
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={annualPlannedInput}
                    onChange={event =>
                      setAnnualPlannedInput(
                        event.target.value === ''
                          ? ''
                          : numberValue(
                              event.target.value
                            )
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />

                </div>

                {/* PRÉVUS TRIMESTRE */}

                <div>

                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Programmes prévus Trimestre
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={trimesterPlannedInput}
                    onChange={event =>
                      setTrimesterPlannedInput(
                        event.target.value === ''
                          ? ''
                          : numberValue(
                              event.target.value
                            )
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />

                </div>

                {/* RÉALISÉS ANNUEL */}

                <div>

                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Programmes réalisés Annuel
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={annualRealizedInput}
                    onChange={event =>
                      setAnnualRealizedInput(
                        event.target.value === ''
                          ? ''
                          : numberValue(
                              event.target.value
                            )
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />

                </div>

                {/* RÉALISÉS TRIMESTRE */}

                <div>

                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Programmes réalisés Trimestre
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={trimesterRealizedInput}
                    onChange={event =>
                      setTrimesterRealizedInput(
                        event.target.value === ''
                          ? ''
                          : numberValue(
                              event.target.value
                            )
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />

                </div>

                {/* BOUTON */}

                <div className="flex items-end gap-2">

                  <button
                    type="button"
                    onClick={
                      handleAddOrUpdate
                    }
                    disabled={
                      isActionLoading ||
                      isSaving
                    }
                    className={`w-full py-2 px-4 rounded-lg font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      editingId
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    } disabled:opacity-50`}
                  >

                    {isActionLoading
                      ? (
                        <>
                          <RefreshCw
                            size={17}
                            className="animate-spin"
                          />

                          Enregistrement...

                        </>
                      )
                      : (
                        <>
                          {editingId
                            ? (
                              <CheckCircle
                                size={17}
                              />
                            )
                            : (
                              <Plus
                                size={17}
                              />
                            )}

                          {editingId
                            ? 'Mettre à jour'
                            : 'Enregistrer'}

                        </>
                      )}

                  </button>

                  <button
                    type="button"
                    onClick={() => {

                      resetForm();

                      setShowAddClassForm(
                        false
                      );

                    }}
                    className="p-2 border border-slate-300 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                    title="Annuler"
                  >

                    <X size={20} />

                  </button>

                </div>

              </div>

            </div>

          )}

        </div>

        {/* ======================================================
         * TABLEAU
         * ====================================================== */}

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden space-y-4 p-4">

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b pb-3">

            <h2 className="text-base font-bold text-slate-800">
              Suivi et avancement des programmes par classe
            </h2>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">

              <BookOpen
                size={15}
                className="text-amber-600"
              />

              <span>
                Ajout rapide après séance :
              </span>

              <select
                value={incrementalValue}
                onChange={e =>
                  setIncrementalValue(
                    Number(
                      e.target.value
                    )
                  )
                }
                className="border border-slate-300 rounded px-2 py-1 bg-white font-bold text-amber-700 focus:outline-none cursor-pointer"
              >

                <option value={1}>
                  +1 programme
                </option>

                <option value={2}>
                  +2 programmes
                </option>

                <option value={3}>
                  +3 programmes
                </option>

                <option value={4}>
                  +4 programmes
                </option>

              </select>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full border-collapse text-sm text-left">

              <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-bold border-b border-slate-200">

                <tr>

                  <th className="px-4 py-3 text-center">
                    Classe
                  </th>

                  <th className="px-4 py-3 text-center">
                    Discipline
                  </th>

                  <th className="px-4 py-3 text-center">
                    Enseignant
                  </th>

                  <th className="px-4 py-3 text-center">
                    Prévus An
                  </th>

                  <th className="px-4 py-3 text-center">
                    Prévus Trim
                  </th>

                  <th className="px-4 py-3 text-center">
                    Réalisés An
                  </th>

                  <th className="px-4 py-3 text-center">
                    Réalisés Trim
                  </th>

                  <th className="px-4 py-3 text-center">
                    Taux An (%)
                  </th>

                  <th className="px-4 py-3 text-center">
                    Taux Trim (%)
                  </th>

                  <th className="px-4 py-3 text-center">
                    Progression
                  </th>

                  <th className="px-4 py-3 text-center">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-200">

                {rows.length === 0
                  ? (

                    <tr>

                      <td
                        colSpan={11}
                        className="px-4 py-10 text-center text-slate-400 italic"
                      >
                        Aucune donnée de couverture des programmes enregistrée pour ce trimestre.
                      </td>

                    </tr>

                  )
                  : (

                    rows.map(row => (

                      <tr
                        key={row.id}
                        className="hover:bg-slate-50 transition-colors"
                      >

                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {row.className}
                        </td>

                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.discipline}
                        </td>

                        <td className="px-4 py-3 text-center text-slate-600">
                          {row.teacherName}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {row.plannedLessonsAnnual}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {row.plannedLessonsTrimester}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {row.completedLessonsAnnual}
                        </td>

                        <td className="px-4 py-3 text-center font-bold text-amber-700">
                          {row.completedLessonsTrimester}
                        </td>

                        <td className="px-4 py-3 text-center font-semibold">

                          <span
                            className={`px-2 py-1 rounded-full text-xs font-bold ${getRateColor(
                              row.completionRate
                            )}`}
                          >
                            {row.completionRate}%
                          </span>

                        </td>

                        <td className="px-4 py-3 text-center font-semibold">

                          <span
                            className={`px-2 py-1 rounded-full text-xs font-bold ${getRateColor(
                              calculateRate(row.completedLessonsTrimester, row.plannedLessonsTrimester)
                            )}`}
                          >
                            {calculateRate(row.completedLessonsTrimester, row.plannedLessonsTrimester)}%
                          </span>

                        </td>

                        {/* PROGRESSION RAPIDE */}

                        <td className="px-4 py-3 text-center">

                          <button
                            type="button"
                            onClick={() =>
                              handleQuickAddSession(
                                row.id,
                                incrementalValue
                              )
                            }
                            disabled={
                              isActionLoading
                            }
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer disabled:opacity-50"
                            title="Ajouter la progression réalisée"
                          >

                            <Plus size={14} />

                            +{incrementalValue}

                          </button>

                        </td>

                        {/* ACTIONS */}

                        <td className="px-4 py-3 text-center">

                          <div className="flex justify-center gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                handleEdit(row)
                              }
                              title="Modifier"
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                            >

                              <Pencil size={16} />

                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  row.id
                                )
                              }
                              title="Supprimer"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                            >

                              <Trash2 size={16} />

                            </button>

                          </div>

                        </td>

                      </tr>

                    ))

                  )}

              </tbody>

            </table>

          </div>

        </div>

        {/* ======================================================
         * ARCHIVES
         * ====================================================== */}

        {showArchives && (

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">

            <div className="flex items-center justify-between border-b pb-3">

              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">

                <FolderOpen
                  size={20}
                  className="text-amber-600"
                />

                Archives des programmes

              </h2>

              <button
                type="button"
                onClick={() =>
                  setShowArchives(false)
                }
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >

                <X size={20} />

              </button>

            </div>

            {archives.length === 0
              ? (

                <p className="text-center text-slate-500 italic py-6">
                  Aucune archive disponible.
                </p>

              )
              : (

                <div className="overflow-x-auto">

                  <table className="w-full border-collapse text-sm">

                    <thead>

                      <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase">

                        <th className="border p-2 text-center">
                          Trimestre
                        </th>

                        <th className="border p-2 text-center">
                          Date
                        </th>

                        <th className="border p-2 text-center">
                          Classes
                        </th>

                        <th className="border p-2 text-center">
                          Actions
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {archives.map(
                        archive => (

                          <tr
                            key={archive.id}
                            className="hover:bg-slate-50"
                          >

                            <td className="border p-2 text-center font-semibold">
                              Trimestre{' '}
                              {archive.trimester}
                            </td>

                            <td className="border p-2 text-center">
                              {archive.date}
                            </td>

                            <td className="border p-2 text-center">
                              {archive.rows.length}
                            </td>

                            <td className="border p-2 text-center">

                              <div className="flex justify-center gap-2">

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleLoadArchive(
                                      archive
                                    )
                                  }
                                  className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded font-semibold text-xs border border-amber-200 cursor-pointer"
                                >
                                  Consulter
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteArchive(
                                      archive.id
                                    )
                                  }
                                  className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer"
                                  title="Supprimer l'archive"
                                >

                                  <Trash2
                                    size={15}
                                  />

                                </button>

                              </div>

                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              )}

          </div>

        )}

        {/* ======================================================
         * MODAL DIAGNOSTIC IA
         * ====================================================== */}

        {showAIModal && (

          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">

            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">

              <div className="flex items-center justify-between border-b pb-3">

                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">

                  <Sparkles
                    className="text-purple-600"
                    size={20}
                  />

                  Diagnostic Pédagogique IA

                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setShowAIModal(false)
                  }
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >

                  <X size={20} />

                </button>

              </div>

              <div className="space-y-3 text-xs text-slate-700">

                <p>
                  <strong>
                    Diagnostic :
                  </strong>{' '}
                  {aiAnalysis.diagnostic}
                </p>

                <p>
                  <strong>
                    Forces :
                  </strong>{' '}
                  {aiAnalysis.forces}
                </p>

                <p>
                  <strong>
                    Faiblesses :
                  </strong>{' '}
                  {aiAnalysis.faiblesses}
                </p>

                <p className="bg-purple-50 border border-purple-200 p-3 rounded-lg font-bold text-purple-900">

                  <strong>
                    Recommandations :
                  </strong>{' '}

                  {aiAnalysis.recommandations}

                </p>

                <p className="bg-slate-50 border border-slate-200 p-3 rounded-lg">

                  <strong>
                    Priorités :
                  </strong>{' '}

                  {aiAnalysis.planAction}

                </p>

                <div className="grid grid-cols-2 gap-3">

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">

                    <div className="text-xs text-slate-500">
                      Meilleure classe
                    </div>

                    <div className="font-bold text-emerald-700">
                      {aiAnalysis.best}
                    </div>

                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">

                    <div className="text-xs text-slate-500">
                      Classe à surveiller
                    </div>

                    <div className="font-bold text-red-700">
                      {aiAnalysis.worst}
                    </div>

                  </div>

                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAIModal(false)
                }
                className="w-full mt-2 p-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Fermer
              </button>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}