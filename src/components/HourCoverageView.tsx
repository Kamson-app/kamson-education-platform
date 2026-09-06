/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/* ============================================================
 * COUVERTURE DES HEURES D'ENSEIGNEMENT (FIRESTORE REALTIME)
 * ============================================================ */

import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  FileSpreadsheet,
  FileBarChart2,
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
  addDoc,
  getDoc
} from 'firebase/firestore';

import { db } from '../firebaseConfig';
import { useUser } from '../context/UserContext';
import { useDepartment } from '../hooks/useDepartment';

import type {
  HourCoverage,
  UserProfile,
  EstablishmentSettings,
  Trimester,
} from '../types';

import { TRIMESTERS } from '../constants/defaults';
import { generateHourCoveragePDF, exportHourCoverageExcel } from '../utils/hourCoverageExport';

const sanitizeFirestoreId = (value: string): string =>
  String(value ?? "")
    .trim()
    .replace(/[\/\\]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9À-ÿ._-]/g, "_");

const buildHourCoverageId = (
  academicYear: string,
  className: string,
  subject: string,
  teacherId?: string
): string => {
  return [
    "hc_default",
    sanitizeFirestoreId(academicYear),
    sanitizeFirestoreId(className),
    sanitizeFirestoreId(subject),
    sanitizeFirestoreId(teacherId || "default")
  ].join("_");
};

/* ============================================================
 * TYPES
 * ============================================================ */

interface HourCoverageViewProps {
  currentUser?: UserProfile | null;
  teacherId?: string;
  teacherName?: string;
  isAnimator?: boolean;
  establishment?: EstablishmentSettings | null;
  academicYear?: string;
  establishmentSettings?: EstablishmentSettings | null;
  establishmentId?: string;
  departmentId?: string;
  classes?: string[];
  allHourCoverages?: HourCoverage[];
  onSaveHourCoverages?: (coverages: HourCoverage[]) => Promise<void>;
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
  plannedHoursAnnual: number | string;
  plannedHoursTrimester: number | string;
  realizedHoursAnnual: number | string;
  realizedHoursTrimester: number | string;
  annualCoverageRate: number;
  trimesterCoverageRate: number;
  source?: HourCoverage;
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
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

const calculateRate = (realized: number, planned: number): number => {
  if (planned <= 0) return 0;
  return Number(Math.min(100, (realized / planned) * 100).toFixed(1));
};

/* ============================================================
 * COMPOSANT PRINCIPAL
 * ============================================================ */

export default function HourCoverageView({
  currentUser,
  teacherId,
  teacherName,
  isAnimator = false,
  establishment,
  academicYear,
  establishmentSettings,
  establishmentId,
  departmentId,
  classes = [],
  isSaving = false,
}: HourCoverageViewProps) {
  const activeEstablishment = establishmentSettings || establishment;
  const { profile } = useUser();
  const effectiveUser = currentUser || profile;

  const resolvedEstablishmentId =
    establishmentId ||
    activeEstablishment?.id ||
    effectiveUser?.establishmentId ||
    profile?.establishmentId ||
    '';

  const { settings: departmentSettings } = useDepartment();
  
  const resolvedDepartmentId =
    departmentId ||
    (departmentSettings as { departmentId?: string } | null)
      ?.departmentId ||
    effectiveUser?.departmentId ||
    profile?.departmentId ||
    '';

  const activeAcademicYear =
    academicYear ||
    departmentSettings?.academicYear ||
    activeEstablishment?.academicYear ||
    "";
  
  /* ============================================================
   * ÉTATS LOCAUX
   * ============================================================ */
  const [selectedTrimester, setSelectedTrimester] = useState<Trimester>(1);
  const [localCoverages, setLocalCoverages] = useState<HourCoverage[]>([]);
  const [rows, setRows] = useState<CoverageRow[]>([]);
  
  const [selectedClass, setSelectedClass] = useState('');
  const [disciplineInput, setDisciplineInput] = useState(effectiveUser?.subject || '');
  const [teacherInput, setTeacherInput] = useState(teacherName || effectiveUser?.name || '');
  
  const [plannedHoursAnnualInput, setPlannedHoursAnnualInput] = useState<number | string>('');
  const [plannedHoursTrimesterInput, setPlannedHoursTrimesterInput] = useState<number | string>('');
  const [realizedHoursAnnualInput, setRealizedHoursAnnualInput] = useState<number | string>('');
  const [realizedHoursTrimesterInput, setRealizedHoursTrimesterInput] = useState<number | string>('');

  const [incrementalValue, setIncrementalValue] = useState<number>(1);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showAddClassForm, setShowAddClassForm] = useState(false);

  const [message, setMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({
    type: null,
    text: '',
  });

  const finalClassesList = useMemo(() => {
    if (classes && classes.length > 0) {
      return classes;
    }
    return effectiveUser?.classes || profile?.classes || [];
  }, [classes, effectiveUser?.classes, profile?.classes]);

  /* ============================================================
   * SYNCHRONISATION TEMPS RÉEL FIRESTORE (onSnapshot)
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

    const q = isAnimator 
      ? query(
          collection(db, 'hourCoverages'),
          where('establishmentId', '==', resolvedEstablishmentId),
          where('departmentId', '==', resolvedDepartmentId || effectiveUser?.departmentId || ''),
          where('trimester', '==', selectedTrimester),
          where('academicYear', '==', activeAcademicYear)
        )
      : query(
          collection(db, 'hourCoverages'),
          where('establishmentId', '==', resolvedEstablishmentId),
          where('discipline', '==', effectiveUser.subject),
          where('trimester', '==', selectedTrimester),
          where('academicYear', '==', activeAcademicYear)
        );

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const data = snapshot.docs.map(
          document => ({
            id: document.id,
            ...document.data()
          } as HourCoverage)
        );
        setLocalCoverages(data);
        setIsLoadingFirestore(false);
      },
      error => {
        console.error('Erreur synchronisation Firestore :', error);
        setIsLoadingFirestore(false);
      }
    );

    return () => unsubscribe();
  }, [
    resolvedEstablishmentId,
    resolvedDepartmentId,
    isAnimator,
    effectiveUser?.subject,
    effectiveUser?.departmentId,
    activeAcademicYear,
    selectedTrimester
  ]);

  /* ============================================================
   * CHARGEMENT DES ARCHIVES DEPUIS FIRESTORE (TEMPS RÉEL)
   * ============================================================ */
  useEffect(() => {
    if (!resolvedEstablishmentId || !activeAcademicYear) {
      return;
    }

    const q = query(
      collection(db, 'hourCoverageArchives'),
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
        const data: ArchiveItem[] = snapshot.docs.map(
          document => {
            const value = document.data();

            return {
              id: document.id,
              date: value.date || '',
              trimester: value.trimester,
              rows: Array.isArray(value.rows)
                ? value.rows
                : []
            };
          }
        );

        setArchives(data);
      },
      error => {
        console.error(
          'Erreur chargement archives :',
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
   * CONVERSION DES DONNÉES FIRESTORE EN LIGNES DU TABLEAU
   * ============================================================ */
  useEffect(() => {
    const mappedRows: CoverageRow[] = localCoverages.map((coverage, index) => {
      const plannedHoursAnnual = numberValue(coverage.plannedHoursAnnual);
      const plannedHoursTrimester = numberValue(coverage.plannedHoursTrimester);
      const realizedHoursAnnual = numberValue(coverage.realizedHoursAnnual);
      const realizedHoursTrimester = numberValue(coverage.realizedHoursTrimester);

      return {
        id: coverage.id || `hour-${index}`,
        className: coverage.className || '',
        discipline: coverage.discipline || '',
        subject: coverage.subject || coverage.discipline || '',
        teacherId: coverage.teacherId || '',
        teacherName: coverage.teacherName || '',
        userId: coverage.userId || '',
        plannedHoursAnnual,
        plannedHoursTrimester,
        realizedHoursAnnual,
        realizedHoursTrimester,
        annualCoverageRate: calculateRate(realizedHoursAnnual, plannedHoursAnnual),
        trimesterCoverageRate: calculateRate(realizedHoursTrimester, plannedHoursTrimester),
        source: coverage,
      };
    });

    setRows(mappedRows);
  }, [localCoverages]);

  /* ============================================================
   * STATISTIQUES ET ANALYSE IA
   * ============================================================ */
  const stats = useMemo(() => {
    const total = rows.length;
    const excellent = rows.filter(c => c.annualCoverageRate >= 90);
    const monitor = rows.filter(c => c.annualCoverageRate >= 70 && c.annualCoverageRate < 90);
    const critical = rows.filter(c => c.annualCoverageRate < 70);
    const avgAnn = total > 0 ? rows.reduce((s, c) => s + c.annualCoverageRate, 0) / total : 0;
    const avgTrim = total > 0 ? rows.reduce((s, c) => s + c.trimesterCoverageRate, 0) / total : 0;
    const best = total > 0 ? [...rows].reduce((p, c) => (c.annualCoverageRate > p.annualCoverageRate ? c : p)) : null;
    const worst = total > 0 ? [...rows].reduce((p, c) => (c.annualCoverageRate < p.annualCoverageRate ? c : p)) : null;
    return { total, excellent: excellent.length, monitor: monitor.length, critical: critical.length, avgAnn, avgTrim, best, worst };
  }, [rows]);

  const aiAnalysis = useMemo(() => {
    return {
      diagnostic: `La couverture horaire annuelle moyenne est de ${stats.avgAnn.toFixed(1)}%.`,
      forces: stats.excellent > 0 ? `Plusieurs classes (${stats.excellent}) présentent une excellente couverture des heures.` : "La progression horaire est stable.",
      faiblesses: stats.critical > 0 ? `Attention, ${stats.critical} classe(s) sont en zone critique pour les heures.` : "Aucun retard horaire majeur.",
      recommandations: "Réorganiser le calendrier et renforcer le suivi des séances pour combler les heures manquées.",
      planAction: "Priorité : Validation des cahiers de textes et programmation de séances de rattrapage.",
      best: stats.best?.className || 'N/A',
      worst: stats.worst?.className || 'N/A'
    };
  }, [stats]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => {
      setMessage({ type: null, text: '' });
    }, 3500);
  };

  const resetForm = () => {
    setSelectedClass('');
    setDisciplineInput(effectiveUser?.subject || '');
    setTeacherInput(teacherName || effectiveUser?.name || '');
    setPlannedHoursAnnualInput('');
    setPlannedHoursTrimesterInput('');
    setRealizedHoursAnnualInput('');
    setRealizedHoursTrimesterInput('');
    setIncrementalValue(1);
    setEditingId(null);
  };

  /* ============================================================
   * AJOUT / MISE À JOUR DIRECTE DANS FIRESTORE
   * ============================================================ */
  const handleAddOrUpdate = async () => {
    if (!selectedClass.trim()) {
      showMessage('error', 'Veuillez sélectionner la classe.');
      return;
    }
    if (!disciplineInput.trim()) {
      showMessage('error', 'Veuillez renseigner la discipline.');
      return;
    }
    if (
      !resolvedEstablishmentId ||
      !activeAcademicYear ||
      !(teacherId || effectiveUser?.id)
    ) {
      showMessage(
        'error',
        'Paramètres d’établissement, année scolaire ou utilisateur manquants.'
      );
      return;
    }

    if (isAnimator && !resolvedDepartmentId) {
      showMessage(
        'error',
        'Le département de l’animateur pédagogique est introuvable.'
      );
      return;
    }

    const pAn = numberValue(plannedHoursAnnualInput);
    const pTri = numberValue(plannedHoursTrimesterInput);
    const rAn = numberValue(realizedHoursAnnualInput);
    const rTri = numberValue(realizedHoursTrimesterInput);

    if (pTri > pAn) {
      showMessage('error', 'Les heures prévues trimestriellement ne peuvent pas dépasser les heures prévues annuellement.');
      return;
    }
    if (rAn > pAn) {
      showMessage('error', 'Les heures réalisées annuellement ne peuvent pas dépasser les heures prévues annuellement.');
      return;
    }
    if (rTri > pTri) {
      showMessage('error', 'Les heures réalisées trimestriellement ne peuvent pas dépasser les heures prévues trimestriellement.');
      return;
    }

    setIsActionLoading(true);

    try {
      const resolvedTeacherId = teacherId || effectiveUser?.id || '';
      const resolvedTName = teacherInput.trim() || teacherName || effectiveUser?.name || '';
      
      const deterministicId =
        editingId ||
        buildHourCoverageId(
          activeAcademicYear,
          selectedClass.trim(),
          disciplineInput.trim(),
          resolvedTeacherId
        );

      const existingDocRef = doc(db, 'hourCoverages', deterministicId);
      const existingDocSnap = await getDoc(existingDocRef);
      const existingData = existingDocSnap.exists() ? existingDocSnap.data() : null;

      const sheetDataBase = {
        establishmentId: resolvedEstablishmentId,
        departmentId: resolvedDepartmentId,
        academicYear: activeAcademicYear,
        className: selectedClass.trim(),
        discipline: disciplineInput.trim(),
        subject: disciplineInput.trim(),
        teacherId: resolvedTeacherId,
        teacherName: resolvedTName,
        userId: resolvedTeacherId,
        trimester: selectedTrimester,
        plannedHoursAnnual: pAn,
        plannedHoursTrimester: pTri,
        realizedHoursAnnual: rAn,
        realizedHoursTrimester: rTri,
        annualCoverageRate:
          pAn > 0
            ? Number(((rAn / pAn) * 100).toFixed(1))
            : 0,
        trimesterCoverageRate:
          pTri > 0
            ? Number(((rTri / pTri) * 100).toFixed(1))
            : 0,
        createdAt: existingData?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        existingDocRef,
        sheetDataBase,
        { merge: true }
      );

      try {
       await addDoc(collection(db, 'hourCoverageHistory'), {
          establishmentId: resolvedEstablishmentId,
          departmentId: resolvedDepartmentId,
          academicYear: activeAcademicYear,
          trimester: selectedTrimester,
          teacherId: resolvedTeacherId,
          teacherName: resolvedTName,
          userId: resolvedTeacherId,
          discipline: disciplineInput.trim(),
          className: selectedClass.trim(),
          plannedHoursAnnual: pAn,
          plannedHoursTrimester: pTri,
          realizedHoursAnnual: rAn,
          realizedHoursTrimester: rTri,
          annualCoverageRate:
            pAn > 0
              ? Number(((rAn / pAn) * 100).toFixed(1))
              : 0,
          trimesterCoverageRate:
            pTri > 0
              ? Number(((rTri / pTri) * 100).toFixed(1))
              : 0,
          savedAt: serverTimestamp()
        });
      } catch (historyError) {
        console.warn(
          "La couverture est enregistrée, mais l'historique n'a pas pu être enregistré :",
          historyError
        );
      }

      showMessage('success', editingId ? 'La couverture horaire a été mise à jour avec succès.' : 'La classe a été enregistrée avec succès.');
      resetForm();
      setShowAddClassForm(false);
    } catch (error) {
      console.error('Erreur lors de l’enregistrement Firestore :', error);
      showMessage('error', 'Une erreur est survenue lors de l’enregistrement.');
    } finally {
      setIsActionLoading(false);
    }
  };

  /* ============================================================
   * ARCHIVER LE TRIMESTRE COURANT DANS FIRESTORE
   * ============================================================ */
  const handleArchive = async () => {
    if (!resolvedEstablishmentId || rows.length === 0) {
      showMessage('error', 'Aucune donnée à archiver.');
      return;
    }

    const resolvedTId = teacherId || effectiveUser?.id;
    if (!resolvedTId) {
      showMessage('error', 'Utilisateur non identifié.');
      return;
    }

    setIsActionLoading(true);

    try {
      const archiveId = [
        "ha",
        sanitizeFirestoreId(resolvedEstablishmentId),
        sanitizeFirestoreId(activeAcademicYear),
        String(selectedTrimester),
        sanitizeFirestoreId(resolvedTId)
      ].join("_");

      const archiveData = {
        establishmentId: resolvedEstablishmentId,
        departmentId: resolvedDepartmentId,
        academicYear: activeAcademicYear,
        trimester: selectedTrimester,
        teacherId: resolvedTId,
        teacherName: teacherName || effectiveUser?.name || teacherInput || '',
        userId: resolvedTId,
        discipline: effectiveUser?.subject || disciplineInput || '',
        date: new Date().toLocaleDateString('fr-FR'),

        rows: rows.map(row => ({
          id: row.id,
          className: row.className,
          discipline: row.discipline,
          subject: row.subject,
          teacherId: row.teacherId,
          teacherName: row.teacherName,
          userId: row.userId,
          plannedHoursAnnual: row.plannedHoursAnnual,
          plannedHoursTrimester: row.plannedHoursTrimester,
          realizedHoursAnnual: row.realizedHoursAnnual,
          realizedHoursTrimester: row.realizedHoursTrimester,
          annualCoverageRate: row.annualCoverageRate,
          trimesterCoverageRate: row.trimesterCoverageRate,
        })),

        archivedAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, 'hourCoverageArchives', archiveId),
        archiveData,
        { merge: true }
      );

      showMessage(
        'success',
        `Le Trimestre ${selectedTrimester} a été archivé avec succès.`
      );

    } catch (error) {
      console.error('Erreur archivage Firestore :', error);
      showMessage(
        'error',
        "Impossible d'archiver le suivi."
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  /* ============================================================
   * INCREMENTATION RAPIDE DES HEURES RÉALISÉES
   * ============================================================ */
  const handleQuickAddSessionHours = async (rowId: string, addValue: number) => {
    const row = rows.find(r => r.id === rowId);
    const resolvedTId = teacherId || effectiveUser?.id;
    if (!row || !resolvedTId) return;

    const newTrimesterRealized = numberValue(row.realizedHoursTrimester) + addValue;
    const newAnnualRealized = numberValue(row.realizedHoursAnnual) + addValue;

    if (newTrimesterRealized > numberValue(row.plannedHoursTrimester)) {
      showMessage('error', 'Les heures réalisées ne peuvent pas dépasser les heures prévues pour le trimestre.');
      return;
    }

    setIsActionLoading(true);
    try {
      const deterministicId = row.id.includes('hc_')
        ? row.id
        : buildHourCoverageId(
            activeAcademicYear,
            row.className,
            row.discipline,
            resolvedTId
          );

      const pAn = numberValue(row.plannedHoursAnnual);
      const pTri = numberValue(row.plannedHoursTrimester);

      const existingDocRef = doc(db, 'hourCoverages', deterministicId);
      const existingDocSnap = await getDoc(existingDocRef);
      const existingData = existingDocSnap.exists() ? existingDocSnap.data() : null;

      const sheetDataBase = {
        establishmentId: resolvedEstablishmentId,
        departmentId: resolvedDepartmentId,
        academicYear: activeAcademicYear,
        trimester: selectedTrimester,
        className: row.className,
        discipline: row.discipline,
        subject: row.subject || row.discipline,
        teacherId: row.teacherId || resolvedTId,
        teacherName: row.teacherName || teacherName || effectiveUser?.name || '',
        userId: row.userId || resolvedTId,
        plannedHoursAnnual: pAn,
        plannedHoursTrimester: pTri,
        realizedHoursAnnual: newAnnualRealized,
        realizedHoursTrimester: newTrimesterRealized,
        annualCoverageRate: calculateRate(newAnnualRealized, pAn),
        trimesterCoverageRate: calculateRate(newTrimesterRealized, pTri),
        createdAt: existingData?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(existingDocRef, sheetDataBase, { merge: true });
      showMessage('success', `+${addValue} heure(s) ajoutée(s) pour la classe ${row.className}.`);
    } catch (error) {
      console.error('Erreur incrémentation séance :', error);
      showMessage('error', 'Erreur lors de l’ajout de la séance.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEdit = (row: CoverageRow) => {
    setEditingId(row.id);
    setSelectedClass(row.className);
    setDisciplineInput(row.discipline);
    setTeacherInput(row.teacherName);
    setPlannedHoursAnnualInput(row.plannedHoursAnnual);
    setPlannedHoursTrimesterInput(row.plannedHoursTrimester);
    setRealizedHoursAnnualInput(row.realizedHoursAnnual);
    setRealizedHoursTrimesterInput(row.realizedHoursTrimester);
    setShowAddClassForm(true);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    const row = rows.find(item => item.id === id);
    if (!row) return;

    const confirmed = window.confirm(`Voulez-vous supprimer définitivement le suivi horaire de la classe « ${row.className} » ?`);
    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      await deleteDoc(doc(db, 'hourCoverages', id));
      if (editingId === id) resetForm();
      showMessage('success', 'La ligne a été supprimée avec succès.');
    } catch (error) {
      console.error('Erreur lors de la suppression Firestore :', error);
      showMessage('error', 'Erreur lors de la suppression.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLoadArchive = (archive: ArchiveItem) => {
    if (!archive || !Array.isArray(archive.rows)) {
      showMessage('error', 'Cette archive ne contient aucune donnée.');
      return;
    }

    setRows(archive.rows);
    setSelectedTrimester(archive.trimester);
    setShowArchives(false);
    setEditingId(null);
    setSelectedClass('');
    setDisciplineInput(effectiveUser?.subject || '');
    setTeacherInput(teacherName || effectiveUser?.name || '');
    setPlannedHoursAnnualInput('');
    setPlannedHoursTrimesterInput('');
    setRealizedHoursAnnualInput('');
    setRealizedHoursTrimesterInput('');
    setIncrementalValue(1);

    showMessage(
      'success',
      `Archive du Trimestre ${archive.trimester} chargée avec succès.`
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const handleDeleteArchive = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cette archive ?')) return;
    try {
      await deleteDoc(doc(db, 'hourCoverageArchives', id));
      showMessage('success', 'Archive supprimée.');
    } catch (error) {
      console.error('Erreur suppression archive :', error);
      showMessage('error', 'Impossible de supprimer l’archive.');
    }
  };

  const getRateColor = (rate: number) => rate >= 90 ? 'text-emerald-600 bg-emerald-100' : rate >= 70 ? 'text-amber-600 bg-amber-100' : 'text-red-600 bg-red-100';

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* EN-TÊTE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
              <Clock size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Couverture des Heures d'Enseignement
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Suivi et avancement horaire en temps réel (Firestore Realtime)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isLoadingFirestore && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full animate-pulse">
                <RefreshCw size={14} className="animate-spin" /> Synchronisation...
              </span>
            )}
            
            <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 border border-slate-200">
              Trimestre : <span className="text-indigo-600">{selectedTrimester}er Tr.</span>
            </div>

            <div className="bg-amber-50 px-4 py-2 rounded-lg text-sm font-semibold text-amber-900 border border-amber-200 flex items-center gap-2">
              <Calendar size={16} className="text-amber-600" />
              <span>Année : <strong>{activeAcademicYear}</strong></span>
            </div>

            <div className="flex gap-2">
              <button 
                title="Exporter Excel" 
                onClick={() => exportHourCoverageExcel(localCoverages)} 
                className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <FileSpreadsheet size={18}/>
              </button>
              <button 
                title="Rapport PDF" 
                onClick={() => {
                  if (!activeEstablishment) {
                    alert("Les paramètres de l'établissement ne sont pas encore chargés.");
                    return;
                  }
                  generateHourCoveragePDF(localCoverages, activeEstablishment);
                }} 
                className="p-2.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <FileBarChart2 size={18}/>
              </button>
            </div>
          </div>
        </div>

        {/* CARTES STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 border-l-blue-500">
            <div className="text-sm font-medium text-slate-500">Classes suivies</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">
            <div className="text-sm font-medium text-slate-500">Taux global Annuel</div>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1">{stats.avgAnn.toFixed(1)}%</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 border-l-indigo-500">
            <div className="text-sm font-medium text-slate-500">Taux global Trimestriel</div>
            <div className="text-3xl font-extrabold text-indigo-600 mt-1">{stats.avgTrim.toFixed(1)}%</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 border-l-purple-500 flex flex-col justify-between">
            <div className="text-sm font-medium text-slate-500">Diagnostic IA</div>
            <button
              onClick={() => setShowAIModal(true)}
              className="mt-2 w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-purple-200"
            >
              <Sparkles size={16} /> Voir le rapport IA
            </button>
          </div>
        </div>

        {/* SÉLECTEUR DE TRIMESTRE & ACTIONS */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <label htmlFor="trimester-select" className="font-semibold text-sm text-slate-700">
              Période d'évaluation :
            </label>
            <select
              id="trimester-select"
              value={selectedTrimester}
              onChange={event => setSelectedTrimester(Number(event.target.value) as Trimester)}
              className="border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              {TRIMESTERS.map((_, index) => {
                const value = (index + 1) as Trimester;
                return (
                  <option key={value} value={value}>
                    Trimestre {value}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleArchive}
              disabled={rows.length === 0 || isActionLoading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <FolderOpen size={16} />
              Archiver le trimestre
            </button>

            <button
              type="button"
              onClick={() => setShowArchives(prev => !prev)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 border border-slate-300 cursor-pointer"
            >
              <FolderOpen size={16} className="text-indigo-600" /> Archives ({archives.length})
            </button>
          </div>
        </div>

        {/* NOTIFICATION MESSAGE */}
        {message.type && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-sm transition-all ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {message.type === 'success' ? <CheckCircle size={20} className="text-emerald-600 shrink-0" /> : <AlertCircle size={20} className="text-rose-600 shrink-0" />}
            <span className="font-medium text-sm">{message.text}</span>
          </div>
        )}

        {/* FORMULAIRE */}
        <div>
          {!showAddClassForm && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddClassForm(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition cursor-pointer shadow-sm"
            >
              <span className="text-xl">＋</span>
              Ajouter une classe au suivi des heures
            </button>
          )}

          {showAddClassForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 mt-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  {editingId ? <Pencil size={18} className="text-indigo-600" /> : <Plus size={18} className="text-emerald-600" />}
                  {editingId ? 'Modifier la couverture horaire de la classe' : 'Ajouter une classe au suivi des heures'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowAddClassForm(false);
                  }}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="hour-coverage-class" className="block text-xs font-semibold text-slate-600 mb-1">
                    Classe *
                  </label>
                  <select
                    id="hour-coverage-class"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Sélectionner une classe</option>
                    {finalClassesList.map((className) => (
                      <option key={className} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Discipline *</label>
                  <input
                    type="text"
                    value={disciplineInput}
                    onChange={event => setDisciplineInput(event.target.value)}
                    placeholder="Discipline"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Enseignant</label>
                  <input
                    type="text"
                    value={teacherInput}
                    onChange={event => setTeacherInput(event.target.value)}
                    placeholder="Nom de l'enseignant"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Heures Prévues Annuel</label>
                  <input
                    type="number"
                    min="0"
                    value={plannedHoursAnnualInput}
                    onChange={event => setPlannedHoursAnnualInput(event.target.value === '' ? '' : numberValue(event.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Heures Prévues Trimestre</label>
                  <input
                    type="number"
                    min="0"
                    value={plannedHoursTrimesterInput}
                    onChange={event => setPlannedHoursTrimesterInput(event.target.value === '' ? '' : numberValue(event.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Heures Réalisées Annuel</label>
                  <input
                    type="number"
                    min="0"
                    value={realizedHoursAnnualInput}
                    onChange={event => setRealizedHoursAnnualInput(event.target.value === '' ? '' : numberValue(event.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Heures Réalisées Trimestre</label>
                  <input
                    type="number"
                    min="0"
                    value={realizedHoursTrimesterInput}
                    onChange={event => setRealizedHoursTrimesterInput(event.target.value === '' ? '' : numberValue(event.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleAddOrUpdate}
                    disabled={isActionLoading || isSaving}
                    className={`w-full py-2 px-4 rounded-lg font-semibold text-white shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      editingId
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    } disabled:opacity-50`}
                  >
                    {isActionLoading ? (
                      <>
                        <RefreshCw size={17} className="animate-spin" />
                        Enregistrement en cours...
                      </>
                    ) : (
                      <>
                        {editingId ? <CheckCircle size={17} /> : <Plus size={17} />}
                        {editingId ? 'Mettre à jour' : 'Enregistrer'}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowAddClassForm(false);
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

        {/* TABLEAU */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-b pb-3">
            <h2 className="text-base font-bold text-slate-800">
              Suivi et avancement des heures par classe
            </h2>
            
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
              <Clock size={15} className="text-indigo-600" />
              <span>Ajout rapide après séance :</span>
              <select
                value={incrementalValue}
                onChange={e => setIncrementalValue(Number(e.target.value))}
                className="border border-slate-300 rounded px-2 py-1 bg-white font-bold text-indigo-700 focus:outline-none cursor-pointer"
              >
                <option value={1}>+1 h / leçon</option>
                <option value={2}>+2 h / leçons</option>
                <option value={3}>+3 h / leçons</option>
                <option value={4}>+4 h / leçons</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center">Classe</th>
                  <th className="px-4 py-3 text-center">Discipline</th>
                  <th className="px-4 py-3 text-center">Enseignant</th>
                  <th className="px-4 py-3 text-center">Prévues An</th>
                  <th className="px-4 py-3 text-center">Prévues Trim</th>
                  <th className="px-4 py-3 text-center">Faites An</th>
                  <th className="px-4 py-3 text-center">Faites Trim</th>
                  <th className="px-4 py-3 text-center">Taux An (%)</th>
                  <th className="px-4 py-3 text-center">Taux Trim (%)</th>
                  <th className="px-4 py-3 text-center">Séance Terminée</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-slate-400 italic">
                      Aucune donnée de couverture horaire enregistrée pour ce trimestre.
                    </td>
                  </tr>
                ) : (
                  rows.map(row => {
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center font-bold text-slate-900">{row.className}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{row.discipline}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{row.teacherName}</td>
                        <td className="px-4 py-3 text-center">{row.plannedHoursAnnual}</td>
                        <td className="px-4 py-3 text-center">{row.plannedHoursTrimester}</td>
                        <td className="px-4 py-3 text-center">{row.realizedHoursAnnual}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-700">{row.realizedHoursTrimester}</td>
                        <td className="px-4 py-3 text-center font-semibold">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${getRateColor(row.annualCoverageRate)}`}>
                            {row.annualCoverageRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${getRateColor(row.trimesterCoverageRate)}`}>
                            {row.trimesterCoverageRate}%
                          </span>
                        </td>
                        
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleQuickAddSessionHours(row.id, incrementalValue)}
                            disabled={isActionLoading}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer disabled:opacity-50"
                            title="Ajouter la séance réalisée"
                          >
                            <Plus size={14} /> +{incrementalValue} séance
                          </button>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              title="Modifier"
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              title="Supprimer"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION ARCHIVES */}
        {showArchives && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <FolderOpen size={20} className="text-indigo-600" />
                Archives des heures d'enseignement
              </h2>
              <button
                type="button"
                onClick={() => setShowArchives(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {archives.length === 0 ? (
              <p className="text-center text-slate-500 italic py-6">Aucune archive disponible.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase">
                      <th className="border p-2 text-center">Trimestre</th>
                      <th className="border p-2 text-center">Date</th>
                      <th className="border p-2 text-center">Classes</th>
                      <th className="border p-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archives.map(archive => (
                      <tr key={archive.id} className="hover:bg-slate-50">
                        <td className="border p-2 text-center font-semibold">Trimestre {archive.trimester}</td>
                        <td className="border p-2 text-center">{archive.date}</td>
                        <td className="border p-2 text-center">{archive.rows.length}</td>
                        <td className="border p-2 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleLoadArchive(archive)}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-semibold text-xs border border-indigo-200 cursor-pointer"
                            >
                              Consulter
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteArchive(archive.id)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer"
                              title="Supprimer l'archive"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL DIAGNOSTIC IA */}
        {showAIModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-fade-in space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                  <Sparkles className="text-purple-600" size={20} /> Diagnostic Pédagogique IA
                </h3>
                <button onClick={() => setShowAIModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3 text-xs text-slate-700">
                <p><strong>Diagnostic :</strong> {aiAnalysis.diagnostic}</p>
                <p><strong>Forces :</strong> {aiAnalysis.forces}</p>
                <p><strong>Faiblesses :</strong> {aiAnalysis.faiblesses}</p>
                <p className="bg-purple-50 border border-purple-200 p-3 rounded-lg font-bold text-purple-900">
                  <strong>Recommandations :</strong> {aiAnalysis.recommandations}
                </p>
                <p className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                  <strong>Priorités :</strong> {aiAnalysis.planAction}
                </p>
              </div>
              <button onClick={() => setShowAIModal(false)} className="w-full mt-2 p-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 cursor-pointer">
                Fermer
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}