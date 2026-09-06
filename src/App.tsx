/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/* ============================================================
 * IMPORTS
 * ============================================================ */
import { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { useUser } from "./context/UserContext";
import { exportFirstCouncilToPDF, exportTrimestrialCouncilToPDF } from "./utils/pdfExport";

import type { StudentStats, ClassGradeSheet, HourCoverage, ProgramCoverage, APCPrepFiche, ExamSubject, CouncilReport, 
  DepartmentMessage, LogbookEntry, EmargementClaim, EstablishmentSettings, Department, UserProfile, DepartmentTeacherModel,
  Progression } from './types';

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SettingsView from './components/SettingsView';
import FirstCouncilReportView from './components/FirstCouncilReportView';
import TrimestrialReportView from './components/TrimestrialReportView';
import GradeEntryView from './components/GradeEntryView';
import HourCoverageView from './components/HourCoverageView';
import ProgramCoverageView from './components/ProgramCoverageView';
import LessonPrepAPCView from './components/LessonPrepAPCView';
import ExamDesignerView from './components/ExamDesignerView';
import AnnualSynthesisView from './components/AnnualSynthesisView';
import TeacherSpaceView from './components/TeacherSpaceView';
import LoginView from './components/LoginView';
import ProfileView from "./components/ProfileView";
import ProgressionLibrary from './components/ProgressionLibrary';
import ProgressionPreview from './components/ProgressionPreview';
import { Menu, Maximize2, Minimize2, LogOut, AlertTriangle, Check, RefreshCw } from 'lucide-react';

// Firebase operations restantes pour les données métier
import { isFirebaseReady, db } from './firebaseConfig';
import { syncCollectionWithArray, saveDocument } from './lib/firebaseService';
import {
  getDocs,
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

/* ============================================================
 * ERROR BOUNDARY COMPONENT
 * ============================================================ */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary a capturé une erreur :", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="p-4 bg-red-950/50 border border-red-500/30 rounded-2xl max-w-md w-full space-y-3">
            <AlertTriangle className="mx-auto text-red-400" size={36} />
            <h2 className="text-lg font-bold">Une erreur est survenue dans ce module.</h2>
            <p className="text-xs text-slate-400">Consultez la console ou rechargez la page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================================
 * TYPES ET INTERFACES
 * ============================================================ */
interface DuplicateConflict {
  type: string;
  title: string;
  message: string;
  onReplace: () => Promise<void>;
  onCancel: () => void;
}

/* ============================================================
 * COMPOSANT PRINCIPAL (APP)
 * ============================================================ */
export default function App() {
  console.log("Render App Component");

  const { profile, establishment: userEstablishment, loading: isUserLoading, logout, isTeacher } = useUser();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<CouncilReport | null>(null);
  const [selectedProgression, setSelectedProgression] = useState<Progression | null>(null);

  console.log("Active Tab :", activeTab);

  // Collections et états métier fortement typés
  const [studentsStats, setStudentsStats] = useState<StudentStats[]>([]);
  const [gradeSheets, setGradeSheets] = useState<ClassGradeSheet[]>([]);
  const [hourCoverages, setHourCoverages] = useState<HourCoverage[]>([]);
  const [programCoverages, setProgramCoverages] = useState<ProgramCoverage[]>([]);
  const [apcPreps, setApcPreps] = useState<APCPrepFiche[]>([]);
  const [exams, setExams] = useState<ExamSubject[]>([]);
  const [councilReports, setCouncilReports] = useState<CouncilReport[]>([]);
  const [departmentMessages, setDepartmentMessages] = useState<DepartmentMessage[]>([]);
  const [departmentData, setDepartmentData] = useState<Department | null>(null);
  const [departmentTeachers, setDepartmentTeachers] = useState<UserProfile[]>([]);

  const normalizedDepartmentTeachers: DepartmentTeacherModel[] =
    departmentTeachers.map((teacher) => ({
      id: teacher.id || teacher.uid || "",
      uid: teacher.uid || teacher.id || "",

      fullName: teacher.name || "",
      email: teacher.email || "",
      
      phone: teacher.phone || "",
      matricule: teacher.matricule || "",
      grade: teacher.grade || "",

      establishmentId:
        teacher.establishmentId ||
        profile?.establishmentId ||
        "",

      departmentId:
        teacher.departmentId ||
        profile?.departmentId ||
        '',

      discipline:
        teacher.discipline ??
        null,

      weeklyHours:
        Number(teacher.weeklyHours ?? 0),

      classes:
        Array.isArray(teacher.classes)
          ? teacher.classes
          : [],

      role: teacher.role,

      isActive:
        teacher.status === "ACTIF",
    }));

  /* ============================================================
   * CLASSES DISPONIBLES
   * - Enseignant : uniquement les classes de son profil
   * - Animateur pédagogique : uniquement ses propres classes
   *
   * Les classes des autres enseignants ne sont pas ajoutées à cette
   * liste. Les relevés des autres enseignants restent disponibles
   * dans les données du tableau de bord AP pour consultation.
   * ============================================================ */
  const CLASS_ORDER = [
    '6e',
    '5e',
    '4e',
    '3e',
    '2nde',
    '1ere',
    'tle',
  ];

  const normalizeClassForOrder = (className: string) =>
    className
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[.']/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const getClassOrderIndex = (className: string) => {
    const normalized = normalizeClassForOrder(className);

    if (/^(6e|6eme|6e annee|sixieme)/.test(normalized)) return 0;
    if (/^(5e|5eme|5e annee|cinquieme)/.test(normalized)) return 1;
    if (/^(4e|4eme|4e annee|quatrieme)/.test(normalized)) return 2;
    if (/^(3e|3eme|3e annee|troisieme)/.test(normalized)) return 3;
    if (/^(2nde|2nd|2de|2e|seconde)/.test(normalized)) return 4;
    if (/^(1ere|1re|1e|premiere)/.test(normalized)) return 5;
    if (/^(tle|t le|terminale|terminal)/.test(normalized)) return 6;

    return CLASS_ORDER.length;
  };

  const availableClasses = Array.from(
    new Set(
      (Array.isArray(profile?.classes) ? profile.classes : [])
        .map((className) => String(className).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => {
    const orderA = getClassOrderIndex(a);
    const orderB = getClassOrderIndex(b);

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.localeCompare(b, 'fr', { sensitivity: 'base' });
  });

  const [customEstablishmentHeaders, setCustomEstablishmentHeaders] = useState<EstablishmentSettings>(
    userEstablishment || {
      id: "default",
      ministry: "MINISTERE DES ENSEIGNEMENTS SECONDAIRES",
      region: "",
      delegation: "",
      establishmentName: "",
      academicYear: "",
      motto: "",
      town: "",
      departmentName: "",
      logoUrl: "",
    }
  );
  const [logbookEntriesList, setLogbookEntriesList] = useState<LogbookEntry[]>([]);
  const [emargementClaimsList, setEmargementClaimsList] = useState<EmargementClaim[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflict | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadBusinessData(profile.id);
      loadDepartmentData(profile.departmentId);
    }
  }, [profile?.id, profile?.departmentId]);

  /* ============================================================
   * SYNCHRONISATION TEMPS RÉEL (HEURES ET PROGRAMMES)
   * ============================================================ */
  useEffect(() => {
    if (
      !db ||
      !profile?.establishmentId ||
      !profile?.departmentId
    ) {
      setHourCoverages([]);
      setProgramCoverages([]);
      return;
    }

    const isAnimator =
      profile.role === "ANIMATEUR_PEDAGOGIQUE";

    const hourQuery = query(
      collection(db, "hourCoverages"),
      where("establishmentId", "==", profile.establishmentId),
      where("departmentId", "==", profile.departmentId)
    );

    const programQuery = query(
      collection(db, "programCoverages"),
      where("establishmentId", "==", profile.establishmentId),
      where("departmentId", "==", profile.departmentId)
    );

    const unsubscribeHours = onSnapshot(
      hourQuery,
      (snapshot) => {
        const userIds = new Set(
          [profile.id, profile.uid].filter(
            (id): id is string => Boolean(id)
          )
        );

        const items = snapshot.docs
          .map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          }) as HourCoverage)
          .filter((item) => {
            if (isAnimator) return true;

            return userIds.has(item.userId ?? "") ||
              userIds.has(item.teacherId ?? "") ||
              userIds.has(item.authorId ?? "");
          });

        setHourCoverages(items);
      },
      (error) => {
        console.error(
          "Erreur de synchronisation des couvertures horaires :",
          error
        );
        setHourCoverages([]);
      }
    );

    const unsubscribePrograms = onSnapshot(
      programQuery,
      (snapshot) => {
        const userIds = new Set(
          [profile.id, profile.uid].filter(
            (id): id is string => Boolean(id)
          )
        );

        const items = snapshot.docs
          .map((documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          }) as ProgramCoverage)
          .filter((item) => {
            if (isAnimator) return true;

            return userIds.has(item.userId ?? "") ||
              userIds.has(item.teacherId ?? "") ||
              userIds.has(item.authorId ?? "");
          });

        setProgramCoverages(items);
      },
      (error) => {
        console.error(
          "Erreur de synchronisation des couvertures des programmes :",
          error
        );
        setProgramCoverages([]);
      }
    );

    return () => {
      unsubscribeHours();
      unsubscribePrograms();
    };
  }, [
    profile?.id,
    profile?.uid,
    profile?.role,
    profile?.establishmentId,
    profile?.departmentId,
  ]);

  /* ============================================================
   * CHARGEMENT DES PARAMÈTRES D'ÉTABLISSEMENT PERSONNALISÉS
   * ============================================================ */
  useEffect(() => {
    if (!profile?.id) return;

    if (userEstablishment) {
      setCustomEstablishmentHeaders((previous) => ({
        ...previous,
        ...userEstablishment,
      }));
    }

    if (!db) return;

    let cancelled = false;

    const loadCustomHeaders = async () => {
      try {
        const configRef = doc(
          db,
          'config',
          `customEstablishmentHeaders_${profile.id}`
        );
        const configSnap = await getDoc(configRef);

        if (cancelled || !configSnap.exists()) return;

        const configData = configSnap.data() as {
          headers?: EstablishmentSettings;
        };

        if (configData.headers) {
          setCustomEstablishmentHeaders((previous) => ({
            ...previous,
            ...(userEstablishment || {}),
            ...configData.headers,
          }));
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des paramètres personnalisés de l'établissement :",
          error
        );
      }
    };

    void loadCustomHeaders();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, userEstablishment]);

  useEffect(() => {
    if (
      !db ||
      !profile?.establishmentId ||
      !profile?.departmentId
    ) {
      setDepartmentTeachers([]);
      return;
    }

    const usersQuery = query(
      collection(db, 'users'),
      where(
        'establishmentId',
        '==',
        profile.establishmentId
      )
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const teachers = snapshot.docs
          .map((userDocument) => ({
            id: userDocument.id,
            ...userDocument.data(),
          }) as UserProfile)
          .filter(
            (user) =>
              user.departmentId === profile.departmentId &&
              user.status === 'ACTIF' &&
              (
                user.role === 'ENSEIGNANT' ||
                user.role === 'ANIMATEUR_PEDAGOGIQUE'
              )
          );

        setDepartmentTeachers(teachers);
      },
      (error) => {
        console.error(
          'Erreur de chargement des enseignants du département :',
          error
        );
        setDepartmentTeachers([]);
      }
    );

    return () => unsubscribe();
  }, [
    profile?.establishmentId,
    profile?.departmentId,
  ]);

  useEffect(() => {
    if (activeTab !== "progressions") {
      setSelectedProgression(null);
    }
  }, [activeTab]);

  const loadBusinessData = async (uid: string) => {
    if (!db || !profile) return;

    setIsSyncing(true);

    try {
      const fetchUserCollection = async <
        T extends {
          id?: string;
          userId?: string;
          authorId?: string;
          teacherId?: string;
          establishmentId?: string;
          departmentId?: string;
        }
      >(
        colName: string,
        setter: (val: T[]) => void
      ): Promise<void> => {
        const snap = await getDocs(collection(db, colName));
        const items: T[] = [];

        const isAnimator =
          profile.role === 'ANIMATEUR_PEDAGOGIQUE';

        const userIds = new Set(
          [uid, profile.id, profile.uid].filter(
            (id): id is string => Boolean(id)
          )
        );

        snap.forEach((documentSnapshot) => {
          const data = documentSnapshot.data() as T;

          const belongsToCurrentUser =
            userIds.has(data.userId || '') ||
            userIds.has(data.authorId || '') ||
            userIds.has(data.teacherId || '');

          if (!isAnimator) {
            if (belongsToCurrentUser) {
              items.push({
                id: documentSnapshot.id,
                ...data,
              });
            }

            return;
          }

          const sameEstablishment =
            data.establishmentId === profile.establishmentId;

          const sameDepartment =
            data.departmentId === profile.departmentId;

          if (sameEstablishment && sameDepartment) {
            items.push({
              id: documentSnapshot.id,
              ...data,
            });
          }
        });

        setter(items);
      };

      await Promise.all([
        fetchUserCollection<StudentStats>(
          'studentsStats',
          setStudentsStats
        ),
        fetchUserCollection<ClassGradeSheet>(
          'classGradeSheets',
          setGradeSheets
        ),
        fetchUserCollection<HourCoverage>(
          'hourCoverages',
          setHourCoverages
        ),
        fetchUserCollection<ProgramCoverage>(
          'programCoverages',
          setProgramCoverages
        ),
        fetchUserCollection<APCPrepFiche>(
          'apcPreps',
          setApcPreps
        ),
        fetchUserCollection<ExamSubject>(
          'exams',
          setExams
        ),
        fetchUserCollection<CouncilReport>(
          'councilReports',
          setCouncilReports
        ),
        fetchUserCollection<DepartmentMessage>(
          'departmentMessages',
          setDepartmentMessages
        ),
        fetchUserCollection<LogbookEntry>(
          'logbookEntries',
          setLogbookEntriesList
        ),
        fetchUserCollection<EmargementClaim>(
          'emargementClaims',
          setEmargementClaimsList
        ),
      ]);
    } catch (err) {
      console.error(
        'Erreur chargement des collections métier Firestore',
        err
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const loadDepartmentData = async (deptId?: string | null) => {
    if (!db || !deptId) return;
    try {
      const deptDocRef = doc(db, 'departments', deptId);
      const deptSnap = await getDoc(deptDocRef);
      if (deptSnap.exists()) {
        setDepartmentData({ id: deptSnap.id, ...deptSnap.data() } as Department);
      }
    } catch (err) {
      console.error("Erreur lors du chargement du département :", err);
    }
  };

  const handleSaveDepartmentSettings = async (newSettings: Department) => {
    if (!db || !profile?.departmentId) return;
    try {
      const deptRef = doc(db, 'departments', profile.departmentId);
      await setDoc(deptRef, newSettings, { merge: true });
      setDepartmentData(newSettings);
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du département :", err);
      throw err;
    }
  };

  useEffect(() => {
    if (isTeacher) {
      const restrictedTabs = [
        'settings',
        'first-report',
        'trimestrial'
      ];
      if (restrictedTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [isTeacher, activeTab]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Erreur d'arborescence plein écran :", err);
    }
  };

  const effectiveEstablishment = userEstablishment
    ? { ...userEstablishment, ...customEstablishmentHeaders }
    : customEstablishmentHeaders;

  const effectiveAcademicYear =
    effectiveEstablishment?.academicYear?.trim() ||
    profile?.academicYear?.trim() ||
    '';

  const saveBusinessState = async (updatedFields: Partial<{
    studentsStats: StudentStats[];
    gradeSheets: ClassGradeSheet[];
    hourCoverages: HourCoverage[];
    programCoverages: ProgramCoverage[];
    apcPreps: APCPrepFiche[];
    exams: ExamSubject[];
    councilReports: CouncilReport[];
    departmentMessages: DepartmentMessage[];
  }>) => {
    if (!profile || !isFirebaseReady || !db) return;
    setIsSyncing(true);
    const uid = profile.id;

    const establishmentId = profile.establishmentId;
    const departmentId = profile.departmentId;
    const academicYear = effectiveAcademicYear;

    if (!establishmentId || !departmentId) {
      console.error(
        'Impossible de synchroniser les données : établissement ou département manquant.'
      );
      setIsSyncing(false);
      return;
    }

    try {
      if (updatedFields.studentsStats) {
        await syncCollectionWithArray(
          'studentsStats',
          updatedFields.studentsStats.map(s => ({
            ...s,
            userId: uid,
            establishmentId,
            departmentId,
            academicYear: s.academicYear || academicYear,
          })),
          'id'
        );
      }
      if (updatedFields.gradeSheets) {
        await syncCollectionWithArray(
          'classGradeSheets',
          updatedFields.gradeSheets.map(g => ({
            ...g,
            userId: uid,
            establishmentId,
            departmentId,
            academicYear: g.academicYear || academicYear,
          })),
          'id'
        );
      }
      if (updatedFields.hourCoverages) {
        await syncCollectionWithArray(
          'hourCoverages',
          updatedFields.hourCoverages.map(h => ({
            ...h,
            userId: uid,
            establishmentId,
            departmentId,
            academicYear: h.academicYear || academicYear,
          })),
          'id'
        );
      }
      if (updatedFields.programCoverages) {
        await syncCollectionWithArray(
          'programCoverages',
          updatedFields.programCoverages.map(p => ({
            ...p,
            userId: uid,
            establishmentId,
            departmentId,
            academicYear: p.academicYear || academicYear,
          })),
          'id'
        );
      }
      if (updatedFields.apcPreps) {
        await syncCollectionWithArray(
          'apcPreps',
          updatedFields.apcPreps.map(a => ({
            ...a,
            userId: uid,
            establishmentId,
            departmentId,
            academicYear: a.academicYear || academicYear,
          })),
          'id'
        );
      }
      if (updatedFields.exams) {
        await syncCollectionWithArray(
          'exams',
          updatedFields.exams.map(e => ({
            ...e,
            userId: uid,
            establishmentId,
            departmentId,
          })),
          'id'
        );
      }
      if (updatedFields.councilReports) {
        await syncCollectionWithArray('councilReports', updatedFields.councilReports.map(c => ({ ...c, userId: uid, establishmentId, departmentId, academicYear: c.academicYear || academicYear })), 'id');
      }
      if (updatedFields.departmentMessages) {
        await syncCollectionWithArray('departmentMessages', updatedFields.departmentMessages.map(m => ({ ...m, userId: uid, establishmentId, departmentId })), 'id');
      }
    } catch (err) {
      console.error('Erreur de synchronisation des états:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveDepartmentMessages = async (nextMessages: DepartmentMessage[]) => {
    setDepartmentMessages(nextMessages);
    await saveBusinessState({ departmentMessages: nextMessages });
  };

  const handleSaveCustomEstablishmentHeaders = async (headers: EstablishmentSettings) => {
    if (!profile) return;

    const mergedHeaders: EstablishmentSettings = {
      ...(userEstablishment || customEstablishmentHeaders),
      ...headers,
    };

    setCustomEstablishmentHeaders(mergedHeaders);

    await saveDocument(
      'config',
      `customEstablishmentHeaders_${profile.id}`,
      { headers: mergedHeaders }
    );
  };

  const handleSaveLogbookEntries = async (entries: LogbookEntry[]) => {
    if (!profile) return;
    setLogbookEntriesList(entries);
    await syncCollectionWithArray('logbookEntries', entries.map(e => ({ ...e, userId: profile.id })), 'id');
  };

  const handleSaveEmargementClaims = async (claims: EmargementClaim[]) => {
    if (!profile) return;
    setEmargementClaimsList(claims);
    await syncCollectionWithArray('emargementClaims', claims.map(c => ({ ...c, userId: profile.id })), 'id');
  };

  const handleSaveReport = async (report: CouncilReport) => {
    const duplicate = councilReports.find(
      r =>
        r.id !== report.id &&
        r.type === report.type &&
        r.academicYear === report.academicYear &&
        (report.type !== 'TRIMESTRIEL' || r.trimester === report.trimester)
    );

    if (duplicate) {
      const label =
        report.type === 'PREMIER_CONSEIL'
          ? "le Premier Conseil d'Enseignement"
          : `le Conseil d'Enseignement du Trimestre ${report.trimester}`;

      setDuplicateConflict({
        type: 'report',
        title: "Rapport de Conseil déjà existant",
        message:
          `Un procès-verbal de conseil pour ${label} de l'année scolaire ${report.academicYear} existe déjà dans la base de données.`,

        onReplace: async () => {
          const replacement = {
            ...report,
            id: duplicate.id,
          };

          const nextReports = councilReports.map(r =>
            r.id === duplicate.id ? replacement : r
          );

          setCouncilReports(nextReports);

          await saveBusinessState({
            councilReports: nextReports,
          });

          setDuplicateConflict(null);
        },

        onCancel: () => {
          setDuplicateConflict(null);
        },
      });

      return;
    }

    const existingIndex = councilReports.findIndex(
      r => r.id === report.id
    );

    const nextReports = [...councilReports];

    if (existingIndex >= 0) {
      nextReports[existingIndex] = report;
    } else {
      nextReports.push(report);
    }

    setCouncilReports(nextReports);

    await saveBusinessState({
      councilReports: nextReports,
    });
  };

  const handleSaveAPCPreps = async (prepsOrUpdater: APCPrepFiche[] | ((prev: APCPrepFiche[]) => APCPrepFiche[])) => {
    const nextPreps = typeof prepsOrUpdater === 'function' ? prepsOrUpdater(apcPreps) : prepsOrUpdater;
    setApcPreps(nextPreps);
    await saveBusinessState({ apcPreps: nextPreps });
  };

  const handleSaveExams = async (nextExams: ExamSubject[]) => {
    setExams(nextExams);
    await saveBusinessState({ exams: nextExams });
  };

  const handleDeleteReport = async (reportId: string) => {
    const nextReports = councilReports.filter(
      report => report.id !== reportId
    );

    setCouncilReports(nextReports);
    await saveBusinessState({
      councilReports: nextReports,
    });
  };

  const handleExportCouncilPDF = (report: CouncilReport) => {
    if (!effectiveEstablishment) return;

    if (report.type === "PREMIER_CONSEIL") {
      exportFirstCouncilToPDF(report, effectiveEstablishment);
    } else {
      exportTrimestrialCouncilToPDF(report, effectiveEstablishment);
    }
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-mono text-slate-400">Authentification & Synchronisation avec Firestore...</p>
      </div>
    );
  }

  const getTabLabel = (tabId: string) => {
    switch (tabId) {
      case 'dashboard': return isTeacher ? 'Tableau de bord' : 'Tableau de bord AP';
      case 'teacher-space': return 'Cahier de Textes & Émargement';
      case 'settings': return 'Paramètres';
      case 'first-report': return 'Rapport 1er Conseil';
      case 'trimestrial': return 'Rapports Trimestriels';
      case 'grades': return 'Relevés de Notes';
      case 'hours': return 'Couverture Heures';
      case 'program': return 'Couverture Programmes';
      case 'progressions': return 'Bibliothèque de Progressions';
      case 'apc': return 'Préparation APC';
      case 'exams': return 'Conception Épreuves';
      case 'profile': return 'Mon compte';
      case 'annual': return 'Synthèse Annuelle';
      default: return 'Conseil d\'Enseignement';
    }
  };

  if (!profile) {
    return (
      <LoginView
        onLogin={() => {}} 
        establishment={userEstablishment || { id: "default",
          ministry: "MINISTERE DES ENSEIGNEMENTS SECONDAIRES", region: "", delegation: "", 
          establishmentName: "", academicYear: "", motto: "", 
          town: "", departmentName: "", logoUrl: "" }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 -ml-1 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Ouvrir le menu"
            >
              <Menu size={20} />
            </button>
            <span className="font-bold text-sm text-slate-100 truncate max-w-[150px] sm:max-w-[250px] md:max-w-none">
              {getTabLabel(activeTab)}
            </span>

          </div>
          
          <div className="flex items-center gap-2">
            {isSyncing && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-950/40 border border-emerald-900/50 rounded-md text-[10px] font-semibold text-emerald-400">
                <RefreshCw size={12} className="animate-spin" />
                <span>Synchro...</span>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all text-xs font-semibold border border-slate-800 bg-slate-950/40 cursor-pointer"
              aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span className="hidden sm:inline">{isFullscreen ? "Quitter" : "Plein écran"}</span>
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-all text-xs font-bold border border-red-900/30 rounded-lg shadow-sm cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut size={15} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-slate-950/60 z-40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <Sidebar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              setIsSidebarOpen(false);
            }}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />

          <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 print:bg-white print:p-0 print:overflow-visible">
            {activeTab === "dashboard" && effectiveEstablishment && (
              <Dashboard
         currentUser={profile}
         establishmentSettings={effectiveEstablishment}
         studentsStats={studentsStats}
         gradeSheets={gradeSheets}
         hourCoverages={hourCoverages}
         programCoverages={programCoverages}
         departmentMessages={departmentMessages}
         departmentTeachers={departmentTeachers}
         onSaveDepartmentMessages={handleSaveDepartmentMessages}
              />
            )}

            {activeTab === 'teacher-space' && effectiveEstablishment && (
              <TeacherSpaceView
                currentUser={profile}
                establishmentSettings={effectiveEstablishment}
                gradeSheets={gradeSheets}
                hourCoverages={hourCoverages}
                programCoverages={programCoverages}
                logbookEntriesList={logbookEntriesList}
                onSaveLogbookEntriesList={handleSaveLogbookEntries}
                emargementClaimsList={emargementClaimsList}
                onSaveEmargementClaimsList={handleSaveEmargementClaims}
              />
            )}

            {activeTab === 'settings' && profile && effectiveEstablishment && (
              <SettingsView
                currentUser={profile}
                establishment={effectiveEstablishment}
                department={departmentData}
                onSaveEstablishment={handleSaveCustomEstablishmentHeaders}
                onSaveDepartment={handleSaveDepartmentSettings}
              />
            )}

            {activeTab === 'first-report' && effectiveEstablishment && (
              <FirstCouncilReportView
                currentUser={profile}
                establishment={effectiveEstablishment}
                reports={councilReports}
                departmentTeachers={departmentTeachers}
                gradeSheets={gradeSheets}
                allHourCoverages={hourCoverages}
                allProgramCoverages={programCoverages}
                onSaveReport={handleSaveReport}
                onExportPDF={handleExportCouncilPDF}
              />
            )}

            {activeTab === 'trimestrial' && effectiveEstablishment && (
              <TrimestrialReportView
                currentUser={profile}
                establishmentSettings={effectiveEstablishment}
                classes={availableClasses}
                existingReport={selectedReport}
                historicalReports={councilReports}
                allStudentStats={studentsStats}
                allGradeSheets={gradeSheets}
                allHourCoverages={hourCoverages}
                allProgramCoverages={programCoverages}
                allDepartmentTeachers={normalizedDepartmentTeachers}
                onSaveReport={handleSaveReport}
                onDeleteReport={handleDeleteReport}
                onExportPDF={handleExportCouncilPDF}
                onSelectReport={setSelectedReport}
              />
            )}

            {activeTab === 'grades' && effectiveEstablishment && (
              <GradeEntryView
                teacherId={profile?.uid || profile?.id || ""}
                teacherName={profile?.name}
                isAnimator={profile?.role === "ANIMATEUR_PEDAGOGIQUE"}
                establishmentSettings={effectiveEstablishment}
                establishmentId={profile?.establishmentId}
                departmentId={profile?.departmentId}
                classes={availableClasses}
                editableClasses={
                  Array.isArray(profile?.classes)
                    ? profile.classes
                    : []
                }
              />
            )}

            {activeTab === 'hours' && effectiveEstablishment && (
              <HourCoverageView
                currentUser={profile}
                establishment={effectiveEstablishment}
                academicYear={effectiveAcademicYear}
                classes={availableClasses}
              />
            )}

            {activeTab === 'program' && effectiveEstablishment && (
              <ProgramCoverageView
                currentUser={profile}
                establishment={effectiveEstablishment}
                establishmentSettings={effectiveEstablishment}
                classes={availableClasses}
              />
            )}

            {activeTab === 'progressions' && effectiveEstablishment && (
              <ProgressionLibrary
                currentUser={profile}
                establishmentId={effectiveEstablishment.id}
                academicYear={effectiveAcademicYear}
                departmentId={profile.departmentId ?? undefined}
                onSelectProgression={(progression) => {
                  setSelectedProgression(progression);
                }}
              />
            )}

            {activeTab === 'progressions' && selectedProgression && (
              <ProgressionPreview
                progression={selectedProgression}
                onClose={() => setSelectedProgression(null)}
              />
            )}

            {activeTab === 'apc' && effectiveEstablishment && (
              <LessonPrepAPCView
                currentUser={profile}
                establishment={effectiveEstablishment}
                apcPreps={apcPreps}
                onSaveAPCPreps={handleSaveAPCPreps}
              />
            )}

            {activeTab === 'exams' && effectiveEstablishment && (
              <ExamDesignerView
                currentUser={profile}
                establishmentSettings={effectiveEstablishment}
                exams={exams}
                programCoverages={programCoverages}
                onSaveExams={handleSaveExams}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView />
            )}

            {activeTab === 'annual' && effectiveEstablishment && (
              <AnnualSynthesisView
                establishmentId={effectiveEstablishment.id}
                departmentId={profile?.departmentId ?? ""}
                academicYear={effectiveAcademicYear}
                discipline={profile?.subject ?? ""}
              />
            )}
          </main>
        </div>

        {/* Security Anti-Duplicate Modal Overlay */}
        {duplicateConflict && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shrink-0 border border-amber-200">
                  <AlertTriangle size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-900 text-base">{duplicateConflict.title}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sécurité Anti-Doublon • MINESEC</p>
                </div>
              </div>

              <div className="text-slate-700 text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 font-medium font-mono">
                {duplicateConflict.message}
              </div>

              <div className="text-xs text-slate-600 bg-amber-50/40 p-3 rounded-lg border border-amber-100/70 leading-relaxed font-semibold">
                <strong>Sécurité :</strong> Cet élément similaire existe déjà dans l'ensemble des tableaux de bord de l'application. Souhaitez-vous écraser et remplacer l'élément existant par cette nouvelle version ?
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={duplicateConflict.onCancel}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await duplicateConflict.onReplace();
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Check size={14} />
                  <span>Oui, Remplacer</span> 
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}