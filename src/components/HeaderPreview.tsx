/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { EstablishmentSettings, Trimester } from '../types';

interface HeaderPreviewProps {
  settings: EstablishmentSettings;
  selectedClass: string;
  selectedSubject: string;
  selectedTrimester: Trimester;
  teacherName: string;
  academicYear: string;
}

const HeaderPreview = React.memo(function HeaderPreview({
  settings,
  selectedClass,
  selectedSubject,
  selectedTrimester,
  teacherName,
  academicYear,
}: HeaderPreviewProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
      {/* En-tête officiel / Administratif */}
      <div className="grid grid-cols-3 items-center text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
        <div className="space-y-0.5">
          <div>{settings.country || 'REPUBLIQUE DU CAMEROUN'}</div>
          <div className="text-[10px] text-slate-500 italic">Paix – Travail – Patrie</div>
          <div>{settings.ministry || 'MINISTERE DES ENSEIGNEMENTS SECONDAIRES'}</div>
          <div className="pt-1">{settings.delegation || 'DELEGATION REGIONALE'}</div>
          <div>{settings.subDelegation || 'DELEGATION DEPARTEMENTALE'}</div>
        </div>

        <div className="flex flex-col items-center justify-center">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain mb-2" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl mb-2">
              {settings.schoolName ? settings.schoolName.charAt(0) : 'E'}
            </div>
          )}
          <div className="font-extrabold text-sm text-slate-900">{settings.schoolName || 'ETABLISSEMENT SCOLAIRE'}</div>
          <div className="text-[10px] text-slate-500 lowercase">{settings.motto || ''}</div>
        </div>

        <div className="space-y-0.5 text-right">
          <div>{settings.countryEnglish || 'REPUBLIC OF CAMEROON'}</div>
          <div className="text-[10px] text-slate-500 italic">Peace – Work – Fatherland</div>
          <div>{settings.ministryEnglish || 'MINISTRY OF SECONDARY EDUCATION'}</div>
          <div className="pt-1">{settings.delegationEnglish || 'REGIONAL DELEGATION'}</div>
          <div>{settings.subDelegationEnglish || 'DIVISIONAL DELEGATION'}</div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Informations sur la classe et la matière */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase">Fiche de notes</div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>{selectedClass || 'Classe non définie'}</span>
            <span className="text-slate-300">•</span>
            <span className="text-indigo-600">{selectedSubject || 'Matière non définie'}</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
          <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            Trimestre {selectedTrimester}
          </span>
          <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            Année : {academicYear || settings.academicYear || '2025-2026'}
          </span>
          <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            Ens. : {teacherName || 'Non spécifié'}
          </span>
        </div>
      </div>
    </div>
  );
});

export default HeaderPreview;