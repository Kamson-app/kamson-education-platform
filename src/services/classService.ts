/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp, 
  type Unsubscribe 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { StudentGrade } from '../types';

/**
 * Écoute en temps réel la liste des classes personnalisées pour un établissement donné.
 */
export const subscribeToClasses = (
  establishmentId: string,
  onData: (classes: string[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  if (!establishmentId) {
    throw new Error("L'identifiant de l'établissement est requis pour l'écoute des classes.");
  }

  const docRef = doc(db, 'customClassesList', establishmentId);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as { classes?: string[] };
        onData(data.classes ?? []);
      } else {
        onData([]);
      }
    },
    (err) => {
      console.error('Erreur lors de l\'écoute des classes personnalisées :', err);
      onError(err);
    }
  );
};

/**
 * Récupère la liste des classes personnalisées pour un établissement donné.
 */
export const getCustomClassesList = async (establishmentId: string): Promise<string[]> => {
  if (!establishmentId) {
    throw new Error("L'identifiant de l'établissement est requis pour récupérer les classes.");
  }

  try {
    const docRef = doc(db, 'customClassesList', establishmentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as { classes?: string[] };
      return data.classes ?? [];
    }
    return [];
  } catch (err) {
    console.error('Erreur lors de la récupération des classes personnalisées :', err);
    throw new Error(`Échec de la récupération des classes : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

/**
 * Sauvegarde la liste complète des classes personnalisées pour un établissement.
 */
export const saveCustomClassesList = async (
  establishmentId: string,
  classes: string[]
): Promise<void> => {
  if (!establishmentId) {
    throw new Error("L'identifiant de l'établissement est requis pour sauvegarder les classes.");
  }

  try {
    const docRef = doc(db, 'customClassesList', establishmentId);
    const payload = {
      classes,
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.error('Erreur lors de la sauvegarde des classes personnalisées :', err);
    throw new Error(`Échec de la sauvegarde des classes : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
};

/**
 * Analyse un fichier CSV brut et retourne la liste des élèves extraits (aucune écriture Firestore).
 */
export const importStudentsFromCSV = async (csvFile: File): Promise<StudentGrade[]> => {
  if (!csvFile) {
    throw new Error("Aucun fichier CSV fourni pour l'importation.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          resolve([]);
          return;
        }

        const lines = text.split('\n');
        const imported: StudentGrade[] = [];

        lines.forEach((line, idx) => {
          if (!line.trim()) return;
          if (idx === 0 && (line.toLowerCase().includes('nom') || line.toLowerCase().includes('sexe') || line.toLowerCase().includes('gender'))) {
            return;
          }

          const separator = line.includes(';') ? ';' : ',';
          const parts = line.split(separator);

          if (parts.length >= 2) {
            const rawName = parts[0]?.trim().replace(/^[""]|[""]$/g, '');
            const genderVal = parts[1]?.trim().toUpperCase();
            const gender = (genderVal === 'F' || genderVal === 'FEMININ' || genderVal === 'FEMELLE') ? 'F' : 'M';

            if (rawName && rawName.length > 1) {
              imported.push({
                id: crypto.randomUUID(),
                name: rawName.toUpperCase(),
                gender,
                average: 0,
                evaluations:{},
              });
            }
          } else if (parts.length === 1 && parts[0]?.trim()) {
            const rawName = parts[0]?.trim().replace(/^[""]|[""]$/g, '');
            if (rawName && rawName.length > 1) {
              imported.push({
                id: crypto.randomUUID(),
                name: rawName.toUpperCase(),
                gender: 'M',
                average: 0,
                evaluations:{},
              });
            }
          }
        });

        resolve(imported);
      } catch (err) {
        reject(new Error(`Échec de l'analyse du fichier CSV : ${err instanceof Error ? err.message : 'Erreur inconnue'}`));
      }
    };

    reader.onerror = (error) => {
      reject(new Error(`Erreur lors de la lecture du fichier : ${error}`.trim()));
    };

    reader.readAsText(csvFile, 'UTF-8');
  });
};