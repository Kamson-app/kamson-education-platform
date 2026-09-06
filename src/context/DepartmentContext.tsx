/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    useCallback
} from "react";

import type { EstablishmentSettings } from "../types";

import { DepartmentService } from "../services/DepartmentService";

import { useUser } from "./UserContext";

interface DepartmentContextType {

    departmentId: string;

    settings: EstablishmentSettings | null;

    loading: boolean;

    error: string | null;

    refresh: () => Promise<void>;

    save: (
        data: Partial<EstablishmentSettings>
    ) => Promise<void>;

    update: (
        data: Partial<EstablishmentSettings>
    ) => Promise<void>;
}

const DepartmentContext =
    createContext<DepartmentContextType | undefined>(
        undefined
    );

export const DepartmentProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {

    const { profile } = useUser();

    const [settings, setSettings] =
        useState<EstablishmentSettings | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const departmentId =
        profile?.departmentId ||
        profile?.discipline ||
        profile?.department ||
        "";

    const load = useCallback(async () => {

        if (!departmentId) {

            console.warn(
                "[DepartmentProvider] Aucun département trouvé."
            );

            setSettings(null);
            setError(null);
            setLoading(false);
            return;
        }

        try {

            setLoading(true);
            setError(null);

            const result =
                await DepartmentService.getDepartmentSettings(
                    departmentId
                );

            if (!result) {

                console.warn(
                    "[DepartmentProvider] Aucun paramètre trouvé pour :",
                    departmentId
                );

                setSettings(null);

            } else {

                setSettings(result);

            }

        } catch (err) {

            console.error(
                "[DepartmentProvider]",
                err
            );

            setSettings(null);
            setError(
                "Impossible de charger les paramètres du département."
            );

        } finally {

            setLoading(false);

        }

    }, [departmentId]);

    useEffect(() => {

        load();

    }, [departmentId, load]);

    useEffect(() => {

        if (!departmentId) return;

        return DepartmentService.subscribe(

            departmentId,

            setSettings

        );

    }, [departmentId]);

    const save = useCallback(async (
        data: Partial<EstablishmentSettings>
    ) => {

        if (!departmentId) {
            throw new Error(
                "Impossible d'enregistrer : département inconnu."
            );
        }

        try {
            setError(null);
            await DepartmentService.saveDepartmentSettings(
                departmentId,
                data
            );

            await load();
        } catch (err) {
            setError("Impossible d'enregistrer les paramètres.");
            throw err;
        }

    }, [departmentId, load]);

    const update = useCallback(async (
        data: Partial<EstablishmentSettings>
    ) => {

        if (!departmentId) return;

        try {
            setError(null);
            await DepartmentService.updateDepartmentSettings(
                departmentId,
                data
            );

            await load();
        } catch (err) {
            setError("Impossible de mettre à jour les paramètres.");
            throw err;
        }

    }, [departmentId, load]);

    const value = useMemo(() => ({

        departmentId,

        settings,

        loading,

        error,

        refresh: load,

        save,

        update,

    }), [

        departmentId,

        settings,

        loading,

        error,

        load,

        save,

        update

    ]);

    return (

        <DepartmentContext.Provider value={value}>

            {children}

        </DepartmentContext.Provider>

    );

};

export function useDepartmentContext() {

    const context = useContext(

        DepartmentContext

    );

    if (!context) {

        throw new Error(

            "useDepartmentContext must be used inside DepartmentProvider"

        );

    }

    return context;

}