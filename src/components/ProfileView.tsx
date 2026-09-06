/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import {
  User,
  Building2,
  BookOpen,
  Phone,
  Mail,
  Shield,
  Bell,
  Activity,
  Cloud,
  Camera,
  Save,
  Lock,
  CheckCircle,
  Loader2
} from "lucide-react";
import { useUser } from "../context/UserContext";

export default function ProfileView() {
  const { profile, currentUser, updateProfile } = useUser();

  const [fullName, setFullName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phoneNumber || "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Synchroniser l'état local si le profil change
  useEffect(() => {
    if (profile) {
      setFullName(profile.name || "");
      setPhone(profile.phoneNumber || "");
    }
  }, [profile]);

  const [activeTab, setActiveTab] = useState<
    | "personal"
    | "professional"
    | "security"
    | "preferences"
    | "activity"
    | "sync"
  >("personal");

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage("");

    try {
      await updateProfile({
        name: fullName,
        phoneNumber: phone,
      });

      alert("Profil mis à jour avec succès.");
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "personal":
        return (
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-28 h-28 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                  {profile?.photoURL ? (
                    <img
                      src={profile.photoURL}
                      className="w-full h-full object-cover"
                      alt="Avatar"
                    />
                  ) : (
                    <User size={60} className="text-slate-500" />
                  )}
                </div>

                <button
                  type="button"
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-600 text-white cursor-pointer"
                >
                  <Camera size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="font-semibold text-sm">Nom complet</label>
              <input
                className="w-full mt-2 border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="font-semibold text-sm flex items-center gap-2">
                <Mail size={16} className="text-slate-500" />
                Adresse e-mail
              </label>
              <input
                disabled
                className="w-full mt-2 border rounded-xl p-3 bg-slate-100 text-slate-500 cursor-not-allowed"
                value={profile?.email || ""}
              />
            </div>

            <div>
              <label className="font-semibold text-sm flex items-center gap-2">
                <Phone size={16} className="text-slate-500" />
                Téléphone
              </label>
              <input
                className="w-full mt-2 border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+237..."
              />
            </div>
          </div>
        );

      case "professional":
        return (
          <div className="space-y-4">
            <Info
              icon={<Building2 size={18} />}
              title="Établissement"
              value={profile?.establishment || ""}
            />

            <Info
              icon={<BookOpen size={18} />}
              title="Département"
              value={profile?.department || ""}
            />

            <Info
              icon={<BookOpen size={18} />}
              title="Discipline"
              value={profile?.subject || ""}
            />

            <Info
              icon={<Shield size={18} />}
              title="Rôle"
              value={profile?.role || ""}
            />

            <Info
              icon={<CheckCircle size={18} />}
              title="Statut"
              value={profile?.status || ""}
            />
          </div>
        );

      case "security":
        return (
          <div className="space-y-5">
            <div className="rounded-xl border p-4">
              <h3 className="font-bold">Vérification de l'adresse e-mail</h3>
              <p className="text-sm text-slate-500 mt-2">
                {currentUser?.emailVerified
                  ? "Adresse e-mail vérifiée."
                  : "Adresse e-mail non vérifiée."}
              </p>
            </div>

            <button
              type="button"
              className="px-5 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold transition cursor-pointer"
            >
              <Lock size={18} className="inline mr-2" />
              Modifier le mot de passe
            </button>
          </div>
        );

      case "preferences":
        return (
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-500" />
              <span>Notifications</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-500" />
              <span>Mode sombre</span>
            </label>
          </div>
        );

      case "activity":
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <Card title="Rapports créés" value="--" />
            <Card title="Relevés de notes" value="--" />
            <Card title="Préparations APC" value="--" />
            <Card title="Dernière connexion" value="--" />
          </div>
        );

      case "sync":
        return (
          <div className="space-y-4">
            <div className="rounded-xl border p-4">
              <h3 className="font-bold">Synchronisation Cloud</h3>
              <p className="mt-2 text-green-700 font-medium">
                ✔ Firestore connecté
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
        <div className="border-b border-slate-100 p-6">
          <h1 className="text-2xl font-black text-slate-900">Mon compte</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Gérez votre profil utilisateur et vos informations professionnelles.
          </p>
        </div>

        <div className="grid lg:grid-cols-4">
          <div className="border-r border-slate-100 p-5 space-y-2 bg-slate-50/50">
            <MenuButton
              active={activeTab === "personal"}
              icon={<User size={18} />}
              label="Informations personnelles"
              onClick={() => setActiveTab("personal")}
            />

            <MenuButton
              active={activeTab === "professional"}
              icon={<Building2 size={18} />}
              label="Informations professionnelles"
              onClick={() => setActiveTab("professional")}
            />

            <MenuButton
              active={activeTab === "security"}
              icon={<Shield size={18} />}
              label="Sécurité"
              onClick={() => setActiveTab("security")}
            />

            <MenuButton
              active={activeTab === "preferences"}
              icon={<Bell size={18} />}
              label="Préférences"
              onClick={() => setActiveTab("preferences")}
            />

            <MenuButton
              active={activeTab === "activity"}
              icon={<Activity size={18} />}
              label="Activité"
              onClick={() => setActiveTab("activity")}
            />

            <MenuButton
              active={activeTab === "sync"}
              icon={<Cloud size={18} />}
              label="Synchronisation"
              onClick={() => setActiveTab("sync")}
            />
          </div>

          <div className="lg:col-span-3 p-8">
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold">
                {errorMessage}
              </div>
            )}

            {renderContent()}

            <div className="pt-8 border-t border-slate-100 mt-8">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                <span>{saving ? "Enregistrement..." : "Enregistrer les modifications"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuButton({ active, icon, label, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition cursor-pointer text-sm font-semibold ${
        active
          ? "bg-emerald-700 text-white shadow-sm"
          : "hover:bg-slate-100 text-slate-700"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Info({ icon, title, value }: any) {
  return (
    <div className="flex items-center gap-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
      <div className="text-emerald-600">{icon}</div>
      <div>
        <div className="text-xs text-slate-500 font-medium">{title}</div>
        <div className="font-semibold text-slate-800">{value || "Non renseigné"}</div>
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
      <div className="text-sm text-slate-500 font-medium">{title}</div>
      <div className="text-3xl font-black mt-2 text-slate-800">{value}</div>
    </div>
  );
}