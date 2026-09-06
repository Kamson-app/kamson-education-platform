/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import type { Progression } from "../types";

const COLLECTION = "progressions";

/**
 * Ajouter une progression en excluant l'id du payload Firestore
 */
export async function addProgression(
  progression: Progression
): Promise<string> {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = progression;

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
 * Lire toutes les progressions avec filtres contextuels optionnels
 */
export async function getProgressions(
  establishmentId: string,
  academicYear?: string,
  departmentId?: string,
  teacherId?: string
): Promise<Progression[]> {

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
      where("academicYear", "==", academicYear)
    );
  }

  if (departmentId) {
    constraints.push(
      where("departmentId", "==", departmentId)
    );
  }

  if (teacherId) {
    constraints.push(
      where("teacherId", "==", teacherId)
    );
  }

  const q = query(
    collection(db, COLLECTION),
    ...constraints,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  })) as Progression[];

}

/**
 * Modifier une progression
 */
export async function updateProgression(
  id: string,
  data: Partial<Progression>
) {

  const ref = doc(db, COLLECTION, id);

  return await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });

}

/**
 * Supprimer une progression
 */
export async function deleteProgression(
  id: string
) {

  return await deleteDoc(
    doc(db, COLLECTION, id)
  );

}

/**
 * Remplacer complètement une progression sans polluer le document avec l'ID et les timestamps
 */
export async function replaceProgression(
  progression: Progression
): Promise<void> {

  if (!progression.id) {
    throw new Error(
      "ID de progression manquant."
    );
  }

  const {
    id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = progression;

  await updateProgression(
    id,
    data
  );

}

/**
 * Exporter une progression
 */
export async function exportProgression(
  id: string
): Promise<Progression | null> {

  const list = await getDocs(
    query(
      collection(db, COLLECTION),
      where("__name__", "==", id)
    )
  );

  if (list.empty) {
    return null;
  }

  return {
    id: list.docs[0].id,
    ...list.docs[0].data(),
  } as Progression;

}

/**
 * Synchronisation temps réel des progressions avec filtres et gestion d'erreurs
 */
export function subscribeProgressions(
  establishmentId: string,
  callback: (progressions: Progression[]) => void,
  academicYear?: string,
  departmentId?: string,
  teacherId?: string,
  onError?: (error: Error) => void
): Unsubscribe {

  if (!establishmentId) {
    return () => {};
  }

  const constraints = [
    where("establishmentId", "==", establishmentId),
  ];

  if (academicYear) {
    constraints.push(
      where("academicYear", "==", academicYear)
    );
  }

  if (departmentId) {
    constraints.push(
      where("departmentId", "==", departmentId)
    );
  }

  if (teacherId) {
    constraints.push(
      where("teacherId", "==", teacherId)
    );
  }

  const q = query(
    collection(db, COLLECTION),
    ...constraints,
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const progressions = snapshot.docs.map(
        (docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        })
      ) as Progression[];

      callback(progressions);
    },
    (error) => {
      console.error(
        "Erreur synchronisation progressions :",
        error
      );

      onError?.(error);
    }
  );

}