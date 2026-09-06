/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "firebase/firestore";

import { db } from "../firebaseConfig";

import type { User } from "../types";

export async function createUserProfile(
    firebaseUser: any,
    extra: any
) {
    const ref = doc(
        db,
        "users",
        firebaseUser.uid
    );

    const snap = await getDoc(ref);

    if (!snap.exists()) {
        const profile: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || extra.fullName,
            email: firebaseUser.email,
            role: extra.role,
            academicYear: extra.academicYear,
            subject: extra.subject,
            classes: [],
            school: extra.school,
            establishment: extra.school,
            establishmentId: extra.establishmentId,
            department: extra.subject,
            departmentId: extra.departmentId,
            status: "ACTIF"
        };

        await setDoc(ref, {
            ...profile,
            email: firebaseUser.email,
            school: extra.school,
            establishment: extra.school,
            establishmentId: extra.establishmentId,
            subject: extra.subject,
            department: extra.subject,
            departmentId: extra.departmentId,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            active: true
        });
    }
}

export async function updateLastLogin(uid: string) {
    await updateDoc(
        doc(db, "users", uid),
        {
            lastLogin: serverTimestamp()
        }
    );
}