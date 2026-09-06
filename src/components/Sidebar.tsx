import { useMemo } from 'react';
import { useUser } from '../context/UserContext';
import {
  LayoutDashboard,
  Settings,
  FileText,
  Calendar,
  FileSpreadsheet,
  Clock,
  BookOpen,
  Sparkles,
  HelpCircle,
  FileBarChart2,
  GraduationCap,
  X,
  LogOut,
  Wifi,
  LibraryBig,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  User as UserIcon,
  CircleUserRound
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  isOpen = false,
  onClose
}: SidebarProps) {
  const { 
    profile, 
    establishment,
    isTeacher,
    isAnimator,
    isAdministrator,
    loading, 
    error, 
    logout, 
    isOnline 
  } = useUser();

  const userRole = profile?.role || 'ENSEIGNANT';

  // Structure du menu filtrée dynamiquement avec les booléens du contexte
  const filteredNavItems = useMemo(() => {
    const navItems = [
      { 
        id: 'dashboard', 
        label: isTeacher ? 'Tableau de bord perso' : 'Tableau de bord AP', 
        icon: LayoutDashboard 
      },
      { 
        id: 'teacher-space', 
        label: 'Cahier de Textes & Émargement', 
        icon: GraduationCap 
      },
      { 
        id: 'settings', 
        label: 'Paramètres', 
        icon: Settings, 
        requiresAnimatorOrAdmin: true 
      },
      { 
        id: 'first-report', 
        label: 'Rapport 1er Conseil', 
        icon: FileText, 
        requiresAnimatorOrAdmin: true 
      },
      { 
        id: 'trimestrial', 
        label: 'Rapports Trimestriels', 
        icon: Calendar, 
        requiresAnimatorOrAdmin: true 
      },
      { 
        id: 'grades', 
        label: 'Relevés de Notes', 
        icon: FileSpreadsheet 
      },
      { 
        id: 'hours', 
        label: 'Couverture Heures', 
        icon: Clock 
      },
      { 
        id: 'program', 
        label: 'Couverture Programmes', 
        icon: BookOpen 
      },
      { 
        id: 'progressions',
        label: 'Bibliothèque des progressions',
        icon: LibraryBig
      },
      { 
        id: 'apc', 
        label: 'Préparation APC', 
        icon: Sparkles 
      },
      { 
        id: 'exams', 
        label: 'Conception Épreuves', 
        icon: HelpCircle 
      },
      { 
        id: 'profile',
        label: 'Mon compte',
        icon: CircleUserRound
      },
      { 
        id: 'annual', 
        label: isTeacher ? 'Synthèse Annuelle perso.' : 'Synthèse Annuelle', 
        icon: FileBarChart2 
      }
    ];

    return navItems.filter(item => {
      // Si l'item demande un accès AP ou Admin, on vérifie les variables correspondantes
      if (item.requiresAnimatorOrAdmin && !isAnimator && !isAdministrator && userRole !== 'ANIMATEUR_PEDAGOGIQUE') {
        return false;
      }
      return true;
    });
  }, [isTeacher, isAnimator, isAdministrator, userRole]);

  // Badge du statut d'inscription/validation
  const statusBadge = useMemo(() => {
    const status = profile?.status || 'EN_ATTENTE';
    const configs: Record<string, { bg: string; text: string }> = {
      ACTIF: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', text: 'Actif' },
      EN_ATTENTE: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', text: 'En attente' },
      SUSPENDU: { bg: 'bg-red-500/10 text-red-400 border-red-500/20', text: 'Suspendu' }
    };
    return configs[status] || configs.EN_ATTENTE;
  }, [profile?.status]);

  // Traduction propre du rôle pour l'affichage
  const readableRole = useMemo(() => {
    switch (userRole) {
      case 'ANIMATEUR_PEDAGOGIQUE': return 'A.P.';
      case 'ENSEIGNANT': return 'Enseignant';
      default: return userRole;
    }
  }, [userRole]);

  // Formatage robuste de la date de dernière synchronisation (gère string, Date et Timestamp)
  const formattedLastSync = useMemo(() => {
    if (!profile?.lastSync) return null;
    try {
      let date: Date;
      
      if (profile.lastSync && typeof (profile.lastSync as any).toDate === 'function') {
        date = (profile.lastSync as any).toDate();
      } else if (profile.lastSync && typeof (profile.lastSync as any).seconds === 'number') {
        date = new Date((profile.lastSync as any).seconds * 1000);
      } else {
        date = new Date(profile.lastSync as any);
      }
        
      if (isNaN(date.getTime())) return null;

      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return null;
    }
  }, [profile?.lastSync]);

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-full transform transition-transform duration-300 ease-in-out print:hidden ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      
      {/* School Badge Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <GraduationCap size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">
              {loading ? 'Chargement...' : establishment?.establishmentName || profile?.establishment || 'Sans Établissement'}
            </h2>
            <span className="text-[10px] font-mono font-medium text-slate-500 tracking-wider block">
              CONSEIL D'ENSEIGNEMENT {profile?.academicYear && `• ${profile.academicYear}`}
            </span>

          </div>
        </div>
        
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Connection & Sync Status Indicator */}
      <div className="px-6 py-2 bg-slate-950/20 border-b border-slate-800/60 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
          {loading ? (
            <>
              <RefreshCw size={11} className="animate-spin text-emerald-500 shrink-0" />
              <span className="truncate">Synchronisation...</span>
            </>
          ) : error ? (
            <>
              <AlertTriangle size={11} className="text-red-400 shrink-0" />
              <span className="text-red-400 truncate">Erreur de synchro</span>
            </>
          ) : (
            <div className="flex flex-col text-[9px] leading-tight min-w-0">
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                Synchronisé
              </span>
              {formattedLastSync && (
                <span className="text-slate-500 font-mono text-[8px] truncate">
                  {formattedLastSync}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Network Status */}
        <div className="flex items-center gap-1 shrink-0">
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-500 font-mono" title="Connecté à Internet">
              <Wifi size={10} /> en ligne
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-500 font-mono" title="Mode hors-ligne (Lecture du cache local)">
              <WifiOff size={10} /> hors-ligne
            </span>
          )}
        </div>
      </div>

      {/* Profile summary card */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 space-y-3">
        <div className="flex items-center gap-3">
          {profile?.photoURL ? (
            <img 
              src={profile.photoURL} 
              alt={profile.name || 'Profil'} 
              className="h-10 w-10 rounded-xl object-cover border border-slate-700 bg-slate-800 shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-750 flex items-center justify-center text-slate-400 shrink-0">
              <UserIcon size={18} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <span className="text-slate-200 block font-semibold text-xs truncate">
              {loading ? 'Chargement...' : profile?.name || 'Enseignant'}
            </span>
            {profile?.discipline && (
              <span className="text-slate-500 text-[10px] italic truncate block">
                Discipline : {profile.discipline}
              </span>
            )}
          </div>
        </div>

        {/* Rôle et Statut */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">
            {readableRole}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${statusBadge.bg}`}>
            {statusBadge.text}
          </span>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Déconnexion */}
      {logout && (
        <div className="p-4 border-t border-slate-850">
          <button
            onClick={logout}
            className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-350 hover:bg-red-950/30 flex items-center gap-3 transition-all cursor-pointer"
          >
            <LogOut size={16} className="text-red-500" />
            <span>Déconnexion</span>
          </button>
        </div>
      )}

      {/* Sidebar Footer badge */}
      <div className="p-4 border-t border-slate-800 text-center text-[10px] text-slate-500 font-mono">
        Rép. du Cameroun • MINESEC
      </div>
    </div>
  );
}