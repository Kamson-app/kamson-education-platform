/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Trash2,
  Printer,
  CheckCircle,
  XCircle,
  FileCheck,
  FileSpreadsheet,
  BookOpen,
  ClipboardCheck
} from 'lucide-react';

import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Imports exclusifs des types officiels de la plateforme
import type {
  LogbookEntry,
  EmargementClaim,
  UserProfile,
  EstablishmentSettings,
  HourCoverage,
  ClassGradeSheet,
  ProgramCoverage,
  Trimester
} from "../types";

interface TeacherSpaceViewProps {
  currentUser: UserProfile;
  establishmentSettings: EstablishmentSettings | null;

  gradeSheets: ClassGradeSheet[];
  hourCoverages: HourCoverage[];
  programCoverages: ProgramCoverage[];

  logbookEntriesList: LogbookEntry[];
  onSaveLogbookEntriesList: (
    entries: LogbookEntry[]
  ) => Promise<void>;

  emargementClaimsList: EmargementClaim[];
  onSaveEmargementClaimsList: (
    claims: EmargementClaim[]
  ) => Promise<void>;

  customClassesList?: string[];
}

export const TeacherSpaceView: React.FC<TeacherSpaceViewProps> = ({
  currentUser,
  establishmentSettings,
  gradeSheets: _gradeSheets,
  hourCoverages: _hourCoverages,
  programCoverages: _programCoverages,
  logbookEntriesList,
  onSaveLogbookEntriesList,
  emargementClaimsList,
  onSaveEmargementClaimsList: _onSaveEmargementClaimsList,
  customClassesList = []
}) => {
  const activeEstablishment = establishmentSettings || {
    id: currentUser?.establishmentId || '',
    ministry: 'MINESEC',
    establishmentName: '',
    academicYear: ''
  };

  // ============================================================
  // ÉTAT DU TRIMESTRE SÉLECTIONNÉ
  // ============================================================
  const [selectedTrimester, setSelectedTrimester] =
    useState<Trimester>(1);

  // ============================================================
  // COUVERTURE DES HEURES — FIRESTORE TEMPS RÉEL
  // FILTRÉE PAR ENSEIGNANT + ANNÉE + TRIMESTRE
  // ============================================================
  const [firestoreHourCoverages, setFirestoreHourCoverages] =
    useState<HourCoverage[]>([]);

  useEffect(() => {
    const establishmentId =
      establishmentSettings?.id ||
      currentUser?.establishmentId ||
      '';

    const teacherId =
      currentUser?.id || '';

    const teacherName =
      currentUser?.name?.trim().toLowerCase() || '';

    const academicYear =
      establishmentSettings?.academicYear ||
      currentUser?.academicYear ||
      '';

    if (!teacherId || !establishmentId) {
      console.warn(
        '⚠️ Impossible de charger la couverture horaire : établissement ou enseignant manquant.',
        {
          establishmentId,
          teacherId
        }
      );

      setFirestoreHourCoverages([]);
      return;
    }

    console.log(
      '🔎 Chargement couverture horaire :',
      {
        establishmentId,
        teacherId,
        teacherName,
        academicYear,
        trimester: selectedTrimester
      }
    );

    const q = query(
      collection(db, 'hourCoverages'),
      where(
        'establishmentId',
        '==',
        establishmentId
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {

        const allCoverages =
          snapshot.docs.map(
            (docSnap) =>
              ({
                id: docSnap.id,
                ...docSnap.data()
              }) as HourCoverage
          );

        /*
         * Filtrage LOCAL :
         * - établissement
         * - année scolaire
         * - trimestre
         * - enseignant
         *
         * Le filtrage local évite de dépendre
         * d'un index composite Firestore.
         */
        const teacherCoverages =
          allCoverages.filter(
            (coverage) => {

              const sameTeacher =
                coverage.teacherId === teacherId ||
                (
                  teacherName !== '' &&
                  coverage.teacherName
                    ?.trim()
                    .toLowerCase() === teacherName
                );

              const sameTrimester =
                Number(coverage.trimester) ===
                Number(selectedTrimester);

              const sameYear =
                !academicYear ||
                coverage.academicYear === academicYear;

              return (
                sameTeacher &&
                sameTrimester &&
                sameYear
              );
            }
          );

        console.log(
          '📊 Couvertures du trimestre sélectionné :',
          {
            trimester: selectedTrimester,
            academicYear,
            data: teacherCoverages
          }
        );

        setFirestoreHourCoverages(
          teacherCoverages
        );
      },
      (error) => {

        console.error(
          '❌ Erreur lecture hourCoverages :',
          error
        );

        setFirestoreHourCoverages([]);
      }
    );

    return () => unsubscribe();

  }, [
    establishmentSettings?.id,
    establishmentSettings?.academicYear,
    currentUser?.establishmentId,
    currentUser?.academicYear,
    currentUser?.id,
    currentUser?.name,
    selectedTrimester
  ]);

  // ============================================================
  // NAVIGATION
  // ============================================================

  const [activeSubTab, setActiveSubTab] = useState<
    'logbook' | 'overview' | 'print'
  >('logbook');

  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [fetchedClassesList, setFetchedClassesList] = useState<string[]>([]);

  // Chargement des classes personnalisées depuis Firestore si aucune liste n'est présente
  useEffect(() => {
    if ((currentUser?.classes && currentUser.classes.length > 0) || (customClassesList && customClassesList.length > 0)) return;
    const loadCustomClasses = async () => {
      const uid = currentUser?.id;
      if (!db || !uid) return;
      try {
        const docRef = doc(db, 'config', `customClasses_${uid}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.classes)) {
            setFetchedClassesList(data.classes);
          }
        }
      } catch (err) {
        console.error("Erreur chargement classes personnalisées :", err);
      }
    };
    loadCustomClasses();
  }, [currentUser?.id, currentUser?.classes, customClassesList]);

  // ============================================================
  // GESTION DES CLASSES DE L'ENSEIGNANT CONNECTÉ
  // ============================================================

  const teacherCoverageClasses = useMemo(() => {
    const classes = firestoreHourCoverages
      .filter((coverage) =>
        coverage.teacherId === currentUser?.id ||
        coverage.teacherName?.trim().toLowerCase() ===
          currentUser?.name?.trim().toLowerCase()
      )
      .map((coverage) => coverage.className)
      .filter((className): className is string => Boolean(className?.trim()));

    return Array.from(new Set(classes));
  }, [firestoreHourCoverages, currentUser?.id, currentUser?.name]);

  const teacherClasses = useMemo<string[]>(() => {
    if (teacherCoverageClasses.length > 0) {
      return teacherCoverageClasses;
    }
    const baseClasses = customClassesList.length > 0 ? customClassesList : (currentUser?.classes || fetchedClassesList || []);
    return Array.from(
      new Set(
        baseClasses
          .filter(Boolean)
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    );
  }, [teacherCoverageClasses, customClassesList, currentUser?.classes, fetchedClassesList]);

  // ============================================================
  // FORMULAIRE CAHIER DE TEXTES
  // ============================================================

  const [logClass, setLogClass] = useState<string>('');

  useEffect(() => {
    if (!logClass && teacherClasses.length > 0) {
      setLogClass(teacherClasses[0]);
    }
  }, [teacherClasses, logClass]);

  const [logDate, setLogDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [logTimeSlot, setLogTimeSlot] = useState<string>('');
  const [logChapter, setLogChapter] = useState<string>('');
  const [logLesson, setLogLesson] = useState<string>('');
  const [logContent, setLogContent] = useState<string>('');
  const [logHomework, setLogHomework] = useState<string>('');

  const teacherDiscipline =
    (currentUser as UserProfile & { subject?: string }).discipline ||
    (currentUser as UserProfile & { subject?: string }).subject ||
    'Discipline non spécifiée';

  // ============================================================
  // AJOUT D'UNE SÉANCE
  // ============================================================

  const handleAddLogEntry = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (
      !logClass ||
      !logDate ||
      !logTimeSlot ||
      !logChapter ||
      !logLesson ||
      !logContent
    ) {
      return;
    }

    const establishmentId =
      currentUser?.establishmentId ||
      activeEstablishment?.id;

    const departmentId = currentUser?.departmentId;

    if (!establishmentId || !departmentId) {
      console.error(
        'Impossible d’enregistrer la séance : établissement ou département manquant.',
        {
          establishmentId,
          departmentId,
          teacherId: currentUser?.id
        }
      );

      alert(
        "Impossible d'enregistrer la séance : le département de l'enseignant n'est pas configuré."
      );

      return;
    }

    const newEntry: LogbookEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teacherId: currentUser?.id || '',
      teacherName: currentUser?.name || '',
      className: logClass,
      date: logDate,
      timeSlot: logTimeSlot,
      chapterName: logChapter,
      lessonName: logLesson,
      contentTaught: logContent,
      homework: logHomework || undefined,
      establishmentId,
      departmentId,
      status: 'PENDING'
    };

    const updatedList = [newEntry, ...logbookEntriesList];
    await onSaveLogbookEntriesList(updatedList);

    // Réinitialisation du formulaire
    setLogTimeSlot('');
    setLogChapter('');
    setLogLesson('');
    setLogContent('');
    setLogHomework('');
  };

  // ============================================================
  // ACTIONS SUR LE CAHIER DE TEXTES (SUPPRESSION / VISAS)
  // ============================================================

  const handleDeleteLog = async (id: string) => {
    const updatedList = logbookEntriesList.filter(log => log.id !== id);
    await onSaveLogbookEntriesList(updatedList);
  };

  const handleApproveLog = async (id: string) => {
    const updatedList = logbookEntriesList.map(log => {
      if (log.id === id) {
        return {
          ...log,
          status: 'APPROVED' as const,
          visaDate: new Date().toLocaleDateString('fr-FR'),
          visaAuthorId: currentUser?.id
        };
      }
      return log;
    });
    await onSaveLogbookEntriesList(updatedList);
  };

  const handleRejectLog = async (id: string) => {
    const updatedList = logbookEntriesList.map(log => {
      if (log.id === id) {
        return {
          ...log,
          status: 'REJECTED' as const,
          visaDate: new Date().toLocaleDateString('fr-FR'),
          visaAuthorId: currentUser?.id
        };
      }
      return log;
    });
    await onSaveLogbookEntriesList(updatedList);
  };

  // ============================================================
  // FILTRAGE DES ENTRÉES DU CAHIER DE TEXTES
  // ============================================================

  const filteredLogs = useMemo<LogbookEntry[]>(() => {
    const teacherLogs = logbookEntriesList.filter(
      log => log.teacherId === currentUser?.id || log.teacherName === currentUser?.name
    );

    if (filterClass === 'ALL') {
      return teacherLogs;
    }

    return teacherLogs.filter(
      (log: LogbookEntry) =>
        log.className === filterClass
    );
  }, [logbookEntriesList, currentUser?.id, currentUser?.name, filterClass]);

  // ============================================================
  // CALCUL DES DONNÉES DE COUVERTURE HORAIRE (SANS CUMUL)
  // ============================================================

  const getHourCoverageForClass = (
    className: string
  ) => {
    const coverage =
      firestoreHourCoverages.find(
        (item) =>
          item.className
            ?.trim()
            .toLowerCase() ===
          className
            .trim()
            .toLowerCase()
      );

    if (!coverage) {
      return {
        planned: 0,
        realized: 0,
        pending: 0,
        rate: 0
      };
    }

    const planned =
      Number(
        coverage.plannedHoursTrimester || 0
      );

    const realized =
      Number(
        coverage.realizedHoursTrimester || 0
      );

    const pending =
      Math.max(
        0,
        planned - realized
      );

    const rate =
      planned > 0
        ? Math.min(
            100,
            Math.round(
              (realized / planned) * 100
            )
          )
        : 0;

    return {
      planned,
      realized,
      pending,
      rate
    };
  };

  // ============================================================
  // RENDU
  // ============================================================

  const isInspector = currentUser?.role === 'ANIMATEUR_PEDAGOGIQUE';

  return (
    <div className="space-y-6">

      {/* ========================================================
          EN-TÊTE DU PROFIL
      ======================================================== */}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {currentUser?.name || 'Enseignant'}
          </h2>

          <p className="text-slate-500 text-sm">
            {teacherDiscipline} — Enseignant
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          {/* CAHIER DE TEXTES */}
          <button
            type="button"
            onClick={() =>
              setActiveSubTab('logbook')
            }
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'logbook'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Cahier de Textes
          </button>

          {/* SUIVI */}
          <button
            type="button"
            onClick={() =>
              setActiveSubTab('overview')
            }
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Suivi & Émargements
          </button>

          {/* IMPRESSION */}
          <button
            type="button"
            onClick={() =>
              setActiveSubTab('print')
            }
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'print'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Printer className="w-4 h-4" />
            Rapports & Impression
          </button>

        </div>
      </div>

      {/* ========================================================
          VUE 1 : CAHIER DE TEXTES
      ======================================================== */}

      {activeSubTab === 'logbook' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* FORMULAIRE */}
          {!isInspector && (

              <div className="xl:col-span-1 space-y-6">

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">

                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Plus
                      className="text-emerald-600"
                      size={16}
                    />
                    Enregistrer un Cours Dispensé
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    Saisissez les détails de la séance
                    pour le Cahier de Textes réglementaire.
                  </p>

                </div>

                <form
                  onSubmit={handleAddLogEntry}
                  className="space-y-4"
                >

                  {/* CLASSE */}
                  <div className="space-y-1">

                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Classe concernée
                    </label>

                    <select
                      value={logClass}
                      onChange={(e) =>
                        setLogClass(e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {teacherClasses.map(
                        (c) => (
                          <option
                            key={c}
                            value={c}
                          >
                            {c}
                          </option>
                        )
                      )}
                    </select>

                  </div>

                  {/* DATE / HORAIRE */}
                  <div className="grid grid-cols-2 gap-3">

                    <div className="space-y-1">

                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Date
                      </label>

                      <input
                        type="date"
                        value={logDate}
                        onChange={(e) =>
                          setLogDate(e.target.value)
                        }
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                      />

                    </div>

                    <div className="space-y-1">

                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Plage horaire
                      </label>

                      <input
                        type="text"
                        value={logTimeSlot}
                        onChange={(e) =>
                          setLogTimeSlot(e.target.value)
                        }
                        placeholder="08h00 - 10h00"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                      />

                    </div>

                  </div>

                  {/* CHAPITRE */}
                  <div className="space-y-1">

                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Titre du Chapitre
                    </label>

                    <input
                      type="text"
                      value={logChapter}
                      onChange={(e) =>
                        setLogChapter(e.target.value)
                      }
                      placeholder="ex: Polynômes du second degré"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 bg-white"
                      required
                    />

                  </div>

                  {/* LEÇON */}
                  <div className="space-y-1">

                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Leçon / Thème du jour
                    </label>

                    <input
                      type="text"
                      value={logLesson}
                      onChange={(e) =>
                        setLogLesson(e.target.value)
                      }
                      placeholder="ex: Résolution par le discriminant Delta"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 bg-white"
                      required
                    />

                  </div>

                  {/* CONTENU */}
                  <div className="space-y-1">

                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Contenu détaillé du cours
                    </label>

                    <textarea
                      rows={4}
                      value={logContent}
                      onChange={(e) =>
                        setLogContent(e.target.value)
                      }
                      placeholder="Définitions vues, théorèmes énoncés, numéros d'exercices d'application réalisés..."
                      className="w-full p-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 bg-white"
                      required
                    />

                  </div>

                  {/* DEVOIR */}
                  <div className="space-y-1">

                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Devoirs à faire à domicile
                    </label>

                    <input
                      type="text"
                      value={logHomework}
                      onChange={(e) =>
                        setLogHomework(e.target.value)
                      }
                      placeholder="ex: Exercice 4 page 12 du livre agréé"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                    />

                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Enregistrer la séance</span>
                  </button>

                </form>

              </div>
            )}

          {/* LISTE DES SÉANCES */}
          <div
            className={`${
              !isInspector
                ? 'xl:col-span-2'
                : 'xl:col-span-3'
            } space-y-5`}
          >

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">

              <h3 className="font-bold text-slate-900 text-sm">
                Séquences d'Enseignements Enregistrées (
                {filteredLogs.length}
                )
              </h3>

              <div className="flex items-center gap-2">

                <span className="text-xs text-slate-500">
                  Filtrer par classe :
                </span>

                <select
                  value={filterClass}
                  onChange={(e) =>
                    setFilterClass(e.target.value)
                  }
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                >

                  <option value="ALL">
                    Toutes mes classes
                  </option>

                  {teacherClasses.map(
                    (c) => (
                      <option
                        key={c}
                        value={c}
                      >
                        {c}
                      </option>
                    )
                  )}

                </select>

              </div>

            </div>

            <div className="space-y-4">

              {filteredLogs.length === 0 ? (

                <div className="bg-white py-16 text-center text-slate-400 text-xs rounded-2xl border border-slate-100 shadow-sm">
                  Aucun cours n'a encore été enregistré
                  pour ce filtre.
                </div>

              ) : (

                filteredLogs.map((log) => (

                  <div
                    key={log.id}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4 relative overflow-hidden"
                  >

                    <div className="flex items-center justify-between">

                      <div className="flex items-center gap-2">

                        <span className="font-bold text-slate-950 text-sm bg-slate-100 px-2 py-0.5 rounded">
                          {log.className}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(
                            log.date
                          ).toLocaleDateString(
                            'fr-FR'
                          )}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock size={11} />
                          {log.timeSlot}
                        </span>

                      </div>

                      <div className="flex items-center gap-1.5">

                        {log.status === 'APPROVED' ? (

                          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded flex items-center gap-1">
                            <CheckCircle size={10} />
                            Visa Accordé (
                            {log.visaDate}
                            )
                          </span>

                        ) : log.status === 'REJECTED' ? (

                          <span className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold rounded flex items-center gap-1">
                            <XCircle size={10} />
                            Réfuté
                          </span>

                        ) : (

                          <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold rounded flex items-center gap-1 animate-pulse">
                            En attente de visa AP
                          </span>

                        )}

                      </div>

                    </div>

                    <div className="space-y-1">

                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Thème & Leçon
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm">
                        {log.chapterName}
                      </h4>

                      <p className="text-xs text-slate-600 font-semibold">
                        {log.lessonName}
                      </p>

                    </div>

                    <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">

                      <span className="font-bold text-[10px] text-slate-500 uppercase block">
                        Contenu dispensé :
                      </span>

                      <p className="text-slate-700 leading-relaxed font-sans">
                        {log.contentTaught}
                      </p>

                      {log.homework && (
                        <div className="mt-2 pt-2 border-t border-slate-200/50 flex gap-1.5 items-start">

                          <span className="font-bold text-[10px] text-emerald-700 uppercase whitespace-nowrap block mt-0.5">
                            Devoir à la maison:
                          </span>

                          <p className="text-slate-600 italic">
                            {log.homework}
                          </p>

                        </div>
                      )}

                    </div>

                    <div className="flex justify-between items-center border-t border-slate-50 pt-3">

                      <span className="text-[9px] text-slate-400 font-mono">
                        ID: {log.id}
                      </span>

                      <div className="flex items-center gap-2">

                        {isInspector &&
                          log.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRejectLog(log.id)
                                }
                                className="px-2 py-1 hover:bg-red-50 text-red-600 font-bold text-[10px] rounded border border-red-200 flex items-center gap-0.5 transition-all cursor-pointer"
                              >
                                <XCircle size={12} />
                                <span>Rejeter</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleApproveLog(log.id)
                                }
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded flex items-center gap-0.5 shadow-sm transition-all cursor-pointer"
                              >
                                <FileCheck size={12} />
                                <span>
                                  Accorder le Visa AP
                                </span>
                              </button>
                            </>
                          )}

                        {(!isInspector ||
                          log.teacherId === currentUser?.id) &&
                          log.status === 'PENDING' && (

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteLog(log.id)
                              }
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded transition-all cursor-pointer"
                              title="Supprimer cette ligne"
                            >
                              <Trash2 size={13} />
                            </button>

                          )}

                      </div>

                    </div>

                  </div>

                ))
              )}

            </div>

          </div>

        </div>
      )}

      {/* ========================================================
          VUE 2 : SUIVI & ÉMARGEMENTS
      ======================================================== */}

      {activeSubTab === 'overview' && (
        <div className="space-y-6">

          {/* SÉLECTEUR DE TRIMESTRE & TABLEAU COUVERTURE HORAIRE */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

            <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 border-b border-slate-200">

              <div>
                <h3 className="font-bold text-slate-900">
                  Suivi quantitatif de la couverture horaire
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Données synchronisées avec « Couverture des heures ».
                </p>
              </div>

              <div className="flex items-center gap-2">

                <label
                  htmlFor="teacher-space-trimester"
                  className="text-sm font-semibold text-slate-700"
                >
                  Période :
                </label>

                <select
                  id="teacher-space-trimester"
                  value={selectedTrimester}
                  onChange={(e) =>
                    setSelectedTrimester(
                      Number(e.target.value) as Trimester
                    )
                  }
                  className="border border-slate-300 rounded-lg px-3 py-2 bg-white font-semibold text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value={1}>
                    Trimestre 1
                  </option>

                  <option value={2}>
                    Trimestre 2
                  </option>

                  <option value={3}>
                    Trimestre 3
                  </option>
                </select>

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse text-sm">

                <thead>

                  <tr className="bg-slate-100/50 text-slate-600 font-semibold text-xs border-b border-slate-100">

                    <th className="p-4">
                      Classe
                    </th>

                    <th className="p-4">
                      Heures Prévues
                    </th>

                    <th className="p-4">
                      Heures Réalisées
                    </th>

                    <th className="p-4">
                      Heures Restantes
                    </th>

                    <th className="p-4">
                      Taux d'Exécution
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {teacherClasses.map(
                    (className) => {

                      const coverage =
                        getHourCoverageForClass(
                          className
                        );

                      const ratio =
                        coverage.rate;

                      return (
                        <tr
                          key={className}
                          className="hover:bg-slate-50/50 transition-colors"
                        >

                          <td className="p-4 font-bold text-slate-900">
                            {className}
                          </td>

                          <td className="p-4 text-slate-600">
                            {coverage.planned}h
                          </td>

                          <td className="p-4 font-semibold text-emerald-600">
                            {coverage.realized}h
                          </td>

                          <td className="p-4 text-amber-600">
                            {coverage.pending}h
                          </td>

                          <td className="p-4">

                            <div className="flex items-center gap-2">

                              <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">

                                <div
                                  className={`h-full rounded-full ${
                                    ratio >= 75
                                      ? 'bg-emerald-500'
                                      : ratio >= 40
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                  }`}
                                  style={{
                                    width: `${ratio}%`
                                  }}
                                />

                              </div>

                              <span className="text-xs font-bold text-slate-700">
                                {ratio}%
                              </span>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

            {teacherClasses.length === 0 && (

              <div className="p-8 text-center text-sm text-slate-400">
                Aucune classe n'est configurée pour cet enseignant.
              </div>

            )}

          </div>

          {/* SECTION ÉMARGEMENTS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">

            <h3 className="text-lg font-bold text-slate-900">
              Suivi des fiches d'émargement mensuelles
            </h3>

            {emargementClaimsList.length === 0 ? (

              <p className="text-sm text-slate-500 text-center py-6">
                Aucun litige ou réclamation d'émargement en cours.
              </p>

            ) : (

              <div className="space-y-3">

                {emargementClaimsList.map(
                  (claim: EmargementClaim) => (

                    <div
                      key={claim.id}
                      className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center gap-4"
                    >

                      <div>

                        <div className="flex items-center gap-2">

                          <span className="text-xs font-bold text-slate-700 uppercase">
                            Mois : {claim.month}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              claim.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {claim.status === 'PAID'
                              ? 'Payé'
                              : claim.status === 'APPROVED'
                                ? 'Approuvé'
                                : 'En Litige'}
                          </span>

                        </div>

                        <p className="text-sm text-slate-600 mt-1 font-medium">

                          Heures déclarées :{' '}

                          <span className="text-slate-900 font-bold">
                            {claim.hoursClaimed}h
                          </span>

                          {' '}vs Validées par l'administration :{' '}

                          <span className="text-emerald-600 font-bold">
                            {claim.hoursValidated}h
                          </span>

                        </p>

                      </div>

                    </div>

                  )
                )}

              </div>
            )}

          </div>

        </div>
      )}

      {/* ========================================================
          VUE 3 : IMPRESSION
      ======================================================== */}

      {activeSubTab === 'print' && (

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 animate-fade-in print:hidden">

          <div className="border-b border-slate-100 pb-3">

            <h3 className="font-bold text-slate-900 text-base">
              Impressions Administratives Réglementaires
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              Sélectionnez le document officiel conforme
              aux normes du MINESEC Cameroun à générer
              pour impression physique ou archivage numérique.
            </p>

          </div>

          <div className="max-w-xl mx-auto">

            <div className="p-5 border border-slate-100 rounded-xl bg-slate-50/50 space-y-3 flex flex-col justify-between">

              <div className="space-y-1.5">

                <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <FileSpreadsheet size={18} />
                </div>

                <h4 className="font-bold text-slate-900 text-sm">
                  Cahier de Textes Officiel de l'Enseignant
                </h4>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Générez le cahier de textes complet
                  contenant toutes les séances visées,
                  avec les signatures requises de
                  l'Enseignant, du Chef de Département
                  (A.P.) et du Censeur.
                </p>

              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer size={13} />
                <span>
                  Imprimer le Cahier de Textes
                </span>
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================
          VERSION IMPRIMABLE
      ======================================================== */}

      <div className="hidden print:block bg-white text-slate-900 font-sans p-6 space-y-8 max-w-4xl mx-auto text-xs leading-normal">

        {/* EN-TÊTE */}
        <div className="grid grid-cols-2 text-center text-[10px] font-bold uppercase leading-tight border-b-2 border-slate-800 pb-4">

          <div className="space-y-0.5">

            <div>
              RÉPUBLIQUE DU CAMEROUN
            </div>

            <div className="text-[8px] font-medium">
              Paix - Travail - Patrie
            </div>

            <div className="pt-1">
              {activeEstablishment?.ministry?.toUpperCase() || 'MINESEC'}
            </div>

            <div>
              {activeEstablishment?.establishmentName?.toUpperCase() || 'ÉTABLISSEMENT SCOLAIRE'}
            </div>

          </div>

          <div className="space-y-0.5 border-l border-slate-300">

            <div>
              REPUBLIC OF CAMEROON
            </div>

            <div className="text-[8px] font-medium">
              Peace - Work - Fatherland
            </div>

            <div className="pt-1">
              MINISTRY OF SECONDARY EDUCATION
            </div>

            <div>
              DÉPARTEMENT DE :{' '}
              {teacherDiscipline.toUpperCase()}
            </div>

          </div>

        </div>

        {/* CAHIER DE TEXTES */}
        {(activeSubTab === 'logbook' ||
          activeSubTab === 'overview' ||
          activeSubTab === 'print') && (

          <div className="space-y-6">

            <div className="text-center space-y-1">

              <h2 className="text-base font-extrabold tracking-tight underline uppercase">
                CAHIER DE TEXTES DIGITALISÉ DE L'ENSEIGNANT
              </h2>

              <p className="text-[10px] font-bold uppercase">
                Enseignant : {currentUser?.name || ''}
                {' • '}
                Discipline :{' '}
                {teacherDiscipline}
                {' • '}
                Année Scolaire :{' '}
                {activeEstablishment?.academicYear || ''}
              </p>

            </div>

            <table className="w-full border-collapse border border-slate-400 text-[10px] leading-tight text-slate-800">

              <thead>

                <tr className="bg-slate-100 text-[9px] uppercase font-bold text-slate-700">

                  <th className="border border-slate-400 p-1.5 text-center w-20">
                    Date / Heure
                  </th>

                  <th className="border border-slate-400 p-1.5 text-center w-12">
                    Classe
                  </th>

                  <th className="border border-slate-400 p-1.5 text-left">
                    Chapitre / Thème de la leçon
                  </th>

                  <th className="border border-slate-400 p-1.5 text-left">
                    Détails des notions abordées & Devoirs
                  </th>

                  <th className="border border-slate-400 p-1.5 text-center w-24">
                    Visa de l'A.P.
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredLogs.map((log) => (

                  <tr
                    key={log.id}
                    className="align-top"
                  >

                    <td className="border border-slate-400 p-1.5 text-center font-mono">

                      {new Date(
                        log.date
                      ).toLocaleDateString(
                        'fr-FR'
                      )}

                      <div className="text-[8px] text-slate-500 mt-0.5">
                        {log.timeSlot}
                      </div>

                    </td>

                    <td className="border border-slate-400 p-1.5 text-center font-bold">
                      {log.className}
                    </td>

                    <td className="border border-slate-400 p-1.5">

                      <div className="font-bold">
                        {log.chapterName}
                      </div>

                      <div className="text-[9px] italic text-slate-600 mt-0.5">
                        {log.lessonName}
                      </div>

                    </td>

                    <td className="border border-slate-400 p-1.5 whitespace-pre-wrap">

                      <p>
                        {log.contentTaught}
                      </p>

                      {log.homework && (

                        <div className="mt-1 pt-1 border-t border-slate-200 text-[8.5px] text-slate-600 italic">

                          <strong>
                            Devoir :
                          </strong>{' '}
                          {log.homework}

                        </div>

                      )}

                    </td>

                    <td className="border border-slate-400 p-1.5 text-center font-bold">

                      {log.status === 'APPROVED' ? (

                        <div className="text-emerald-700 text-[8px] uppercase space-y-1">

                          <div>
                            ✔ VISÉ AP
                          </div>

                          <div className="text-[7px] text-slate-400 font-mono">
                            Le {log.visaDate}
                          </div>

                        </div>

                      ) : (

                        <span className="text-slate-400 italic text-[8px]">
                          Non signé
                        </span>

                      )}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

            {/* SIGNATURES */}
            <div className="grid grid-cols-3 text-center text-[10px] font-bold uppercase pt-8">

              <div className="space-y-8">

                <div>
                  L'Enseignant
                </div>

                <div className="text-slate-400 text-[9px] italic font-medium">
                  Signature :
                </div>

                <div className="text-slate-700 text-[10px]">
                  {currentUser?.name || ''}
                </div>

              </div>

              <div className="space-y-8 border-l border-slate-200">

                <div>
                  Chef de Département (A.P.)
                </div>

                <div className="text-slate-400 text-[9px] italic font-medium">
                  Signature & Tampon :
                </div>

                <div className="text-slate-700 text-[10px]">

                  {currentUser?.role ===
                  'ANIMATEUR_PEDAGOGIQUE'
                    ? currentUser.name
                    : 'Administration'}

                </div>

              </div>

              <div className="space-y-8 border-l border-slate-200">

                <div>
                  Le Censeur / Administration
                </div>

                <div className="text-slate-400 text-[9px] italic font-medium">
                  Signature & Cachet :
                </div>

                <div className="text-slate-700 text-[10px]">
                  {
                    (
                      activeEstablishment as EstablishmentSettings & {
                        principalName?: string;
                      }
                    )?.principalName || 'Administration'
                  }
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
};

export default TeacherSpaceView;