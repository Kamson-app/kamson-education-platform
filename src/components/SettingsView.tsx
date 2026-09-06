/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import type {
  EstablishmentSettings,
  Department
} from "../types";

interface SettingsViewProps {
  currentUser: any;
  establishment: EstablishmentSettings;
  department: Department | null;
  onSaveEstablishment: (
    settings: EstablishmentSettings
  ) => Promise<void>;
  onSaveDepartment: (
    department: Department
  ) => Promise<void>;
}

export default function SettingsView({
  currentUser,
  establishment,
  department,
  onSaveEstablishment,
  onSaveDepartment,
}: SettingsViewProps) {

  const [activeSection, setActiveSection] =
    useState<"establishment" | "department">(
      "establishment"
    );

  const [establishmentForm, setEstablishmentForm] =
    useState<EstablishmentSettings>(establishment);

  const [departmentForm, setDepartmentForm] =
    useState<Department | null>(department);

  const [saving, setSaving] = useState(false);

  const updateEstablishment = (
    field: keyof EstablishmentSettings,
    value: string
  ) => {
    setEstablishmentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateDepartment = (
    field: keyof Department,
    value: string
  ) => {
    setDepartmentForm((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : prev
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveEstablishment(establishmentForm);
      if (departmentForm) {
        await onSaveDepartment(departmentForm);
      }
      alert("Paramètres enregistrés avec succès.");
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des paramètres :", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* EN-TÊTE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configuration de l'établissement et du département pédagogique
        </p>
        {currentUser?.name && (
          <p className="text-xs text-slate-400 mt-2">
            Connecté en tant que : {currentUser.name}
          </p>
        )}
      </div>

      {/* NAVIGATION */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm flex gap-2">
        <button
          type="button"
          onClick={() => setActiveSection("establishment")}
          className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition ${
            activeSection === "establishment"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          🏫 Établissement
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("department")}
          className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition ${
            activeSection === "department"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📚 Département
        </button>
      </div>

      {/* ÉTABLISSEMENT */}
      {activeSection === "establishment" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-8">
          <h2 className="text-lg font-bold text-slate-800">Paramètres de l'établissement</h2>
          
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3">Informations institutionnelles</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">République</label>
                  <input type="text" value="REPUBLIC OF CAMEROON" readOnly className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Ministère</label>
                  <input type="text" value="MINISTERE DES ENSEIGNEMENTS SECONDAIRES" readOnly className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Ministry</label>
                  <input type="text" value="MINISTRY OF SECONDARY EDUCATION" readOnly className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700 cursor-not-allowed" />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3">Délégations</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Délégation régionale (Français)" value={establishmentForm.delegation} onChange={(v) => updateEstablishment("delegation", v)} />
                <Field label="Délégation régionale (English)" value={establishmentForm.delegationEnglish} onChange={(v) => updateEstablishment("delegationEnglish", v)} />
                <Field label="Délégation départementale (Français)" value={establishmentForm.subDelegation} onChange={(v) => updateEstablishment("subDelegation", v)} />
                <Field label="Délégation départementale (English)" value={establishmentForm.subDelegationEnglish} onChange={(v) => updateEstablishment("subDelegationEnglish", v)} />
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-800 mb-4">Établissement</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Établissement (Français)" value={establishmentForm.schoolName} onChange={(v) => updateEstablishment("schoolName", v)} />
                <Field label="Établissement (English)" value={(establishmentForm as any).schoolNameEnglish || ""} onChange={(v) => updateEstablishment("schoolNameEnglish" as keyof EstablishmentSettings, v)} />
                <Field label="Ville" value={establishmentForm.town} onChange={(v) => updateEstablishment("town", v)} />
                <Field label="Devise" value={establishmentForm.motto} onChange={(v) => updateEstablishment("motto", v)} />
                <div className="md:col-span-2">
                  <Field label="URL du logo" value={establishmentForm.logoUrl} onChange={(v) => updateEstablishment("logoUrl", v)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DÉPARTEMENT */}
      {activeSection === "department" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-5">Paramètres du département pédagogique</h2>
          {!departmentForm ? (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              Aucun département n'est actuellement chargé.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Nom du département / discipline" value={(departmentForm as any).name || (departmentForm as any).label || ""} onChange={(v) => updateDepartment("name" as keyof Department, v)} />
              <Field label="Animateur pédagogique" value={(departmentForm as any).animateurPedagogique || ""} onChange={(v) => updateDepartment("animateurPedagogique" as keyof Department, v)} />
              <Field label="Président du conseil" value={(departmentForm as any).presidentConseil || ""} onChange={(v) => updateDepartment("presidentConseil" as keyof Department, v)} />
              <Field label="Grade du président" value={(departmentForm as any).gradePresident || ""} onChange={(v) => updateDepartment("gradePresident" as keyof Department, v)} />
            </div>
          )}
        </div>
      )}

      {/* INFORMATIONS DU DOCUMENT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-800">Informations du document</h3>
          <p className="text-xs text-slate-500 mt-1">
            Ces informations seront utilisées automatiquement dans les relevés, rapports et documents PDF.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Établissement" value={establishmentForm.schoolName} onChange={(v) => updateEstablishment("schoolName", v)} />
          <Field label="Département" value={(establishmentForm as any).departmentFr || ""} onChange={(v) => updateEstablishment("departmentFr" as keyof EstablishmentSettings, v)} />
          <Field label="Discipline" value={(establishmentForm as any).discipline || ""} onChange={(v) => updateEstablishment("discipline" as keyof EstablishmentSettings, v)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Field label="Année scolaire" value={establishmentForm.academicYear} onChange={(v) => updateEstablishment("academicYear", v)} />
          <Field label="Trimestre" value={(establishmentForm as any).trimester || ""} onChange={(v) => updateEstablishment("trimester" as keyof EstablishmentSettings, v)} />
          <Field label="Date du rapport" value={(establishmentForm as any).reportDate || ""} onChange={(v) => updateEstablishment("reportDate" as keyof EstablishmentSettings, v)} />
        </div>
      </div>

      {/* BOUTON UNIQUE */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm transition"
        >
          {saving ? "Enregistrement en cours..." : "Enregistrer les paramètres"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
 * CHAMP RÉUTILISABLE
 * ============================================================ */
interface FieldProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}

function Field({ label, value, onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
      />
    </div>
  );
}