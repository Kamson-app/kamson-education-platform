/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
// Importation et utilisation du type User unifié
import type { User } from '../types'; 
import { 
  Shield, 
  GraduationCap, 
  BookOpen, 
  AlertTriangle, 
  Wifi, 
  Award,
  MapPin,
  School,
  ChevronDown,
  User as UserIcon,
  LogOut,
  HelpCircle,
  Key,
  Camera,
  Info,
  Bell
} from 'lucide-react';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// Déclaration pour que TypeScript accepte la variable injectée par Vite
declare const __BUILD_NUMBER__: string;

interface RoleSelectorProps {
  onNavigate?: (page: 'profil' | 'about') => void;
  onOpenPhotoTrigger?: () => void;
  onOpenPasswordReset?: () => void;
  onOpenSupportModal?: () => void;
}

const APP_VERSION = "v1.2.5";
const BUILD_NUMBER = typeof __BUILD_NUMBER__ !== 'undefined' ? __BUILD_NUMBER__ : "Build DEV";
const IS_PRODUCTION = import.meta.env.PROD;

const parseFirestoreDate = (dateField: unknown): Date | null => {
  if (!dateField) return null;
  if (typeof dateField === 'object' && dateField !== null && 'toDate' in dateField && typeof (dateField as { toDate: unknown }).toDate === 'function') {
    return (dateField as { toDate: () => Date }).toDate();
  }
  const candidate = new Date(dateField as string | number | Date);
  return isNaN(candidate.getTime()) ? null : candidate;
};

export default function RoleSelector({
  onNavigate,
  onOpenPhotoTrigger,
  onOpenPasswordReset,
  onOpenSupportModal
}: RoleSelectorProps): React.JSX.Element {
  
  const { currentUser, 
    profile, 
    isTeacher, 
    isAnimator, 
    isAdministrator 
  } = useUser();

  // On force le typage ici pour utiliser explicitement le type 'User' importé
  const userProfile = profile as User | null;

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Écoute dynamique des notifications non lues
  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (error) => {
      console.error("Erreur lors du suivi des notifications:", error);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Fermeture du menu sur clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!currentUser) {
    return (
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-center gap-3 text-white">
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-xs font-mono text-slate-400">En attente d'authentification...</span>
      </div>
    );
  }

  const accountStatus = userProfile?.status ?? (userProfile?.active ? 'ACTIF' : 'SUSPENDU');
  const isConfigured = !!userProfile && !!userProfile.role;

  if (!isConfigured || accountStatus === 'SUSPENDU') {
    return (
      <div className="bg-slate-950 border-b border-red-900/50 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-red-200">
              {!isConfigured ? "Votre compte n'est pas encore configuré." : "Votre accès a été restreint."}
            </p>
            <p className="text-xs text-slate-400">
              {!isConfigured 
                ? "Aucun rôle ou profil MINESEC valide n'est rattaché à cet identifiant." 
                : "Ce compte a été suspendu par la direction de la plateforme."}
            </p>
          </div>
        </div>
        <div className="text-xs font-mono bg-red-950/60 text-red-400 px-3 py-1.5 rounded border border-red-900/30 font-bold">
          STATUT : {accountStatus}
        </div>
      </div>
    );
  }

  const syncDate = parseFirestoreDate(userProfile?.lastSync);
  const syncTimeString = syncDate 
    ? syncDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
    : "En attente...";

  const currentPlan = userProfile?.subscription?.plan ?? "GRATUITE";
  const subscriptionStatus = userProfile?.subscription?.status ?? "ACTIVE";
  const expiryDate = parseFirestoreDate(userProfile?.subscription?.endDate);
  const formattedExpiry = expiryDate 
    ? expiryDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) 
    : null;

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  const triggerAction = (action?: () => void) => {
    setIsMenuOpen(false);
    if (action) action();
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-white select-none relative z-50">
      
      {/* SECTION GAUCHE : Établissement & Versioning */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-slate-200 font-medium text-xs">
          <School size={14} className="text-emerald-500" />
          <span className="uppercase tracking-wide font-bold">
            {userProfile.establishment || 'Établissement non spécifié'}
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {userProfile.academicYear || 'Année Académique ---'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-slate-400 text-[10px] flex-wrap">
          {(userProfile.region || userProfile.department || userProfile.city) && (
            <>
              <MapPin size={10} className="text-slate-500" />
              <span>
                {[userProfile.city, userProfile.department, userProfile.region].filter(Boolean).join(' • ')}
              </span>
              <span className="text-slate-600">|</span>
            </>
          )}
          
          <span className="text-slate-500 font-mono">Plateforme KKJ {APP_VERSION} ({BUILD_NUMBER})</span>
          
          <span className={`px-1 rounded text-[8px] font-bold tracking-tight uppercase ${IS_PRODUCTION ? 'bg-indigo-950 text-indigo-400 border border-indigo-900/50' : 'bg-amber-950 text-amber-400 border border-amber-900/50'}`}>
            {IS_PRODUCTION ? 'Production' : 'Développement'}
          </span>
        </div>
      </div>

      {/* SECTION DROITE : Actions & Télémétrie */}
      <div className="flex items-center gap-4 flex-wrap">
        
        {/* MENU INTERACTIF UTILISATEUR */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 bg-slate-950 hover:bg-slate-850 px-3 py-2 rounded-lg border border-slate-800 transition-all cursor-pointer text-left focus:outline-none focus:border-slate-700 relative"
          >
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 border border-slate-900 animate-pulse" />
            )}

            {userProfile.photoURL ? (
              <img 
                src={userProfile.photoURL} 
                alt={userProfile.name} 
                className="h-7 w-7 rounded-full object-cover border border-slate-700"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 text-xs font-bold">
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : '👤'}
              </div>
            )}

            <div className="flex flex-col pr-1">
              <span className="text-xs font-bold text-slate-100 flex items-center gap-1">
                {userProfile.name}
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                {userProfile.discipline || 'Général'} {userProfile.department ? `• Dpt: ${userProfile.department}` : ''}
              </span>
            </div>

            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-800 border border-slate-700 flex items-center gap-1">
              {isAdministrator && <Shield size={10} className="text-amber-400" />}
              {isAnimator && <GraduationCap size={10} className="text-emerald-400" />}
              {isTeacher && <BookOpen size={10} className="text-blue-400" />}
              
              {userProfile.role === 'ANIMATEUR_PEDAGOGIQUE' && 'A.P.'}
              {userProfile.role === 'ENSEIGNANT' && 'Enseignant'}
            </span>

          </button>

          {/* Fenêtre déroulante */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl p-1 text-slate-200">
              <div className="px-3 py-2 border-b border-slate-900 text-[11px] font-medium text-slate-400 flex items-center justify-between">
                <span>Espace Personnel</span>
                {unreadCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              </div>
              
              <button 
                onClick={() => triggerAction(() => onNavigate?.('profil'))}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg hover:bg-slate-900 text-left transition-all cursor-pointer"
              >
                <UserIcon size={14} className="text-slate-400" /> Mon profil
              </button>

              <button 
                onClick={() => triggerAction(() => onNavigate?.('profil'))}
                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-slate-900 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Bell size={14} className={`transition-colors ${unreadCount > 0 ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'}`} /> 
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => triggerAction(onOpenPhotoTrigger)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg hover:bg-slate-900 text-left transition-all cursor-pointer"
              >
                <Camera size={14} className="text-slate-400" /> Modifier ma photo
              </button>
              
              <button 
                onClick={() => triggerAction(onOpenPasswordReset)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg hover:bg-slate-900 text-left transition-all cursor-pointer"
              >
                <Key size={14} className="text-slate-400" /> Mot de passe
              </button>
              
              <div className="h-px bg-slate-900 my-1" />
              
              <button 
                onClick={() => triggerAction(onOpenSupportModal)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg hover:bg-slate-900 text-left transition-all cursor-pointer"
              >
                <HelpCircle size={14} className="text-slate-400" /> Centre d'assistance
              </button>
              <button 
                onClick={() => triggerAction(() => onNavigate?.('about'))}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg hover:bg-slate-900 text-left transition-all cursor-pointer"
              >
                <Info size={14} className="text-slate-400" /> À propos
              </button>
              
              <div className="h-px bg-slate-900 my-1" />
              
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-left font-semibold transition-all cursor-pointer"
              >
                <LogOut size={14} /> Déconnexion
              </button>
            </div>
          )}
        </div>

        {/* Bloc Technique 1 : État du compte */}
        <div className="hidden sm:flex flex-col text-[10px] font-mono bg-slate-950/50 px-2 py-1 rounded border border-slate-800/60 gap-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Compte:</span>
            {accountStatus === 'ACTIF' && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Actif
              </span>
            )}
            {accountStatus === 'EN_ATTENTE' && (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> En attente
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Email:</span>
            <span className={currentUser.emailVerified ? "text-emerald-400" : "text-amber-400"}>
              {currentUser.emailVerified ? "Vérifié" : "Non vérifié"}
            </span>
          </div>
        </div>

        {/* Bloc Technique 2 : Télémétrie Cloud */}
        <div className="flex flex-col text-[10px] font-mono bg-slate-950/50 px-2 py-1 rounded border border-slate-800/60 gap-0.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Wifi size={10} />
            <span>Firestore En ligne</span>
          </div>
          <div className="text-slate-500 text-[9px] text-right">
            Synchro: <span className="text-slate-300">{syncTimeString}</span>
          </div>
        </div>

        {/* Bloc Licence */}
        <div className="hidden lg:flex items-center gap-1.5 bg-gradient-to-r from-slate-950 to-slate-900 px-2.5 py-1 rounded border border-slate-800">
          <Award size={12} className={currentPlan !== 'GRATUITE' ? "text-amber-400 animate-pulse" : "text-slate-400"} />
          <div className="flex flex-col text-[9px] font-mono leading-none">
            <span className="text-slate-500 text-[8px] uppercase tracking-tight">Licence {currentPlan}</span>
            <span className={`font-bold mt-0.5 text-[9px] ${currentPlan !== 'GRATUITE' && subscriptionStatus === 'ACTIVE' ? "text-amber-400" : "text-slate-400"}`}>
              {currentPlan !== 'GRATUITE' && formattedExpiry ? `Exp: ${formattedExpiry}` : 'Illimitée'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}