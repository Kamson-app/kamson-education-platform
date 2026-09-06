/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import type { APCPrepFiche } from "../types";

import LessonPrepAPCView from "./LessonPrepAPCView";
import APCPrepLibrary from "./APCPrepLibrary";
import ProgressionPreview from "./ProgressionPreview";

import type {
    User,
    EstablishmentSettings,} from "../types";

interface Props {

    currentUser: User;

    establishment: EstablishmentSettings;

    establishmentId: string;

    apcPreps: APCPrepFiche[];

    setAPCPreps: React.Dispatch<
        React.SetStateAction<APCPrepFiche[]>
    >;

}

export default function APCPrepDashboard({

    currentUser,

    establishment,

    establishmentId,

    apcPreps,

    setAPCPreps

}: Props) {

    const [activeTab, setActiveTab] = useState<
        "new" | "library"
    >("new");

    const [selected, setSelected] =
        useState<APCPrepFiche | null>(null);

    return (

        <div className="space-y-6">

            <div className="flex gap-4">

                <button
                    onClick={() => setActiveTab("new")}
                    className={`px-5 py-2 rounded-lg ${
                        activeTab === "new"
                            ? "bg-blue-600 text-white"
                            : "border"
                    }`}
                >
                    Nouvelle fiche APC
                </button>

                <button
                    onClick={() => setActiveTab("library")}
                    className={`px-5 py-2 rounded-lg ${
                        activeTab === "library"
                            ? "bg-blue-600 text-white"
                            : "border"
                    }`}
                >
                    Bibliothèque
                </button>

            </div>

            {activeTab === "new" && (

    <LessonPrepAPCView
    currentUser={currentUser}
    establishment={establishment}
    apcPreps={apcPreps}
    onSaveAPCPreps={setAPCPreps}
      /> 

            )}

            {activeTab === "library" && (

                <APCPrepLibrary
    currentUser={currentUser}
    establishmentId={establishmentId}
    academicYear={establishment.academicYear}
    departmentId={currentUser.departmentId}
    onSelectPrep={(fiche) => {
        setSelected(fiche);
    }}
/>

            )}

            {selected && (

                <ProgressionPreview

                    progression={selected as any}

                    onClose={() => setSelected(null)}

                />

            )}

        </div>

    );

}