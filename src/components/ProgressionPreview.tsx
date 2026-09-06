/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Progression,
  ProgressionLesson,
} from "../types";

import { analyzeProgression } from "../utils/progressionAnalyzer";

interface ProgressionPreviewProps {
  progression: Progression | null;
  onClose: () => void;
}

function getStatusLabel(status: ProgressionLesson["status"]): string {
  switch (status) {
    case "PLANIFIEE":
      return "Planifiée";
    case "EN_COURS":
      return "En cours";
    case "TERMINEE":
      return "Terminée";
    case "REPORTEE":
      return "Reportée";
    default:
      return status;
  }
}

function getStatusClass(status: ProgressionLesson["status"]): string {
  switch (status) {
    case "PLANIFIEE":
      return "bg-slate-100 text-slate-700";
    case "EN_COURS":
      return "bg-blue-100 text-blue-700";
    case "TERMINEE":
      return "bg-emerald-100 text-emerald-700";
    case "REPORTEE":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function ProgressionPreview({
  progression,
  onClose,
}: ProgressionPreviewProps) {
  if (!progression) {
    return null;
  }

  const analysis = analyzeProgression(progression);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* =====================================================
         * EN-TÊTE
         * ===================================================== */}
        <div className="border-b px-6 sm:px-8 py-5 flex items-center justify-between shrink-0">

          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">
              {progression.title}
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Aperçu de la progression pédagogique
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-sm font-semibold transition-colors"
          >
            Fermer
          </button>

        </div>

        {/* =====================================================
         * CONTENU
         * ===================================================== */}
        <div className="overflow-y-auto">

          {/* ===================================================
           * INFORMATIONS GÉNÉRALES
           * =================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 p-6 sm:p-8">

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                Enseignant
              </p>

              <p className="font-semibold text-slate-800 mt-1">
                {progression.teacherName || "Non renseigné"}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                Classe
              </p>

              <p className="font-semibold text-slate-800 mt-1">
                {progression.className}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                Discipline
              </p>

              <p className="font-semibold text-slate-800 mt-1">
                {progression.discipline}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                Trimestre
              </p>

              <p className="font-semibold text-slate-800 mt-1">
                {progression.trimester}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                Année scolaire
              </p>

              <p className="font-semibold text-slate-800 mt-1">
                {progression.academicYear}
              </p>
            </div>

          </div>

          {/* ===================================================
           * ANALYSE AUTOMATIQUE
           * =================================================== */}
          <div className="px-6 sm:px-8 pb-8">

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6">

              <h3 className="text-lg sm:text-xl font-bold text-blue-800 mb-5">
                📊 Analyse automatique
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

                <StatCard
                  label="Modules"
                  value={analysis.modules}
                />

                <StatCard
                  label="Chapitres"
                  value={analysis.chapters}
                />

                <StatCard
                  label="Leçons"
                  value={analysis.lessons}
                />

                <StatCard
                  label="Heures"
                  value={analysis.plannedHours}
                />

                <StatCard
                  label="Moy./Chapitre"
                  value={analysis.averageLessonsPerChapter}
                />

                <StatCard
                  label="Moy./Module"
                  value={analysis.averageLessonsPerModule}
                />

              </div>

            </div>

          </div>

          {/* ===================================================
           * MODULES / CHAPITRES / LEÇONS
           * =================================================== */}
          <div className="px-6 sm:px-8 pb-8">

            <div className="flex items-center justify-between mb-6">

              <h3 className="text-xl font-bold text-slate-800">
                Modules pédagogiques
              </h3>

              <span className="text-xs font-semibold text-slate-500">
                {progression.modules.length} module
                {progression.modules.length > 1 ? "s" : ""}
              </span>

            </div>

            {progression.modules.length === 0 ? (

              <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-400">
                Aucun module enregistré dans cette progression.
              </div>

            ) : (

              <div className="space-y-6">

                {progression.modules
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((module, moduleIndex) => (

                    <div
                      key={module.id || `module-${moduleIndex}`}
                      className="border border-slate-200 rounded-2xl overflow-hidden bg-white"
                    >

                      {/* MODULE */}
                      <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">

                        <div className="flex items-center gap-3">

                          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold">
                            {moduleIndex + 1}
                          </span>

                          <div>

                            <p className="text-[10px] uppercase tracking-wide text-blue-600 font-bold">
                              Module
                            </p>

                            <h4 className="font-bold text-slate-800">
                              {module.title}
                            </h4>

                          </div>

                        </div>

                      </div>

                      {/* CHAPITRES */}
                      <div className="p-5 space-y-5">

                        {module.chapters
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((chapter, chapterIndex) => (

                            <div
                              key={
                                chapter.id ||
                                `chapter-${moduleIndex}-${chapterIndex}`
                              }
                              className="border border-slate-200 rounded-xl"
                            >

                              <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200">

                                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                                  Chapitre {chapterIndex + 1}
                                </p>

                                <h5 className="font-semibold text-slate-800 mt-1">
                                  {chapter.title}
                                </h5>

                              </div>

                              {/* LEÇONS */}
                              <div className="divide-y divide-slate-100">

                                {chapter.lessons
                                  .slice()
                                  .sort((a, b) => a.order - b.order)
                                  .map((lesson, lessonIndex) => (

                                    <LessonRow
                                      key={
                                        lesson.id ||
                                        `lesson-${moduleIndex}-${chapterIndex}-${lessonIndex}`
                                      }
                                      lesson={lesson}
                                    />

                                  ))}

                              </div>

                            </div>

                          ))}

                      </div>

                    </div>

                  ))}

              </div>

            )}

          </div>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
 * CARTE STATISTIQUE
 * ============================================================ */

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({
  label,
  value,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">

      <div className="text-xs text-slate-500">
        {label}
      </div>

      <div className="text-2xl font-bold text-slate-800 mt-1">
        {value}
      </div>

    </div>
  );
}

/* ============================================================
 * LIGNE D'UNE LEÇON
 * ============================================================ */

interface LessonRowProps {
  lesson: ProgressionLesson;
}

function LessonRow({
  lesson,
}: LessonRowProps) {
  return (
    <div className="px-4 py-4 hover:bg-slate-50 transition-colors">

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">

        <div className="flex gap-3 min-w-0">

          <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
            {lesson.order}
          </span>

          <div className="min-w-0">

            <h6 className="font-semibold text-sm text-slate-800">
              {lesson.title}
            </h6>

            {lesson.objectives &&
              lesson.objectives.length > 0 && (

                <div className="mt-2">

                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Objectifs
                  </p>

                  <ul className="mt-1 space-y-1">

                    {lesson.objectives.map(
                      (objective, index) => (

                        <li
                          key={index}
                          className="text-xs text-slate-600"
                        >
                          • {objective}
                        </li>

                      )
                    )}

                  </ul>

                </div>

              )}

            {lesson.competencies &&
              lesson.competencies.length > 0 && (

                <div className="mt-2">

                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Compétences
                  </p>

                  <div className="flex flex-wrap gap-1 mt-1">

                    {lesson.competencies.map(
                      (competency, index) => (

                        <span
                          key={index}
                          className="text-[10px] px-2 py-1 rounded-md bg-blue-50 text-blue-700"
                        >
                          {competency}
                        </span>

                      )
                    )}

                  </div>

                </div>

              )}

          </div>

        </div>

        <div className="flex items-center gap-2 shrink-0">

          {lesson.durationHours !== undefined && (

            <span className="text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600">
              {lesson.durationHours} h
            </span>

          )}

          <span
            className={`text-[10px] font-bold px-2 py-1 rounded-md ${getStatusClass(
              lesson.status
            )}`}
          >
            {getStatusLabel(lesson.status)}
          </span>

        </div>

      </div>

      {lesson.taughtDate && (

        <p className="text-[10px] text-slate-400 mt-2 ml-10">
          Date d'enseignement : {lesson.taughtDate}
        </p>

      )}

      {lesson.evaluation && (

        <p className="text-xs text-slate-500 mt-2 ml-10">
          <span className="font-semibold">
            Évaluation :
          </span>{" "}
          {lesson.evaluation}
        </p>

      )}

      {lesson.observations && (

        <p className="text-xs text-slate-500 mt-2 ml-10">
          <span className="font-semibold">
            Observations :
          </span>{" "}
          {lesson.observations}
        </p>

      )}

    </div>
  );
}