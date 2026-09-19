/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    doc,
    getDoc,
    updateDoc,
    setDoc,
    onSnapshot,
    type Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebaseConfig";
import type { EstablishmentSettings } from "../types";

/**
 * Les paramètres du département sont stockés
 * dans la collection Firestore "departments".
 *
 * Le departmentId du profil utilisateur correspond
 * directement à l'identifiant du document Firestore.
 */
const COLLECTION = "departments";

export class DepartmentService {

    /**
     * Récupère les paramètres du département.
     */
    static async getDepartmentSettings(
        departmentId: string
    ): Promise<EstablishmentSettings | null> {

        if (!departmentId) {
            return null;
        }

        const ref = doc(
            db,
            COLLECTION,
            departmentId
        );

        const snap = await getDoc(ref);

        if (!snap.exists()) {
            return null;
        }

        return {
            id: snap.id,
            ...snap.data(),
        } as EstablishmentSettings;
    }

    /**
     * Enregistre ou complète les paramètres
     * du département sans supprimer les champs existants.
     */
    static async saveDepartmentSettings(
        departmentId: string,
        data: Partial<EstablishmentSettings>
    ): Promise<void> {

        if (!departmentId) {
            throw new Error(
                "Impossible d'enregistrer : département inconnu."
            );
        }

        const ref = doc(
            db,
            COLLECTION,
            departmentId
        );

        await setDoc(
            ref,
            {
                ...data,
                id: departmentId,
            },
            {
                merge: true,
            }
        );
    }

    /**
     * Met à jour les paramètres existants
     * du département.
     */
    static async updateDepartmentSettings(
        departmentId: string,
        data: Partial<EstablishmentSettings>
    ): Promise<void> {

        if (!departmentId) {
            throw new Error(
                "Impossible de mettre à jour : département inconnu."
            );
        }

        const ref = doc(
            db,
            COLLECTION,
            departmentId
        );

        await updateDoc(
            ref,
            data
        );
    }

    /**
     * Écoute en temps réel les paramètres
     * du département.
     */
    static subscribe(
        departmentId: string,
        callback: (
            settings: EstablishmentSettings | null
        ) => void
    ): Unsubscribe {

        if (!departmentId) {
            callback(null);

            return () => {};
        }

        const ref = doc(
            db,
            COLLECTION,
            departmentId
        );

        return onSnapshot(
            ref,
            (snapshot) => {

                if (!snapshot.exists()) {
                    callback(null);

                    return;
                }

                callback({
                    id: snapshot.id,
                    ...snapshot.data(),
                } as EstablishmentSettings);
            },
            (error) => {

                console.error(
                    "[DepartmentService] Erreur de synchronisation :",
                    error
                );

                callback(null);
            }
        );
    }
}