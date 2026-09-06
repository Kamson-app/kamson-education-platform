/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, where, serverTimestamp} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { 
  ClassGradeSheet,
  Trimester,
} from "../types";

export interface GradeSheetQuery {
  establishmentId: string;
  departmentId: string;
  academicYear?: string;
  trimester?: Trimester;
  teacherId?: string;
  discipline?: string;
  className?: string;
}

function buildGradeSheetQuery(
  filters: GradeSheetQuery
) {
  if (!filters.establishmentId) {
    throw new Error("establishmentId est requis.");
  }

  if (!filters.departmentId) {
    throw new Error("departmentId est requis.");
  }

  const constraints = [
    where(
      "establishmentId",
      "==",
      filters.establishmentId
    ),
    where(
      "departmentId",
      "==",
      filters.departmentId
    ),
  ];

  if (filters.academicYear) {
    constraints.push(
      where(
        "academicYear",
        "==",
        filters.academicYear
      )
    );
  }

  if (filters.trimester) {
    constraints.push(
      where(
        "trimester",
        "==",
        filters.trimester
      )
    );
  }

  if (filters.teacherId) {
    constraints.push(
      where(
        "teacherId",
        "==",
        filters.teacherId
      )
    );
  }

  if (filters.discipline) {
    constraints.push(
      where(
        "discipline",
        "==",
        filters.discipline
      )
    );
  }

  if (filters.className) {
    constraints.push(
      where(
        "className",
        "==",
        filters.className
      )
    );
  }

  return query(
    collection(db, "classGradeSheets"),
    ...constraints
  );
}

export const getDepartmentGradeSheets = async (
  filters: GradeSheetQuery
): Promise<ClassGradeSheet[]> => {

  const q =
    buildGradeSheetQuery(filters);

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as ClassGradeSheet)
  );
};

export const subscribeToDepartmentGradeSheetsByScope = (
  filters: GradeSheetQuery,
  onData: (
    sheets: ClassGradeSheet[]
  ) => void,
  onError: (
    error: Error
  ) => void
): Unsubscribe => {

  const q =
    buildGradeSheetQuery(filters);

  return onSnapshot(
    q,
    snapshot => {

      const sheets =
        snapshot.docs.map(
          docSnap => ({
            id: docSnap.id,
            ...docSnap.data(),
          } as ClassGradeSheet)
        );

      onData(sheets);
    },
    onError
  );
};

/**
 * Écoute en temps réel les relevés de notes pour un enseignant dans son établissement et son département.
 */
export const subscribeToGradeSheets = (
  establishmentId: string,
  departmentId: string,
  teacherUid: string,
  onData: (sheets: ClassGradeSheet[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!establishmentId || !departmentId || !teacherUid) {
    throw new Error("Paramètres requis manquants pour l'écoute des relevés (establishmentId, departmentId, teacherUid).");
  }

  const q = query(
    collection(db, 'classGradeSheets'),
    where('establishmentId', '==', establishmentId),
    where('departmentId', '==', departmentId),
    where('teacherId', '==', teacherUid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sheets: ClassGradeSheet[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ClassGradeSheet, 'id'>)
      }));
      onData(sheets);
    },
    (err) => {
      console.error('Erreur lors de l\'écoute des relevés de notes :', err);
      onError(err);
    }
  );
};

/**
 * Écoute en temps réel TOUS les relevés de notes
 * d'un établissement et d'un département.
 */
export const subscribeToDepartmentGradeSheets = (
  establishmentId: string,
  departmentId: string,
  onData: (sheets: ClassGradeSheet[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!establishmentId || !departmentId) {
    throw new Error(
      "Paramètres requis manquants pour l'écoute des relevés du département."
    );
  }

  const q = query(
    collection(db, 'classGradeSheets'),
    where('establishmentId', '==', establishmentId),
    where('departmentId', '==', departmentId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sheets: ClassGradeSheet[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ClassGradeSheet, 'id'>)
      }));

      onData(sheets);
    },
    (err) => {
      console.error(
        "Erreur lors de l'écoute des relevés du département :",
        err
      );
      onError(err);
    }
  );
};

/**
 * Récupère un relevé de notes spécifique par son ID.
 */
export const getGradeSheet = async (sheetId: string): Promise<ClassGradeSheet | null> => {
  if (!sheetId) {
    throw new Error("L'identifiant du relevé est requis pour la récupération.");
  }

  try {
    const docRef = doc(db, 'classGradeSheets', sheetId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...(docSnap.data() as Omit<ClassGradeSheet, 'id'>)
      };
    }
    return null;
  } catch (err) {
    console.error(`Erreur lors de la récupération du relevé ${sheetId} :`, err);
    throw new Error(`Échec de la récupération du relevé de notes : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

/**
 * Sauvegarde (crée ou remplace) un relevé de notes.
 */
export const saveGradeSheet = async (
  sheetId: string,
  gradeSheetData: Omit<ClassGradeSheet, 'id' | 'updatedAt'>
): Promise<void> => {
  if (!sheetId) {
    throw new Error("L'identifiant du relevé est requis pour la sauvegarde.");
  }

  const establishmentId = gradeSheetData.establishmentId;
  const departmentId = gradeSheetData.departmentId;

  if (!departmentId) {
    throw new Error("departmentId est manquant.");
  }
  if (!establishmentId) {
    throw new Error("establishmentId est manquant.");
  }
  if (!gradeSheetData.teacherId) {
    throw new Error("teacherId est manquant.");
  }

  try {
    const sheetRef = doc(db, 'classGradeSheets', sheetId);
    const payload = {
      ...gradeSheetData,
      establishmentId,
      departmentId,
      updatedAt: serverTimestamp()
    };

    await setDoc(sheetRef, payload, { merge: true });
  } catch (err) {
    console.error(`Erreur lors de la sauvegarde du relevé ${sheetId} :`, err);
    throw new Error(`Échec de la sauvegarde du relevé de notes : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

/**
 * Met à jour un relevé de notes existant.
 */
export const updateGradeSheet = async (
  sheetId: string,
  partialData: Partial<ClassGradeSheet>
): Promise<void> => {
  if (!sheetId) {
    throw new Error("L'identifiant du relevé est requis pour la mise à jour.");
  }

  try {
    const sheetRef = doc(db, 'classGradeSheets', sheetId);
    const payload = {
      ...partialData,
      updatedAt: serverTimestamp()
    };

    await setDoc(sheetRef, payload, { merge: true });
  } catch (err) {
    console.error(`Erreur lors de la mise à jour du relevé ${sheetId} :`, err);
    throw new Error(`Échec de la mise à jour du relevé de notes : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

/**
 * Supprime un relevé de notes de Firestore.
 */
export const deleteGradeSheet = async (sheetId: string): Promise<void> => {
  if (!sheetId) {
    throw new Error("L'identifiant du relevé est requis pour la suppression.");
  }

  try {
    const sheetRef = doc(db, 'classGradeSheets', sheetId);
    await deleteDoc(sheetRef);
  } catch (err) {
    console.error(`Erreur lors de la suppression du relevé ${sheetId} :`, err);
    throw new Error(`Échec de la suppression du relevé de notes : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

/**
 * --------------------------------------------------------------------------
 * COMPATIBILITÉ AVEC L'ANCIEN GradeEntryView
 * --------------------------------------------------------------------------
 */

export const saveGradeSheetCompat = async (
  gradeSheet: ClassGradeSheet
): Promise<void> => {
  if (!gradeSheet.id) {
    throw new Error("Le relevé doit posséder un identifiant.");
  }

  const { id, updatedAt, ...data } = gradeSheet;

  await saveGradeSheet(id, data);
};

export const getGradeSheets = async (
  establishmentId: string,
  departmentId: string,
  teacherId: string
): Promise<ClassGradeSheet[]> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = subscribeToGradeSheets(
      establishmentId,
      departmentId,
      teacherId,
      (sheets) => {
        unsubscribe();
        resolve(sheets);
      },
      reject
    );
  });
};