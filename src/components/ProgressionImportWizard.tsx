/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Upload, FileText, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { parseProgression, type ParsedProgression } from "../utils/progressionParser";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import type { UserProfile } from "../types";

interface ProgressionImportWizardProps {
  currentUser?: UserProfile;
  onFinish?: (progression: ParsedProgression) => void;
  onCancel?: () => void;
}

export default function ProgressionImportWizard({
  currentUser,
  onFinish,
  onCancel
}: ProgressionImportWizardProps) {

  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedProgression | null>(null);

  async function handleFile(file: File) {
    setSelectedFile(file);

    const text = await file.text();

    const result = parseProgression(text);

    setPreview(result);

    setStep(2);
  }

  async function handleValidate() {
    if (!preview) return;

    try {
      await addDoc(collection(db, "progressions"), {
        title: selectedFile?.name ?? "Progression",
        teacherId: currentUser?.uid ?? "",
        teacherName: currentUser?.name ?? "",
        establishmentId: currentUser?.establishmentId ?? "default",
        departmentId: currentUser?.departmentId ?? "",
        discipline: currentUser?.discipline ?? preview.discipline,
        className: preview.className,
        academicYear: currentUser?.academicYear ?? preview.academicYear,
        trimester: preview.trimester,
        modules: preview.modules,
        importedAt: serverTimestamp()
      });

      if (onFinish) {
        onFinish(preview);
      }

      alert("Progression importée avec succès.");

    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'import.");
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-4xl mx-auto">

      <h2 className="text-2xl font-bold mb-6">
        Assistant d'importation de progression
      </h2>

      {/* ETAPE 1 */}

      {step === 1 && (

        <div className="space-y-6">

          <div className="border-2 border-dashed rounded-xl p-10 text-center">

            <Upload
              className="mx-auto text-blue-600"
              size={60}
            />

            <p className="mt-4 font-semibold">

              Sélectionnez une progression pédagogique

            </p>

            <input
              type="file"
              accept=".txt,.csv"
              className="mt-6"
              onChange={(e) => {
                if (e.target.files?.length) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <p className="text-xs text-slate-500 mt-4">

              Les formats PDF, DOCX, XLSX seront ajoutés ensuite.

            </p>

          </div>

        </div>

      )}

      {/* ETAPE 2 */}

      {step === 2 && preview && (

        <div className="space-y-6">

          <div className="flex items-center gap-3">

            <FileText className="text-blue-600"/>

            <div>

              <div className="font-bold">

                {selectedFile?.name}

              </div>

              <div className="text-sm text-slate-500">

                Analyse terminée

              </div>

            </div>

          </div>

          <div className="grid grid-cols-2 gap-6">

            <div className="border rounded-xl p-4">

              <h3 className="font-bold mb-3">

                Modules détectés

              </h3>

              <ul className="space-y-2">

                {preview.modules.map((m) => (

                  <li
                    key={m.id}
                    className="flex items-center gap-2"
                  >

                    <CheckCircle
                      size={16}
                      className="text-green-600"
                    />

                    {m.title}

                  </li>

                ))}

              </ul>

            </div>

            <div className="border rounded-xl p-4">

              <h3 className="font-bold mb-3">

                Structure détectée

              </h3>

              <div className="max-h-96 overflow-auto space-y-4">

                {preview.modules.map((module) => (

                  <div
                    key={module.id}
                    className="border rounded-lg p-3"
                  >

                    <div className="font-bold text-blue-700">

                      📘 {module.title}

                    </div>

                    {module.chapters.map((chapter) => (

                      <div
                        key={chapter.id}
                        className="ml-5 mt-3"
                      >

                        <div className="font-semibold text-slate-700">

                          📂 {chapter.title}

                        </div>

                        <ul className="ml-6 mt-2 list-disc space-y-1">

                          {chapter.lessons.map((lesson) => (

                            <li
                              key={lesson.id}
                              className="text-sm"
                            >

                              {lesson.title}

                            </li>

                          ))}

                        </ul>

                      </div>

                    ))}

                  </div>

                ))}

              </div>

            </div>

          </div>

          <div className="flex justify-between">

            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg"
            >

              <ArrowLeft size={18}/>

              Retour

            </button>

            <button
              onClick={handleValidate}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg"
            >

              Enregistrer

              <ArrowRight size={18}/>

            </button>

          </div>

        </div>

      )}

      {onCancel && (

        <div className="mt-8 text-center">

          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-700"
          >

            Fermer

          </button>

        </div>

      )}

    </div>
  );
}