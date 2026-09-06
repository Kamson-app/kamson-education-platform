/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { subscribeAPCPreps } from "../services/apcPrepService";
import type { APCPrepFiche, User } from "../types";

interface APCPrepLibraryProps {
  currentUser: User;
  establishmentId: string;
  academicYear: string;
  departmentId?: string;
  teacherId?: string;
  onSelectPrep: (prep: APCPrepFiche) => void;
}

export default function APCPrepLibrary({
  currentUser,
  establishmentId,
  academicYear,
  departmentId,
  teacherId,
  onSelectPrep,
}: APCPrepLibraryProps) {
  const [preps, setPreps] = useState<APCPrepFiche[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!establishmentId) {
      setPreps([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeAPCPreps(
      establishmentId,
      (list) => {
        setPreps(list);
        setLoading(false);
      },
      academicYear,
      departmentId,
      currentUser.role === "ENSEIGNANT" ? currentUser.id : teacherId
    );

    return () => unsubscribe();
  }, [establishmentId, academicYear, departmentId, teacherId, currentUser.id, currentUser.role]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-slate-900 text-sm">
        Bibliothèque des Fiches APC ({preps.length})
      </h3>
      {preps.length === 0 ? (
        <p className="text-xs text-slate-400">Aucune fiche trouvée pour cette période.</p>
      ) : (
        <div className="grid gap-3">
          {preps.map((prep) => (
            <div
              key={prep.id}
              onClick={() => onSelectPrep(prep)}
              className="p-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 cursor-pointer transition-all space-y-1"
            >
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                <span>{prep.className}</span>
                <span>{prep.academicYear}</span>
              </div>
              <h4 className="font-extrabold text-slate-800 text-xs">{prep.lessonName || prep.title}</h4>
              <p className="text-[11px] text-slate-500 italic">{prep.chapterName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}