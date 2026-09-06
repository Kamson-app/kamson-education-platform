/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Trimester } from '../types';
import { X, BookOpen } from 'lucide-react';

interface CreateClassModalProps {
  isOpen: boolean;

  /** Classe sélectionnée depuis "Mes classes" */
  className: string;
  customClassesList: string[];

  subject: string;
  selectedTrimester: Trimester;
  teacherName: string;
  academicYear: string;

  onClassNameChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onTrimesterChange: (value: Trimester) => void;
  onTeacherNameChange: (value: string) => void;
  onAcademicYearChange: (value: string) => void;

  onSave: () => void;
  onClose: () => void;
}

export default function CreateClassModal({
  isOpen,
  className,
  customClassesList,
  subject,
  selectedTrimester,
  teacherName,
  academicYear,
  onClassNameChange,
  onSubjectChange,
  onTrimesterChange,
  onTeacherNameChange,
  onAcademicYearChange,
  onSave,
  onClose,
}: CreateClassModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in no-print">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col">

        {/* =========================================================
            HEADER
        ========================================================= */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BookOpen size={20} />
            </div>

            <div>
              <h3 className="font-bold text-slate-800">
                Configurer la classe et la matière
              </h3>

              <p className="text-xs text-slate-500">
                Sélectionnez une classe créée dans « Mes classes »
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* =========================================================
            FORMULAIRE
        ========================================================= */}
        <div className="p-6 space-y-4">

          {/* =======================================================
              CLASSE
          ======================================================= */}
          <div className="space-y-1.5">
            <label
              htmlFor="create-class-select"
              className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Nom de la classe
            </label>

            <select
              id="create-class-select"
              value={className}
              onChange={(e) => onClassNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="">
                Sélectionner une classe
              </option>

              {customClassesList.length > 0 ? (
                customClassesList.map((classItem) => (
                  <option
                    key={classItem}
                    value={classItem}
                  >
                    {classItem}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  Aucune classe disponible
                </option>
              )}
            </select>

            {customClassesList.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Aucune classe n'a encore été créée dans « Mes classes ».
              </p>
            )}
          </div>

          {/* =======================================================
              MATIÈRE
          ======================================================= */}
          <div className="space-y-1.5">
            <label
              htmlFor="create-class-subject"
              className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Matière
            </label>

            <input
              id="create-class-subject"
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Ex: Mathématiques, Histoire..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* =======================================================
              TRIMESTRE + ANNÉE
          ======================================================= */}
          <div className="grid grid-cols-2 gap-4">

            <div className="space-y-1.5">
              <label
                htmlFor="create-class-trimester"
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Trimestre
              </label>

              <select
                id="create-class-trimester"
                value={selectedTrimester}
                onChange={(e) =>
                  onTrimesterChange(
                    Number(e.target.value) as Trimester
                  )
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value={1}>Trimestre 1</option>
                <option value={2}>Trimestre 2</option>
                <option value={3}>Trimestre 3</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="create-class-academic-year"
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Année académique
              </label>

              <input
                id="create-class-academic-year"
                type="text"
                value={academicYear}
                onChange={(e) =>
                  onAcademicYearChange(e.target.value)
                }
                placeholder="Ex: 2025-2026"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

          </div>

          {/* =======================================================
              ENSEIGNANT
          ======================================================= */}
          <div className="space-y-1.5">
            <label
              htmlFor="create-class-teacher"
              className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Nom de l'enseignant
            </label>

            <input
              id="create-class-teacher"
              type="text"
              value={teacherName}
              onChange={(e) =>
                onTeacherNameChange(e.target.value)
              }
              placeholder="Ex: M. Dupont"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

        </div>

        {/* =========================================================
            FOOTER
        ========================================================= */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={!className || customClassesList.length === 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enregistrer
          </button>

        </div>

      </div>
    </div>
  );
}