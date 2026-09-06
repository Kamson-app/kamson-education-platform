/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import type { ExamSubject, UserProfile, EstablishmentSettings, ProgramCoverage } from '../types';
import { AIOrchestrator } from '../ai/AIOrchestrator';
import { Sparkles, Printer, Save, Plus, HelpCircle, FileText, BookOpen, Layers, Award, Copy, Check, ChevronDown, ChevronUp, Trash2, FileDown, SpellCheck, X, AlertCircle, Archive, FolderOpen } from 'lucide-react';

interface ExamDesignerViewProps {
  currentUser: UserProfile;
  establishmentSettings: EstablishmentSettings | null;
  exams: ExamSubject[];
  programCoverages?: ProgramCoverage[];
  onSaveExams: (exams: ExamSubject[]) => Promise<void>;
}

interface GeneratedExercises {
  chapter: string;
  applicationExercises: { title: string; statement: string; solution: string }[];
  consolidationExercises: { title: string; statement: string; solution: string }[];
  supervisedWorks: { title: string; statement: string; solution: string }[];
}

function getDefaultChapters(className: string): string[] {
  const norm = className.toLowerCase();
  if (norm.includes('terminale')) {
    return [
      "Nombres complexes",
      "Arithmétique",
      "Suites numériques",
      "Limites et continuité",
      "Dérivabilité et étude de fonctions",
      "Fonctions logarithmes et exponentielles",
      "Calcul intégral",
      "Équations différentielles",
      "Probabilités",
      "Similitudes planes directes",
      "Géométrie dans l'espace",
      "Statistiques à deux variables"
    ];
  } else if (norm.includes('première') || norm.includes('1ère')) {
    return [
      "Équations et inéquations du second degré",
      "Barycentres de points pondérés",
      "Généralités sur les fonctions",
      "Limites et dérivation",
      "Trigonométrie",
      "Géométrie analytique du plan",
      "Suites numériques",
      "Statistiques",
      "Probabilités"
    ];
  } else if (norm.includes('seconde') || norm.includes('2nde')) {
    return [
      "Ensembles de nombres",
      "Calcul algébrique et équations",
      "Fonctions numériques",
      "Vecteurs et repérage",
      "Géométrie plane",
      "Statistiques et probabilités"
    ];
  } else if (norm.includes('3ème') || norm.includes('3eme')) {
    return [
      "Calcul dans R et propriétés",
      "Racines carrées",
      "Équations et inéquations",
      "Systèmes d'équations",
      "Trigonométrie",
      "Théorème de Thalès et Pythagore",
      "Applications affines",
      "Statistiques"
    ];
  } else if (norm.includes('4ème') || norm.includes('4eme')) {
    return [
      "Calcul dans Q",
      "Puissances de 10",
      "Calcul littéral",
      "Triangle rectangle et Pythagore",
      "Cercle et triangle",
      "Statistiques"
    ];
  } else if (norm.includes('5ème') || norm.includes('5eme')) {
    return [
      "Calcul dans D",
      "Nombres relatifs",
      "Calcul littéral",
      "Symétrie centrale",
      "Aires et volumes",
      "Statistiques"
    ];
  } else if (norm.includes('6ème') || norm.includes('6eme')) {
    return [
      "Nombres décimaux",
      "Fractions",
      "Droites et segments",
      "Angles",
      "Symétrie orthogonale",
      "Statistiques"
    ];
  }
  return [
    "Calcul algébrique",
    "Géométrie",
    "Statistiques",
    "Probabilités",
    "Fonctions numériques"
  ];
}

export default function ExamDesignerView({
  currentUser,
  establishmentSettings,
  exams,
  programCoverages = [],
  onSaveExams
}: ExamDesignerViewProps) {
  const [selectedType, setSelectedType] = useState<'BEPC' | 'PROBATOIRE' | 'BACCALAUREAT' | 'CONTROLE_CONTINU'>('BACCALAUREAT');
  const [selectedClass, setSelectedClass] = useState('Terminale C');
  const [duration, setDuration] = useState('4 heures');
  const [coefficient, setCoefficient] = useState(5);
  
  // Generation Loaders
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [isGeneratingPanoply, setIsGeneratingPanoply] = useState(false);
  
  // Archiving
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showArchivesModal, setShowArchivesModal] = useState(false);
  const [forceTwoPages, setForceTwoPages] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');

  const handleDeleteExam = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer définitivement cette épreuve des archives ?")) {
      const nextExams = exams.filter(e => e.id !== id);
      await onSaveExams(nextExams);
      if (activeExam.id === id) {
        if (nextExams.length > 0) {
          setActiveExam(nextExams[0]);
        }
      }
    }
  };

  // Proofreading / Grammar Check
  const [isProofreading, setIsProofreading] = useState(false);
  const [proofreadResult, setProofreadResult] = useState<{
    correctedInstructions: string;
    correctedSections: { title: string; points: number; content: string }[];
    correctedMarkingScheme: string;
    corrections: { original: string; corrected: string; explanation: string }[];
  } | null>(null);
  const [showProofreadPanel, setShowProofreadPanel] = useState(false);

  // Chapter state (supports selecting multiple chapters, automatically linked to program coverage)
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [newCustomChapter, setNewCustomChapter] = useState('');

  // Sub-navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'panoply'>('editor');

  // Exercise Panoply state
  const [generatedPanoply, setGeneratedPanoply] = useState<GeneratedExercises | null>(null);
  const [activePanoplyTab, setActivePanoplyTab] = useState<'application' | 'consolidation' | 'td'>('application');
  const [visibleSolutions, setVisibleSolutions] = useState<Record<string, boolean>>({});

  // Dynamic feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active Exam
  const [activeExam, setActiveExam] = useState<ExamSubject>(exams[0] || {
    id: "exam-1",
    title: "Évaluation Sommative de Fin de Trimestre 1",
    subject: currentUser.subject || "Mathématiques",
    examType: "BACCALAUREAT",
    className: "Terminale C",
    duration: "4 heures",
    coefficient: 5,
    teacherId: currentUser.id,
    establishmentId: currentUser.establishmentId || '',
    departmentId: currentUser.departmentId || '',
    instructions: "L'usage de la calculatrice scientifique non programmable est autorisé. Le candidat doit traiter toutes les parties.",
    createdAt: new Date().toISOString(),
    sections: [
      {
        title: "Partie A : Évaluation des ressources (15 points)",
        points: 15,
        content: "Exercice 1 : Arithmétique (5 points)\nRésoudre dans Z² l'équation : 7x - 5y = 3.\n\nExercice 2 : Nombres Complexes (5 points)\nDéterminer les racines complexes de l'équation z² - 4z + 13 = 0."
      },
      {
        title: "Partie B : Évaluation des compétences (5 points)",
        points: 5,
        content: "Situation-problème : Un ingénieur souhaite clôturer un terrain rectangulaire..."
      }
    ],
    markingScheme: "Corrigé indicatif : Exercice 1 (5pts), Exercice 2 (5pts)."
  });

  // Calculate validated chapters from coverage (status === 'DONE')
  const validatedLessonsFromCoverage = programCoverages
    ? programCoverages
        .filter(c => c.className.toLowerCase().trim() === selectedClass.toLowerCase().trim())
        .flatMap(c => c.lessons.filter(l => l.status === 'DONE').map(l => l.title))
    : [];

  // Automatically sync selected chapters to validated lessons from the program coverage page of the selected class
  useEffect(() => {
    const classCoverage = programCoverages?.find(
      c => c.className.toLowerCase().trim() === selectedClass.toLowerCase().trim()
    );
    const validated = classCoverage
      ? classCoverage.lessons.filter(l => l.status === 'DONE').map(l => l.title)
      : [];
    setSelectedChapters(validated);
  }, [selectedClass, programCoverages]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getFinalChapter = () => {
    return selectedChapters.length > 0 ? selectedChapters.join(', ') : 'Généralités';
  };

  // Helper pour ajouter un examen et persister
  const addExam = async (newExam: ExamSubject) => {
    const nextExams = [newExam, ...exams];
    await onSaveExams(nextExams);
  };

  // Original randomized generator
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const finalChapter = getFinalChapter();
      const examResult: any = await AIOrchestrator.exam({
        subject: currentUser.subject || 'Mathématiques',
        className: selectedClass,
        sequence: 'Séquence 1',
        trimester: 'Trimestre 1',
        academicYear: '2025-2026',
        duration,
        totalMarks: 20,
        chapters: selectedChapters.length > 0 ? selectedChapters : [finalChapter],
        instructions: customPrompt || "L'usage de la calculatrice scientifique non programmable est autorisé."
      });

      if (!examResult) {
        throw new Error("La génération du sujet a échoué.");
      }
      
      const configuredExam: ExamSubject = {
        id: "exam-" + Date.now(),
        title: examResult.title || `Évaluation : ${finalChapter}`,
        subject: currentUser.subject || 'Mathématiques',
        examType: selectedType,
        className: selectedClass,
        duration,
        coefficient,
        teacherId: currentUser.id,
        establishmentId: currentUser.establishmentId || '',
        departmentId: currentUser.departmentId || '',
        instructions: examResult.instructions || "L'usage de la calculatrice est autorisé.",
        sections: examResult.sections || [
          {
            title: "Partie A : Évaluation des ressources (15 points)",
            points: 15,
            content: examResult.content || "Exercices générés par l'IA."
          }
        ],
        markingScheme: examResult.correction || examResult.markingScheme || "",
        createdAt: new Date().toISOString()
      };

      setActiveExam(configuredExam);
      await addExam(configuredExam);
      showToast("Sujet d'épreuve généré et sauvegardé avec succès !");
    } catch (err: any) {
      console.error('Error generating exam subject:', err);
      showToast("Échec de la génération aléatoire : " + (err.message || ''));
    } finally {
      setIsGenerating(false);
    }
  };

  // Requirement 1: Structure Type Generator based on Chapter
  const handleGenerateStructure = async () => {
    const finalChapter = getFinalChapter();
    if (!finalChapter) {
      showToast("Veuillez sélectionner ou saisir un chapitre pour l'IA.");
      return;
    }

    setIsGeneratingStructure(true);
    try {
      const examResult: any = await AIOrchestrator.exam({
        subject: currentUser.subject || 'Mathématiques',
        className: selectedClass,
        sequence: 'Séquence 1',
        trimester: 'Trimestre 1',
        academicYear: '2025-2026',
        duration,
        totalMarks: 20,
        chapters: selectedChapters,
        instructions: customPrompt || "L'usage de la calculatrice scientifique non programmable est autorisé."
      });

      if (!examResult) {
        throw new Error("La génération du sujet a échoué.");
      }

      const configuredExam: ExamSubject = {
        id: "exam-" + Date.now(),
        title: examResult.title || `Évaluation Type : ${finalChapter}`,
        subject: currentUser.subject || 'Mathématiques',
        examType: selectedType,
        className: selectedClass,
        duration,
        coefficient,
        teacherId: currentUser.id,
        establishmentId: currentUser.establishmentId || '',
        departmentId: currentUser.departmentId || '',
        instructions: examResult.instructions || "L'usage de la calculatrice est autorisé.",
        sections: examResult.sections || [
          {
            title: "Partie A : Évaluation des ressources (15 points)",
            points: 15,
            content: examResult.content || "Structure générée par l'IA."
          }
        ],
        markingScheme: examResult.correction || examResult.markingScheme || "",
        createdAt: new Date().toISOString()
      };

      setActiveExam(configuredExam);
      await addExam(configuredExam);
      showToast("Structure d'épreuve type générée et sauvegardée !");
    } catch (err: any) {
      console.error('Error generating structure:', err);
      showToast("Échec de la génération : " + err.message);
    } finally {
      setIsGeneratingStructure(false);
    }
  };

  // Requirement 2: Exercise & TD Panoply Generator based on Chapter
  const handleGeneratePanoply = async () => {
    const finalChapter = getFinalChapter();
    if (!finalChapter) {
      showToast("Veuillez sélectionner ou saisir un chapitre pour générer les exercices.");
      return;
    }

    setIsGeneratingPanoply(true);
    try {
      const response = await fetch('/api/gemini/generate-exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: currentUser.subject || 'Mathématiques',
          className: selectedClass,
          chapterName: finalChapter
        })
      });

      if (!response.ok) {
        throw new Error("Erreur serveur lors de la génération");
      }

      const resData = await response.json();
      if (resData.data) {
        setGeneratedPanoply(resData.data);
        showToast("Panoplie d'exercices et TD générée avec succès !");
      } else {
        throw new Error("Données d'exercices invalides");
      }
    } catch (err: any) {
      console.error('Error generating panoply:', err);
      showToast("Échec de la génération : " + err.message);
    } finally {
      setIsGeneratingPanoply(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const existingIndex = exams.findIndex(e => e.id === activeExam.id);
    let nextExams = [...exams];

    if (existingIndex >= 0) {
      nextExams[existingIndex] = activeExam;
    } else {
      nextExams.push(activeExam);
    }

    try {
      await onSaveExams(nextExams);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSectionContentChange = (index: number, val: string) => {
    setActiveExam(prev => {
      const nextSections = [...prev.sections];
      nextSections[index] = { ...nextSections[index], content: val };
      return { ...prev, sections: nextSections };
    });
  };

  const toggleSolution = (id: string) => {
    setVisibleSolutions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Texte copié dans le presse-papiers !");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAppendToExam = (partIndex: number, title: string, statement: string, solution: string) => {
    setActiveExam(prev => {
      const nextSections = prev.sections.map(sec => ({ ...sec }));
      
      if (nextSections.length <= partIndex) {
        nextSections.push({
          title: partIndex === 0 ? "Partie A : Évaluation des ressources (15 points)" : "Partie B : Évaluation des compétences (5 points)",
          points: partIndex === 0 ? 15 : 5,
          content: ""
        });
      }

      const section = nextSections[partIndex];
      const currentContent = section.content ? section.content.trim() : "";
      const appendContent = `\n\n${title}\n${statement}`;
      
      nextSections[partIndex] = {
        ...section,
        content: currentContent ? `${currentContent}${appendContent}` : `${title}\n${statement}`
      };

      const currentScheme = prev.markingScheme ? prev.markingScheme.trim() : "";
      const appendScheme = `\n\n--- Corrigé de l'${title} ---\n${solution}`;
      const nextScheme = currentScheme ? `${currentScheme}${appendScheme}` : `--- Corrigé de l'${title} ---\n${solution}`;

      return {
        ...prev,
        sections: nextSections,
        markingScheme: nextScheme
      };
    });

    showToast(`"${title}" a été ajouté à la ${partIndex === 0 ? "Partie A" : "Partie B"} !`);
  };

  const handleProofread = async () => {
    setIsProofreading(true);
    setProofreadResult(null);
    try {
      const response = await fetch('/api/gemini/proofread-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions: activeExam.instructions,
          sections: activeExam.sections,
          markingScheme: activeExam.markingScheme
        })
      });

      if (!response.ok) {
        throw new Error("Erreur de communication avec le serveur");
      }

      const resData = await response.json();
      if (resData.data) {
        setProofreadResult(resData.data);
        setShowProofreadPanel(true);
        showToast("Vérification linguistique et orthographique terminée !");
      } else {
        throw new Error("Données de révision linguistique invalides");
      }
    } catch (err: any) {
      console.error('Error proofreading exam:', err);
      showToast("Échec de la révision : " + err.message);
    } finally {
      setIsProofreading(false);
    }
  };

  const handleApplyCorrections = () => {
    if (!proofreadResult) return;
    setActiveExam(prev => ({
      ...prev,
      instructions: proofreadResult.correctedInstructions,
      sections: proofreadResult.correctedSections.map((sec, idx) => {
        const orig = prev.sections[idx];
        return {
          title: sec.title || (orig ? orig.title : `Partie ${idx + 1}`),
          points: typeof sec.points === 'number' ? sec.points : (orig ? orig.points : 10),
          content: sec.content || ""
        };
      }),
      markingScheme: proofreadResult.correctedMarkingScheme
    }));
    setShowProofreadPanel(false);
    setProofreadResult(null);
    showToast("Toutes les corrections linguistiques ont été appliquées !");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header action menu */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="text-emerald-600 animate-pulse" size={24} />
            Conception et Génération d'Épreuves (Norme Cameroun)
          </h1>
          <p className="text-sm text-slate-500">
            Concevez instantanément des sujets d'examen officiels (BEPC, Probatoire, Baccalauréat) ou des panoplies d'exercices par chapitre validés par l'IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowArchivesModal(true)}
            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-sm rounded-lg flex items-center gap-2 border border-amber-200 transition-all cursor-pointer"
          >
            <Archive size={16} className="text-amber-600" />
            <span>Voir les archives</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            <Save size={16} />
            <span>{isSaving ? 'Enregistrement...' : 'Archiver le sujet'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm rounded-lg flex items-center gap-2 shadow-sm transition-all animate-fade-in cursor-pointer"
          >
            <Printer size={16} />
            <span>Imprimer</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-lg flex items-center gap-2 shadow-sm transition-all animate-fade-in cursor-pointer"
          >
            <FileDown size={16} />
            <span>Exporter en PDF</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation for structural modes */}
      <div className="flex border-b border-slate-200 print:hidden">
        <button
          onClick={() => setActiveSubTab('editor')}
          className={`px-5 py-3 border-b-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeSubTab === 'editor'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <FileText size={16} />
          Conception du Sujet d'Épreuve
        </button>
        <button
          onClick={() => setActiveSubTab('panoply')}
          className={`px-5 py-3 border-b-2 text-sm font-semibold transition-all flex items-center gap-2 ${
            activeSubTab === 'panoply'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Sparkles size={16} />
          Générateur d'Exercices & TD
        </button>
      </div>

      {/* View workspace according to tabs */}
      {activeSubTab === 'editor' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden animate-fade-in">
            {/* Control Column */}
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">Paramètres de l'examen</h3>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Type d'épreuve</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="BACCALAUREAT">Baccalauréat (Séries C, D, TI)</option>
                    <option value="PROBATOIRE">Probatoire (Séries C, D, TI)</option>
                    <option value="BEPC">BEPC (3ème)</option>
                    <option value="CONTROLE_CONTINU">Contrôle Continu Coordonné</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Classe visée</label>
                  <input
                    type="text"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Durée d'épreuve</label>
                    <input
                      type="text"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Coefficient</label>
                    <input
                      type="number"
                      value={coefficient}
                      onChange={(e) => setCoefficient(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Target chapter selector block */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                      <span>Chapitres d'évaluation</span>
                      <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded font-mono font-bold border border-emerald-200">
                        MINESEC Sync
                      </span>
                    </span>
                    {selectedChapters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedChapters([])}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        Tout effacer
                      </button>
                    )}
                  </div>

                  {/* Badges container */}
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[44px]">
                    {selectedChapters.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Aucun chapitre sélectionné</span>
                    ) : (
                      selectedChapters.map((chap, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-md animate-fade-in">
                          <span className="truncate max-w-[120px]">{chap}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedChapters(prev => prev.filter(c => c !== chap))}
                            className="text-emerald-600 hover:text-emerald-800 focus:outline-none ml-1 font-bold"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Sync Status of Program Coverage */}
                  {validatedLessonsFromCoverage.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        <span>Chapitres validés de la classe ({validatedLessonsFromCoverage.length}) :</span>
                      </span>
                      <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2.5 space-y-1 bg-white">
                        {validatedLessonsFromCoverage.map((chap, idx) => {
                          const isChecked = selectedChapters.includes(chap);
                          return (
                            <label key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedChapters(prev => prev.filter(c => c !== chap));
                                  } else {
                                    setSelectedChapters(prev => [...prev, chap]);
                                  }
                                }}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className="truncate">{chap}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[11px] space-y-1">
                      <p className="font-bold flex items-center gap-1 text-amber-700">
                        <AlertCircle size={14} className="text-amber-600 shrink-0" />
                        <span>Lien automatique actif</span>
                      </p>
                      <p className="text-slate-600 leading-relaxed font-medium">
                        Aucun chapitre n'est marqué comme <strong>"Fait"</strong> dans le <strong>Suivi des Programmes</strong> pour la classe <strong>{selectedClass}</strong>. Saisissez ou ajoutez des chapitres ci-dessous.
                      </p>
                    </div>
                  )}

                  {/* Quick Dropdown to add official chapters */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ajouter un chapitre de la progression officielle</label>
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !selectedChapters.includes(val)) {
                          setSelectedChapters(prev => [...prev, val]);
                        }
                        e.target.value = ""; // reset
                      }}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Sélectionner pour ajouter --</option>
                      {getDefaultChapters(selectedClass).map((chap, i) => (
                        <option key={i} value={chap}>{chap}</option>
                      ))}
                    </select>
                  </div>

                  {/* Input field to add custom chapters */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saisir un chapitre personnalisé</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCustomChapter}
                        onChange={(e) => setNewCustomChapter(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newCustomChapter.trim() && !selectedChapters.includes(newCustomChapter.trim())) {
                              setSelectedChapters(prev => [...prev, newCustomChapter.trim()]);
                              setNewCustomChapter('');
                            }
                          }
                        }}
                        placeholder="Ex: Fonctions trigonométriques..."
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newCustomChapter.trim() && !selectedChapters.includes(newCustomChapter.trim())) {
                            setSelectedChapters(prev => [...prev, newCustomChapter.trim()]);
                            setNewCustomChapter('');
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>

                {/* IA Options & Guidelines */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <span>Options de génération IA</span>
                  </span>

                  <label className="flex items-start gap-2.5 p-2 bg-emerald-50/50 hover:bg-emerald-50 rounded-lg border border-emerald-100 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceTwoPages}
                      onChange={(e) => setForceTwoPages(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-0.5"
                    />
                    <div className="text-xs text-emerald-900 font-medium leading-relaxed">
                      <p className="font-bold">Forcer au moins 2 pages</p>
                      <p className="text-emerald-700/80 text-[10px]">Épreuve très dense avec 3 longs exercices (Ressources) et situation d'aide à la décision fouillée (Compétences).</p>
                    </div>
                  </label>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consigne spécifique (Optionnelle)</label>
                    <textarea
                      rows={2}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Ex: Insérer un exercice sur les suites géométriques..."
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs leading-relaxed focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    onClick={handleGenerateStructure}
                    disabled={isGeneratingStructure}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles size={18} className={isGeneratingStructure ? 'animate-spin' : ''} />
                    <span>{isGeneratingStructure ? 'Génération de l\'épreuve...' : 'Générer l\'épreuve'}</span>
                  </button>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <Layers size={14} className={isGenerating ? 'animate-pulse' : ''} />
                    <span>Concevoir un sujet complet aléatoire</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Editor Workspace */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base">Sujet rédigé & Barème</h3>
                
                <button
                  onClick={handleProofread}
                  disabled={isProofreading}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-60 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all border border-indigo-100"
                >
                  <SpellCheck size={14} className={isProofreading ? 'animate-spin' : ''} />
                  <span>{isProofreading ? 'Correction orthographe...' : 'Correction orthographe (IA)'}</span>
                </button>
              </div>

              {activeExam.sections.map((sec, idx) => (
                <div key={idx} className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                    <span>{sec.title}</span>
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">{sec.points} points</span>
                  </label>
                  <textarea
                    rows={7}
                    value={sec.content}
                    onChange={(e) => handleSectionContentChange(idx, e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Corrigé indicatif & Barème de notation</label>
                <textarea
                  rows={4}
                  value={activeExam.markingScheme || ''}
                  onChange={(e) => setActiveExam(prev => ({ ...prev, markingScheme: e.target.value }))}
                  className="w-full p-3 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 focus:outline-none focus:border-emerald-500 leading-relaxed"
                  placeholder="Saisissez le barème détaillé ici..."
                />
              </div>
            </div>
          </div>

          {/* Printable official layout - Masterpiece high fidelity Cameroonian Exam Paper! */}
          <div className="page-a4 rounded-xl shadow-xl font-serif text-slate-900 space-y-8 relative overflow-hidden print:border-none print:shadow-none print:p-0 print:mx-0 print:max-w-none animate-fade-in">
            {/* Letterhead */}
            <div className="grid grid-cols-2 text-center text-[9px] font-bold uppercase leading-tight border-b-2 border-slate-800 pb-4">
              <div className="space-y-0.5">
                <div>RÉPUBLIQUE DU CAMEROUN</div>
                <div className="text-[7px] font-medium font-sans">Paix - Travail - Patrie</div>
                <div className="pt-1">{establishmentSettings?.ministry?.toUpperCase()}</div>
                <div>{establishmentSettings?.establishmentName?.toUpperCase()}</div>
              </div>
              <div className="space-y-0.5 border-l border-slate-300">
                <div>REPUBLIC OF CAMEROON</div>
                <div className="text-[7px] font-medium font-sans">Peace - Work - Fatherland</div>
                <div className="pt-1">MINISTRY OF SECONDARY EDUCATION</div>
                <div>EXAMEN : {activeExam.examType}</div>
              </div>
            </div>

            {/* Exam parameters card */}
            <div className="border border-slate-800 p-2.5 text-xs font-sans grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="font-bold">MATIÈRE : </span>
                <span className="uppercase">{activeExam.subject}</span>
              </div>
              <div>
                <span className="font-bold">SÉRIE / CLASSE : </span>
                <span className="uppercase">{activeExam.className}</span>
              </div>
              <div>
                <span className="font-bold">COEFFICIENT : </span>
                <span className="font-mono font-bold">{activeExam.coefficient}</span>
              </div>
              <div className="col-span-3 border-t border-slate-200 pt-1">
                <span className="font-bold">DURÉE DE L'ÉPREUVE : </span>
                <span>{activeExam.duration}</span>
              </div>
            </div>

            <div className="border-l-4 border-slate-800 pl-4 py-1 italic text-xs font-sans bg-slate-50">
              <span className="font-bold uppercase block text-[9px] text-slate-500 not-italic">Consignes aux candidats :</span>
              {activeExam.instructions}
            </div>

            {/* Séquences / Questions sections */}
            <div className="space-y-8 text-xs font-serif leading-relaxed">
              {activeExam.sections.map((sec, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="font-bold uppercase border-b border-slate-300 pb-1 flex justify-between">
                    <span>{sec.title}</span>
                    <span>({sec.points} Pts)</span>
                  </div>
                  <div className="whitespace-pre-wrap pl-2 leading-loose">
                    {sec.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom signature and line */}
            <div className="border-t border-slate-200 pt-6 text-center text-[9px] font-sans text-slate-400 uppercase tracking-wider">
              Fin de l'épreuve • Lycée de Ngoa-Ekellé Département de {activeExam.subject}
            </div>
          </div>
        </>
      ) : (
        /* Exercises & TD Panoply View */
         <div className="space-y-6 animate-fade-in print:hidden">
          {/* Top selection card */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <BookOpen className="text-emerald-600 animate-pulse" size={18} />
              <h3 className="font-bold text-slate-900 text-sm">Paramètres de la Banque d'Exercices</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Class settings */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Classe visée</label>
                  <input
                    type="text"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Statut de la génération :</span>
                  <div className="text-xs text-slate-600 font-medium">
                    {selectedChapters.length > 0 ? (
                      <span className="text-emerald-700 font-semibold">
                        Générera des exercices pour : {selectedChapters.join(', ')}
                      </span>
                    ) : (
                      <span className="text-rose-600 italic">Aucun chapitre sélectionné</span>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleGeneratePanoply}
                    disabled={isGeneratingPanoply}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles size={16} className={isGeneratingPanoply ? 'animate-spin' : ''} />
                    <span>{isGeneratingPanoply ? 'Génération...' : 'Générer la Banque d\'Exercices & TD'}</span>
                  </button>
                </div>
              </div>

              {/* Right Column (takes 2 span): Multi-Chapter Selection Panel */}
              <div className="lg:col-span-2 space-y-3 pl-0 lg:pl-6 border-t lg:border-t-0 lg:border-l border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <span>Chapitres d'évaluation</span>
                    <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded font-mono font-bold border border-emerald-200">
                      MINESEC Sync
                    </span>
                  </span>
                  {selectedChapters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedChapters([])}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Tout effacer
                    </button>
                  )}
                </div>

                {/* Badges container */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[44px]">
                  {selectedChapters.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Aucun chapitre sélectionné</span>
                  ) : (
                    selectedChapters.map((chap, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-md animate-fade-in">
                        <span className="truncate max-w-[150px]">{chap}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedChapters(prev => prev.filter(c => c !== chap))}
                          className="text-emerald-600 hover:text-emerald-800 focus:outline-none ml-1 font-bold"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left sub-col: Checkbox List of validated lessons */}
                  {validatedLessonsFromCoverage.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        <span>Chapitres validés de la classe ({validatedLessonsFromCoverage.length}) :</span>
                      </span>
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2.5 space-y-1 bg-white">
                        {validatedLessonsFromCoverage.map((chap, idx) => {
                          const isChecked = selectedChapters.includes(chap);
                          return (
                            <label key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedChapters(prev => prev.filter(c => c !== chap));
                                  } else {
                                    setSelectedChapters(prev => [...prev, chap]);
                                  }
                                }}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className="truncate">{chap}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[11px] space-y-1 self-start">
                      <p className="font-bold flex items-center gap-1 text-amber-700">
                        <AlertCircle size={14} className="text-amber-600 shrink-0" />
                        <span>Lien automatique actif</span>
                      </p>
                      <p className="text-slate-600 leading-relaxed font-medium">
                        Aucun chapitre n'est marqué comme <strong>"Fait"</strong> dans le <strong>Suivi des Programmes</strong> pour la classe <strong>{selectedClass}</strong>. Saisissez ou ajoutez des chapitres ci-dessous.
                      </p>
                    </div>
                  )}

                  {/* Right sub-col: Dropdown and Text inputs */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ajouter un chapitre de la progression officielle</label>
                      <select
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !selectedChapters.includes(val)) {
                            setSelectedChapters(prev => [...prev, val]);
                          }
                          e.target.value = ""; // reset
                        }}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Sélectionner pour ajouter --</option>
                        {getDefaultChapters(selectedClass).map((chap, i) => (
                          <option key={i} value={chap}>{chap}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saisir un chapitre personnalisé</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCustomChapter}
                          onChange={(e) => setNewCustomChapter(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newCustomChapter.trim() && !selectedChapters.includes(newCustomChapter.trim())) {
                                setSelectedChapters(prev => [...prev, newCustomChapter.trim()]);
                                setNewCustomChapter('');
                              }
                            }
                          }}
                          placeholder="Ex: Fonctions exponentielles..."
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newCustomChapter.trim() && !selectedChapters.includes(newCustomChapter.trim())) {
                              setSelectedChapters(prev => [...prev, newCustomChapter.trim()]);
                              setNewCustomChapter('');
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Loading status layout */}
          {isGeneratingPanoply && (
            <div className="bg-white p-12 rounded-xl border border-slate-100 shadow-sm text-center space-y-4 animate-pulse">
              <div className="relative inline-flex items-center justify-center">
                <div className="absolute w-12 h-12 border-4 border-emerald-200 rounded-full animate-ping"></div>
                <div className="relative w-12 h-12 border-4 border-t-emerald-600 border-emerald-100 rounded-full animate-spin"></div>
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="font-bold text-slate-800 text-base">Génération de la panoplie en cours</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  L'intelligence artificielle analyse le programme du Ministère des Enseignements Secondaires, élabore des exercices d'application, de consolidation, et un travail dirigé complet avec leurs corrigés détaillés.
                </p>
                <div className="pt-3 text-[10px] text-emerald-600 font-mono flex items-center justify-center gap-1">
                  <span>● Calcul des barèmes de notation...</span>
                </div>
              </div>
            </div>
          )}

          {/* Render generated panoply content */}
          {!isGeneratingPanoply && generatedPanoply && (
            <div className="space-y-6 animate-fade-in">
              {/* Category selector */}
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActivePanoplyTab('application')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    activePanoplyTab === 'application'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-inner'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <BookOpen size={14} />
                  Exercices d'Application
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
                    {generatedPanoply.applicationExercises?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => setActivePanoplyTab('consolidation')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    activePanoplyTab === 'consolidation'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-inner'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <Layers size={14} />
                  Exercices de Consolidation
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
                    {generatedPanoply.consolidationExercises?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => setActivePanoplyTab('td')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    activePanoplyTab === 'td'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-inner'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <Award size={14} />
                  Travaux Dirigés (TD / Compétences)
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
                    {generatedPanoply.supervisedWorks?.length || 0}
                  </span>
                </button>
              </div>

              {/* Exercises rendered according to current active category tab */}
              <div className="space-y-6">
                {activePanoplyTab === 'application' && (
                  <>
                    {generatedPanoply.applicationExercises?.map((ex, idx) => (
                      <div key={`app-${idx}`} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                              Application Directe
                            </span>
                            <h4 className="font-bold text-slate-800 text-base mt-2">{ex.title}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyText(`${ex.title}\n${ex.statement}`, `app-stmt-${idx}`)}
                              className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg border border-slate-100 transition-all flex items-center gap-1 text-xs"
                              title="Copier l'énoncé"
                            >
                              {copiedId === `app-stmt-${idx}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              <span>{copiedId === `app-stmt-${idx}` ? "Copié !" : "Copier"}</span>
                            </button>
                            
                            <button
                              onClick={() => handleAppendToExam(0, ex.title, ex.statement, ex.solution)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs transition-all flex items-center gap-1"
                              title="Ajouter à la Partie A (Ressources)"
                            >
                              <Plus size={13} />
                              <span>＋ Partie A (Ressources)</span>
                            </button>
                          </div>
                        </div>

                        {/* Statement area */}
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm font-serif leading-relaxed text-slate-800 whitespace-pre-wrap">
                          {ex.statement}
                        </div>

                        {/* Collapsible Solution section */}
                        <div className="border-t border-slate-100 pt-3">
                          <button
                            onClick={() => toggleSolution(`app-sol-${idx}`)}
                            className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-all"
                          >
                            {visibleSolutions[`app-sol-${idx}`] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <span>{visibleSolutions[`app-sol-${idx}`] ? "Masquer la solution pédagogique" : "Afficher la solution pédagogique"}</span>
                          </button>

                          {visibleSolutions[`app-sol-${idx}`] && (
                            <div className="mt-3 p-4 bg-amber-50/40 border border-amber-100 text-xs text-amber-950 font-mono leading-relaxed rounded-lg whitespace-pre-wrap">
                              <span className="font-bold uppercase text-[9px] text-amber-600 block mb-2">Corrigé indicatif détaillé :</span>
                              {ex.solution}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!generatedPanoply.applicationExercises || generatedPanoply.applicationExercises.length === 0) && (
                      <p className="text-sm text-slate-400 italic text-center py-6">Aucun exercice d'application généré.</p>
                    )}
                  </>
                )}

                {activePanoplyTab === 'consolidation' && (
                  <>
                    {generatedPanoply.consolidationExercises?.map((ex, idx) => (
                      <div key={`con-${idx}`} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-teal-600 uppercase bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100">
                              Consolidation & Méthodes
                            </span>
                            <h4 className="font-bold text-slate-800 text-base mt-2">{ex.title}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyText(`${ex.title}\n${ex.statement}`, `con-stmt-${idx}`)}
                              className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg border border-slate-100 transition-all flex items-center gap-1 text-xs"
                              title="Copier l'énoncé"
                            >
                              {copiedId === `con-stmt-${idx}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              <span>{copiedId === `con-stmt-${idx}` ? "Copié !" : "Copier"}</span>
                            </button>
                            
                            <button
                              onClick={() => handleAppendToExam(0, ex.title, ex.statement, ex.solution)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs transition-all flex items-center gap-1"
                            >
                              <Plus size={13} />
                              <span>＋ Partie A (Ressources)</span>
                            </button>
                          </div>
                        </div>

                        {/* Statement area */}
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm font-serif leading-relaxed text-slate-800 whitespace-pre-wrap">
                          {ex.statement}
                        </div>

                        {/* Collapsible Solution section */}
                        <div className="border-t border-slate-100 pt-3">
                          <button
                            onClick={() => toggleSolution(`con-sol-${idx}`)}
                            className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-all"
                          >
                            {visibleSolutions[`con-sol-${idx}`] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <span>{visibleSolutions[`con-sol-${idx}`] ? "Masquer la solution pédagogique" : "Afficher la solution pédagogique"}</span>
                          </button>

                          {visibleSolutions[`con-sol-${idx}`] && (
                            <div className="mt-3 p-4 bg-amber-50/40 border border-amber-100 text-xs text-amber-950 font-mono leading-relaxed rounded-lg whitespace-pre-wrap">
                              <span className="font-bold uppercase text-[9px] text-amber-600 block mb-2">Corrigé indicatif détaillé :</span>
                              {ex.solution}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!generatedPanoply.consolidationExercises || generatedPanoply.consolidationExercises.length === 0) && (
                      <p className="text-sm text-slate-400 italic text-center py-6">Aucun exercice de consolidation généré.</p>
                    )}
                  </>
                )}

                {activePanoplyTab === 'td' && (
                  <>
                    {generatedPanoply.supervisedWorks?.map((ex, idx) => (
                      <div key={`td-${idx}`} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-sky-600 uppercase bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
                              Travail Dirigé (Étude de cas / Compétences)
                            </span>
                            <h4 className="font-bold text-slate-800 text-base mt-2">{ex.title}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyText(`${ex.title}\n${ex.statement}`, `td-stmt-${idx}`)}
                              className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg border border-slate-100 transition-all flex items-center gap-1 text-xs"
                              title="Copier l'énoncé"
                            >
                              {copiedId === `td-stmt-${idx}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              <span>{copiedId === `td-stmt-${idx}` ? "Copié !" : "Copier"}</span>
                            </button>
                            
                            <button
                              onClick={() => handleAppendToExam(1, ex.title, ex.statement, ex.solution)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100 font-semibold rounded-lg text-xs transition-all flex items-center gap-1 animate-fade-in"
                            >
                              <Plus size={13} />
                              <span>＋ Partie B (Compétences)</span>
                            </button>
                          </div>
                        </div>

                        {/* Statement area */}
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm font-serif leading-relaxed text-slate-800 whitespace-pre-wrap">
                          {ex.statement}
                        </div>

                        {/* Collapsible Solution section */}
                        <div className="border-t border-slate-100 pt-3">
                          <button
                            onClick={() => toggleSolution(`td-sol-${idx}`)}
                            className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-all"
                          >
                            {visibleSolutions[`td-sol-${idx}`] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <span>{visibleSolutions[`td-sol-${idx}`] ? "Masquer la solution pédagogique" : "Afficher la solution pédagogique"}</span>
                          </button>

                          {visibleSolutions[`td-sol-${idx}`] && (
                            <div className="mt-3 p-4 bg-amber-50/40 border border-amber-100 text-xs text-amber-950 font-mono leading-relaxed rounded-lg whitespace-pre-wrap">
                              <span className="font-bold uppercase text-[9px] text-amber-600 block mb-2">Corrigé indicatif détaillé :</span>
                              {ex.solution}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!generatedPanoply.supervisedWorks || generatedPanoply.supervisedWorks.length === 0) && (
                      <p className="text-sm text-slate-400 italic text-center py-6">Aucun travail dirigé généré.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Fallback card if nothing generated yet */}
          {!isGeneratingPanoply && !generatedPanoply && (
            <div className="bg-white p-12 rounded-xl border border-slate-100 shadow-sm text-center space-y-4 max-w-xl mx-auto">
              <div className="inline-flex items-center justify-center p-3 bg-emerald-50 rounded-full text-emerald-700">
                <BookOpen size={28} />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-800 text-base">Aucune banque d'exercices générée</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sélectionnez le chapitre ciblé de votre choix et cliquez sur le bouton <span className="font-bold">"Générer la Banque d'Exercices & TD"</span> ci-dessus. L'IA rédigera instantanément une panoplie d'exercices d'application, de consolidation et des travaux dirigés complets dotés de leurs corrigés de référence.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating dynamic Toast Notifications */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 z-50 animate-fade-in border border-slate-850">
          <Sparkles size={14} className="text-emerald-400 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 z-50 animate-bounce">
          <Save size={14} />
          <span>Sujet sauvegardé avec succès dans l'historique !</span>
        </div>
      )}

      {/* Proofreading results modal panel */}
      {showProofreadPanel && proofreadResult && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg">
                  <SpellCheck size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm md:text-base">Analyse orthographique & grammaticale</h4>
                  <p className="text-[11px] text-slate-500">Gemini a analysé les textes de votre épreuve et du corrigé.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowProofreadPanel(false);
                  setProofreadResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 transition-all text-sm"
              >
                ✕
              </button>
            </div>

            {/* Corrections Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {proofreadResult.corrections && proofreadResult.corrections.length > 0 ? (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Suggestions de correction :</span>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    {proofreadResult.corrections.map((corr, idx) => (
                      <div key={idx} className="p-4 bg-white hover:bg-slate-50/50 transition-all space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold uppercase tracking-wider">
                            Suggestion {idx + 1}
                          </span>
                          <span className="text-xs text-slate-500 italic font-mono">{corr.explanation}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-2.5 bg-rose-50 border border-rose-100 rounded text-rose-900 line-through whitespace-pre-wrap leading-relaxed">
                            {corr.original}
                          </div>
                          <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded text-emerald-950 font-medium whitespace-pre-wrap leading-relaxed">
                            {corr.corrected}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-2">
                  <div className="inline-flex p-3 bg-emerald-50 text-emerald-700 rounded-full">
                    <Check size={24} />
                  </div>
                  <h5 className="font-bold text-slate-800 text-sm">Félicitations ! Aucune faute n'a été identifiée.</h5>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">Votre épreuve respecte parfaitement les règles d'orthographe et de grammaire.</p>
                </div>
              )}

              {/* Comparative previews */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Aperçu du texte révisé :</span>
                <div className="space-y-3.5 text-xs">
                  {proofreadResult.correctedSections.map((sec, idx) => {
                    const originalContent = activeExam.sections[idx]?.content || "";
                    const isDifferent = originalContent.trim() !== (sec.content || "").trim();
                    return (
                      <div key={idx} className="space-y-1 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{sec.title}</span>
                          {isDifferent ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">Modifié</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px]">Inchangé</span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap max-h-24 overflow-y-auto mt-1 border border-slate-200 bg-white p-2 rounded">
                          {sec.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowProofreadPanel(false);
                  setProofreadResult(null);
                }}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg transition-all"
              >
                Ignorer
              </button>
              <button
                onClick={handleApplyCorrections}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Appliquer les corrections</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archives Modal */}
      {showArchivesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in print:hidden">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-base">Sujets d'Épreuve Archivés ({exams.length})</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowArchivesModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto space-y-4">
              {exams.length > 0 ? (
                exams.map((exam) => (
                  <div key={exam.id} className="p-4 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/65 hover:border-emerald-400 transition-all">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wider px-2 py-0.5 rounded uppercase">
                          {exam.className}
                        </span>
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-black tracking-wider px-2 py-0.5 rounded uppercase">
                          {exam.examType}
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          {exam.createdAt 
                            ? (typeof exam.createdAt === 'object' && exam.createdAt !== null && 'toDate' in exam.createdAt 
                                ? (exam.createdAt as any).toDate().toLocaleDateString() 
                                : new Date(exam.createdAt as any).toLocaleDateString()) 
                            : 'Date non spécifiée'}
                        </span>
                        {exam.duration && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            • {exam.duration}
                          </span>
                        )}
                        {exam.coefficient && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            • Coeff. {exam.coefficient}
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        {exam.title}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Discipline : {exam.subject}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveExam(exam);
                          setShowArchivesModal(false);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        Charger
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveExam(exam);
                          setShowArchivesModal(false);
                          setTimeout(() => {
                            window.print();
                          }, 300);
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                        title="Imprimer ou Exporter en PDF"
                      >
                        <FileDown size={14} />
                        Imprimer / PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExam(exam.id)}
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
                  <p className="text-xs font-bold">Aucun sujet d'épreuve archivé pour le moment.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Concevez ou générez une épreuve, puis cliquez sur "Archiver le sujet" pour la sauvegarder.</p>
                </div>
              )}
            </div>

            {/* Footer */}
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