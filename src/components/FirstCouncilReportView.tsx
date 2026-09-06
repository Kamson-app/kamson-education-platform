/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import type {
  EstablishmentSettings,
  CouncilReport,
  UserProfile,
  ClassGradeSheet,
  HourCoverage,
  ProgramCoverage,
} from '../types';
import { exportFirstCouncilToPDF } from '../utils/pdfExport';
import { reportAIService } from '../services/report/reportAIService';
import { FileText, Printer, Sparkles, Save, Archive, FileDown, X } from 'lucide-react';

export default function FirstCouncilReportView({
  currentUser,
  establishment,
  reports,
  departmentTeachers,
  gradeSheets,
  allHourCoverages,
  allProgramCoverages,
  onSaveReport,
}: {
  currentUser: UserProfile;
  establishment: EstablishmentSettings | null;
  reports: CouncilReport[];
  departmentTeachers: UserProfile[];
  gradeSheets: ClassGradeSheet[];
  allHourCoverages: HourCoverage[];
  allProgramCoverages: ProgramCoverage[];
  onSaveReport: (report: CouncilReport) => Promise<void>;
  onExportPDF?: (report: CouncilReport) => void;
}) {
  const normalizeText = (value: unknown): string =>
    String(value ?? '')
      .trim()
      .toLowerCase();

  const normalizeAcademicYear = (value: unknown): string =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, '')
      .replace(/\//g, '-');

  const dashboardStatistics = useMemo(() => {
    const establishmentId =
      establishment?.id ||
      currentUser.establishmentId ||
      '';

    const departmentId =
      currentUser.departmentId ||
      '';

    const academicYear =
      establishment?.academicYear ||
      '';

    const normalizedYear =
      normalizeAcademicYear(academicYear);

    const isInScope = (item: any): boolean =>
      normalizeText(item.establishmentId) ===
        normalizeText(establishmentId) &&
      normalizeText(item.departmentId) ===
        normalizeText(departmentId) &&
      normalizeAcademicYear(
        item.academicYear ?? item.academicYear
      ) === normalizedYear;

    const gradeSheetsInScope =
      gradeSheets.filter(isInScope);

    /*
     * Un relevé réel constitue la source des statistiques.
     * On conserve une ligne par classe pour ne pas compter
     * deux fois les mêmes élèves.
     */
    const statisticsByClass = new Map<
      string,
      {
        className: string;
        totalStudents: number;
        boys: number;
        girls: number;
        admitted: number;
        average: number;
      }
    >();

    gradeSheetsInScope.forEach((sheet) => {
      const classKey = normalizeText(sheet.className);

      if (!classKey || statisticsByClass.has(classKey)) {
        return;
      }

      const students = Array.isArray(sheet.students)
        ? sheet.students
        : [];

      const totalStudents = students.length;

      const boys = students.filter(
        (student: any) => student.gender === 'M'
      ).length;

      const girls = students.filter(
        (student: any) => student.gender === 'F'
      ).length;

      const averages = students
        .map((student: any) => Number(student.average))
        .filter((average) => Number.isFinite(average));

      const admitted = averages.filter(
        (average) => average >= 10
      ).length;

      const average =
        averages.length > 0
          ? averages.reduce(
              (sum, value) => sum + value,
              0
            ) / averages.length
          : 0;

      statisticsByClass.set(classKey, {
        className: sheet.className || 'Classe non renseignée',
        totalStudents,
        boys,
        girls,
        admitted,
        average,
      });
    });

    const studentStats =
      Array.from(statisticsByClass.values());

    const hourCoverages =
      allHourCoverages.filter(isInScope);

    const programCoverages =
      allProgramCoverages.filter(isInScope);

    const totalStudents = studentStats.reduce(
      (sum, stat) => sum + Number(stat.totalStudents || 0),
      0
    );

    const totalBoys = studentStats.reduce(
      (sum, stat) => sum + Number(stat.boys || 0),
      0
    );

    const totalGirls = studentStats.reduce(
      (sum, stat) => sum + Number(stat.girls || 0),
      0
    );

    const admittedStudents = studentStats.reduce(
      (sum, stat) => sum + Number(stat.admitted || 0),
      0
    );

    const weightedAverageSum = studentStats.reduce(
      (sum, stat) =>
        sum +
        Number(stat.average || 0) *
          Number(stat.totalStudents || 0),
      0
    );

    const average =
      totalStudents > 0
        ? weightedAverageSum / totalStudents
        : null;

    const successRate =
      totalStudents > 0
        ? (admittedStudents / totalStudents) * 100
        : null;

    const annualHoursPlanned = hourCoverages.reduce(
      (sum, coverage) =>
        sum + Number(coverage.plannedHoursAnnual || 0),
      0
    );

    const annualHoursCompleted = hourCoverages.reduce(
      (sum, coverage) =>
        sum + Number(coverage.realizedHoursAnnual || 0),
      0
    );

    const hoursCoverageRate =
      annualHoursPlanned > 0
        ? (annualHoursCompleted / annualHoursPlanned) * 100
        : null;

    const annualProgramsPlanned = programCoverages.reduce(
      (sum, coverage) =>
        sum +
        Number(
          (coverage as any).plannedLessonsAnnual ??
          coverage.plannedLessons ??
          0
        ),
      0
    );

    const annualProgramsCompleted = programCoverages.reduce(
      (sum, coverage) =>
        sum +
        Number(
          (coverage as any).completedLessonsAnnual ??
          coverage.completedLessons ??
          0
        ),
      0
    );

    const programsCoverageRate =
      annualProgramsPlanned > 0
        ? (annualProgramsCompleted / annualProgramsPlanned) * 100
        : null;

    return {
      classCount: new Set(
        studentStats
          .map((stat) => normalizeText(stat.className))
          .filter(Boolean)
      ).size,

      totalStudents,
      totalBoys,
      totalGirls,

      average,
      successRate,
      hoursCoverageRate,
      programsCoverageRate,
    };
  }, [
    gradeSheets,
    allHourCoverages,
    allProgramCoverages,
    establishment?.id,
    establishment?.academicYear,
    currentUser.establishmentId,
    currentUser.departmentId,
  ]);

  const scopedUser = currentUser as UserProfile & {
    establishmentId?: string;
    departmentId?: string;
  };

  const resolvedEstablishmentId =
    establishment?.id ||
    scopedUser.establishmentId ||
    '';

  const resolvedDepartmentId =
    scopedUser.departmentId ||
    '';

  // Recherche d'un rapport existant actif pour le premier conseil
  const existingReport = reports.find(r => r.type === 'PREMIER_CONSEIL' && r.status !== 'ARCHIVE');

  // Filtrage dynamique des archives réelles issues de Firebase / Props
  const archivedReports = reports.filter(r => r.type === 'PREMIER_CONSEIL' && r.status === 'ARCHIVE');

  const [report, setReport] = useState<CouncilReport>(existingReport || {
    id: 'rep-first-council',
    type: 'PREMIER_CONSEIL',
    establishmentId: resolvedEstablishmentId,
    departmentId: resolvedDepartmentId,
    date: new Date().toISOString().split('T')[0],
    academicYear: establishment?.academicYear ?? "",
    agenda: [
      "Prise de contact entre les enseignants du département",
      "Analyse des programmes nationaux officiels et des progressions de l'APC",
      "Choix et harmonisation des manuels scolaires",
      "Harmonisation des critères d'évaluation et de notation",
      "Mise en place d'un calendrier des contrôles continus"
    ],
    content: "L'an deux mille vingt-cinq, s'est tenu au sein de l'établissement le premier conseil d'enseignement de la matière... La séance était présidée par l'Animateur Pédagogique.",
    resolutions: [
      "Adoption et respect rigoureux des progressions harmonisées.",
      "Vérification hebdomadaire des cahiers de textes.",
      "Organisation d'interrogations coordonnées chaque fin de chapitre."
    ],
    attendance: departmentTeachers.map(
      (teacher) =>
        `${teacher.name || 'Enseignant non renseigné'} (${
          teacher.role === 'ANIMATEUR_PEDAGOGIQUE'
            ? 'Animateur pédagogique'
            : 'Enseignant'
        })`
    ),
    status: 'BROUILLON',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showArchives, setShowArchives] = useState<boolean>(false);
  const [selectedArchive, setSelectedArchive] = useState<CouncilReport | null>(null);

  const handleGenerate = async () => {
    if (dashboardStatistics.successRate === null) {
      alert(
        "Impossible de générer l'analyse : aucune statistique réelle de réussite n'est disponible pour ce département."
      );
      return;
    }

    setIsGenerating(true);

    try {
      const aiReport = await reportAIService.generateReportAnalysis({
        discipline: establishment?.departmentName || "Département",
        trimester: "Premier Conseil d'Enseignement",
        academicYear: establishment?.academicYear || "",
        establishment: establishment?.establishmentName || "",
        
        statistics: {
          nombreClasses: dashboardStatistics.classCount,
          effectifTotal: dashboardStatistics.totalStudents,
          totalGarcons: dashboardStatistics.totalBoys,
          totalFilles: dashboardStatistics.totalGirls,

          moyenneGenerale:
            dashboardStatistics.average !== null
              ? dashboardStatistics.average.toFixed(2)
              : 'Données non renseignées',

          tauxReussite: Number(
            dashboardStatistics.successRate.toFixed(1)
          ),

          couvertureHeures:
            dashboardStatistics.hoursCoverageRate !== null
              ? `${dashboardStatistics.hoursCoverageRate.toFixed(1)}%`
              : 'Données non renseignées',

          couvertureProgrammes:
            dashboardStatistics.programsCoverageRate !== null
              ? `${dashboardStatistics.programsCoverageRate.toFixed(1)}%`
              : 'Données non renseignées',

          tauxAssiduite: 'Données non renseignées',
          nerTotal: dashboardStatistics.totalStudents,
        },

        coverage: `
Couverture des heures d'enseignement :
${
  dashboardStatistics.hoursCoverageRate !== null
    ? `${dashboardStatistics.hoursCoverageRate.toFixed(1)}%`
    : 'Données non renseignées'
}.

Couverture des programmes :
${
  dashboardStatistics.programsCoverageRate !== null
    ? `${dashboardStatistics.programsCoverageRate.toFixed(1)}%`
    : 'Données non renseignées'
}.
`,

        observations: `
Premier conseil d'enseignement de l'année scolaire.
Prise de contact entre les enseignants.
Harmonisation des progressions et des pratiques pédagogiques.
Organisation du suivi des apprentissages et des évaluations.
`
      });

      if (!aiReport) {
        throw new Error("L'IA n'a retourné aucun rapport.");
      }

      const content = [
        aiReport.introduction,

        "MANUELS SCOLAIRES",
        aiReport.manuals,

        "SALLES ET CONDITIONS DE TRAVAIL",
        aiReport.classrooms,

        "CONDITIONS DE TRAVAIL",
        aiReport.workingConditions,

        "COUVERTURE DES HEURES",
        aiReport.hourCoverage,

        "COUVERTURE DES PROGRAMMES",
        aiReport.programCoverage,

        "COUVERTURE NUMÉRIQUE",
        aiReport.digitalCoverage,

        "CORRÉLATIONS ET ANALYSE",
        aiReport.correlations,

        "ASSIDUITÉ",
        aiReport.attendance,

        "EXERCICES ET ACTIVITÉS",
        aiReport.exercises,

        "ÉVALUATIONS",
        aiReport.evaluations,

        "DIFFICULTÉS DES ENSEIGNANTS",
        aiReport.teachersDifficulties,

        "DIFFICULTÉS DES ÉLÈVES",
        aiReport.studentsDifficulties,

        "DIFFICULTÉS INSTITUTIONNELLES",
        aiReport.institutionalDifficulties,
      ].join('\n\n');

      setReport(prev => ({
        ...prev,
        content: content,
        updatedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Erreur génération IA :', err);
      alert(err instanceof Error ? err.message : 'Impossible de générer le rapport avec l’IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!resolvedEstablishmentId || !resolvedDepartmentId) {
      alert(
        "Impossible d'enregistrer le rapport : établissement ou département manquant."
      );
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const reportToSave: CouncilReport = {
        ...report,
        establishmentId: resolvedEstablishmentId,
        departmentId: resolvedDepartmentId,
        academicYear:
          establishment?.academicYear ||
          report.academicYear ||
          '',
        updatedAt: new Date().toISOString(),
      };

      await onSaveReport(reportToSave);

      setReport(reportToSave);
      setSaveSuccess(true);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (report.status === 'ARCHIVE') {
      alert("Ce rapport est déjà archivé.");
      return;
    }

    if (!resolvedEstablishmentId || !resolvedDepartmentId) {
      alert(
        "Impossible d'archiver le rapport : établissement ou département manquant."
      );
      return;
    }

    try {
      setIsSaving(true);

      const archivedReport: CouncilReport = {
        ...report,
        establishmentId: resolvedEstablishmentId,
        departmentId: resolvedDepartmentId,
        status: 'ARCHIVE',
        updatedAt: new Date().toISOString(),
      };

      await onSaveReport(archivedReport);

      setReport(archivedReport);
      setSaveSuccess(true);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Erreur lors de l'archivage :", error);
      alert("Impossible d'archiver le rapport.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Screen Controls Header (Masqué à l'impression) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-emerald-600" size={24} />
            Rapport du Premier Conseil d'Enseignement
          </h1>
          <p className="text-sm text-slate-500">
            Rédigez automatiquement ou manuellement le rapport constitutif du début d'année scolaire.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowArchives(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
          >
            <Archive size={15} className="text-amber-600" />
            <span>Voir mes archives ({archivedReports.length})</span>
          </button>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-650 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Sparkles size={15} className={isGenerating ? 'animate-pulse' : ''} />
            <span>{isGenerating ? 'IA en cours...' : 'Générer (IA)'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Save size={15} className="text-blue-600" />
            <span>{isSaving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
          </button>

          <button
            onClick={handleArchive}
            disabled={isSaving || report.status === 'ARCHIVE'}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Archive size={15} />
            <span>
              {report.status === 'ARCHIVE' ? 'Archivé' : 'Archiver'}
            </span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Printer size={15} />
            <span>Imprimer</span>
          </button>

          <button
            onClick={() => {
              if (!establishment) return;
              exportFirstCouncilToPDF(report, establishment);
            }}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <FileDown size={15} />
            <span>Exporter PDF</span>
          </button>
        </div>
      </div>

      {/* Panels d'édition (Masqués à l'impression) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden">
        <div className="lg:col-span-1 space-y-6 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">Informations générales</h3>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Date du conseil</label>
              <input
                type="date"
                value={report.date}
                onChange={(e) => setReport(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Membres présents (un par ligne)</label>
              <textarea
                rows={4}
                value={report.attendance.join('\n')}
                onChange={(e) => setReport(prev => ({ ...prev, attendance: e.target.value.split('\n') }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                placeholder="Ex : Saisir les membres présents"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Résolutions adoptées (une par ligne)</label>
              <textarea
                rows={4}
                value={report.resolutions.join('\n')}
                onChange={(e) => setReport(prev => ({ ...prev, resolutions: e.target.value.split('\n') }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                placeholder="Ex : Suivi hebdomadaire des cahiers"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">Contenu principal du procès-verbal</h3>
          <textarea
            rows={16}
            value={report.content}
            onChange={(e) => setReport(prev => ({ ...prev, content: e.target.value, updatedAt: new Date().toISOString() }))}
            className="w-full p-4 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
            placeholder="Écrivez le compte rendu détaillé ou utilisez l'assistant de génération IA ci-dessus..."
          />
        </div>
      </div>

      {/* Layout officiel d'impression MINESEC */}
      <div className="bg-white p-4 sm:p-8 md:p-12 lg:p-16 border border-slate-200 shadow-xl rounded-xl mx-auto max-w-[800px] font-serif text-slate-900 space-y-8 relative overflow-hidden print:border-none print:shadow-none print:p-0 print:mx-0 print:max-w-none">
        
        <div className="grid grid-cols-2 text-center text-[10px] font-bold uppercase leading-tight border-b-2 border-slate-800 pb-4">
          <div className="space-y-1">
            <div>RÉPUBLIQUE DU CAMEROUN</div>
            <div className="text-[8px] font-medium font-sans">Paix - Travail - Patrie</div>
            <div className="pt-1">{establishment?.ministry?.toUpperCase()??""}</div>
            <div>DÉLÉGATION RÉGIONALE DU {establishment?.region?.toUpperCase()??""}</div>
            <div>DÉLÉGATION DÉPARTEMENTALE DU {establishment?.delegation?.toUpperCase()??""}</div>
            <div>{establishment?.establishmentName?.toUpperCase()??""}</div>
          </div>
          <div className="space-y-1 border-l border-slate-300">
            <div>REPUBLIC OF CAMEROON</div>
            <div className="text-[8px] font-medium font-sans">Peace - Work - Fatherland</div>
            <div className="pt-1">MINISTRY OF SECONDARY EDUCATION</div>
            <div>REGIONAL DELEGATION</div>
            <div>DIVISIONAL DELEGATION</div>
            <div>SCHOOL YEAR : {establishment?.academicYear??""}</div>
          </div>
        </div>

        <div className="text-center space-y-1">
          <div className="text-xs uppercase tracking-widest font-sans font-semibold text-slate-500">
            DÉPARTEMENT DE : {establishment?.departmentName?.toUpperCase()??""}
          </div>
          <h2 className="text-xl font-extrabold tracking-tight underline uppercase">
            PROCÈS-VERBAL DU PREMIER CONSEIL D'ENSEIGNEMENT
          </h2>
          <p className="text-xs italic">Séance tenue le : {new Date(report.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed whitespace-pre-wrap">
          <div>
            <h4 className="font-bold underline uppercase text-xs">I. ORDRE DU JOUR :</h4>
            <ul className="list-disc pl-5 font-sans text-xs space-y-1 mt-1">
              {report.agenda.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold underline uppercase text-xs">II. COMPTE RENDU DES DÉBATS :</h4>
            <div className="text-xs pl-2 font-serif leading-relaxed mt-1">
              {report.content}
            </div>
          </div>

          <div>
            <h4 className="font-bold underline uppercase text-xs">III. RÉSOLUTIONS ADOPTÉES :</h4>
            <ol className="list-decimal pl-5 font-sans text-xs space-y-1 mt-1">
              {report.resolutions.map((res, idx) => (
                <li key={idx} className="font-semibold">{res}</li>
              ))}
            </ol>
          </div>

          <div>
            <h4 className="font-bold underline uppercase text-xs">IV. MEMBRES DU DÉPARTEMENT PRÉSENTS :</h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-sans mt-1">
              {report.attendance.length > 0 ? (
                report.attendance.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 bg-slate-800 rounded-full" />
                    <span>{att}</span>
                  </div>
                ))
              ) : (
                <div className="italic text-slate-400">Aucun membre renseigné.</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 pt-12 text-xs font-bold font-sans">
          <div className="text-center space-y-12">
            <div>Le Rapporteur de Séance</div>
            <div className="italic text-slate-400 font-light">(Signature)</div>
            <div className="underline text-[11px]">Données non renseignées</div>
          </div>
          <div className="text-center space-y-12">
            <div>L'Animateur Pédagogique</div>
            <div className="italic text-slate-400 font-light">(Signature & Cachet)</div>
            <div className="underline text-[11px]">{currentUser.name}</div>
          </div>
        </div>

        <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-6 font-sans">
          Document administratif certifié conforme • Archivage numérique de l'établissement
        </div>
      </div>

      {saveSuccess && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2 animate-bounce">
          <Save size={16} />
          <span>Rapport sauvegardé avec succès !</span>
        </div>
      )}

      {/* Modal des Archives */}
      {showArchives && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden animate-fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Archive size={20} className="text-amber-400" />
                <div>
                  <h3 className="font-bold text-base">Archives des Rapports de Conseils</h3>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">PREMIER CONSEIL D'ENSEIGNEMENT</p>
                </div>
              </div>
              <button
                onClick={() => { setShowArchives(false); setSelectedArchive(null); }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Sidebar de la liste des archives */}
              <div className="w-full md:w-80 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto space-y-3 shrink-0">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Années Antérieures</span>
                <div className="space-y-2">
                  {archivedReports.length > 0 ? (
                    archivedReports.map((arch) => {
                      const isSel = selectedArchive?.id === arch.id;
                      return (
                        <button
                          key={arch.id}
                          onClick={() => setSelectedArchive(arch)}
                          className={`w-full text-left p-3 rounded-xl border transition-all text-xs flex flex-col gap-1.5 cursor-pointer ${
                            isSel
                              ? 'bg-emerald-50 border-emerald-500/30 text-emerald-900 shadow-sm'
                              : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                              {arch.academicYear}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{arch.date}</span>
                          </div>
                          <p className="font-semibold line-clamp-2 leading-snug">Procès-verbal du Premier Conseil d'Enseignement</p>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic p-2">Aucun rapport archivé trouvé.</p>
                  )}
                </div>
              </div>

              {/* Contenu de l'archive sélectionnée */}
              <div className="flex-1 p-6 overflow-y-auto bg-white flex flex-col justify-between">
                {selectedArchive ? (
                  <div className="space-y-6">
                    <div className="border-b border-slate-200 pb-4">
                      <div className="flex items-center gap-2 text-slate-400 font-bold font-mono text-[11px] uppercase tracking-wide">
                        <span>Conseil d'Enseignement</span>
                        <span>•</span>
                        <span>{selectedArchive.academicYear}</span>
                      </div>
                      <h4 className="text-xl font-bold font-serif text-slate-900 leading-tight mt-1">Procès-verbal du Premier Conseil d'Enseignement</h4>
                      <p className="text-xs text-slate-500 mt-1">Date d'archivage : {selectedArchive.date}</p>
                    </div>

                    <div className="space-y-4 text-sm text-slate-700 leading-relaxed font-serif">
                      <div>
                        <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Ordre du Jour</span>
                        <ul className="list-disc pl-5 space-y-1 text-xs font-sans text-slate-600">
                          {selectedArchive.agenda.map((ag, idx) => (
                            <li key={idx}>{ag}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Déroulement de la Séance</span>
                        <p className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs italic">{selectedArchive.content}</p>
                      </div>

                      <div>
                        <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Résolutions Adoptées</span>
                        <ul className="list-decimal pl-5 space-y-1 text-xs font-sans text-slate-600">
                          {selectedArchive.resolutions.map((res, idx) => (
                            <li key={idx}>{res}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Membres Présents</span>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {selectedArchive.attendance.length > 0 ? (
                            selectedArchive.attendance.map((name, idx) => (
                              <span key={idx} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium">
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">Aucun membre renseigné.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Archive size={22} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-950">Aucune archive sélectionnée</h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">Sélectionnez un procès-verbal dans le panneau latéral pour charger et consulter son contenu historique.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-between shrink-0">
              <span className="text-[10px] font-semibold text-slate-400 self-center">Système d'Archivage Pédagogique MINESEC</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowArchives(false); setSelectedArchive(null); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                {selectedArchive && (
                  <>
                    <button
                      onClick={() => {
                        if (!establishment) return;
                        exportFirstCouncilToPDF(selectedArchive, establishment);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <FileDown size={14} />
                      Exporter en PDF
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}