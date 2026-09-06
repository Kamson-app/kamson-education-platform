/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/* ============================================================
 * IMPORTS
 * ============================================================ */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle
} from 'lucide-react';

import type { 
  CouncilReport, 
  UserProfile, 
  StudentStats, 
  HourCoverage, 
  ProgramCoverage, 
  EstablishmentSettings,
  ClassGradeSheet,
  ArchiveReleve,
  Trimester,
  DepartmentTeacherModel
} from '../types';

import { subscribeToDepartmentGradeSheets } from '../services/gradeSheetService';
import { subscribeToArchives } from '../services/archiveService';

import { DEFAULT_COUNCIL_REPORT, TRIMESTERS } from '../constants/defaults';
import { AIOrchestrator } from "../ai/AIOrchestrator";
import { useDepartment } from "../hooks/useDepartment";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";

/* ============================================================
 * TYPES ET INTERFACES
 * ============================================================ */
interface TrimestrialReportViewProps {
  currentUser: UserProfile | null;
  establishment?: EstablishmentSettings | null;
  establishmentSettings?: EstablishmentSettings | null;
  classes?: string[];
  allGradeSheets?: ClassGradeSheet[];

  existingReport?: CouncilReport | null;
  historicalReports?: CouncilReport[];
  allStudentStats?: StudentStats[];
  allHourCoverages?: HourCoverage[];
  allProgramCoverages?: ProgramCoverage[];
  allDepartmentTeachers?: DepartmentTeacherModel[];

  onSaveReport: (report: CouncilReport) => void | Promise<void>;
  onExportPDF: (report: CouncilReport) => void;
  onDeleteReport: (reportId: string) => void | Promise<void>;
  onSelectReport: (report: CouncilReport | null) => void;
  isSaving?: boolean;
}

type ReportStatus = 'Brouillon' | 'En cours' | 'Validé' | 'Archivé';

interface ReportSection {
  id: string;
  weight: number;
  title: string;
  children: React.ReactNode;
}

type ReadableRecord = Record<string, unknown>;

const toReadableRecord = (value: unknown): ReadableRecord => {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  return value as ReadableRecord;
};

const readStringField = (value: unknown, key: string): string => {
  const field = toReadableRecord(value)[key];
  return typeof field === 'string' ? field : '';
};

const readNumberField = (value: unknown, key: string): number => {
  const field = toReadableRecord(value)[key];
  const number = Number(field);
  return Number.isFinite(number) ? number : 0;
};

/* ============================================================
 * INITIALISATION DU COMPOSANT ET ÉTATS
 * ============================================================ */
export const TrimestrialReportView: React.FC<TrimestrialReportViewProps> = ({
  currentUser,
  establishment,
  establishmentSettings,
  classes = [],
  allGradeSheets = [],
  existingReport = null,
  historicalReports = [],
  allStudentStats = [],
  allHourCoverages = [],
  allProgramCoverages = [],
  allDepartmentTeachers = [],
  onSaveReport,
  onExportPDF,
  onDeleteReport,
  onSelectReport,
  isSaving = false
}) => {
  const activeEstablishment = establishmentSettings || establishment;

  const {
    settings,
    loading: departmentLoading,
    error: departmentError
  } = useDepartment();

  // ============================================================
  // EN-TÊTE COMMUN
  // ============================================================
  const reportHeader = useMemo(() => {
    const parameterSettings = settings;
    const parameterEstablishment = activeEstablishment;

    return {
      ministryFr:
        readStringField(parameterSettings, 'ministereFr') ||
        readStringField(parameterSettings, 'ministryFr') ||
        parameterEstablishment?.ministry ||
        '',

      ministryEn:
        readStringField(parameterSettings, 'ministereEn') ||
        readStringField(parameterSettings, 'ministryEn') ||
        readStringField(parameterEstablishment, 'ministryEnglish') ||
        parameterEstablishment?.ministry ||
        '',

      regionFr:
        readStringField(parameterSettings, 'regionFr') ||
        parameterEstablishment?.region ||
        readStringField(parameterEstablishment, 'delegation') ||
        '',

      regionEn:
        readStringField(parameterSettings, 'regionEn') ||
        readStringField(parameterEstablishment, 'regionEnglish') ||
        parameterEstablishment?.region ||
        readStringField(parameterEstablishment, 'delegationEnglish') ||
        '',

      departmentFr:
        readStringField(parameterSettings, 'departementFr') ||
        readStringField(parameterSettings, 'departmentFr') ||
        parameterSettings?.departmentName ||
        parameterEstablishment?.departmentName ||
        readStringField(parameterEstablishment, 'subDelegation') ||
        '',

      departmentEn:
        readStringField(parameterSettings, 'departementEn') ||
        readStringField(parameterSettings, 'departmentEn') ||
        readStringField(parameterSettings, 'departmentNameEn') ||
        readStringField(parameterEstablishment, 'departmentNameEn') ||
        readStringField(parameterEstablishment, 'subDelegationEnglish') ||
        parameterEstablishment?.departmentName ||
        '',

      establishmentFr:
        readStringField(parameterSettings, 'etablissementFr') ||
        readStringField(parameterSettings, 'establishmentFr') ||
        parameterEstablishment?.establishmentName ||
        readStringField(parameterEstablishment, 'schoolName') ||
        '',

      establishmentEn:
        readStringField(parameterSettings, 'etablissementEn') ||
        readStringField(parameterSettings, 'establishmentEn') ||
        readStringField(parameterEstablishment, 'schoolNameEnglish') ||
        readStringField(parameterEstablishment, 'schoolName') ||
        parameterEstablishment?.establishmentName ||
        '',

      departmentName:
        parameterSettings?.departmentName ||
        parameterEstablishment?.departmentName ||
        '',

      discipline:
        parameterSettings?.discipline ||
        parameterEstablishment?.discipline ||
        '',

      academicYear:
        parameterSettings?.academicYear ||
        parameterEstablishment?.academicYear ||
        '',

      date:
        readStringField(parameterSettings, 'dateRapport') ||
        readStringField(parameterSettings, 'reportDate') ||
        new Date().toLocaleDateString('fr-FR'),

      logo:
        readStringField(parameterSettings, 'logo') ||
        readStringField(parameterSettings, 'logoUrl') ||
        parameterEstablishment?.logoUrl ||
        readStringField(parameterEstablishment, 'logo') ||
        ''
    };
  }, [settings, activeEstablishment]);

  const [report, setReport] = useState<CouncilReport>(DEFAULT_COUNCIL_REPORT);
  const [selectedTrimester, setSelectedTrimester] = useState<Trimester>(1);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // ÉTATS DE L'APERÇU ET DU ZOOM
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(0.8);

  // RÉFÉRENCES POUR LES MINIATURES DE NAVIGATION (STYLE ACROBAT)
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const page3Ref = useRef<HTMLDivElement>(null);

  const [competencyStatus, setCompetencyStatus] = useState<string>('');
  const [classroomClimate, setClassroomClimate] = useState<string>('');
  const [headOfDepartment, setHeadOfDepartment] = useState<string>('');

  // États locaux des rubriques sans valeurs par défaut factices
  const [introductionText, setIntroductionText] = useState<string>('');

  /* II */
  const [manuals, setManuals] = useState<string>('');
  const [classrooms, setClassrooms] = useState<string>('');
  const [workingConditions, setWorkingConditions] = useState<string>('');

  /* III */
  const [hourCoverage, setHourCoverage] = useState<string>('');
  const [programCoverage, setProgramCoverage] = useState<string>('');
  const [digitalCoverage, setDigitalCoverage] = useState<string>('');
  const [correlations, setCorrelations] = useState<string>('');

  /* IV */
  const [attendance, setAttendance] = useState<string>('');
  const [exercises, setExercises] = useState<string>('');
  const [evaluations, setEvaluations] = useState<string>('');

  /* V */
  const [teachersDifficulties, setTeachersDifficulties] = useState<string>('');
  const [studentsDifficulties, setStudentsDifficulties] = useState<string>('');
  const [institutionalDifficulties, setInstitutionalDifficulties] = useState<string>('');

  /* VI */
  const [recommendationsAnimator, setRecommendationsAnimator] = useState<string>('');
  const [recommendationsAdministration, setRecommendationsAdministration] = useState<string>('');
  const [recommendationsHierarchy, setRecommendationsHierarchy] = useState<string>('');

  /* VII */
  const [clubs, setClubs] = useState<string>('');

  const [observationsText, setObservationsText] = useState<string>('');
  const [reportStatus, setReportStatus] = useState<ReportStatus>('Brouillon');

  // Références corrigées en HTMLElement pour correspondre aux balises <section>
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // États pour les colonnes dynamiques basées sur la mesure réelle
  const [leftColumnState, setLeftColumnState] = useState<Array<{ id: string; weight: number; title: string; children: React.ReactNode }>>([]);
  const [rightColumnState, setRightColumnState] = useState<Array<{ id: string; weight: number; title: string; children: React.ReactNode }>>([]);

  // ============================================================
  // RELEVÉS DE NOTES ET ARCHIVES DU DÉPARTEMENT
  // ============================================================
  const [departmentGradeSheets, setDepartmentGradeSheets] =
    useState<ClassGradeSheet[]>([]);
  const [gradeSheetsLoading, setGradeSheetsLoading] =
    useState(true);

  const [departmentArchives, setDepartmentArchives] =
    useState<ArchiveReleve[]>([]);
  const [archivesLoading, setArchivesLoading] =
    useState(true);

  const resolvedSchoolId =
    activeEstablishment?.id ||
    currentUser?.establishmentId ||
    '';

  const resolvedDepartmentId =
    settings?.departmentId ||
    activeEstablishment?.departmentId ||
    currentUser?.departmentId ||
    '';

  console.log('[TrimestrialReportView] CONTEXTE RAPPORT', {
    resolvedSchoolId,
    resolvedDepartmentId,
    selectedTrimester,
    academicYear: settings?.academicYear || activeEstablishment?.academicYear,
    establishmentId: activeEstablishment?.id,
    establishmentName:
      activeEstablishment?.establishmentName ||
      activeEstablishment?.schoolName,
    departmentId: settings?.departmentId,
    departmentName:
      settings?.departmentName ||
      activeEstablishment?.departmentName,
      classesCount: classes.length
  });

  useEffect(() => {
    if (!resolvedSchoolId || !resolvedDepartmentId) {
      setDepartmentGradeSheets([]);
      setDepartmentArchives([]);
      setGradeSheetsLoading(false);
      setArchivesLoading(false);
      return;
    }

    setGradeSheetsLoading(true);
    setArchivesLoading(true);

    const unsubscribeGradeSheets = subscribeToDepartmentGradeSheets(
      resolvedSchoolId,
      resolvedDepartmentId,
      (sheets) => {
        console.log(
          '[TrimestrialReportView] RELEVÉS ACTIFS REÇUS',
          {
            nombre: sheets.length,
            sheets
          }
        );

        setDepartmentGradeSheets(sheets);
        setGradeSheetsLoading(false);
      },
      (error) => {
        console.error(
          '[TrimestrialReportView] Erreur relevés actifs :',
          error
        );

        setDepartmentGradeSheets([]);
        setGradeSheetsLoading(false);
      }
    );

    const unsubscribeArchives = subscribeToArchives(
      resolvedSchoolId,
      resolvedDepartmentId,
      (archives) => {
        console.log(
          '[TrimestrialReportView] ARCHIVES REÇUES',
          {
            nombre: archives.length,
            archives
          }
        );

        setDepartmentArchives(archives);
        setArchivesLoading(false);
      },
      (error) => {
        console.error(
          '[TrimestrialReportView] Erreur archives :',
          error
        );

        setDepartmentArchives([]);
        setArchivesLoading(false);
      }
    );

    return () => {
      unsubscribeGradeSheets();
      unsubscribeArchives();
    };
  }, [
    resolvedSchoolId,
    resolvedDepartmentId
  ]);

  // IMPORTANT : cette vue ne doit jamais charger un rapport du PREMIER CONSEIL.
  const quarterlyExistingReport =
     existingReport?.type === 'TRIMESTRIEL' ? existingReport : null;

  const quarterlyHistoricalReports = useMemo(
     () => historicalReports.filter(hist => hist.type === 'TRIMESTRIEL'),
     [historicalReports]
  );

  const loadReport = useCallback((loadedReport: CouncilReport) => {
    setReport(loadedReport);

    if (typeof loadedReport.trimester === 'number') {
      setSelectedTrimester(loadedReport.trimester as Trimester);
    }

    setClassroomClimate(loadedReport.classroomClimate || '');
    setCompetencyStatus(loadedReport.competencyStatus || '');
    setHeadOfDepartment(loadedReport.headOfDepartment || '');

    setReportStatus(
      (loadedReport.reportStatus as ReportStatus) || 'Brouillon'
    );

    // ============================================================
    // I — INTRODUCTION
    // ============================================================
    setIntroductionText(
      loadedReport.sections?.introduction ||
      loadedReport.content ||
      ''
    );

    // ============================================================
    // II — CONDITIONS DE TRAVAIL
    // ============================================================
    setManuals(
      loadedReport.sections?.workingConditions?.material || ''
    );

    setClassrooms(
      loadedReport.sections?.workingConditions?.pedagogicalResources || ''
    );

    setWorkingConditions(
      loadedReport.sections?.workingConditions?.generalConditions || ''
    );

    // ============================================================
    // III — COUVERTURE DES ENSEIGNEMENTS
    // ============================================================
    setHourCoverage(
      loadedReport.sections?.teachingCoverage?.hours || ''
    );

    setProgramCoverage(
      loadedReport.sections?.teachingCoverage?.programs || ''
    );

    setDigitalCoverage(
      loadedReport.sections?.teachingCoverage?.digitalCoursesText || ''
    );

    setCorrelations(
      loadedReport.sections?.teachingCoverage?.correlations || ''
    );

    // ============================================================
    // IV — ANALYSE DES RÉSULTATS
    // ============================================================
    setAttendance(
      loadedReport.sections?.pedagogicalAnalysis?.attendance || ''
    );

    setExercises(
      loadedReport.sections?.pedagogicalAnalysis?.exercises || ''
    );

    setEvaluations(
      loadedReport.sections?.pedagogicalAnalysis?.results || ''
    );

    // ============================================================
    // V — DIFFICULTÉS
    // ============================================================
    setTeachersDifficulties(
      loadedReport.sections?.pedagogicalAnalysis?.teachersDifficulties || ''
    );

    setStudentsDifficulties(
      loadedReport.sections?.pedagogicalAnalysis?.studentsDifficulties || ''
    );

    setInstitutionalDifficulties(
      loadedReport.sections?.pedagogicalAnalysis?.institutionalDifficulties || ''
    );

    // ============================================================
    // VI — SUGGESTIONS
    // ============================================================
    setRecommendationsAnimator(
      loadedReport.sections?.pedagogicalAnalysis?.recommendationsAnimator ||
      loadedReport.sections?.pedagogicalAnalysis?.recommendationsTeachers ||
      loadedReport.recommendations ||
      ''
    );

    setRecommendationsAdministration(
      loadedReport.sections?.pedagogicalAnalysis?.recommendationsAdministration ||
      ''
    );

    setRecommendationsHierarchy(
      loadedReport.sections?.pedagogicalAnalysis?.recommendationsHierarchy ||
      ''
    );

    // ============================================================
    // VII — CLUBS / OBSERVATIONS
    // ============================================================
    setClubs(
      loadedReport.sections?.observations || ''
    );

    setObservationsText(
      loadedReport.sections?.observations ||
      loadedReport.observations ||
      ''
    );
  }, []);

  useEffect(() => {
     if (quarterlyExistingReport) {
       loadReport(quarterlyExistingReport);
     } else {
       const defaultNewReport: CouncilReport = {
          ...DEFAULT_COUNCIL_REPORT,
          id: `rep-trimestriel-${Date.now()}`,
          type: 'TRIMESTRIEL',
          trimester: selectedTrimester,
          academicYear:
            settings?.academicYear ||
            activeEstablishment?.academicYear ||
            '',
          title: 'Rapport de Conseil d’Enseignement de fin de trimestre'
       };
       loadReport(defaultNewReport);
     }
  }, [quarterlyExistingReport, activeEstablishment, settings, selectedTrimester, loadReport]);

  const handleDeleteReport = async (reportId: string) => {
     const confirmed = window.confirm(
       "Voulez-vous vraiment supprimer ce rapport ?"
     );

     if (!confirmed) return;

     try {
         await onDeleteReport(reportId);
         setSaveStatus({
           type: "success",
           message: "Rapport supprimé avec succès."
         });
     } catch {
         setSaveStatus({
           type: "error",
           message: "Impossible de supprimer le rapport."
         });
     }
  };

  const buildCurrentReportPayload = (forcedId?: string): CouncilReport => {
     const currentAcademicYear = settings?.academicYear || activeEstablishment?.academicYear || report.academicYear;
     const currentEstablishmentName = activeEstablishment?.establishmentName || activeEstablishment?.schoolName || '';
     const currentDepartmentName = settings?.departmentName || activeEstablishment?.departmentName || '';

     const existingMatch = quarterlyHistoricalReports.find(hist => {
       const sameTrimester = Number(hist.trimester) === Number(selectedTrimester);
       const sameYear = (hist.academicYear || '').trim().toLowerCase() === (currentAcademicYear || '').trim().toLowerCase();
       const sameEstablishment = !currentEstablishmentName || (hist.establishmentName || '').trim().toLowerCase() === currentEstablishmentName.trim().toLowerCase();
       const sameDepartment = !currentDepartmentName || (hist.departmentName || '').trim().toLowerCase() === currentDepartmentName.trim().toLowerCase();
       
       return sameTrimester && sameYear && sameEstablishment && sameDepartment && hist.id !== existingReport?.id;
     });

     const resolvedId =
     forcedId ||
     quarterlyExistingReport?.id ||
     existingMatch?.id ||
     report.id ||
     `rep-trimestriel-${Date.now()}`;

     return {
        ...report,
        id: resolvedId,
        type: 'TRIMESTRIEL',
        title: 'Rapport de Conseil d’Enseignement de fin de trimestre',
        trimester: selectedTrimester,
        academicYear: currentAcademicYear,
        establishmentName: currentEstablishmentName,
        departmentName: currentDepartmentName,
        classroomClimate,
        competencyStatus,
        headOfDepartment,
        reportStatus,
        teacherName: currentUser?.name || settings?.animatorName || report.teacherName,
        content: introductionText,
        recommendations: recommendationsAnimator,
        observations: observationsText,
        sections: {
          // ============================================================
          // I — INTRODUCTION
          // ============================================================
          introduction: introductionText,

          // ============================================================
          // II — CONDITIONS DE TRAVAIL
          // ============================================================
          workingConditions: {
            material: manuals,
            pedagogicalResources: classrooms,
            generalConditions: workingConditions
          },

          // ============================================================
          // III — COUVERTURE DES ENSEIGNEMENTS
          // ============================================================
          teachingCoverage: {
            hours: hourCoverage,
            programs: programCoverage,
            digitalCoursesText: digitalCoverage,
            correlations
          },

          // ============================================================
          // IV — ANALYSE DES RÉSULTATS
          // ============================================================
          pedagogicalAnalysis: {
            attendance,
            exercises,
            results: evaluations,

            // V — DIFFICULTÉS
            teachersDifficulties,
            studentsDifficulties,
            institutionalDifficulties,

            // VI — SUGGESTIONS
            recommendationsTeachers: recommendationsAnimator,
            recommendationsAnimator,
            recommendationsAdministration,
            recommendationsHierarchy
          },

          // ============================================================
          // VII — OBSERVATIONS / CLUBS
          // ============================================================
          observations: observationsText
        }
     };
  };

  const handleSave = async () => {
     try {
       setSaveStatus({ type: null, message: '' });

       const academicYear =
          settings?.academicYear ||
          report.academicYear ||
          "";
       if (!academicYear) {
          setSaveStatus({
              type: "error",
              message: "Veuillez d'abord configurer l'année scolaire dans les paramètres du département."
          });
          return;
       }
       if (!selectedTrimester) {
        setSaveStatus({ type: 'error', message: 'Erreur de validation : le trimestre sélectionné est obligatoire.' });
        return;
       }

       const currentAcademicYear = academicYear;
       const currentEstablishmentName = activeEstablishment?.establishmentName || activeEstablishment?.schoolName || '';
       const currentDepartmentName = settings?.departmentName || activeEstablishment?.departmentName || '';

       const normalizeValue = (val: unknown) => String(val ?? "").trim().toLowerCase();

       const existingMatch = quarterlyHistoricalReports.find(hist => {
         const sameTrimester =
           Number(hist.trimester) === Number(selectedTrimester);

         const sameYear =
           normalizeValue(hist.academicYear) ===
           normalizeValue(currentAcademicYear);

         const sameEstablishment =
           normalizeValue(hist.establishmentName) ===
           normalizeValue(currentEstablishmentName);

         const sameDepartment =
           normalizeValue(hist.departmentName) ===
           normalizeValue(currentDepartmentName);

         return (
           sameTrimester &&
           sameYear &&
           sameEstablishment &&
           sameDepartment &&
           hist.id !== existingReport?.id
         );
       });

       if (existingMatch) {
         const replace = window.confirm(
           `Un rapport trimestriel existe déjà pour :

Département : ${currentDepartmentName}
Trimestre : ${selectedTrimester}
Année scolaire : ${currentAcademicYear}

Voulez-vous remplacer le rapport existant ?`
         );

         if (!replace) {
           return;
         }
       }
       
       const resolvedId = existingMatch?.id || quarterlyExistingReport?.id || report.id;
       const updatedReport = buildCurrentReportPayload(resolvedId);
       await onSaveReport(updatedReport);
       setSaveStatus({ type: 'success', message: 'Le rapport trimestriel du département a été enregistré avec succès.' });
       setTimeout(() => {
         setSaveStatus({
           type: null,
           message: ""
         });
       }, 4000);

     } catch (error) {
       setSaveStatus({ type: 'error', message: 'Une erreur est survenue lors de la sauvegarde du rapport.' });
     }
  };

  const handleValidateReport = async () => {
     try {
       setSaveStatus({ type: null, message: '' });

       const academicYear =
          settings?.academicYear ||
          report.academicYear ||
          "";
       if (!academicYear) {
          setSaveStatus({
              type: "error",
              message: "Veuillez d'abord configurer l'année scolaire dans les paramètres du département."
          });
          return;
       }

       setReportStatus('Validé');
       const updatedReport = {
         ...buildCurrentReportPayload(),
         reportStatus: 'Validé' as ReportStatus
       };

       await onSaveReport(updatedReport);
       setSaveStatus({ type: 'success', message: 'Le rapport a été validé et enregistré avec succès.' });
       setTimeout(() => {
         setSaveStatus({ type: null, message: '' });
       }, 4000);
     } catch (error) {
       setSaveStatus({ type: 'error', message: 'Une erreur est survenue lors de la validation du rapport.' });
     }
  };

  const handleExportWithLatestData = () => {
     const academicYear = settings?.academicYear || report.academicYear || "";
     if (!academicYear || !selectedTrimester) {
       alert("Veuillez renseigner l'année scolaire et le trimestre avant d'exporter en PDF.");
       return;
     }
     const latestReport = buildCurrentReportPayload();
     onExportPDF(latestReport);
  };

  // ---------------------------------------------------------------------------
  // PÉRIMÈTRE STRICT DU RAPPORT
  // ---------------------------------------------------------------------------
  /* ---------------------------------------------------------------------------
   * ANNÉE SCOLAIRE ACTIVE
   *
   * Priorité aux paramètres actuels et aux données réellement synchronisées.
   * Le rapport chargé précédemment ne doit jamais imposer une ancienne année
   * scolaire et ainsi masquer les couvertures de l'année courante.
   * --------------------------------------------------------------------------- */
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

  const dataAcademicYear =
    allHourCoverages.find((item) => item.academicYear)?.academicYear ||
    allProgramCoverages.find((item) => item.academicYear)?.academicYear ||
    allGradeSheets.find((sheet) => sheet.academicYear)?.academicYear ||
    allStudentStats.find((stat) => stat.academicYear)?.academicYear ||
    '';

  const currentAcademicYear =
    settings?.academicYear ||
    activeEstablishment?.academicYear ||
    dataAcademicYear ||
    report.academicYear ||
    '';

  const normalizedAcademicYear =
    normalizeAcademicYear(currentAcademicYear);

  /* SYNCHRONISATION DIRECTE FIRESTORE DES COUVERTURES */
  const [firestoreHourCoverages, setFirestoreHourCoverages] =
    useState<HourCoverage[]>([]);
  const [firestoreProgramCoverages, setFirestoreProgramCoverages] =
    useState<ProgramCoverage[]>([]);
  const [firestoreCoveragesLoaded, setFirestoreCoveragesLoaded] =
    useState(false);

  useEffect(() => {
    if (!db || !resolvedSchoolId || !currentAcademicYear) {
      setFirestoreHourCoverages([]);
      setFirestoreProgramCoverages([]);
      setFirestoreCoveragesLoaded(false);
      return;
    }

    setFirestoreCoveragesLoaded(false);

    const hourQuery = query(
      collection(db, "hourCoverages"),
      where("establishmentId", "==", resolvedSchoolId),
      where("academicYear", "==", currentAcademicYear),
      where("trimester", "==", Number(selectedTrimester))
    );

    const programQuery = query(
      collection(db, "programCoverages"),
      where("establishmentId", "==", resolvedSchoolId),
      where("academicYear", "==", currentAcademicYear),
      where("trimester", "==", Number(selectedTrimester))
    );

    const unsubscribeHours = onSnapshot(
      hourQuery,
      (snapshot) => {
        setFirestoreHourCoverages(
          snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          }) as HourCoverage)
        );
        setFirestoreCoveragesLoaded(true);
      },
      (error) => {
        console.error("[TrimestrialReportView] Erreur hourCoverages :", error);
        setFirestoreHourCoverages([]);
        setFirestoreCoveragesLoaded(true);
      }
    );

    const unsubscribePrograms = onSnapshot(
      programQuery,
      (snapshot) => {
        setFirestoreProgramCoverages(
          snapshot.docs.map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          }) as ProgramCoverage)
        );
        setFirestoreCoveragesLoaded(true);
      },
      (error) => {
        console.error("[TrimestrialReportView] Erreur programCoverages :", error);
        setFirestoreProgramCoverages([]);
        setFirestoreCoveragesLoaded(true);
      }
    );

    return () => {
      unsubscribeHours();
      unsubscribePrograms();
    };
  }, [resolvedSchoolId, currentAcademicYear, selectedTrimester]);

  const sourceHourCoverages =
    firestoreCoveragesLoaded ? firestoreHourCoverages : allHourCoverages;

  const sourceProgramCoverages =
    firestoreCoveragesLoaded ? firestoreProgramCoverages : allProgramCoverages;

  const getRecordAcademicYear = (record: unknown): string => {
    const academicYear = readStringField(record, 'academicYear');
    const schoolYear = readStringField(record, 'schoolYear');
    return normalizeAcademicYear(academicYear || schoolYear);
  };

  /*
   * Les classes peuvent être enregistrées sous plusieurs formes :
   * 4e / 4ème / 4eme, 3e / 3ème / 3eme, 2nde / 2de, 1ere / 1ère, Tle / Terminale.
   * Elles doivent représenter la même classe dans le rapport.
   */
  const normalizeClassName = (value: unknown): string => {
    const key = String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/[._-]/g, '');

    const aliases: Record<string, string> = {
      '6e': '6e', '6eme': '6e', 'sixieme': '6e',
      '5e': '5e', '5eme': '5e', 'cinquieme': '5e',
      '4e': '4e', '4eme': '4e', 'quatrieme': '4e',
      '3e': '3e', '3eme': '3e', 'troisieme': '3e',
      '2nde': '2nde', '2nd': '2nde', '2de': '2nde', '2e': '2nde', 'seconde': '2nde',
      '1ere': '1ere', '1re': '1ere', '1e': '1ere', 'premiere': '1ere',
      'tle': 'tle', 'terminale': 'tle', 'terminal': 'tle'
    };

    return aliases[key] || key;
  };

  /*
   * Un document doit appartenir explicitement au périmètre.
   * On exclut les anciennes données non rattachées afin d'éviter
   * qu'un autre établissement, département ou trimestre apparaisse.
   */

  const matchesProvidedDataScope = (record: unknown): boolean =>
    Boolean(normalizedAcademicYear) &&
    getRecordAcademicYear(record) === normalizedAcademicYear &&
    readNumberField(record, 'trimester') === Number(selectedTrimester);

  const matchesClassName = (left: unknown, right: unknown): boolean =>
    normalizeClassName(left) === normalizeClassName(right);

  // Regroupe les variantes d'une même classe par niveau : 3e, 3e A, 3e B...
  const normalizeClassLevel = (value: unknown): string => {
    const key = normalizeClassName(value);
    if (key.startsWith('6eme') || key.startsWith('6e') || key.startsWith('sixieme')) return '6e';
    if (key.startsWith('5eme') || key.startsWith('5e') || key.startsWith('cinquieme')) return '5e';
    if (key.startsWith('4eme') || key.startsWith('4e') || key.startsWith('quatrieme')) return '4e';
    if (key.startsWith('3eme') || key.startsWith('3e') || key.startsWith('troisieme')) return '3e';
    if (key.startsWith('2nde') || key.startsWith('2nd') || key.startsWith('2de') || key.startsWith('2e') || key.startsWith('seconde')) return '2nde';
    if (key.startsWith('1ere') || key.startsWith('1re') || key.startsWith('1e') || key.startsWith('premiere')) return '1ere';
    if (key.startsWith('tle') || key.startsWith('terminale') || key.startsWith('terminal')) return 'tle';
    return key;
  };

  const classLevelLabel = (level: string): string => {
    const labels: Record<string, string> = {
      '6e': '6e', '5e': '5e', '4e': '4e', '3e': '3e',
      '2nde': '2nde', '1ere': '1ere', 'tle': 'Tle'
    };
    return labels[level] || level;
  };

  const reportDiscipline = normalizeText(
    settings?.discipline ||
    activeEstablishment?.discipline ||
    ''
  );

  const matchesReportDiscipline = (record: unknown): boolean => {
    if (!reportDiscipline) return true;

    const discipline =
      readStringField(record, 'discipline') ||
      readStringField(record, 'subject');

    return normalizeText(discipline) === reportDiscipline;
  };

  // ---------------------------------------------------------------------------
  // SOURCE PRINCIPALE DES RELEVÉS
  // ---------------------------------------------------------------------------
  // App possède déjà les relevés autorisés de l'utilisateur connecté.
  // Ils sont prioritaires sur la subscription secondaire du composant.
  const sourceGradeSheets =
    allGradeSheets.length > 0 ? allGradeSheets : departmentGradeSheets;

  const activeGradeSheetsForReport =
    sourceGradeSheets.filter(matchesProvidedDataScope);

  const archivedGradeSheetsForReport =
    departmentArchives
      .filter(matchesProvidedDataScope)
      .map((archive) => ({
        ...archive,
        id: archive.id,
      })) as unknown as ClassGradeSheet[];

  // ---------------------------------------------------------------------------
  // ANTI-DOUBLON
  // ---------------------------------------------------------------------------
  const getGradeSheetUniqueKey = (
    sheet: ClassGradeSheet
  ): string => {
    return [
      sheet.establishmentId,
      sheet.departmentId,
      sheet.teacherId,
      String(sheet.className || '').trim().toLowerCase(),
      String(sheet.discipline || '').trim().toLowerCase(),
      String(sheet.subject || '').trim().toLowerCase(),
      Number(sheet.trimester),
      normalizeAcademicYear(sheet.academicYear)
    ].join('|');
  };

  const gradeSheetsMap = new Map<string, ClassGradeSheet>();
  activeGradeSheetsForReport.forEach((sheet) => {
    gradeSheetsMap.set(getGradeSheetUniqueKey(sheet), sheet);
  });

  archivedGradeSheetsForReport.forEach((archiveSheet) => {
    const key = getGradeSheetUniqueKey(archiveSheet);
    if (!gradeSheetsMap.has(key)) {
      gradeSheetsMap.set(key, archiveSheet);
    }
  });

  const synchronizedGradeSheets = Array.from(gradeSheetsMap.values());

  console.log('[TrimestrialReportView] SOURCE FINALE DES DONNEES', {
    allGradeSheets: allGradeSheets.length,
    departmentGradeSheets: departmentGradeSheets.length,
    sourceGradeSheets: sourceGradeSheets.length,
    activeGradeSheetsForReport: activeGradeSheetsForReport.length,
    archivedGradeSheetsForReport: archivedGradeSheetsForReport.length,
    synchronizedGradeSheets: synchronizedGradeSheets.length,
    allStudentStats: allStudentStats.length,
    allHourCoverages: allHourCoverages.length,
    allProgramCoverages: allProgramCoverages.length,
    firestoreHourCoverages: firestoreHourCoverages.length,
    firestoreProgramCoverages: firestoreProgramCoverages.length,
    sourceHourCoverages: sourceHourCoverages.length,
    sourceProgramCoverages: sourceProgramCoverages.length,
    firestoreCoveragesLoaded,
    selectedTrimester,
    currentAcademicYear,
    normalizedAcademicYear,
    resolvedSchoolId,
    resolvedDepartmentId,
  });

  // ---------------------------------------------------------------------------
  // CONSTRUCTION DES STATISTIQUES ÉLÈVES
  // ---------------------------------------------------------------------------
  const synchronizedStudentStats: StudentStats[] =
    synchronizedGradeSheets.map((sheet) => {
      const students = Array.isArray(sheet.students)
        ? sheet.students
        : [];

      const ner = students.filter((student) =>
        Object.values(student.evaluations ?? {}).some((evaluation) => {
          if (evaluation === null || evaluation === undefined) {
            return false;
          }

          if (typeof evaluation === "number") {
            return Number.isFinite(evaluation);
          }

          if (typeof evaluation === "object" && "score" in evaluation) {
            const score = (evaluation as { score?: unknown }).score;
            return typeof score === "number" && Number.isFinite(score);
          }

          return false;
        })
      ).length;

      const boys = students.filter(
        (student) => student.gender === "M"
      ).length;

      const girls = students.filter(
        (student) => student.gender === "F"
      ).length;

      const averages = students
        .map((student) => student.average)
        .filter(
          (average): average is number =>
            typeof average === "number" &&
            Number.isFinite(average)
        );

      const admittedStudents = students.filter(
        (student) =>
          typeof student.average === "number" &&
          Number.isFinite(student.average) &&
          student.average >= 10
      );

      const admittedBoys = admittedStudents.filter(
        (student) => student.gender === "M"
      ).length;

      const admittedGirls = admittedStudents.filter(
        (student) => student.gender === "F"
      ).length;

      const totalStudents = students.length;

      const average =
        averages.length > 0
          ? averages.reduce((sum, value) => sum + value, 0) /
            averages.length
          : 0;

      const successRate =
        totalStudents > 0
          ? (admittedStudents.length / totalStudents) * 100
          : 0;

      return {
        id: sheet.id,
        establishmentId: sheet.establishmentId,
        departmentId: sheet.departmentId,
        teacherId: sheet.teacherId,
        discipline: sheet.discipline,
        className: sheet.className || "Classe non renseignée",

        academicYear: sheet.academicYear,
        trimester: sheet.trimester,

        totalStudents,
        boys,
        girls,

        average,
        successRate,

        admitted: admittedStudents.length,
        admittedBoys,
        admittedGirls,

        failed:
          totalStudents - admittedStudents.length,

        highestAverage:
          averages.length > 0
            ? Math.max(...averages)
            : 0,

        lowestAverage:
          averages.length > 0
            ? Math.min(...averages)
            : 0,

        ner,
        attendanceRate: 0
      } as StudentStats;
    });

  // Les relevés de notes sont la source prioritaire.
  // Les StudentStats existants servent de secours pour les données historiques
  // déjà correctement rattachées au même établissement/département/année/trimestre.
  const studentStatsBySource = new Map<string, StudentStats>();

  const getStudentStatsSourceKey = (stat: StudentStats): string =>
  [
    normalizeText(stat.establishmentId),
    normalizeText(stat.departmentId),
    normalizeAcademicYear(stat.academicYear),
    Number(stat.trimester),
    normalizeText(stat.className),
    normalizeText(stat.discipline),
    normalizeText(stat.teacherId),
  ].join('|');

  allStudentStats
    .filter(matchesProvidedDataScope)
    .forEach((stat) => {
      studentStatsBySource.set(
        getStudentStatsSourceKey(stat),
        stat
      );
    });

  synchronizedStudentStats
    .forEach((stat) => {
      // Le relevé calculé depuis les notes remplace une statistique ancienne.
      studentStatsBySource.set(
        getStudentStatsSourceKey(stat),
        stat
      );
    });

  const scopedStudentStats =
    Array.from(studentStatsBySource.values());

  // ---------------------------------------------------------------------------
  // DÉDUPLICATION ET FUSION DES CLASSES (PLUSIEURS ENSEIGNANTS)
  // ---------------------------------------------------------------------------
  const classesByName = new Map<string, StudentStats>();
  scopedStudentStats.forEach((stat) => {
    const normalizedClassName = String(stat.className || '')
      .trim()
      .toLowerCase();

    if (!normalizedClassName) return;

    const existing = classesByName.get(normalizedClassName);

    // Première occurrence
    if (!existing) {
      classesByName.set(normalizedClassName, {
        ...stat
      });
      return;
    }

    // Si plusieurs relevés concernent la même classe,
    // on fusionne les statistiques au lieu d'écraser le relevé précédent.
    const totalStudents =
      (existing.totalStudents || 0) +
      (stat.totalStudents || 0);

    const boys =
      (existing.boys || 0) +
      (stat.boys || 0);

    const girls =
      (existing.girls || 0) +
      (stat.girls || 0);

    const admitted =
      (existing.admitted || 0) +
      (stat.admitted || 0);

    const admittedBoys =
      (existing.admittedBoys || 0) +
      (stat.admittedBoys || 0);

    const admittedGirls =
      (existing.admittedGirls || 0) +
      (stat.admittedGirls || 0);

    const failed =
      totalStudents - admitted;

    const averageSum =
      ((existing.average ?? 0) * (existing.totalStudents || 0)) +
      ((stat.average ?? 0) * (stat.totalStudents || 0));

    const averageCount =
      (existing.totalStudents || 0) + (stat.totalStudents || 0);

    const average =
      averageCount > 0
        ? averageSum / averageCount
        : 0;

    classesByName.set(normalizedClassName, {
      ...existing,

      totalStudents,
      boys,
      girls,

      admitted,
      admittedBoys,
      admittedGirls,
      failed,

      average,

      successRate:
        totalStudents > 0
          ? (admitted / totalStudents) * 100
          : 0,

      highestAverage: Math.max(
        existing.highestAverage || 0,
        stat.highestAverage || 0
      ),

      lowestAverage:
        Math.min(
          existing.lowestAverage || 20,
          stat.lowestAverage || 20
        ),

      ner:
        (existing.ner || 0) +
        (stat.ner || 0),

      attendanceRate:
        totalStudents > 0
          ? ((existing.attendanceRate || 0) * (existing.totalStudents || 0) +
             (stat.attendanceRate || 0) * (stat.totalStudents || 0)) /
            totalStudents
          : 0
    });
  });

  const statisticsByClassRaw: StudentStats[] =
    Array.from(classesByName.values());

  // Ordre scolaire immuable : 6e → 5e → 4e → 3e → 2nde → 1ère → Tle.
  // Les variantes 3è/3ème, 4è/4ème, etc. sont normalisées avant le tri.
  const classOrder: Record<string, number> = {
    '6e': 1, '6eme': 1, 'sixieme': 1,
    '5e': 2, '5eme': 2, 'cinquieme': 2,
    '4e': 3, '4eme': 3, 'quatrieme': 3,
    '3e': 4, '3eme': 4, 'troisieme': 4,
    '2nde': 5, '2nd': 5, '2de': 5, '2e': 5, 'seconde': 5,
    '1ere': 6, '1re': 6, '1e': 6, 'premiere': 6,
    'tle': 7, 't le': 7, 'terminale': 7, 'terminal': 7
  };
  const normalizedClassOrder = (name: unknown): number => {
    const key = String(name ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/[-_]/g, '');
    return classOrder[key] ?? 999;
  };
  const departmentClasses = [...statisticsByClassRaw].sort((a, b) => {
    const orderA = normalizedClassOrder(a.className);
    const orderB = normalizedClassOrder(b.className);
    return orderA - orderB || String(a.className ?? '').localeCompare(String(b.className ?? ''), 'fr', { numeric: true });
  });

  const departmentTeachers = allDepartmentTeachers.filter((teacher) => {
    const teacherSchoolId = teacher.establishmentId || "";
    const matchSchool = !resolvedSchoolId || !teacherSchoolId || teacherSchoolId === resolvedSchoolId;
    if (!matchSchool) return false;

    const teacherDepartmentId = teacher.departmentId || "";
    const matchDepartmentId = !resolvedDepartmentId || !teacherDepartmentId || teacherDepartmentId === resolvedDepartmentId;

    return matchDepartmentId;
  });

  // Construction des lignes détaillées par classe réelle.
  // Elles servent ensuite à regrouper 3e A / 3e B / 3e C sur une seule ligne « 3e ».
  const statisticsByClassDetails = departmentClasses.map((sheet) => {
    const className = sheet.className || 'N/A';
    const boys = sheet.boys || 0;
    const girls = sheet.girls || 0;
    const total = sheet.totalStudents || (boys + girls);

    const admittedStudentsCount = sheet.admitted || 0;
    const admittedBoys = sheet.admittedBoys || 0;
    const admittedGirls = sheet.admittedGirls || 0;

    const generalAverage = sheet.average || 0;

    const successTotal =
      total > 0 ? Math.round((admittedStudentsCount / total) * 100) : (sheet.successRate ? Math.round(sheet.successRate) : 0);

    const successBoys =
      boys > 0 ? Math.round((admittedBoys / boys) * 100) : 0;

    const successGirls =
      girls > 0 ? Math.round((admittedGirls / girls) * 100) : 0;

    // ----------------------------------------------------------
    // COUVERTURE DES HEURES
    // ----------------------------------------------------------
    const hourMatches = sourceHourCoverages.filter(
      (hour) =>
        matchesProvidedDataScope(hour) &&
        matchesReportDiscipline(hour) &&
        matchesClassName(hour.className, className) &&
        (
          !resolvedDepartmentId ||
          !hour.departmentId ||
          hour.departmentId === resolvedDepartmentId
        )
    );

    const numberOf = (value: unknown): number => {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    };

    const anPlanned = hourMatches.reduce(
      (sum, hour) => sum + numberOf(hour.plannedHoursAnnual),
      0
    );

    const triPlanned = hourMatches.reduce(
      (sum, hour) => sum + numberOf(hour.plannedHoursTrimester),
      0
    );

    const anCompleted = hourMatches.reduce(
      (sum, hour) => sum + numberOf(hour.realizedHoursAnnual),
      0
    );

    const triCompleted = hourMatches.reduce(
      (sum, hour) => sum + numberOf(hour.realizedHoursTrimester),
      0
    );

    const anRate =
      anPlanned > 0
        ? Math.round((anCompleted / anPlanned) * 100)
        : 0;

    const triRate =
      triPlanned > 0
        ? Math.round((triCompleted / triPlanned) * 100)
        : 0;

    // ----------------------------------------------------------
    // COUVERTURE DES PROGRAMMES
    // ----------------------------------------------------------
    const programMatches = sourceProgramCoverages.filter(
      (program) =>
        matchesProvidedDataScope(program) &&
        matchesReportDiscipline(program) &&
        matchesClassName(program.className, className) &&
        (
          !resolvedDepartmentId ||
          !program.departmentId ||
          program.departmentId === resolvedDepartmentId
        )
    );

    const pAnPlanned = programMatches.reduce(
      (sum, program) =>
        sum + numberOf(program.plannedLessonsAnnual),
      0
    );

    const pTriPlanned = programMatches.reduce(
      (sum, program) =>
        sum + numberOf(program.plannedLessonsTrimester),
      0
    );

    const pAnCompleted = programMatches.reduce(
      (sum, program) =>
        sum + numberOf(program.completedLessonsAnnual),
      0
    );

    const pTriCompleted = programMatches.reduce(
      (sum, program) =>
        sum + numberOf(program.completedLessonsTrimester),
      0
    );

    const pAnRate =
      pAnPlanned > 0
        ? Math.round((pAnCompleted / pAnPlanned) * 100)
        : 0;

    const pTriRate =
      pTriPlanned > 0
        ? Math.round((pTriCompleted / pTriPlanned) * 100)
        : 0;

    // ----------------------------------------------------------
    // COURS DIGITAUX
    // ----------------------------------------------------------
    const plannedDigitalCoursesAnnual = programMatches.reduce((sum, p) => sum + (p.plannedDigitalCoursesAnnual || 0), 0);
    const plannedDigitalCoursesTrimester = programMatches.reduce((sum, p) => sum + (p.plannedDigitalCoursesTrimester || 0), 0);
    const completedDigitalCoursesAnnual = programMatches.reduce((sum, p) => sum + (p.completedDigitalCoursesAnnual || 0), 0);
    const completedDigitalCoursesTrimester = programMatches.reduce((sum, p) => sum + (p.completedDigitalCoursesTrimester || 0), 0);

    const digitalCoverageRateAnnual = plannedDigitalCoursesAnnual > 0 ? Math.round((completedDigitalCoursesAnnual / plannedDigitalCoursesAnnual) * 100) : 0;
    const digitalCoverageRateTrimester = plannedDigitalCoursesTrimester > 0 ? Math.round((completedDigitalCoursesTrimester / plannedDigitalCoursesTrimester) * 100) : 0;

    let observation = "";
    if (total > 0) {
      if (successTotal < 50) {
        observation = "Attention requise (Taux < 50%)";
      } else if (successTotal >= 80) {
        observation = "Excellents résultats";
      }
    }

    return {
      classId: sheet.id || className,
      className,
      boys,
      girls,
      total,
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
      ner: sheet.ner ?? 0,
      // Assiduité : conserver séparément le taux annuel et le taux du trimestre.
      // StudentStats possède un seul taux d'assiduité canonique :
      // il correspond au trimestre sélectionné. Aucun champ annuel
      // supplémentaire n'est inventé ici.
      attendanceRateAnnual: 0,
      attendanceRateTrimester: numberOf(sheet.attendanceRate),
      attendanceRate: numberOf(sheet.attendanceRate),
      averageAbove10: admittedStudentsCount,
      averageAbove10Boys: admittedBoys,
      averageAbove10Girls: admittedGirls,
      admittedBoys,
      admittedGirls,
      successBoys,
      successGirls,
      successTotal,
      averageSum:
        generalAverage * total,
      averageCount: total,
      generalAverage: Number(generalAverage.toFixed(2)),
      observation
    };
  });

  type DetailedClassStatistics = (typeof statisticsByClassDetails)[number];
  type LevelStatistics = DetailedClassStatistics & { classCount: number };

  // Une seule ligne par niveau. « classCount » compte les classes réelles.
  const levelStatisticsMap = new Map<string, LevelStatistics>();

  statisticsByClassDetails.forEach((item) => {
    const level = normalizeClassLevel(item.className);
    const existing = levelStatisticsMap.get(level);

    if (!existing) {
      levelStatisticsMap.set(level, { ...item, className: classLevelLabel(level), classCount: 1 });
      return;
    }

    const total = existing.total + item.total;
    const boys = existing.boys + item.boys;
    const girls = existing.girls + item.girls;
    const admitted = existing.averageAbove10 + item.averageAbove10;
    const admittedBoys = existing.averageAbove10Boys + item.averageAbove10Boys;
    const admittedGirls = existing.averageAbove10Girls + item.averageAbove10Girls;
    const averageSum = existing.averageSum + item.averageSum;
    const averageCount = existing.averageCount + item.averageCount;
    const anPlanned = existing.anPlanned + item.anPlanned;
    const triPlanned = existing.triPlanned + item.triPlanned;
    const anCompleted = existing.anCompleted + item.anCompleted;
    const triCompleted = existing.triCompleted + item.triCompleted;
    const pAnPlanned = existing.pAnPlanned + item.pAnPlanned;
    const pTriPlanned = existing.pTriPlanned + item.pTriPlanned;
    const pAnCompleted = existing.pAnCompleted + item.pAnCompleted;
    const pTriCompleted = existing.pTriCompleted + item.pTriCompleted;
    const plannedDigitalCoursesAnnual = existing.plannedDigitalCoursesAnnual + item.plannedDigitalCoursesAnnual;
    const plannedDigitalCoursesTrimester = existing.plannedDigitalCoursesTrimester + item.plannedDigitalCoursesTrimester;
    const completedDigitalCoursesAnnual = existing.completedDigitalCoursesAnnual + item.completedDigitalCoursesAnnual;
    const completedDigitalCoursesTrimester = existing.completedDigitalCoursesTrimester + item.completedDigitalCoursesTrimester;
    const ner = existing.ner + item.ner;
    const attendanceWeight = total;
    const attendanceRateTrimester = attendanceWeight > 0
      ? ((existing.attendanceRateTrimester * existing.total) + (item.attendanceRateTrimester * item.total)) / attendanceWeight
      : 0;

    levelStatisticsMap.set(level, {
      ...existing,
      total, boys, girls,
      averageAbove10: admitted,
      averageAbove10Boys: admittedBoys,
      averageAbove10Girls: admittedGirls,
      admittedBoys, admittedGirls,
      successBoys: boys > 0 ? Math.round((admittedBoys / boys) * 100) : 0,
      successGirls: girls > 0 ? Math.round((admittedGirls / girls) * 100) : 0,
      successTotal: total > 0 ? Math.round((admitted / total) * 100) : 0,
      averageSum, averageCount,
      generalAverage: averageCount > 0 ? Number((averageSum / averageCount).toFixed(2)) : 0,
      anPlanned, triPlanned, anCompleted, triCompleted,
      anRate: anPlanned > 0 ? Math.round((anCompleted / anPlanned) * 100) : 0,
      triRate: triPlanned > 0 ? Math.round((triCompleted / triPlanned) * 100) : 0,
      pAnPlanned, pTriPlanned, pAnCompleted, pTriCompleted,
      pAnRate: pAnPlanned > 0 ? Math.round((pAnCompleted / pAnPlanned) * 100) : 0,
      pTriRate: pTriPlanned > 0 ? Math.round((pTriCompleted / pTriPlanned) * 100) : 0,
      plannedDigitalCoursesAnnual, plannedDigitalCoursesTrimester,
      completedDigitalCoursesAnnual, completedDigitalCoursesTrimester,
      digitalCoverageRateAnnual: plannedDigitalCoursesAnnual > 0 ? Math.round((completedDigitalCoursesAnnual / plannedDigitalCoursesAnnual) * 100) : 0,
      digitalCoverageRateTrimester: plannedDigitalCoursesTrimester > 0 ? Math.round((completedDigitalCoursesTrimester / plannedDigitalCoursesTrimester) * 100) : 0,
      ner,
      attendanceRateTrimester,
      attendanceRate: attendanceRateTrimester,
      classCount: existing.classCount + 1,
    });
  });

  const classLevelOrder: Record<string, number> = {
    '6e': 1, '5e': 2, '4e': 3, '3e': 4, '2nde': 5, '1ere': 6, 'tle': 7
  };

  const statisticsByClass = Array.from(levelStatisticsMap.values()).sort(
    (a, b) => (classLevelOrder[normalizeClassLevel(a.className)] ?? 999) - (classLevelOrder[normalizeClassLevel(b.className)] ?? 999)
  );

  // « Nombre » = nombre de classes réelles, jamais le numéro d'ordre.
  const nombreClasses = statisticsByClass.reduce((sum, item) => sum + item.classCount, 0);
  const effectifTotal = statisticsByClass.reduce((sum, item) => sum + item.total, 0);
  const totalGarcons = statisticsByClass.reduce((sum, item) => sum + item.boys, 0);
  const totalFilles = statisticsByClass.reduce((sum, item) => sum + item.girls, 0);

  // ---------------------------------------------------------------------------
  // STATISTIQUES GLOBALES DU DÉPARTEMENT
  // ---------------------------------------------------------------------------
  const departmentStatistics = statisticsByClass.reduce(
    (acc, stat) => {
        acc.totalStudents += stat.total || 0;
        acc.boys += stat.boys || 0;
        acc.girls += stat.girls || 0;

        acc.admitted += stat.averageAbove10 || 0;
        acc.failed += (stat.total - (stat.averageAbove10 || 0)) || 0;

        acc.admittedBoys += stat.admittedBoys || 0;
        acc.admittedGirls += stat.admittedGirls || 0;

        acc.averageSum += stat.averageSum || 0;
        acc.averageCount += stat.averageCount || 0;

        if (typeof stat.generalAverage === "number") {
            acc.highestAverage = Math.max(
                acc.highestAverage,
                stat.generalAverage
            );

            acc.lowestAverage = acc.lowestAverage === 0 
                ? stat.generalAverage 
                : Math.min(acc.lowestAverage, stat.generalAverage);
        }

        return acc;
    },
    {
        totalStudents: 0,
        boys: 0,
        girls: 0,

        admitted: 0,
        failed: 0,

        admittedBoys: 0,
        admittedGirls: 0,

        averageSum: 0,
        averageCount: 0,

        highestAverage: 0,
        lowestAverage: 0
    }
  );

  const departmentAverage =
    departmentStatistics.averageCount > 0
        ? Number(
            (
                departmentStatistics.averageSum /
                    departmentStatistics.averageCount
            ).toFixed(2)
          )
        : 0;

  const departmentSuccessRate =
    departmentStatistics.totalStudents > 0
        ? Number(
            (
                (departmentStatistics.admitted /
                    departmentStatistics.totalStudents) *
                100
            ).toFixed(2)
          )
        : 0;

  const departmentSuccessRateBoys =
    departmentStatistics.boys > 0
        ? Number(
            (
                (departmentStatistics.admittedBoys /
                    departmentStatistics.boys) *
                100
            ).toFixed(2)
          )
        : 0;

  const departmentSuccessRateGirls =
    departmentStatistics.girls > 0
        ? Number(
            (
                (departmentStatistics.admittedGirls /
                    departmentStatistics.girls) *
                100
            ).toFixed(2)
          )
        : 0;

  const heuresPrevuesAn = statisticsByClass.reduce((acc, curr) => acc + curr.anPlanned, 0);
  const heuresPrevuesTri = statisticsByClass.reduce((acc, curr) => acc + curr.triPlanned, 0);
  const heuresFaitesAn = statisticsByClass.reduce((acc, curr) => acc + curr.anCompleted, 0);
  const heuresFaitesTri = statisticsByClass.reduce((acc, curr) => acc + curr.triCompleted, 0);
  const tauxHeuresAn = heuresPrevuesAn > 0 ? Math.round((heuresFaitesAn / heuresPrevuesAn) * 100) : 0;
  const tauxHeuresTri = heuresPrevuesTri > 0 ? Math.round((heuresFaitesTri / heuresPrevuesTri) * 100) : 0;

  const chapPrevusAn = statisticsByClass.reduce((acc, curr) => acc + curr.pAnPlanned, 0);
  const chapPrevusTri = statisticsByClass.reduce((acc, curr) => acc + curr.pTriPlanned, 0);
  const chapFaitsAn = statisticsByClass.reduce((acc, curr) => acc + curr.pAnCompleted, 0);
  const chapFaitsTri = statisticsByClass.reduce((acc, curr) => acc + curr.pTriCompleted, 0);
  const tauxProgrammeAn = chapPrevusAn > 0 ? Math.round((chapFaitsAn / chapPrevusAn) * 100) : 0;
  const tauxProgrammeTri = chapPrevusTri > 0 ? Math.round((chapFaitsTri / chapPrevusTri) * 100) : 0;

  const totalDigitalPrevusAn = statisticsByClass.reduce((acc, curr) => acc + curr.plannedDigitalCoursesAnnual, 0);
  const totalDigitalPrevusTri = statisticsByClass.reduce((acc, curr) => acc + curr.plannedDigitalCoursesTrimester, 0);
  const totalDigitalFaitsAn = statisticsByClass.reduce((acc, curr) => acc + curr.completedDigitalCoursesAnnual, 0);
  const totalDigitalFaitsTri = statisticsByClass.reduce((acc, curr) => acc + curr.completedDigitalCoursesTrimester, 0);
  const tauxDigitalAn = totalDigitalPrevusAn > 0 ? Math.round((totalDigitalFaitsAn / totalDigitalPrevusAn) * 100) : 0;
  const tauxDigitalTri = totalDigitalPrevusTri > 0 ? Math.round((totalDigitalFaitsTri / totalDigitalPrevusTri) * 100) : 0;

  const nerTotal = statisticsByClass.reduce(
    (acc, curr) => acc + (curr.ner ?? 0),
    0
  );

  const attendanceRatesAnnual = statisticsByClass
    .map((curr) => Number(curr.attendanceRateAnnual) || 0)
    .filter((rate) => rate > 0);

  const attendanceRatesTrimester = statisticsByClass
    .map((curr) => Number(curr.attendanceRateTrimester) || 0)
    .filter((rate) => rate > 0);

  const tauxAssiduiteAn =
    attendanceRatesAnnual.length > 0
      ? Number((attendanceRatesAnnual.reduce((sum, rate) => sum + rate, 0) / attendanceRatesAnnual.length).toFixed(2))
      : 0;

  const tauxAssiduiteTri =
    attendanceRatesTrimester.length > 0
      ? Number((attendanceRatesTrimester.reduce((sum, rate) => sum + rate, 0) / attendanceRatesTrimester.length).toFixed(2))
      : 0;

  const tauxAssiduite = tauxAssiduiteTri;

  const moyenne10GarconsTotal = statisticsByClass.reduce(
    (acc, curr) => acc + (Number(curr.averageAbove10Boys) || 0),
    0
  );
  const moyenne10FillesTotal = statisticsByClass.reduce(
    (acc, curr) => acc + (Number(curr.averageAbove10Girls) || 0),
    0
  );
  const moyenne10Total = moyenne10GarconsTotal + moyenne10FillesTotal;

  const tauxReussite = departmentSuccessRate;
  const reussiteGarcons = departmentSuccessRateBoys;
  const reussiteFilles = departmentSuccessRateGirls;
  const moyenneGenerale = departmentAverage.toFixed(2);

  const handleAIGenerateAnalysis = async () => {
     setIsGeneratingAI(true);
     setSaveStatus({ type: null, message: "" });
     try {
        const payloadData = {
          statistiques: {
            nombreClasses,
            effectifTotal,
            totalGarcons,
            totalFilles,

            admis: departmentStatistics.admitted,
            ajournes: departmentStatistics.failed,

            moyenneGenerale,
            meilleureMoyenne: departmentStatistics.highestAverage,
            plusFaibleMoyenne: departmentStatistics.lowestAverage,

            tauxReussite: departmentSuccessRate,
            tauxAssiduite,

            couvertureHeures: tauxHeuresTri,
            couvertureProgrammes: tauxProgrammeTri,
            couvertureCoursDigitaux: tauxDigitalTri,

            appreciation: departmentSuccessRate >= 80 ? "Excellent" : departmentSuccessRate >= 60 ? "Satisfaisant" : "À améliorer"
          },
          classes: statisticsByClass,
          trimester: `Trimestre ${report.trimester || selectedTrimester}`,
          etablissement: activeEstablishment?.schoolName || activeEstablishment?.establishmentName || '',
          departement: settings?.departmentName || activeEstablishment?.departmentName || ''
        };

        const aiPrompt = `
Tu es Inspecteur pédagogique.
À partir des statistiques du département, rédige le rapport officiel au format MINESEC.
        `.trim();

        const aiReport = await AIOrchestrator.report({
          discipline: settings?.discipline || activeEstablishment?.departmentName || "Département Pédagogique",
          trimester: `Trimestre ${selectedTrimester}`,
          academicYear: settings?.academicYear || activeEstablishment?.academicYear || report.academicYear,
          establishment: activeEstablishment?.establishmentName || "",
          statistics: payloadData.statistiques,
          coverage: `Couverture horaire : ${tauxHeuresTri}%, Couverture programmes : ${tauxProgrammeTri}%`,
          observations: aiPrompt
        });

        if (!aiReport) {
          throw new Error("La génération IA a échoué.");
        }

        setIntroductionText(aiReport.introduction || '');
        setManuals(aiReport.manuals || '');
        setClassrooms(aiReport.classrooms || '');
        setWorkingConditions(aiReport.workingConditions || '');

        setHourCoverage(aiReport.hourCoverage || '');
        setProgramCoverage(aiReport.programCoverage || '');
        setDigitalCoverage(aiReport.digitalCoverage || '');
        setCorrelations(aiReport.correlations || '');

        setAttendance(aiReport.attendance || '');
        setExercises(aiReport.exercises || '');
        setEvaluations(aiReport.evaluations || '');

        setTeachersDifficulties(aiReport.teachersDifficulties || '');
        setStudentsDifficulties(aiReport.studentsDifficulties || '');
        setInstitutionalDifficulties(aiReport.institutionalDifficulties || '');

        setRecommendationsAnimator(aiReport.recommendationsAnimator || '');
        setRecommendationsAdministration(aiReport.recommendationsAdministration || '');
        setRecommendationsHierarchy(aiReport.recommendationsHierarchy || '');

        setClubs(aiReport.clubs || '');

        setReportStatus("En cours");
        setSaveStatus({ type: 'success', message: 'Rapport départemental généré et structuré avec succès par l\'IA.' });
        setTimeout(() => {
          setSaveStatus({
              type: null,
              message: ""
          });
        }, 3000);

     } catch (error) {
        setSaveStatus({ type: "error", message: "Impossible de générer le rapport via l'IA." });
     } finally {
        setIsGeneratingAI(false);
     }
  };

  const departmentProgramCoverage = statisticsByClass;
  const digitalCoverageRate =
    departmentProgramCoverage.length > 0
        ? departmentProgramCoverage.reduce(
            (sum, item) => sum + (item.digitalCoverageRateTrimester ?? 0),
            0
          ) / departmentProgramCoverage.length
        : 0;

  // ---------------------------------------------------------------------------
  // RUBRIQUES UNIFORMISÉES AVEC LA CLASSE .report-paragraph
  // ---------------------------------------------------------------------------
  const reportSections = useMemo<ReportSection[]>(() => [
    {
        id: "II",
        weight: 260,
        title: "II. EXAMEN DES CONDITIONS DE TRAVAIL",
        children: (
            <>
                <h3 className="report-subtitle">2.1 Manuels et supports didactiques</h3>
                <p className="report-paragraph">{manuals}</p>
                <h3 className="report-subtitle">2.2 Salles de classe et infrastructures</h3>
                <p className="report-paragraph">{classrooms}</p>
                <h3 className="report-subtitle">2.3 Conditions générales de travail</h3>
                <p className="report-paragraph">{workingConditions}</p>
            </>
        )
    },
    {
        id: "III",
        weight: 320,
        title: "III. COUVERTURE DES ENSEIGNEMENTS",
        children: (
            <>
                <h3 className="report-subtitle">3.1 Couverture horaire ({tauxHeuresTri}%)</h3>
                <p className="report-paragraph">{hourCoverage}</p>
                <h3 className="report-subtitle">3.2 Couverture des programmes ({tauxProgrammeTri}%)</h3>
                <p className="report-paragraph">{programCoverage}</p>
                <h3 className="report-subtitle">3.3 Couverture des cours digitaux ({digitalCoverageRate.toFixed(1)}%)</h3>
                <p className="report-paragraph">{digitalCoverage}</p>
                <h3 className="report-subtitle">3.4 Corrélations et APC</h3>
                <p className="report-paragraph">{correlations}</p>
            </>
        )
    },
    {
        id: "IV",
        weight: 240,
        title: "IV. ANALYSE DES RÉSULTATS SCOLAIRES",
        children: (
            <>
                <h3 className="report-subtitle">4.1 Assiduité des élèves ({tauxAssiduite}%)</h3>
                <p className="report-paragraph">{attendance}</p>
                <h3 className="report-subtitle">4.2 Exercices et travaux dirigés</h3>
                <p className="report-paragraph">{exercises}</p>
                <h3 className="report-subtitle">4.3 Évaluations et résultats (Moyenne : {moyenneGenerale}/20, Réussite : {tauxReussite}%)</h3>
                <p className="report-paragraph">{evaluations}</p>
            </>
        )
    },
    {
        id: "V",
        weight: 220,
        title: "V. DIFFICULTÉS RENCONTRÉES",
        children: (
            <>
                <h3 className="report-subtitle">5.1 Difficultés enseignants</h3>
                <p className="report-paragraph">{teachersDifficulties}</p>
                <h3 className="report-subtitle">5.2 Difficultés élèves</h3>
                <p className="report-paragraph">{studentsDifficulties}</p>
                <h3 className="report-subtitle">5.3 Difficultés institutionnelles</h3>
                <p className="report-paragraph">{institutionalDifficulties}</p>
            </>
        )
    },
    {
        id: "VI",
        weight: 170,
        title: "VI. SUGGESTIONS",
        children: (
            <>
                <h3 className="report-subtitle">6.1 Animateur pédagogique</h3>
                <p className="report-paragraph">{recommendationsAnimator}</p>
                <h3 className="report-subtitle">6.2 Administration</h3>
                <p className="report-paragraph">{recommendationsAdministration}</p>
                <h3 className="report-subtitle">6.3 Hiérarchie</h3>
                <p className="report-paragraph">{recommendationsHierarchy}</p>
            </>
        )
    },
    {
        id: "VII",
        weight: 120,
        title: "VII. ANIMATION DES CLUBS",
        children: (
            <p className="report-paragraph">{clubs}</p>
        )
    }
], [
  manuals, classrooms, workingConditions, 
  tauxHeuresTri, hourCoverage, 
  programCoverage, digitalCoverageRate, digitalCoverage, correlations, 
  tauxAssiduite, attendance, exercises, moyenneGenerale, tauxReussite, evaluations, 
  teachersDifficulties, studentsDifficulties, institutionalDifficulties, 
  recommendationsAnimator, recommendationsAdministration, recommendationsHierarchy, 
  clubs
]);

// ---------------------------------------------------------------------------
// MESURE ET RÉPARTITION DYNAMIQUE APRÈS LE RENDU
// ---------------------------------------------------------------------------
useEffect(() => {
     const left: ReportSection[] = [];
     const right: ReportSection[] = [];

     let totalHeight = 0;

     reportSections.forEach(section => {
        const element = sectionRefs.current.get(section.id);
        const height = element?.offsetHeight ?? section.weight ?? 150;

        if (totalHeight + height < 930) {
            left.push(section);
            totalHeight += height;
        } else {
            right.push(section);
        }
     });

     setLeftColumnState(left);
     setRightColumnState(right);
}, [reportSections]);

const renderReportSection = (section: ReportSection) => (
    <section
        ref={(el) => {
            if (el) {
                sectionRefs.current.set(section.id, el);
            }
        }}
        key={section.id}
        className="report-section"
        style={{
            breakInside: "avoid",
            pageBreakInside: "avoid",
            marginBottom: "8mm"
        }}
    >
        <h2 className="report-title-section">
            {section.title}
        </h2>

        {section.children}
    </section>
);

const presidentTeacherRecord = departmentTeachers.find(
    t => t.fullName?.toLowerCase() === (settings?.councilPresidentName || activeEstablishment?.councilPresidentName || report.councilPresidentName)?.toLowerCase()
);

const animatorTeacherRecord = departmentTeachers.find(
    t => t.id === currentUser?.id || t.fullName?.toLowerCase() === (currentUser?.name || settings?.animatorName || report.teacherName)?.toLowerCase() || t.role === "ANIMATEUR_PEDAGOGIQUE"
);

const presidentGrade = 
    presidentTeacherRecord?.grade || 
    activeEstablishment?.councilPresidentGrade || 
    "";

const animatorGrade = 
    animatorTeacherRecord?.grade || 
    currentUser?.grade || 
    "";

const councilMembers = [
    {
        id: "president",
        order: 1,
        name: settings?.councilPresidentName || activeEstablishment?.councilPresidentName || report.councilPresidentName || "",
        grade: presidentGrade,
        quality: "Président de séance",
        discipline: "",
        classes: "",
        weeklyHours: ""
    },
    {
        id: "animateur",
        order: 2,
        name: settings?.animatorName || currentUser?.name || report.teacherName || "",
        grade: animatorGrade,
        quality: "Animateur pédagogique",
        discipline: settings?.departmentName || activeEstablishment?.departmentName || "",
        classes: "",
        weeklyHours: ""
    },
    ...departmentTeachers
        .filter(t => t.role !== "ANIMATEUR_PEDAGOGIQUE")
        .map((teacher, index) => ({
            id: teacher.id || `teach_${index}`,
            order: index + 3,
            name: teacher.fullName || "",
            grade: teacher.grade || "",
            quality: 
              teacher.role === "ANIMATEUR_PEDAGOGIQUE"
                    ? "Animateur pédagogique"
                    : "Membre",
            discipline: teacher.discipline || settings?.departmentName || activeEstablishment?.departmentName || "",
            classes: Array.isArray(teacher.classes) ? teacher.classes.join(", ") : (teacher.classes || ""),
            weeklyHours: teacher.weeklyHours || ""
        }))
];

const Page1 = () => {
   const logo = reportHeader.logo;

   return (
     <div ref={page1Ref}>
         <section className="report-page landscape-page bg-white mx-auto shadow-lg border p-8 print:shadow-none print:border-none print:break-after-page flex flex-col justify-between">
             <div>
                 <div className="border-b-2 border-black pb-4 mb-4">
                     <div className="grid grid-cols-3 items-center">
                         <div className="text-center text-xs space-y-0.5 pr-2">
                             <p className="font-bold uppercase">REPUBLIQUE DU CAMEROUN</p>
                             <p className="italic">Paix - Travail - Patrie</p>
                             <p className="font-bold uppercase mt-1">{reportHeader.ministryFr}</p>
                             <p>{reportHeader.regionFr}</p>
                             <p>{reportHeader.departmentFr}</p>
                             <p className="font-bold">{reportHeader.establishmentFr}</p>
                         </div>

                         <div className="text-center flex justify-center border-x border-dashed border-gray-300 py-1">
                             {logo ? (
                                 <img
                                     src={logo}
                                     alt="Logo"
                                     className="h-16 w-16 object-contain"
                                 />
                             ) : (
                                 <div className="h-16 w-16 border rounded-full flex items-center justify-center text-[10px] text-gray-400 font-semibold bg-gray-50">
                                     LOGO
                                 </div>
                             )}
                         </div>

                         <div className="text-center text-xs space-y-0.5 pl-2">
                             <p className="font-bold uppercase">REPUBLIC OF CAMEROON</p>
                             <p className="italic">Peace - Work - Fatherland</p>
                             <p className="font-bold uppercase mt-1">{reportHeader.ministryEn}</p>
                             <p>{reportHeader.regionEn}</p>
                             <p>{reportHeader.departmentEn}</p>
                             <p className="font-bold">{reportHeader.establishmentEn}</p>
                         </div>
                     </div>
                 </div>

                 <div className="text-center mt-4 mb-4">
                     <h1 className="text-2xl font-extrabold uppercase">RAPPORT TRIMESTRIEL</h1>
                     <h2 className="text-lg font-bold mt-1">DU CONSEIL D'ENSEIGNEMENT DU DÉPARTEMENT</h2>
                 </div>

                 <div className="border rounded-lg p-3 mb-6">
                     <div className="grid grid-cols-5 gap-2 text-xs">
                         <div><strong>Département</strong><br />{settings?.departmentName || activeEstablishment?.departmentName || ''}</div>
                         <div><strong>Classes couvertes</strong><br />{nombreClasses} classes</div>
                         <div><strong>Trimestre</strong><br />{selectedTrimester}</div>
                         <div><strong>Année scolaire</strong><br />{reportHeader.academicYear}</div>
                         <div><strong>Date</strong><br />{reportHeader.date}</div>
                     </div>
                 </div>

                 <section className="report-section mb-4">
                     <h2 className="report-title-section">I. Synthèse statistique</h2>
                 </section>

                 <div className="mb-4 overflow-x-auto w-full">
                     <table
                       style={{
                         borderCollapse: 'collapse',
                         width: 'max-content',
                         minWidth: '2200px',
                         fontSize: '11px',
                         textAlign: 'center',
                         tableLayout: 'fixed'
                       }}
                     >
                       <colgroup>
                         {[
                           72, 34, 34, 34, 38,
                           44, 44, 44, 44, 44, 44,
                           44, 44, 44, 44, 44, 44,
                           44, 44, 44, 44, 44, 44,
                           44, 44, 44,
                           44, 44, 44,
                           42, 42, 42, 42, 42,
                           50
                         ].map((width, index) => (
                           <col key={index} style={{ width: `${width}px` }} />
                         ))}
                       </colgroup>
                       <thead>
                         <tr>
                           <th rowSpan={3} style={{ border: '1px solid #9ca3af', padding: '7px', background: '#dbeafe', fontWeight: 700 }}>Classes</th>
                           <th colSpan={4} style={{ border: '1px solid #9ca3af', padding: '7px', background: '#dbeafe', fontWeight: 700 }}>Établissement</th>
                           <th colSpan={6} style={{ border: '1px solid #9ca3af', padding: '7px', background: '#dcfce7', fontWeight: 700 }}>Enseignement</th>
                           <th colSpan={6} style={{ border: '1px solid #9ca3af', padding: '7px', background: '#ffedd5', fontWeight: 700 }}>Programmes</th>
                           <th colSpan={6} style={{ border: '1px solid #9ca3af', padding: '7px', background: '#ede9fe', fontWeight: 700 }}>Cours digitaux</th>
                           <th colSpan={3} style={{ border: '1px solid #9ca3af', padding: '7px', background: '#fce7f3', fontWeight: 700 }}>Assiduité</th>
                           <th colSpan={7} style={{ border: '1px solid #9ca3af', padding: '7px', background: '#ccfbf1', fontWeight: 700 }}>Résultats Scolaires</th>
                         </tr>
                         <tr>
                           <th rowSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#eff6ff' }}>Nombres</th>
                           <th colSpan={3} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#eff6ff' }}>Effectif</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f0fdf4' }}>Heures prévues</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f0fdf4' }}>Heures faites</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f0fdf4' }}>Taux</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#fff7ed' }}>Chap. prévus</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#fff7ed' }}>Chap. faits</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#fff7ed' }}>Taux</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f5f3ff' }}>Digitaux prévus</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f5f3ff' }}>Digitaux faits</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f5f3ff' }}>Taux</th>
                           <th rowSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#fdf2f8' }}>NER</th>
                           <th colSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#fdf2f8' }}>Taux</th>
                           <th colSpan={3} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f0fdfa' }}>≥ 10</th>
                           <th colSpan={3} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f0fdfa' }}>Taux réussite</th>
                           <th rowSpan={2} style={{ border: '1px solid #9ca3af', padding: '5px', background: '#f0fdfa' }}>M.G</th>
                         </tr>
                         <tr>
                           {['G','F','T'].map((label) => (
                             <th key={`effectif-${label}`} style={{ border: '1px solid #9ca3af', padding: '4px', background: '#eff6ff' }}>{label}</th>
                           ))}
                           {['An','Tri','An','Tri','An','Tri'].map((label, index) => (
                             <th key={`enseignement-${index}`} style={{ border: '1px solid #9ca3af', padding: '4px', background: '#f0fdf4' }}>{label}</th>
                           ))}
                           {['An','Tri','An','Tri','An','Tri'].map((label, index) => (
                             <th key={`programmes-${index}`} style={{ border: '1px solid #9ca3af', padding: '4px', background: '#fff7ed' }}>{label}</th>
                           ))}
                           {['An','Tri','An','Tri','An','Tri'].map((label, index) => (
                             <th key={`digitaux-${index}`} style={{ border: '1px solid #9ca3af', padding: '4px', background: '#f5f3ff' }}>{label}</th>
                           ))}
                           {['An','Tri'].map((label) => (
                             <th key={`assiduite-${label}`} style={{ border: '1px solid #9ca3af', padding: '4px', background: '#fdf2f8' }}>{label}</th>
                           ))}
                           {['G','F','T','G','F','T'].map((label, index) => (
                             <th key={`resultats-${index}`} style={{ border: '1px solid #9ca3af', padding: '4px', background: '#f0fdfa' }}>{label}</th>
                           ))}
                         </tr>
                       </thead>
                       <tbody>
                         {statisticsByClass.length > 0 ? statisticsByClass.map((item, index) => {
                           const attendanceAn = Number(item.attendanceRateAnnual) || 0;
                           const attendanceTri = Number(item.attendanceRateTrimester) || 0;
                           return (
                             <tr key={item.classId ?? index}>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px', background: '#eff6ff', fontWeight: 700 }}>{item.className}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.classCount}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.boys}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.girls}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.total}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.anPlanned || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.triPlanned || '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.anCompleted || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.triCompleted || '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.anRate ? `${item.anRate}%` : '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.triRate ? `${item.triRate}%` : '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.pAnPlanned || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.pTriPlanned || '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.pAnCompleted || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.pTriCompleted || '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.pAnRate ? `${item.pAnRate}%` : '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.pTriRate ? `${item.pTriRate}%` : '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.plannedDigitalCoursesAnnual || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.plannedDigitalCoursesTrimester || '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.completedDigitalCoursesAnnual || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.completedDigitalCoursesTrimester || '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.digitalCoverageRateAnnual ? `${item.digitalCoverageRateAnnual}%` : '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.digitalCoverageRateTrimester ? `${item.digitalCoverageRateTrimester}%` : '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.ner || '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{attendanceAn ? `${attendanceAn.toFixed(2)}%` : '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{attendanceTri ? `${attendanceTri.toFixed(2)}%` : '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.averageAbove10Boys || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.averageAbove10Girls || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.averageAbove10 || '-'}</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.successBoys}%</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.successGirls}%</td><td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.successTotal}%</td>
                               <td style={{ border: '1px solid #cbd5e1', padding: '7px' }}>{item.generalAverage}</td>
                             </tr>
                           );
                         }) : (
                           <tr><td colSpan={33} style={{ border: '1px solid #cbd5e1', padding: '14px' }} className="text-center text-gray-500 italic">Aucun relevé de classe synchronisé pour ce trimestre.</td></tr>
                         )}
                       </tbody>
                       <tfoot>
                                                  <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                           <td style={{ border: '1px solid #cbd5e1', padding: '8px', background: '#dbeafe' }}>TOTAL</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{nombreClasses}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{totalGarcons}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{totalFilles}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{effectifTotal}</td>
                           <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{heuresPrevuesAn}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{heuresPrevuesTri}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{heuresFaitesAn}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{heuresFaitesTri}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxHeuresAn}%</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxHeuresTri}%</td>
                           <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{chapPrevusAn}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{chapPrevusTri}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{chapFaitsAn}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{chapFaitsTri}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxProgrammeAn}%</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxProgrammeTri}%</td>
                           <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{totalDigitalPrevusAn}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{totalDigitalPrevusTri}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{totalDigitalFaitsAn}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{totalDigitalFaitsTri}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxDigitalAn}%</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxDigitalTri}%</td>
                           <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{nerTotal || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxAssiduiteAn ? `${tauxAssiduiteAn}%` : '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxAssiduiteTri ? `${tauxAssiduiteTri}%` : '-'}</td>
                           <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{moyenne10GarconsTotal || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{moyenne10FillesTotal || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{moyenne10Total || '-'}</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{reussiteGarcons}%</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{reussiteFilles}%</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{tauxReussite}%</td><td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{moyenneGenerale}</td>
                         </tr>
                       </tfoot>
                     </table>
                 </div>
             </div>

             <div className="flex justify-between items-center text-xs text-gray-500 border-t pt-2 mt-4">
                 <div>Rapport généré le : {reportHeader.date}</div>
                 <div className="report-footer">Page 1 / 3</div>
             </div>
         </section>
     </div>
   );
};

const Page2 = () => (
     <div ref={page2Ref}>
         <section className="report-page landscape-page bg-white mx-auto shadow-lg border p-8 print:shadow-none print:border-none print:break-after-page flex flex-col justify-between">
             <div>
                 <div className="flex gap-8 relative">
                     <div
                         className="absolute"
                         style={{
                             left: "50%",
                             top: 0,
                             bottom: 0,
                             width: "1px",
                             background: "#000",
                             transform: "translateX(-50%)"
                         }}
                     />

                     <div className="w-1/2 pr-6">
                         {leftColumnState.map(renderReportSection)}
                     </div>
                     <div className="w-1/2 pl-6">
                         {rightColumnState.map(renderReportSection)}
                     </div>
                 </div>
             </div>

             <div className="flex justify-between items-center text-xs text-gray-500 border-t pt-2 mt-4">
                 <div>Rapport du conseil d'enseignement tenu le : {reportHeader.date}</div>
                 <div className="report-footer">Page 2 / 3</div>
             </div>
         </section>
     </div>
);

const Page3 = () => (
     <div ref={page3Ref}>
         <div className="report-page landscape-page bg-white mx-auto shadow-lg border p-8 print:shadow-none print:border-none flex flex-col justify-between">
             <div>
                 <div className="report-header mb-6">
                 </div>

                 <h2 className="report-title-section">
                     VIII. CONSTITUTION DU CONSEIL
                 </h2>

                 <table className="report-table" style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px', marginTop: '10px', tableLayout: 'fixed' }}>
                     <colgroup>
                         <col style={{ width: '5%' }} />
                         <col style={{ width: '24%' }} />
                         <col style={{ width: '10%' }} />
                         <col style={{ width: '15%' }} />
                         <col style={{ width: '14%' }} />
                         <col style={{ width: '14%' }} />
                         <col style={{ width: '8%' }} />
                         <col style={{ width: '10%' }} />
                     </colgroup>
                     <thead>
                         <tr className="bg-gray-200 text-center">
                             <th style={{ border: '1px solid black', padding: '5px' }}>N° d'ordre</th>
                             <th style={{ border: '1px solid black', padding: '5px' }}>Noms et prénoms</th>
                             <th style={{ border: '1px solid black', padding: '5px' }}>Grade</th>
                             <th style={{ border: '1px solid black', padding: '5px' }}>Qualité</th>
                             <th style={{ border: '1px solid black', padding: '5px' }}>Discipline</th>
                             <th style={{ border: '1px solid black', padding: '5px' }}>Classe tenue</th>
                             <th style={{ border: '1px solid black', padding: '5px' }}>Heure hebdomadaire</th>
                             <th style={{ border: '1px solid black', padding: '5px' }}>Émargement</th>
                         </tr>
                     </thead>
                     <tbody>
                         {councilMembers && councilMembers.length > 0 ? (
                             councilMembers.map((member) => {
                                 let qualityBadgeClass = "font-medium text-gray-800";
                                 if (member.quality === "Président de séance") {
                                     qualityBadgeClass = "font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded";
                                 } else if (member.quality === "Animateur pédagogique") {
                                     qualityBadgeClass = "font-bold text-purple-700 bg-purple-50 px-1 py-0.5 rounded";
                                 } else if (member.quality === "Chef de département") {
                                     qualityBadgeClass = "font-bold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded";
                                 } else if (member.quality === "Membre") {
                                     qualityBadgeClass = "font-medium text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded";
                                 }

                                 return (
                                     <tr key={member.id}>
                                         <td style={{ border: '1px solid black', padding: '5px' }} className="text-center">{member.order}</td>
                                         <td style={{ border: '1px solid black', padding: '5px' }} className="font-semibold">{member.name}</td>
                                         <td style={{ border: '1px solid black', padding: '5px' }} className="text-center">{member.grade || '-'}</td>
                                         <td style={{ border: '1px solid black', padding: '5px' }} className="text-center">
                                             <span className={qualityBadgeClass}>{member.quality}</span>
                                         </td>
                                         <td style={{ border: '1px solid black', padding: '5px' }} className="text-center">{member.discipline || '-'}</td>
                                         <td style={{ border: '1px solid black', padding: '5px' }} className="text-center">{member.classes || '-'}</td>
                                         <td style={{ border: '1px solid black', padding: '5px' }} className="text-center">{member.weeklyHours || '-'}</td>
                                         <td style={{ border: '1px solid black', padding: '5px' }} className="h-10"></td>
                                     </tr>
                                 );
                             })
                         ) : (
                             <tr>
                                 <td colSpan={8} style={{ border: '1px solid black', padding: '12px' }} className="text-center text-gray-500 italic">
                                     Aucun membre enregistré pour ce conseil.
                                 </td>
                             </tr>
                         )}
                     </tbody>
                 </table>

                 <div
                     style={{
                         display: "flex",
                         justifyContent: "space-between",
                         marginTop: "70px"
                     }}>
                     <div
                         style={{
                             width: "40%",
                             textAlign: "center"
                         }}
                     >
                         <strong>L'ANIMATEUR PÉDAGOGIQUE</strong>

                         <div style={{ height: "90px" }} />

                         <strong>{settings?.animatorName || currentUser?.name || ""}</strong>
                     </div>

                     <div
                         style={{
                             width: "40%",
                             textAlign: "center"
                         }}
                     >
                         <strong>L'ADMINISTRATION</strong>

                         <div style={{ height: "90px" }} />

                         <p className="text-sm mt-8">
                     Fait à _______________________, le ____ / ____ / ______
                         </p>
                     </div>
                 </div>
             </div>

             <div className="flex justify-between items-center text-xs text-gray-500 border-t pt-2 mt-4">
                 <div>Rapport généré le : {reportHeader.date}</div>
                 <div className="report-footer">Page 3 / 3</div>
             </div>
         </div>
     </div>
);

if (departmentLoading || gradeSheetsLoading || archivesLoading) {
     return (
         <div className="flex items-center justify-center h-64">
             Chargement des relevés, archives et paramètres du département...
         </div>
     );
}

return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen print:bg-white print:p-0">
     
     {departmentError && (
         <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
             {departmentError}
         </div>
     )}

     <div className="bg-white rounded-xl shadow-sm border p-8 mb-6 print:hidden">

         <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
             <FileText className="h-9 w-9 text-indigo-600" />
             Rapport du Conseil des Enseignants
         </h1>

         <p className="mt-3 text-lg text-slate-600">
             Générez, analysez et finalisez le rapport pédagogique trimestriel officiel du département.
         </p>

         <div className="mt-6 flex flex-wrap gap-4">

             <button
                 type="button"
                 onClick={handleAIGenerateAnalysis}
                 disabled={isGeneratingAI}
                 className="px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
             >
                {isGeneratingAI && <span className="animate-spin">⏳</span>}
                Générer le rapport
             </button>

             <button
                 type="button"
                 onClick={() => setShowPreview(true)}
                 className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors cursor-pointer shadow"
             >
                 Aperçu
             </button>

             <button
                 type="button"
                 onClick={handleSave}
                 disabled={isSaving}
                 className="px-6 py-3 rounded-lg border font-semibold hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
             >
                 {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
             </button>

             <button
                 type="button"
                 onClick={handleValidateReport}
                 disabled={isSaving || reportStatus === 'Validé' || !introductionText}
                 className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow"
             >
                 Valider le rapport
             </button>

         </div>
     </div>

     {saveStatus.type && (
        <div className={`mb-6 p-4 rounded-md print:hidden flex items-center justify-between gap-3 ${saveStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <div className="flex items-center gap-3">
            {saveStatus.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-500 shrink-0" /> : <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />}
            <p className="text-sm font-medium">{saveStatus.message}</p>
          </div>
          <button 
            type="button"
            onClick={() => setSaveStatus({ type: null, message: '' })}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
     )}

     <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
       <div className="flex items-center gap-4">
         <div className="flex items-center gap-2">
           <label htmlFor="trimester-select" className="text-sm font-semibold text-gray-700">Période d'évaluation :</label>
           <select
             id="trimester-select"
             value={selectedTrimester}
             onChange={(e) => setSelectedTrimester(Number(e.target.value) as Trimester)}
             className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-1.5 cursor-pointer"
           >
             {TRIMESTERS.map((_, index) => {
               const value = (index + 1) as Trimester;
               return <option key={value} value={value}>Trimestre {value}</option>;
             })}
           </select>
         </div>

         <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
           <label htmlFor="status-select" className="text-sm font-semibold text-gray-700">Statut :</label>
           <select
             id="status-select"
             value={reportStatus}
             onChange={(e) => setReportStatus(e.target.value as ReportStatus)}
             disabled={reportStatus === 'Validé'}
             className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs font-bold uppercase p-1.5 bg-indigo-50 text-indigo-800 cursor-pointer disabled:opacity-50"
           >
             <option value="Brouillon">Brouillon</option>
             <option value="En cours">En cours</option>
             <option value="Validé">Validé</option>
             <option value="Archivé">Archivé</option>
           </select>
         </div>
       </div>

       <div className="text-xs text-gray-500">
         Animateur / Enseignant connecté : <span className="font-semibold text-gray-700">{settings?.animatorName || currentUser?.name || 'Non spécifié'}</span>
       </div>
     </div>

     {!showPreview && (
         <div className="bg-gray-100 p-6 print:bg-white space-y-8 print:p-0">
             <Page1 />
             <Page2 />
             <Page3 />
         </div>
     )}

     {showPreview && (
         <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center print:hidden">
             <div className="bg-white w-[98%] h-[98%] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                 
                 <div className="flex justify-between items-center border-b p-4 bg-gray-50">
                     <div className="flex items-center gap-4">
                         <h2 className="text-2xl font-bold text-slate-800">
                             Aperçu du rapport
                         </h2>
                         <div className="flex items-center gap-2 border-l pl-4 border-gray-300">
                             <label htmlFor="zoom-select" className="text-xs font-semibold text-gray-600">Zoom :</label>
                             <select
                                 id="zoom-select"
                                 value={zoom}
                                 onChange={(e) => setZoom(Number(e.target.value))}
                                 className="rounded border-gray-300 text-xs p-1 bg-white cursor-pointer shadow-sm"
                             >
                                 <option value={0.5}>50%</option>
                                 <option value={0.75}>75%</option>
                                 <option value={1}>100%</option>
                                 <option value={1.25}>125%</option>
                                 <option value={1.5}>150%</option>
                             </select>
                         </div>
                     </div>

                     <button
                         type="button"
                         onClick={() => setShowPreview(false)}
                         className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer transition-colors text-sm"
                     >
                         Fermer
                     </button>
                 </div>

                 <div className="flex-1 flex overflow-hidden">
                     
                     <div className="w-48 bg-slate-100 border-r p-4 flex flex-col gap-3 overflow-y-auto select-none">
                         <span className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Navigation</span>
                         
                         <div 
                             onClick={() => page1Ref.current?.scrollIntoView({ behavior: 'smooth' })}
                             className="p-3 bg-white border rounded shadow-sm hover:border-indigo-500 cursor-pointer text-xs font-medium text-slate-700 text-center transition-colors"
                         >
                             📄 Page 1
                         </div>

                         <div 
                             onClick={() => page2Ref.current?.scrollIntoView({ behavior: 'smooth' })}
                             className="p-3 bg-white border rounded shadow-sm hover:border-indigo-500 cursor-pointer text-xs font-medium text-slate-700 text-center transition-colors"
                         >
                             📄 Page 2
                         </div>

                         <div 
                             onClick={() => page3Ref.current?.scrollIntoView({ behavior: 'smooth' })}
                             className="p-3 bg-white border rounded shadow-sm hover:border-indigo-500 cursor-pointer text-xs font-medium text-slate-700 text-center transition-colors"
                         >
                             📄 Page 3
                         </div>
                     </div>

                     <div className="flex-1 overflow-auto bg-gray-200 p-8">
                         <div
                             style={{
                                 transform: `scale(${zoom})`,
                                 transformOrigin: "top center",
                                 transition: "transform 0.2s ease-in-out"
                             }}
                             className="space-y-8"
                         >
                             <Page1 />
                             <Page2 />
                             <Page3 />
                         </div>
                     </div>

                 </div>

                 <div className="border-t p-4 flex justify-end gap-4 bg-gray-50">
                     <button
                         type="button"
                         onClick={handleExportWithLatestData}
                         className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded cursor-pointer transition-colors shadow-sm"
                     >
                         Exporter PDF
                     </button>

                     <button
                         type="button"
                         onClick={() => window.print()}
                         className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded cursor-pointer transition-colors shadow-sm"
                     >
                         Imprimer
                     </button>
                 </div>

             </div>
         </div>
     )}

     {quarterlyHistoricalReports.length > 0 && (
        <div className="mt-12 bg-white shadow-md rounded-xl p-6 border border-gray-200 print:hidden">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" />
            Historique des Rapports Trimestriels ({quarterlyHistoricalReports.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Trimestre</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Année Scolaire</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Auteur</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">État / Statut</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {quarterlyHistoricalReports.map((histReport) => {
                  const reportAuthor = histReport.teacherName || histReport.authorName || settings?.animatorName || currentUser?.name || 'Auteur non spécifié';

                  return (
                    <tr key={histReport.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-indigo-600">Trimestre {histReport.trimester}</td>
                      <td className="px-4 py-3 text-gray-900">{histReport.academicYear}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{reportAuthor}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase">
                          {histReport.reportStatus || 'Validé / Archivé'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            loadReport(histReport);
                            onSelectReport?.(histReport);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 font-medium mr-3 cursor-pointer"
                        >
                          Charger
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportPDF(histReport)}
                          className="text-gray-600 hover:text-gray-900 font-medium mr-3 cursor-pointer"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => histReport.id && handleDeleteReport(histReport.id)}
                          className="text-red-600 hover:text-red-800 font-medium ml-3 cursor-pointer"
                        >
                          🗑️ Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
     )}

   </div>
);
};

export default TrimestrialReportView;