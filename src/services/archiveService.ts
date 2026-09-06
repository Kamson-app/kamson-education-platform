/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';

import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { ArchiveReleve } from '../types';

/**
 * Écoute en temps réel les archives de relevés de notes pour un établissement et un département donnés.
 */
export const subscribeToArchives = (
  establishmentId: string,
  departmentId: string,
  onData: (archives: ArchiveReleve[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!establishmentId || !departmentId) {
    throw new Error("Paramètres requis manquants pour l'écoute des archives (establishmentId, departmentId).");
  }

  const q = query(
    collection(db, 'archiveReleves'),
    where('establishmentId', '==', establishmentId),
    where('departmentId', '==', departmentId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const archives: ArchiveReleve[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ArchiveReleve, 'id'>)
      }));
      onData(archives);
    },
    (err) => {
      console.error('Erreur lors de l\'écoute des archives de relevés :', err);
      onError(err);
    }
  );
};

/**
 * Récupère une archive spécifique par son identifiant.
 */
export const getArchive = async (archiveId: string): Promise<ArchiveReleve | null> => {
  if (!archiveId) {
    throw new Error("L'identifiant de l'archive est requis pour la récupération.");
  }

  try {
    const docRef = doc(db, 'archiveReleves', archiveId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...(docSnap.data() as Omit<ArchiveReleve, 'id'>)
      };
    }
    return null;
  } catch (err) {
    console.error(`Erreur lors de la récupération de l'archive ${archiveId} :`, err);
    throw new Error(`Échec de la récupération de l'archive : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

/**
 * Enregistre ou met à jour une archive de relevé de notes dans Firestore (Anti-doublon strict).
 */
export const saveArchive = async (
  archiveData: Omit<ArchiveReleve, 'id' | 'createdAt'> & { id?: string }
): Promise<string> => {
  const establishmentId = archiveData.establishmentId;
  const departmentId = archiveData.departmentId;
  const className = archiveData.className;
  const discipline = archiveData.discipline;
  const trimester = archiveData.trimester;
  const academicYear = archiveData.academicYear;

  if (!departmentId) {
    throw new Error("departmentId est manquant.");
  }
  if (!establishmentId) {
    throw new Error("establishmentId est manquant.");
  }

  try {
    const archivesRef = collection(db, 'archiveReleves');

    // Si un ID est explicitement fourni (cas d'un remplacement), on met à jour directement ce document
    if (archiveData.id) {
      const docRef = doc(db, 'archiveReleves', archiveData.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, {
          ...archiveData,
          updatedAt: serverTimestamp()
        });
        console.log("Archive mise à jour par ID direct :", archiveData.id);
        return archiveData.id;
      }
    }

    // Sinon, recherche par critère d'unicité strict
    const q = query(
      archivesRef,
      where("establishmentId", "==", establishmentId),
      where("departmentId", "==", departmentId),
      where("className", "==", className),
      where("discipline", "==", discipline),
      where("trimester", "==", trimester),
      where("academicYear", "==", academicYear)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      await updateDoc(
        doc(db, "archiveReleves", existingDoc.id),
        {
          ...archiveData,
          updatedAt: serverTimestamp()
        }
      );

      console.log("Archive existante mise à jour par correspondance stricte :", existingDoc.id);
      return existingDoc.id;
    }

    // Aucun doublon trouvé : création d'une nouvelle archive
    const newDoc = await addDoc(
      archivesRef,
      {
        ...archiveData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    console.log("Nouvelle archive créée :", newDoc.id);
    return newDoc.id;

  } catch (err) {
    console.error("Erreur lors de l'archivage du relevé :", err);
    throw new Error(`Échec de l'archivage du relevé : ${err instanceof Error ? err.message : "Erreur inconnue"}`);
  }
};

/**
 * Supprime une archive de relevé de notes de Firestore.
 */
export const deleteArchive = async (archiveId: string): Promise<void> => {
  if (!archiveId) {
    throw new Error("L'identifiant de l'archive est requis pour la suppression.");
  }

  try {
    const docRef = doc(db, 'archiveReleves', archiveId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Erreur lors de la suppression de l'archive ${archiveId} :`, err);
    throw new Error(`Échec de la suppression de l'archive : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

/**
 * Retourne les données contenues dans une archive afin d'être restaurées côté client.
 */
export const restoreArchive = (archive: ArchiveReleve): ArchiveReleve => {
  if (!archive) {
    throw new Error("Impossible de restaurer une archive vide ou inexistante.");
  }
  return archive;
};

export const getArchives = async (
  establishmentId: string,
  departmentId: string
): Promise<ArchiveReleve[]> => {
  if (!departmentId) {
    throw new Error("departmentId est manquant.");
  }
  if (!establishmentId) {
    throw new Error("establishmentId est manquant.");
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = subscribeToArchives(
      establishmentId,
      departmentId,
      (archives) => {
        unsubscribe();
        resolve(archives);
      },
      reject
    );
  });
};

export const restoreArchiveAsync = async (
  archive: ArchiveReleve
): Promise<ArchiveReleve> => {
  return restoreArchive(archive);
};