/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, updateDoc, writeBatch } from 'firebase/firestore';
import type { UserProfile, EstablishmentSettings, Department, AppNotification, UserRole, AccountStatus } from '../types';

interface UserPermissions {
  canManageSettings: boolean;
  canGenerateReports: boolean;
  canManageTeachers: boolean;
  canUseAIReports: boolean;
  canUseAILessons: boolean;
  canUseAIExam: boolean;
  canUseAIStatistics: boolean;
  canApprovePrograms: boolean;
  canApproveHours: boolean;
  canManageSubscriptions: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

interface UserContextType {
  currentUser: FirebaseUser | null;
  profile: UserProfile | null;
  establishment: EstablishmentSettings | null;
  department: Department | null;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  permissions: UserPermissions;
  allowedMenus: MenuItem[];
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  isOnline: boolean;
  canSync: boolean;
  lastSync: Date | null;
  isTeacher: boolean;
  isAnimator: boolean;
  isAdministrator: boolean;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

const VALID_ROLES: UserRole[] = ['ENSEIGNANT', 'ANIMATEUR_PEDAGOGIQUE'];
const VALID_STATUSES: AccountStatus[] = ['ACTIF', 'EN_ATTENTE', 'SUSPENDU'];

function isValidUserProfile(data: unknown): data is UserProfile {
  if (!data || typeof data !== 'object') {
    console.error("[isValidUserProfile] Les données fournies ne sont pas un objet valide :", data);
    return false;
  }

  const candidate = data as Record<string, unknown>;

  const requiredStringFields = ['id', 'uid', 'role', 'status', 'establishmentId', 'departmentId'];
  for (const field of requiredStringFields) {
    const value = candidate[field];
    if (typeof value !== 'string' || value.trim() === "") {
      console.error(`[isValidUserProfile] Le champ obligatoire '${field}' est manquant, invalide ou vide :`, value);
      return false;
    }
  }

  const role = candidate.role as string;
  if (!VALID_ROLES.includes(role as UserRole)) {
    console.error(`[isValidUserProfile] Le champ 'role' a une valeur invalide ('${role}'). Valeurs autorisées :`, VALID_ROLES);
    return false;
  }

  const status = candidate.status as string;
  if (!VALID_STATUSES.includes(status as AccountStatus)) {
    console.error(`[isValidUserProfile] Le champ 'status' a une valeur invalide ('${status}'). Valeurs autorisées :`, VALID_STATUSES);
    return false;
  }

  return true;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [establishment, setEstablishment] = useState<EstablishmentSettings | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setError(null);
    setLoading(true);

    let unsubscribeProfile: () => void = () => {};
    let unsubscribeEstablishment: () => void = () => {};
    let unsubscribeDepartment: () => void = () => {};
    let unsubscribeNotifications: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile();
      unsubscribeEstablishment();
      unsubscribeDepartment();
      unsubscribeNotifications();

      setCurrentUser(user);
      
      if (!user) {
        setProfile(null);
        setEstablishment(null);
        setDepartment(null);
        setNotifications([]);
        setLastSync(null);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const rawData = docSnap.data() as UserProfile;

          console.log("=== PROFIL FIRESTORE ===");
          console.log(rawData);

          let migrated = false;
          const updates: Record<string, unknown> = {};
          if (!rawData.uid) {
              updates.uid = rawData.id || user.uid;
              rawData.uid = rawData.id || user.uid;
              migrated = true;
          }
          if (!rawData.status) {
              updates.status = "ACTIF";
              rawData.status = "ACTIF";
              migrated = true;
          }
          if (!rawData.id) {
              updates.id = user.uid;
              rawData.id = user.uid;
              migrated = true;
          }
          if (migrated) {
              try {
                  await updateDoc(userDocRef, updates);
                  console.log("✅ Ancien profil migré automatiquement :", updates);
              } catch (e) {
                  console.error("❌ Impossible de migrer automatiquement le profil :", e);
              }
          }

          if (!isValidUserProfile(rawData)) {
              console.error("=== PROFIL INVALIDE ===");
              console.error(rawData);

              setError("Le format du profil utilisateur est invalide.");
              setLoading(false);
              return;
          }

          const missingFields: string[] = [];
          if (!rawData.establishmentId || rawData.establishmentId.trim() === "") {
            missingFields.push("establishmentId");
          }
          if (!rawData.departmentId || rawData.departmentId.trim() === "") {
            missingFields.push("departmentId");
          }
          if (!rawData.role || rawData.role.trim() === "") {
            missingFields.push("role");
          }
          if (!rawData.status || rawData.status.trim() === "") {
            missingFields.push("status");
          }

          if (missingFields.length > 0) {
            console.error(`[UserContext] Document utilisateur ${user.uid} incomplet. Champs manquants ou vides :`, missingFields);
            setError(`Profil utilisateur incomplet. Champs manquants : ${missingFields.join(', ')}`);
            setLoading(false);
            return;
          }

          const normalizedProfile: UserProfile = {
            ...rawData,
            id: rawData.id ?? user.uid,
            uid: rawData.uid ?? user.uid,
            establishmentId: rawData.establishmentId,
            departmentId: rawData.departmentId,
            establishment: rawData.establishment ?? "",
            department: rawData.department ?? ""
          };

          setProfile(normalizedProfile);
          console.log("=== PROFILE NORMALISÉ ===");
          console.log(normalizedProfile);
          
          setError(null);
          setLastSync(new Date());

          console.log("UID :", user.uid);
          console.log("establishmentId :", normalizedProfile.establishmentId);
          console.log("departmentId :", normalizedProfile.departmentId);
          console.log("role :", normalizedProfile.role);
          console.log("status :", normalizedProfile.status);

          if (normalizedProfile.establishmentId && normalizedProfile.establishmentId.trim() !== "") {
            unsubscribeEstablishment();
            const estDocRef = doc(db, 'schools', normalizedProfile.establishmentId);
            unsubscribeEstablishment = onSnapshot(estDocRef, (estSnap) => {
              if (estSnap.exists()) {
                setEstablishment(estSnap.data() as EstablishmentSettings);
                setLastSync(new Date());
              } else {
                setEstablishment(null);
                console.warn(`[UserContext] Document école introuvable dans 'schools' avec l'ID : ${normalizedProfile.establishmentId}`);
              }
            }, (err) => {
              console.error(`[UserContext] Erreur lors de l'écoute de l'école ${normalizedProfile.establishmentId}:`, err);
            });
          } else {
            setEstablishment(null);
            console.warn("[UserContext] establishmentId est vide. Requête 'schools' ignorée.");
          }

          if (normalizedProfile.departmentId && normalizedProfile.departmentId.trim() !== "") {
            unsubscribeDepartment();
            const deptDocRef = doc(db, 'departments', normalizedProfile.departmentId);
            unsubscribeDepartment = onSnapshot(deptDocRef, (deptSnap) => {
              if (deptSnap.exists()) {
                setDepartment(deptSnap.data() as Department);
                setLastSync(new Date());
              } else {
                setDepartment(null);
                console.warn(`[UserContext] Document sujet/département introuvable dans 'subjects' avec l'ID : ${normalizedProfile.departmentId}`);
              }
            }, (err) => {
              console.error(`[UserContext] Erreur lors de l'écoute du sujet ${normalizedProfile.departmentId}:`, err);
            });
          } else {
            setDepartment(null);
            console.warn("[UserContext] departmentId est vide. Requête 'subjects' ignorée.");
          }

          unsubscribeNotifications();
          const notificationsRef = collection(db, 'notifications');
          const q = query(
            notificationsRef, 
            where('recipientId', '==', normalizedProfile.uid),
            where('status', '==', 'UNREAD')
          );
          unsubscribeNotifications = onSnapshot(q, (querySnap) => {
            const notifs: AppNotification[] = [];
            querySnap.forEach((d) => {
              const data = d.data() as AppNotification;
              notifs.push({
                ...data,
                id: d.id
              });
            });
            setNotifications(notifs);
            setLastSync(new Date());
          });

          setLoading(false);
        } else {
          setProfile(null);
          setError('Profil utilisateur introuvable.');
          setLoading(false);
        }
      }, (err) => {
        console.error(err);
        setError('Erreur de synchronisation du profil.');
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
      unsubscribeEstablishment();
      unsubscribeDepartment();
      unsubscribeNotifications();
    };
  }, []);

  const logout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la déconnexion.');
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, { status: 'READ' });
    } catch (err) {
      console.error('Erreur lors du marquage de la notification :', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((notif) => {
        const notifRef = doc(db, 'notifications', notif.id);
        batch.update(notifRef, { status: 'READ' });
      });
      await batch.commit();
    } catch (err) {
      console.error('Erreur lors du marquage groupé des notifications :', err);
    }
  };

  const updateProfile = async (
    updates: Partial<UserProfile>
  ): Promise<void> => {

    if (!currentUser) {
        throw new Error("Aucun utilisateur connecté.");
    }

    try {

        const userRef = doc(db, "users", currentUser.uid);

        await updateDoc(userRef, updates);

        console.log("Profil mis à jour avec succès.");

    } catch (error) {

        console.error(
            "Erreur lors de la mise à jour du profil :",
            error
        );

        throw error;
    }
  };

  const unreadNotificationsCount = useMemo(() => notifications.length, [notifications]);

  const isTeacher = useMemo(() => profile?.role === 'ENSEIGNANT', [profile?.role]);
  const isAnimator = useMemo(() => profile?.role === 'ANIMATEUR_PEDAGOGIQUE', [profile?.role]);
  const isAdministrator = useMemo(() => profile?.role === 'ANIMATEUR_PEDAGOGIQUE', [profile?.role]);

  const permissions = useMemo<UserPermissions>(() => {
    const role = profile?.role ?? null;
    const status = profile?.status ?? 'EN_ATTENTE';

    if (status !== 'ACTIF') {
      return {
        canManageSettings: false, canGenerateReports: false, canManageTeachers: false,
        canUseAIReports: false, canUseAILessons: false, canUseAIExam: false, canUseAIStatistics: false,
        canApprovePrograms: false, canApproveHours: false, canManageSubscriptions: false
      };
    }

    return {
      canManageSettings: role === 'ANIMATEUR_PEDAGOGIQUE',
      canGenerateReports: role === 'ANIMATEUR_PEDAGOGIQUE',
      canManageTeachers: role === 'ANIMATEUR_PEDAGOGIQUE',

      canUseAIReports: true,
      canUseAILessons: true,
      canUseAIExam: true,
      canUseAIStatistics: true,

      canApprovePrograms: role === 'ANIMATEUR_PEDAGOGIQUE',
      canApproveHours: role === 'ANIMATEUR_PEDAGOGIQUE',

      canManageSubscriptions: false
    };
  }, [profile?.role, profile?.status]);

  const allowedMenus = useMemo<MenuItem[]>(() => {
    if (!profile || profile.status !== 'ACTIF') return [];

    const fullMenu: (MenuItem & { visible: boolean })[] = [
      { id: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', path: '/dashboard', visible: true },
      { id: 'teacher-space', label: 'Cahier de Textes', icon: 'GraduationCap', path: '/cahier-textes', visible: true },
      { id: 'lessons-ai', label: 'Préparation de Cours IA', icon: 'Sparkles', path: '/ia-cours', visible: permissions.canUseAILessons },
      { id: 'exams-ai', label: 'Conception Épreuves', icon: 'HelpCircle', path: '/ia-examens', visible: permissions.canUseAIExam },
      { id: 'reports', label: 'Rapports Pédagogiques', icon: 'FileText', path: '/rapports', visible: permissions.canGenerateReports },
      { id: 'teachers-management', label: 'Gestion Enseignants', icon: 'Users', path: '/enseignants', visible: permissions.canManageTeachers },
      { id: 'profile', label: 'Mon compte', icon: 'CircleUserRound', path: '/profile', visible: true },
      { id: 'settings', label: 'Paramètres', icon: 'Settings', path: '/settings', visible: permissions.canManageSettings },
    ];

    return fullMenu.filter(item => item.visible).map(({ id, label, icon, path }) => ({ id, label, icon, path }));
  }, [profile, permissions]);

  const canSync = isOnline && currentUser !== null && !loading;

  const contextValue = useMemo(() => ({
    currentUser,
    profile,
    establishment,
    department,
    notifications,
    unreadNotificationsCount,
    permissions,
    allowedMenus,
    loading,
    error,
    logout,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    updateProfile,
    isOnline,
    canSync,
    lastSync,
    isTeacher,
    isAnimator,
    isAdministrator
  }), [
    currentUser, profile, establishment, department, notifications, unreadNotificationsCount,
    permissions, allowedMenus, loading, error, isOnline, canSync, lastSync, isTeacher, isAnimator, isAdministrator, updateProfile
  ]);

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser doit être utilisé à l'intérieur d'un UserProvider");
  }
  return context;
}