/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ArchiveReleve } from '../types';
import { formatFirestoreDate } from '../utils/firestoreHelpers';
import {
  X,
  Calendar,
  User,
  BookOpen,
  RotateCcw,
  Trash2,
} from 'lucide-react';

interface ArchiveModalProps {
  archives: ArchiveReleve[];
  isAnimator: boolean;
  onClose: () => void;
  onRestore: (archive: ArchiveReleve) => void;
  onDelete: (archiveId: string) => void;
}

export default function ArchiveModal({
  archives,
  isAnimator,
  onClose,
  onRestore,
  onDelete,
}: ArchiveModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in no-print">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">
                Archives des relevés de notes
              </h3>
              <p className="text-xs text-slate-500">
                Historique des versions archivées pour le département
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Liste */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {archives.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Aucune archive disponible pour le moment.
            </div>
          ) : (
            archives.map((archive) => (
              <div
                key={archive.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white hover:bg-indigo-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">
                      {archive.className}
                    </span>

                    <span className="text-slate-300">•</span>

                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {archive.subject}
                    </span>

                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      Trimestre {archive.trimester}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <User size={13} className="text-slate-400" />
                      {archive.teacherName || 'Enseignant'}
                    </span>

                    <span className="flex items-center gap-1">
                      <BookOpen size={13} className="text-slate-400" />
                      Archivé le {formatFirestoreDate(archive.archivedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onRestore(archive)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} />
                    <span>Restaurer</span>
                  </button>

                  {isAnimator && (
                    <button
                      type="button"
                      onClick={() => onDelete(archive.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}