/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebaseConfig";
import type { APCPrepFiche } from "../types";

const COLLECTION = "apcPreps";

/**
 * Enregistrer ou mettre à jour une fiche APC selon la présence d'un ID
 */
export async function saveAPCPrep(
  fiche: APCPrepFiche
): Promise<string> {
  const {
    id,
    createdAt: _createdAt,
    ...data
  } = fiche;

  if (id && id.trim() !== "") {
    const ref = doc(db, COLLECTION, id);

    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    return id;
  }

  const ref = await addDoc(
    collection(db, COLLECTION),
    {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return ref.id;
}

/**
 * Lire toutes les fiches APC d'un établissement avec filtres optionnels
 */
export async function getAPCPreps(
  establishmentId: string,
  academicYear?: string,
  departmentId?: string,
  teacherId?: string
): Promise<APCPrepFiche[]> {

  if (!establishmentId) {
    throw new Error(
      "L'établissement est requis."
    );
  }

  const constraints = [
    where(
      "establishmentId",
      "==",
      establishmentId
    ),
  ];

  if (academicYear) {
    constraints.push(
      where(
        "academicYear",
        "==",
        academicYear
      )
    );
  }

  if (departmentId) {
    constraints.push(
      where(
        "departmentId",
        "==",
        departmentId
      )
    );
  }

  if (teacherId) {
    constraints.push(
      where(
        "teacherId",
        "==",
        teacherId
      )
    );
  }

  const q = query(
    collection(db, COLLECTION),
    ...constraints,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    docItem => ({
      id: docItem.id,
      ...docItem.data(),
    })
  ) as APCPrepFiche[];
}

/**
 * Modifier une fiche APC
 */
export async function updateAPCPrep(
  id: string,
  data: Partial<APCPrepFiche>
) {

  const ref = doc(db, COLLECTION, id);

  return await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });

}

/**
 * Supprimer une fiche APC
 */
export async function deleteAPCPrep(
  id: string
) {

  return await deleteDoc(
    doc(db, COLLECTION, id)
  );

}

/**
 * Remplacer complètement une fiche
 */
export async function replaceAPCPrep(
  fiche: APCPrepFiche
): Promise<void> {

  if (!fiche.id) {
    throw new Error("ID de fiche APC manquant.");
  }

  const {
    id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = fiche;

  await updateDoc(
    doc(db, COLLECTION, id),
    {
      ...data,
      updatedAt: serverTimestamp(),
    }
  );
}

/**
 * Synchronisation temps réel avec filtrage contextuel et gestion d'erreurs
 */
export function subscribeAPCPreps(
  establishmentId: string,
  callback: (list: APCPrepFiche[]) => void,
  academicYear?: string,
  departmentId?: string,
  teacherId?: string,
  onError?: (error: Error) => void
): Unsubscribe {

  const constraints = [
    where(
      "establishmentId",
      "==",
      establishmentId
    ),
  ];

  if (academicYear) {
    constraints.push(
      where(
        "academicYear",
        "==",
        academicYear
      )
    );
  }

  if (departmentId) {
    constraints.push(
      where(
        "departmentId",
        "==",
        departmentId
      )
    );
  }

  if (teacherId) {
    constraints.push(
      where(
        "teacherId",
        "==",
        teacherId
      )
    );
  }

  const q = query(
    collection(db, COLLECTION),
    ...constraints,
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    snapshot => {
      const list = snapshot.docs.map(
        docItem => ({
          id: docItem.id,
          ...docItem.data(),
        })
      ) as APCPrepFiche[];

      callback(list);
    },
    error => {
      console.error(
        "[APCPrepLibrary]",
        error
      );

      onError?.(error);
    }
  );
}

/**
 * Export unitaire d'une fiche via getDoc
 */
export async function exportAPCPrep(
  id: string
): Promise<APCPrepFiche | null> {

  if (!id) {
    return null;
  }

  const snapshot = await getDoc(
    doc(db, COLLECTION, id)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as APCPrepFiche;

}