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

const COLLECTION = "departmentSettings";

export class DepartmentService {

    static async getDepartmentSettings(
        departmentId: string
    ): Promise<EstablishmentSettings | null> {

        if (!departmentId) return null;

        const ref = doc(db, COLLECTION, departmentId);

        const snap = await getDoc(ref);

        if (!snap.exists()) return null;

        return snap.data() as EstablishmentSettings;
    }

    static async saveDepartmentSettings(
        departmentId: string,
        data: Partial<EstablishmentSettings>
    ): Promise<void> {

        const ref = doc(db, COLLECTION, departmentId);

        await setDoc(ref, data, { merge: true });
    }

    static async updateDepartmentSettings(
        departmentId: string,
        data: Partial<EstablishmentSettings>
    ): Promise<void> {

        const ref = doc(db, COLLECTION, departmentId);

        await updateDoc(ref, data);
    }

    static subscribe(

        departmentId: string,

        callback: (
            settings: EstablishmentSettings | null
        ) => void

    ): Unsubscribe {

        const ref = doc(db, COLLECTION, departmentId);

        return onSnapshot(ref, (snapshot) => {

            if (!snapshot.exists()) {

                callback(null);

                return;
            }

            callback(snapshot.data() as EstablishmentSettings);

        });

    }

}