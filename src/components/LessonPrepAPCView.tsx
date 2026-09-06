/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/* ============================================================
 * IMPORTS
 * ============================================================ */
import { useState, useCallback } from 'react';
import type { APCPrepFiche, User, EstablishmentSettings } from '../types';
import { Sparkles, Printer, Save, FileText, BookOpen, PenTool, ClipboardList, Home, FileDown, Archive, Trash2, X, FolderOpen, AlertCircle } from 'lucide-react';
import { exportAPCPrepFicheToPDF } from '../utils/pdfExport';
import { generateLesson } from "../ai/LessonAgent";
import { LessonBuilder } from "../ai/LessonBuilder";

/* ============================================================
 * TYPES ET INTERFACES
 * ============================================================ */
interface LessonPrepAPCViewProps {
  currentUser: User;
  establishment: EstablishmentSettings;
  apcPreps: APCPrepFiche[];
  onSaveAPCPreps: React.Dispatch<
  React.SetStateAction<APCPrepFiche[]>
>;
}

/* ============================================================
 * INITIALISATION
 * ============================================================ */
export default function LessonPrepAPCView({
  currentUser,
  establishment,
  apcPreps,
  onSaveAPCPreps
}: LessonPrepAPCViewProps) {
  /* ============================================================
   * ÉTATS (useState)
   * ============================================================ */
  const [selectedClass, setSelectedClass] = useState('Seconde C');
  const [chapterName, setChapterName] = useState('Polynômes du second degré');
  const [lessonName, setLessonName] = useState('La méthode du discriminant Delta');
  const [competenceTargeted, setCompetenceTargeted] = useState('Résoudre des problèmes de calcul d\'aires maximales ou de trajectoires paraboliques.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<'info' | 'prereq_sit' | 'steps' | 'homework'>('info');
  const [showArchivesModal, setShowArchivesModal] = useState(false);

  // Initial rich document fallback
 const getInitialFiche = (): APCPrepFiche => {
    if (apcPreps.length > 0) {
      return apcPreps[0];
    }
    return {
      id: "apc-1",
      teacherId: currentUser.id,
      establishmentId: currentUser.establishmentId ?? "",
      departmentId: currentUser.departmentId ?? "",
      title: "",
      subject: currentUser.subject || "",
      className: selectedClass,
      duration: "",
      academicYear: currentUser.academicYear ?? establishment.academicYear ?? "",
      effectif: "",
      date: new Date().toLocaleDateString('fr-FR'),
      teacherName: currentUser.name,
      moduleName: "",
      chapterName: chapterName,
      lessonName: lessonName,
      competenceTargeted: competenceTargeted,
      familyOfSituation: "",
      exampleOfSituation: "",
      categoryOfAction: "",
      resources: {
        material: [],
        pedagogical: []
      },
      prerequisites: {
        reviewQuestions: [],
        expectedAnswers: [],
        commonDifficulties: [],
        transition: ""
      },
      situationProbleme: {
        realLifeContext: "",
        problem: "",
        studentTask: "",
        objective: ""
      },
      steps: [
        {
          phase: "A) Introduction / Découverte",
          duration: "",
          teacherActivity: "",
          studentActivity: "",
          writtenTrace: ""
        },
        {
          phase: "B) Construction du savoir",
          duration: "",
          teacherActivity: "",
          studentActivity: "",
          writtenTrace: ""
        },
        {
          phase: "C) Application",
          duration: "",
          teacherActivity: "",
          studentActivity: "",
          writtenTrace: ""
        },
        {
          phase: "D) Synthèse",
          duration: "",
          teacherActivity: "",
          studentActivity: "",
          writtenTrace: ""
        },
        {
          phase: "E) Évaluation",
          duration: "",
          teacherActivity: "",
          studentActivity: "",
          writtenTrace: ""
        },
        {
          phase: "F) Remédiation",
          duration: "",
          teacherActivity: "",
          studentActivity: "",
          writtenTrace: ""
        }
      ],
      homework: "",
      createdAt: new Date().toISOString()
    };
  };

  const [activeFiche, setActiveFiche] = useState<APCPrepFiche>(getInitialFiche());

  /* ============================================================
   * GÉNÉRATION IA
   * ============================================================ */
  const handleGenerate = async () => {
    setErrorMessage(null);

    // Validation automatique avant génération IA
    if (!currentUser?.subject?.trim() || !selectedClass.trim() || !chapterName.trim() || !lessonName.trim() || !competenceTargeted.trim()) {
      setErrorMessage("Veuillez renseigner tous les champs obligatoires (discipline, classe, chapitre, titre de la leçon et compétence visée) avant de lancer la génération IA.");
      return;
    }

    setIsGenerating(true);
    try {
      const lesson = await generateLesson({
        subject: currentUser.subject || 'Mathématiques',
        className: selectedClass,
        academicYear:
          currentUser.academicYear ??
          establishment.academicYear ??
          "",
        chapter: chapterName,
        lesson: lessonName,
        duration: '2 heures',
        objectives: competenceTargeted,
        teacherName: currentUser.name
      });

      if (!lesson) {
        return;
      }

      const fiche = LessonBuilder.build(
        lesson,
        {
          ...activeFiche,
          academicYear:
            currentUser.academicYear ??
            establishment.academicYear ??
            "",
          establishmentId:
            currentUser.establishmentId ??
            establishment.id ??
            "",
          departmentId:
            currentUser.departmentId ??
            establishment.departmentId ??
            "",
          teacherId: currentUser.id,
          teacherName: currentUser.name,
          subject: currentUser.subject || activeFiche.subject,
        }
      );
      setActiveFiche(fiche);
    } catch (err) {
      console.error('Erreur lors de la génération de la leçon APC :', err);
      setErrorMessage("Échec de la génération IA. Veuillez vérifier votre connexion ou réessayer ultérieurement.");
    } finally {
      setIsGenerating(false);
    }
  };

  /* ============================================================
   * GESTION DES FICHES
   * ============================================================ */
  const handleUpdateStep = useCallback((idx: number, field: 'duration' | 'teacherActivity' | 'studentActivity' | 'phase' | 'writtenTrace', val: string) => {
    setActiveFiche(prev => {
      const nextSteps = [...prev.steps];
      nextSteps[idx] = { ...nextSteps[idx], [field]: val };
      return { ...prev, steps: nextSteps };
    });
  }, []);

  /* ============================================================
   * ARCHIVAGE
   * ============================================================ */
  const handleSave = async () => {
    setErrorMessage(null);

    if (!activeFiche.lessonName || activeFiche.lessonName.trim() === '') {
      setErrorMessage("Impossible d'archiver : le titre de la leçon est manquant.");
      return;
    }
    if (!activeFiche.steps || activeFiche.steps.length < 6) {
      setErrorMessage("Impossible d'archiver : les 6 phases d'apprentissage APC sont requises.");
      return;
    }
    if (!activeFiche.resources || !activeFiche.resources.material || activeFiche.resources.material.length === 0 || !activeFiche.resources.pedagogical || activeFiche.resources.pedagogical.length === 0) {
      setErrorMessage("Impossible d'archiver : les ressources matérielles et pédagogiques sont requises.");
      return;
    }
    if (!activeFiche.prerequisites) {
      setErrorMessage("Impossible d'archiver : les prérequis sont requis.");
      return;
    }
    if (!activeFiche.situationProbleme) {
      setErrorMessage("Impossible d'archiver : la situation problème est requise.");
      return;
    }
    if (!activeFiche.homework || activeFiche.homework.trim() === '') {
      setErrorMessage("Impossible d'archiver : les devoirs à domicile sont requis.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const duplicateIndex = apcPreps.findIndex(p => 
        p.subject.trim().toLowerCase() === activeFiche.subject.trim().toLowerCase() &&
        p.className.trim().toLowerCase() === activeFiche.className.trim().toLowerCase() &&
        p.chapterName.trim().toLowerCase() === activeFiche.chapterName.trim().toLowerCase() &&
        p.lessonName.trim().toLowerCase() === activeFiche.lessonName.trim().toLowerCase() &&
        p.id !== activeFiche.id
      );

      let nextPreps = [...apcPreps];

      if (duplicateIndex >= 0) {
        const confirmReplace = window.confirm(
          "Une fiche identique (même discipline, classe, chapitre et leçon) existe déjà dans les archives. Souhaitez-vous la remplacer ?"
        );
        if (!confirmReplace) {
          setIsSaving(false);
          return;
        }
        nextPreps[duplicateIndex] = activeFiche;
      } else {
        const existingIndex = nextPreps.findIndex(p => p.id === activeFiche.id);
        if (existingIndex >= 0) {
          nextPreps[existingIndex] = activeFiche;
        } else {
          nextPreps.push(activeFiche);
        }
      }

      await onSaveAPCPreps(nextPreps);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Erreur lors de l\'archivage de la fiche APC :', err);
      setErrorMessage("Échec lors de l'archivage de la fiche. Veuillez réessayer.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFiche = async (id: string) => {
    setErrorMessage(null);
    if (window.confirm("Voulez-vous vraiment supprimer définitivement cette fiche de préparation des archives ?")) {
      try {
        const nextPreps = apcPreps.filter(p => p.id !== id);
        await onSaveAPCPreps(nextPreps);
        if (activeFiche.id === id) {
          if (nextPreps.length > 0) {
            setActiveFiche(nextPreps[0]);
          }
        }
      } catch (err) {
        console.error('Erreur lors de la suppression de la fiche APC :', err);
        setErrorMessage("Échec lors de la suppression de la fiche.");
      }
    }
  };

  /* ============================================================
   * EXPORT PDF
   * ============================================================ */
  const handleExportPDF = (ficheToExport: APCPrepFiche) => {
    setErrorMessage(null);
    try {
      exportAPCPrepFicheToPDF(ficheToExport, establishment);
    } catch (err) {
      console.error('Erreur export PDF APC :', err);
      setErrorMessage("Impossible d'exporter la fiche en PDF.");
    }
  };

  /* ============================================================
   * IMPRESSION
   * ============================================================ */
  const handlePrint = () => {
    window.print();
  };

  /* ============================================================
   * RENDU DE L'INTERFACE
   * ============================================================ */
  return (
    <div className="space-y-8 animate-fade-in">
      {errorMessage && (
        <div 
          role="alert" 
          aria-live="assertive" 
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center justify-between gap-3 print:hidden shadow-sm"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setErrorMessage(null)} 
            className="text-xs font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
            aria-label="Fermer l'alerte"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="text-emerald-600 animate-pulse" size={24} />
            Fiches de Préparation Pédagogique APC (IA)
          </h1>
          <p className="text-sm text-slate-500">
            Générez des fiches complètes, détaillées de plusieurs pages, conformes aux exigences de l'APC au Cameroun.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowArchivesModal(true)}
            aria-label="Voir les archives des fiches de préparation"
            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-sm rounded-lg flex items-center gap-2 border border-amber-200 transition-all cursor-pointer"
          >
            <Archive size={16} className="text-amber-600" />
            <span>Voir les archives</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            aria-label="Archiver la fiche active"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <Save size={16} />
            <span>{isSaving ? 'Enregistrement...' : 'Archiver la fiche'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            aria-label="Imprimer la fiche pédagogique"
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>Imprimer la Fiche Pédagogique</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportPDF(activeFiche)}
            aria-label="Exporter en PDF la fiche pédagogique officielle"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-lg flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            title="Générer une fiche de préparation APC officielle au format PDF"
          >
            <FileDown size={16} />
            <span>Exporter en PDF</span>
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden">
        {/* Left column: Setup, Generator, and Archival Selector */}
        <div className="lg:col-span-1 space-y-6">
          {apcPreps.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
              <label htmlFor="archived-lessons-select" className="font-bold text-slate-900 text-sm flex items-center gap-1.5 cursor-pointer">
                <FileText className="text-emerald-600" size={16} />
                <span>Fiches de Leçon Archivées ({apcPreps.length})</span>
              </label>
              <div className="space-y-1">
                <select
                  id="archived-lessons-select"
                  value={activeFiche.id}
                  onChange={(e) => {
                    const selected = apcPreps.find(p => p.id === e.target.value);
                    if (selected) setActiveFiche(selected);
                  }}
                  aria-label="Sélectionner une fiche archivée"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {apcPreps.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.className} - {p.lessonName || p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* AI Generation Form */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Sparkles className="text-emerald-600" size={16} />
              Générateur de Leçon APC
            </h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="select-class-target" className="text-xs font-semibold text-slate-500 uppercase">Classe visée *</label>
                <select
                  id="select-class-target"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  aria-label="Classe visée"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-white cursor-pointer"
                >
                  <option value="6ème A">6ème</option>
                  <option value="5ème M1">5ème</option>
                  <option value="4ème All">4ème</option>
                  <option value="3ème All1">3ème</option>
                  <option value="Seconde C">Seconde C</option>
                  <option value="Première D">Première D</option>
                  <option value="Terminale C">Terminale C</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="input-chapter-name" className="text-xs font-semibold text-slate-500 uppercase">Chapitre officiel *</label>
                <input
                  id="input-chapter-name"
                  type="text"
                  value={chapterName}
                  onChange={(e) => setChapterName(e.target.value)}
                  aria-label="Chapitre officiel"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="input-lesson-name" className="text-xs font-semibold text-slate-500 uppercase">Titre précis de la leçon *</label>
                <input
                  id="input-lesson-name"
                  type="text"
                  value={lessonName}
                  onChange={(e) => setLessonName(e.target.value)}
                  aria-label="Titre précis de la leçon"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="textarea-competence-targeted" className="text-xs font-semibold text-slate-500 uppercase">Compétence visée (APC) *</label>
                <textarea
                  id="textarea-competence-targeted"
                  rows={3}
                  value={competenceTargeted}
                  onChange={(e) => setCompetenceTargeted(e.target.value)}
                  aria-label="Compétence visée APC"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                aria-label="Générer la Fiche APC via IA"
                className="w-full mt-2 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles size={16} className={isGenerating ? 'animate-spin' : ''} />
                <span>{isGenerating ? 'Génération de la leçon...' : 'Générer la Fiche APC (IA)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Form details editor for modifications */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-base">Éditeur de la Séquence Pédagogique</h3>
            <span className="text-xs text-slate-400">Identifiant: {activeFiche.id}</span>
          </div>

          <div className="flex border-b border-slate-100 gap-1 overflow-x-auto pb-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'info'}
              onClick={() => setEditorTab('info')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${editorTab === 'info' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <BookOpen size={14} />
              En-tête & Ressources
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'prereq_sit'}
              onClick={() => setEditorTab('prereq_sit')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${editorTab === 'prereq_sit' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <PenTool size={14} />
              Prérequis & Situation Problème
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'steps'}
              onClick={() => setEditorTab('steps')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${editorTab === 'steps' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ClipboardList size={14} />
              Déroulement (6 phases)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'homework'}
              onClick={() => setEditorTab('homework')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${editorTab === 'homework' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Home size={14} />
              Devoirs à domicile
            </button>
          </div>

          {editorTab === 'info' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="input-module-name" className="text-xs font-semibold text-slate-500">Nom du Module</label>
                  <input
                    id="input-module-name"
                    type="text"
                    value={activeFiche.moduleName || ""}
                    onChange={(e) => setActiveFiche(prev => ({ ...prev, moduleName: e.target.value }))}
                    aria-label="Nom du Module"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="input-duration" className="text-xs font-semibold text-slate-500">Durée estimée</label>
                  <input
                    id="input-duration"
                    type="text"
                    value={activeFiche.duration || ""}
                    onChange={(e) => setActiveFiche(prev => ({ ...prev, duration: e.target.value }))}
                    aria-label="Durée estimée"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="input-effectif" className="text-xs font-semibold text-slate-500">Effectif de la classe</label>
                  <input
                    id="input-effectif"
                    type="text"
                    value={activeFiche.effectif || "55 élèves"}
                    onChange={(e) => setActiveFiche(prev => ({ ...prev, effectif: e.target.value }))}
                    aria-label="Effectif de la classe"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="input-date-cours" className="text-xs font-semibold text-slate-500">Date du cours</label>
                  <input
                    id="input-date-cours"
                    type="text"
                    value={activeFiche.date || ""}
                    onChange={(e) => setActiveFiche(prev => ({ ...prev, date: e.target.value }))}
                    aria-label="Date du cours"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase">Matrice de Situation (APC)</h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label htmlFor="input-fam-sit" className="text-xs font-semibold text-slate-500">Famille de Situation</label>
                    <input
                      id="input-fam-sit"
                      type="text"
                      value={activeFiche.familyOfSituation || ""}
                      onChange={(e) => setActiveFiche(prev => ({ ...prev, familyOfSituation: e.target.value }))}
                      aria-label="Famille de Situation"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="input-ex-sit" className="text-xs font-semibold text-slate-500">Exemple de Situation</label>
                    <input
                      id="input-ex-sit"
                      type="text"
                      value={activeFiche.exampleOfSituation || ""}
                      onChange={(e) => setActiveFiche(prev => ({ ...prev, exampleOfSituation: e.target.value }))}
                      aria-label="Exemple de Situation"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="input-cat-action" className="text-xs font-semibold text-slate-500">Catégorie d'Action</label>
                    <input
                      id="input-cat-action"
                      type="text"
                      value={activeFiche.categoryOfAction || ""}
                      onChange={(e) => setActiveFiche(prev => ({ ...prev, categoryOfAction: e.target.value }))}
                      aria-label="Catégorie d'Action"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="textarea-res-mat" className="text-xs font-semibold text-slate-500">Ressources Matérielles</label>
                  <textarea
                    id="textarea-res-mat"
                    rows={2}
                    value={activeFiche.resources.material.join(", ") || ""}
                    onChange={(e) => setActiveFiche(prev => ({ ...prev, resources: { ...prev.resources, material: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))}
                    aria-label="Ressources Matérielles"
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="textarea-res-ped" className="text-xs font-semibold text-slate-500">Ressources Pédagogiques</label>
                  <textarea
                    id="textarea-res-ped"
                    rows={2}
                    value={activeFiche.resources.pedagogical.join(", ") || ""}
                    onChange={(e) => setActiveFiche(prev => ({ ...prev, resources: { ...prev.resources, pedagogical: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))}
                    aria-label="Ressources Pédagogiques"
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {editorTab === 'prereq_sit' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-slate-50 rounded-lg space-y-3 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase">Prérequis (Rappels de cours)</h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label htmlFor="textarea-recall-q" className="text-xs font-semibold text-slate-500">Questions de Rappel</label>
                    <textarea
                      id="textarea-recall-q"
                      rows={2}
                      value={activeFiche.prerequisites?.reviewQuestions.join("\n") || ""}
                      onChange={(e) => setActiveFiche(prev => ({
                        ...prev,
                        prerequisites: {
                          reviewQuestions: e.target.value.split('\n'),
                          expectedAnswers: prev.prerequisites?.expectedAnswers || [],
                          commonDifficulties: prev.prerequisites?.commonDifficulties || [],
                          transition: prev.prerequisites?.transition || ""
                        }
                      }))}
                      aria-label="Questions de Rappel"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="textarea-expected-ans" className="text-xs font-semibold text-slate-500">Réponses attendues</label>
                    <textarea
                      id="textarea-expected-ans"
                      rows={2}
                      value={activeFiche.prerequisites?.expectedAnswers.join("\n") || ""}
                      onChange={(e) => setActiveFiche(prev => ({
                        ...prev,
                        prerequisites: {
                          reviewQuestions: prev.prerequisites?.reviewQuestions || [],
                          expectedAnswers: e.target.value.split('\n'),
                          commonDifficulties: prev.prerequisites?.commonDifficulties || [],
                          transition: prev.prerequisites?.transition || ""
                        }
                      }))}
                      aria-label="Réponses attendues"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="textarea-transition" className="text-xs font-semibold text-slate-500">Transition vers la nouvelle leçon</label>
                    <textarea
                      id="textarea-transition"
                      rows={2}
                      value={activeFiche.prerequisites?.transition || ""}
                      onChange={(e) => setActiveFiche(prev => ({
                        ...prev,
                        prerequisites: {
                          reviewQuestions: prev.prerequisites?.reviewQuestions || [],
                          expectedAnswers: prev.prerequisites?.expectedAnswers || [],
                          commonDifficulties: prev.prerequisites?.commonDifficulties || [],
                          transition: e.target.value
                        }
                      }))}
                      aria-label="Transition vers la nouvelle leçon"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg space-y-3 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase">Situation Problème contextualisée</h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label htmlFor="textarea-sit-context" className="text-xs font-semibold text-slate-500">Contexte de vie (Cameroun)</label>
                    <textarea
                      id="textarea-sit-context"
                      rows={3}
                      value={activeFiche.situationProbleme?.realLifeContext || ""}
                      onChange={(e) => setActiveFiche(prev => ({
                        ...prev,
                        situationProbleme: {
                          realLifeContext: e.target.value,
                          problem: prev.situationProbleme?.problem || "",
                          studentTask: prev.situationProbleme?.studentTask || "",
                          objective: prev.situationProbleme?.objective || ""
                        }
                      }))}
                      aria-label="Contexte de vie"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="textarea-sit-problem" className="text-xs font-semibold text-slate-500">Problème rencontré</label>
                    <textarea
                      id="textarea-sit-problem"
                      rows={2}
                      value={activeFiche.situationProbleme?.problem || ""}
                      onChange={(e) => setActiveFiche(prev => ({
                        ...prev,
                        situationProbleme: {
                          realLifeContext: prev.situationProbleme?.realLifeContext || "",
                          problem: e.target.value,
                          studentTask: prev.situationProbleme?.studentTask || "",
                          objective: prev.situationProbleme?.objective || ""
                        }
                      }))}
                      aria-label="Problème rencontré"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="textarea-sit-task" className="text-xs font-semibold text-slate-500">Tâche demandée aux élèves</label>
                    <textarea
                      id="textarea-sit-task"
                      rows={2}
                      value={activeFiche.situationProbleme?.studentTask || ""}
                      onChange={(e) => setActiveFiche(prev => ({
                        ...prev,
                        situationProbleme: {
                          realLifeContext: prev.situationProbleme?.realLifeContext || "",
                          problem: prev.situationProbleme?.problem || "",
                          studentTask: e.target.value,
                          objective: prev.situationProbleme?.objective || ""
                        }
                      }))}
                      aria-label="Tâche demandée aux élèves"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {editorTab === 'steps' && (
            <div className="space-y-4 animate-fade-in max-h-[500px] overflow-y-auto pr-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">Matrice des 6 phases d'apprentissage</h4>
              {activeFiche.steps.map((step, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-150 rounded-lg space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 gap-2">
                    <input
                      type="text"
                      value={step.phase}
                      onChange={(e) => handleUpdateStep(idx, 'phase', e.target.value)}
                      aria-label={`Nom de la phase ${idx + 1}`}
                      className="font-bold text-xs text-emerald-800 bg-transparent focus:outline-none uppercase w-2/3"
                    />
                    <input
                      type="text"
                      value={step.duration}
                      onChange={(e) => handleUpdateStep(idx, 'duration', e.target.value)}
                      aria-label={`Durée de la phase ${idx + 1}`}
                      className="text-xs font-semibold font-mono text-slate-500 text-right bg-transparent border-b border-dashed border-slate-300 focus:outline-none w-20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <label htmlFor={`teacher-act-${idx}`} className="font-bold text-slate-500">Activité de l'Enseignant :</label>
                      <textarea
                        id={`teacher-act-${idx}`}
                        rows={3}
                        value={step.teacherActivity}
                        onChange={(e) => handleUpdateStep(idx, 'teacherActivity', e.target.value)}
                        aria-label={`Activité de l'enseignant pour l'étape ${idx + 1}`}
                        className="w-full p-2 border border-slate-200 rounded bg-white text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={`student-act-${idx}`} className="font-bold text-slate-500">Activité des Émules / Élèves :</label>
                      <textarea
                        id={`student-act-${idx}`}
                        rows={3}
                        value={step.studentActivity}
                        onChange={(e) => handleUpdateStep(idx, 'studentActivity', e.target.value)}
                        aria-label={`Activité des élèves pour l'étape ${idx + 1}`}
                        className="w-full p-2 border border-slate-200 rounded bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-xs pt-1.5 border-t border-slate-200">
                    <label htmlFor={`written-trace-${idx}`} className="font-bold text-slate-700 flex items-center gap-1">
                      <span>Trace écrite officielle du cours (à recopier) :</span>
                    </label>
                    <textarea
                      id={`written-trace-${idx}`}
                      rows={5}
                      value={step.writtenTrace || ""}
                      onChange={(e) => handleUpdateStep(idx, 'writtenTrace', e.target.value)}
                      aria-label={`Trace écrite pour l'étape ${idx + 1}`}
                      className="w-full p-2 border border-slate-200 rounded bg-white font-mono text-[11px] leading-normal"
                      placeholder="Définitions, théorèmes, règles et exemples corrigés complets..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {editorTab === 'homework' && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <label htmlFor="textarea-homework" className="text-xs font-bold text-slate-600 uppercase">Devoirs et Consolidation à la maison</label>
                <p className="text-xs text-slate-400">Rédigez les exercices détaillés avec énoncés complexes que les élèves doivent traiter en dehors du cours.</p>
                <textarea
                  id="textarea-homework"
                  rows={8}
                  value={activeFiche.homework || ""}
                  onChange={(e) => setActiveFiche(prev => ({ ...prev, homework: e.target.value }))}
                  aria-label="Devoirs et consolidation"
                  className="w-full p-3 border border-slate-200 rounded-lg text-xs font-mono"
                  placeholder="Énoncés détaillés des exercices de consolidation..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Printable official layout */}
      <div className="bg-white p-4 sm:p-8 md:p-12 lg:p-16 border border-slate-200 shadow-xl rounded-xl mx-auto max-w-[850px] font-sans text-slate-900 space-y-8 relative overflow-hidden print:border-none print:shadow-none print:p-0 print:mx-0 print:max-w-none">
        
        <div className="grid grid-cols-2 text-center text-[10px] font-bold uppercase leading-tight border-b-2 border-slate-800 pb-4">
          <div className="space-y-0.5">
            <div>RÉPUBLIQUE DU CAMEROUN</div>
            <div className="text-[8px] font-medium">Paix - Travail - Patrie</div>
            <div className="pt-1">{establishment?.ministry?.toUpperCase() ?? ""}</div>
            <div>{(establishment?.establishmentName ?? "").toUpperCase()}</div>
          </div>
          <div className="space-y-0.5 border-l border-slate-300">
            <div>REPUBLIC OF CAMEROON</div>
            <div className="text-[8px] font-medium">Peace - Work - Fatherland</div>
            <div className="pt-1">MINISTRY OF SECONDARY EDUCATION</div>
            <div>DÉPARTEMENT DE : {(activeFiche?.subject ?? "").toUpperCase()}</div>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl font-extrabold tracking-tight underline uppercase">
            FICHE DE PREPARATION PEDAGOGIQUE APC (COMPLÈTE)
          </h2>
          <p className="text-xs font-bold uppercase">Leçon : {activeFiche.lessonName} • Classe : {activeFiche.className}</p>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold uppercase text-[12px] text-emerald-900 border-b border-slate-300 pb-0.5">
            1. CADRE ADMINISTRATIF & MATRICE DE SITUATION
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 border border-slate-400 text-[11px] font-sans">
            <div className="p-2 border-r border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Établissement :</span>
              <span>{establishment.establishmentName}</span>
            </div>
            <div className="p-2 border-r border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Département :</span>
              <span>{establishment.departmentName}</span>
            </div>
            <div className="p-2 border-r border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Discipline :</span>
              <span>{activeFiche.subject}</span>
            </div>
            <div className="p-2 border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Classe :</span>
              <span>{activeFiche.className}</span>
            </div>

            <div className="p-2 border-r border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Effectif :</span>
              <span>{activeFiche.effectif || "55 élèves"}</span>
            </div>
            <div className="p-2 border-r border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Date du cours :</span>
              <span>{activeFiche.date || new Date().toLocaleDateString('fr-FR')}</span>
            </div>
            <div className="p-2 border-r border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Durée :</span>
              <span>{activeFiche.duration}</span>
            </div>
            <div className="p-2 border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Enseignant :</span>
              <span>{activeFiche.teacherName}</span>
            </div>

            <div className="col-span-2 p-2 border-r border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Module de formation :</span>
              <span>{activeFiche.moduleName}</span>
            </div>
            <div className="col-span-2 p-2 border-b border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Chapitre :</span>
              <span>{activeFiche.chapterName}</span>
            </div>

            <div className="col-span-4 p-2 border-b border-slate-400 bg-slate-50/50">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Compétence attendue (APC) :</span>
              <span className="font-bold text-slate-800">{activeFiche.competenceTargeted}</span>
            </div>

            <div className="col-span-2 p-2 border-r border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Famille de situation :</span>
              <span>{activeFiche.familyOfSituation || "Non spécifiée"}</span>
            </div>
            <div className="p-2 border-r border-slate-400">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Exemple de situation :</span>
              <span>{activeFiche.exampleOfSituation || "Non spécifié"}</span>
            </div>
            <div className="p-2">
              <span className="font-bold uppercase block text-[9px] text-slate-500">Catégorie d'action :</span>
              <span>{activeFiche.categoryOfAction || "Non spécifiée"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs font-sans">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <span className="font-bold block text-[9px] text-slate-500 uppercase mb-0.5">Ressources Matérielles</span>
            <p className="text-[11px] leading-snug">{activeFiche.resources.material.join(", ")}</p>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <span className="font-bold block text-[9px] text-slate-500 uppercase mb-0.5">Ressources Pédagogiques</span>
            <p className="text-[11px] leading-snug">{activeFiche.resources.pedagogical.join(", ")}</p>
          </div>
        </div>

        {activeFiche.prerequisites && (
          <div className="space-y-2 page-break-before">
            <h3 className="font-extrabold uppercase text-[12px] text-emerald-900 border-b border-slate-300 pb-0.5">
              2. EVALUATION DIAGNOSTIQUE (PRÉREQUIS)
            </h3>
            <div className="border border-slate-400 text-[11px] font-sans rounded overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-50 border-b border-slate-400 font-bold text-slate-700 text-[10px]">
                <div className="p-2 border-r border-slate-400 uppercase">Questions de rappel proposées</div>
                <div className="p-2 uppercase">Réponses attendues des élèves</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 text-[11px]">
                <div className="p-2 border-r border-slate-400 whitespace-pre-wrap leading-relaxed bg-white">
                  {activeFiche.prerequisites.reviewQuestions.join("\n")}
                </div>
                <div className="p-2 whitespace-pre-wrap leading-relaxed bg-white">
                  {activeFiche.prerequisites.expectedAnswers.join("\n")}
                </div>
              </div>
              <div className="p-2.5 bg-emerald-50 border-t border-slate-400 text-[11px] leading-relaxed">
                <span className="font-bold text-emerald-950 uppercase block text-[9px] tracking-wide">Transition vers la leçon :</span>
                <p className="text-emerald-900 italic mt-0.5">{activeFiche.prerequisites.transition}</p>
              </div>
            </div>
          </div>
        )}

        {activeFiche.situationProbleme && (
          <div className="space-y-2">
            <h3 className="font-extrabold uppercase text-[12px] text-emerald-900 border-b border-slate-300 pb-0.5">
              3. CONTEXTE D'APPRENTISSAGE (SITUATION PROBLÈME)
            </h3>
            <div className="border border-slate-400 bg-amber-50/20 p-4 rounded-lg space-y-3 text-[11px] font-sans leading-relaxed">
              <div>
                <span className="font-extrabold text-amber-900 uppercase text-[9px] tracking-wider block mb-0.5">Contexte de la vie réelle (Cameroun) :</span>
                <p className="text-slate-800 font-medium">{activeFiche.situationProbleme.realLifeContext}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-300/60">
                <div>
                  <span className="font-extrabold text-red-900 uppercase text-[9px] tracking-wider block mb-0.5">Problème à résoudre :</span>
                  <p className="text-slate-850 font-bold">{activeFiche.situationProbleme.problem}</p>
                </div>
                <div>
                  <span className="font-extrabold text-emerald-900 uppercase text-[9px] tracking-wider block mb-0.5">Tâche attendue des élèves :</span>
                  <p className="text-emerald-950 font-bold underline bg-white p-1.5 border border-emerald-100 rounded">{activeFiche.situationProbleme.studentTask}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 page-break-before">
          <h3 className="font-extrabold uppercase text-[12px] text-emerald-900 border-b border-slate-300 pb-0.5">
            4. DÉROULEMENT DE LA SÉQUENCE (TABLEAU MATRIX)
          </h3>
          <table className="w-full border-collapse border border-slate-400 text-[10.5px] font-sans leading-normal">
            <thead>
              <tr className="bg-slate-100 uppercase text-[9px] font-extrabold text-slate-700">
                <th className="border border-slate-400 p-2 w-[18%]">ÉTAPES / DURÉE</th>
                <th className="border border-slate-400 p-2 w-[24%]">ACTIVITÉS DE L'ENSEIGNANT</th>
                <th className="border border-slate-400 p-2 w-[24%]">ACTIVITÉS DES APPRENANTS</th>
                <th className="border border-slate-400 p-2 w-[34%]">TRACE ÉCRITE (NOTIONS CLÉS & EXEMPLES)</th>
              </tr>
            </thead>
            <tbody>
              {activeFiche.steps.map((step, idx) => (
                <tr key={idx} className="align-top hover:bg-slate-50/20">
                  <td className="border border-slate-400 p-2 font-bold uppercase tracking-wider bg-slate-50/50">
                    <div className="text-emerald-800 text-[10px]">{step.phase}</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">({step.duration})</div>
                  </td>
                  <td className="border border-slate-400 p-2 whitespace-pre-wrap leading-relaxed text-slate-700">{step.teacherActivity}</td>
                  <td className="border border-slate-400 p-2 whitespace-pre-wrap leading-relaxed text-slate-700">{step.studentActivity}</td>
                  <td className="border border-slate-400 p-2 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50/10 text-slate-900 font-medium">
                    {step.writtenTrace ? (
                      <div className="bg-white p-1 rounded border border-slate-100 shadow-sm text-[10px]">
                        {step.writtenTrace}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[9px]">Saisir la trace écrite pour cette étape</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeFiche.homework && (
          <div className="space-y-2 page-break-inside-avoid">
            <h3 className="font-extrabold uppercase text-[12px] text-emerald-900 border-b border-slate-300 pb-0.5">
              5. DEVOIR À FAIRE À DOMICILE (CONSOLIDATION)
            </h3>
            <div className="bg-slate-50 p-4 border border-slate-300 rounded text-[11px] font-sans leading-relaxed whitespace-pre-wrap">
              {activeFiche.homework}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 pt-8 text-[11px] font-bold font-sans text-center page-break-inside-avoid">
          <div className="space-y-12">
            <div>Visa de l'Enseignant</div>
            <div className="text-[11px] underline font-extrabold">{activeFiche.teacherName}</div>
          </div>
          <div className="space-y-12 border-l border-slate-200">
            <div>Visa de l'Animateur Pédagogique</div>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2 animate-bounce print:hidden">
          <Save size={16} />
          <span>Fiche pédagogique archivée avec succès !</span>
        </div>
      )}

      {/* Archives Modal */}
      {showArchivesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in print:hidden">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base">Fiches de Préparation APC Archivées ({apcPreps.length})</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowArchivesModal(false)}
                aria-label="Fermer la fenêtre des archives"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {apcPreps.length > 0 ? (
                apcPreps.map((prep) => (
                  <div key={prep.id} className="p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/65 hover:border-emerald-400 transition-all">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wider px-2 py-0.5 rounded uppercase">
                          {prep.className}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          {prep.date || 'Date non spécifiée'}
                        </span>
                        {prep.duration && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            • {prep.duration}
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        {prep.lessonName || prep.title}
                      </h4>
                      {prep.chapterName && (
                        <p className="text-xs text-slate-500 font-semibold italic">
                          Chapitre : {prep.chapterName}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400">
                        Discipline : {prep.subject}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFiche(prep);
                          setShowArchivesModal(false);
                        }}
                        aria-label={`Charger la fiche ${prep.lessonName || prep.title}`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        Charger
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportPDF(prep)}
                        aria-label={`Exporter en PDF la fiche ${prep.lessonName || prep.title}`}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                        title="Exporter en PDF"
                      >
                        <FileDown size={14} />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFiche(prep.id)}
                        aria-label={`Supprimer définitivement la fiche ${prep.lessonName || prep.title}`}
                        className="p-1.5 hover:bg-rose-100 text-rose-600 border border-transparent rounded-md transition-all cursor-pointer"
                        title="Supprimer définitivement"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <FolderOpen size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold">Aucune fiche de préparation archivée pour le moment.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Générez ou concevez une fiche, puis cliquez sur "Archiver la fiche" pour la sauvegarder.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowArchivesModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}