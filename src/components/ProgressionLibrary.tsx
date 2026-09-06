/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import type { Progression, User } from "../types";
import { subscribeProgressions } from "../services/progressionService";

interface ProgressionLibraryProps {
  currentUser: User;
  establishmentId: string;
  academicYear: string;
  departmentId?: string;
  teacherId?: string;
  onSelectProgression: (progression: Progression) => void;
}

export default function ProgressionLibrary({
  currentUser,
  establishmentId,
  academicYear,
  departmentId,
  teacherId,
  onSelectProgression,
}: ProgressionLibraryProps) {
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!establishmentId) {
      setProgressions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const effectiveTeacherId =
      currentUser.role === "ENSEIGNANT"
        ? currentUser.id
        : teacherId;

    const unsubscribe = subscribeProgressions(
      establishmentId,
      (list) => {
        setProgressions(list);
        setLoading(false);
      },
      academicYear,
      departmentId,
      effectiveTeacherId,
      (err) => {
        console.error(
          "Erreur bibliothèque des progressions :",
          err
        );
        setError(
          "Impossible de charger la bibliothèque des progressions."
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [
    establishmentId,
    academicYear,
    departmentId,
    teacherId,
    currentUser.id,
    currentUser.role,
  ]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 text-sm">
          Bibliothèque des progressions
        </h3>

        <span className="text-xs font-semibold text-slate-500">
          {progressions.length} progression
          {progressions.length > 1 ? "s" : ""}
        </span>
      </div>

      {progressions.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-slate-400">
            Aucune progression trouvée pour cette période.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {progressions.map((progression) => (
            <button
              key={progression.id}
              type="button"
              onClick={() =>
                onSelectProgression(progression)
              }
              className="w-full text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-sm transition-all"
            >
              <div className="flex justify-between items-center gap-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  {progression.className}
                </span>

                <span className="text-[10px] text-slate-400 font-bold">
                  Trimestre {progression.trimester}
                </span>
              </div>

              <h4 className="font-extrabold text-slate-800 text-sm mt-2">
                {progression.title}
              </h4>

              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                  {progression.discipline}
                </span>

                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                  {progression.modules.length} module
                  {progression.modules.length > 1 ? "s" : ""}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                {progression.teacherName}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}