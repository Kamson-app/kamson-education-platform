/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebaseConfig";
import type { ProgramCoverage, Trimester } from "../types";

const COLLECTION = "programCoverages";

/* ============================================================
 * PARAMÈTRES DE RECHERCHE COMMUNS
 * ============================================================ */

export interface ProgramCoverageQuery {
  establishmentId: string;
  departmentId?: string;
  academicYear?: string;
  trimester?: Trimester;
  teacherId?: string;
  discipline?: string;
  className?: string;
}

/* ============================================================
 * VALIDATION
 * ============================================================ */

function validateEstablishment(
  establishmentId: string
): void {
  if (!establishmentId) {
    throw new Error(
      "establishmentId est requis pour accéder aux couvertures des programmes."
    );
  }
}

/* ============================================================
 * CONSTRUCTION DE REQUÊTE
 * ============================================================ */

function buildProgramCoverageQuery(
  filters: ProgramCoverageQuery
) {
  validateEstablishment(filters.establishmentId);

  const constraints = [
    where(
      "establishmentId",
      "==",
      filters.establishmentId
    ),
  ];

  if (filters.departmentId) {
    constraints.push(
      where(
        "departmentId",
        "==",
        filters.departmentId
      )
    );
  }

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
    collection(db, COLLECTION),
    ...constraints
  );
}

/* ============================================================
 * RÉCUPÉRER UNE COUVERTURE
 * ============================================================ */

export async function getProgramCoverage(
  id: string
): Promise<ProgramCoverage | null> {

  if (!id) {
    throw new Error(
      "L'identifiant de la couverture des programmes est requis."
    );
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
  } as ProgramCoverage;
}

/* ============================================================
 * RECHERCHER LES COUVERTURES
 * ============================================================ */

export async function getProgramCoverages(
  filters: ProgramCoverageQuery
): Promise<ProgramCoverage[]> {

  const q = buildProgramCoverageQuery(filters);

  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    document => ({
      id: document.id,
      ...document.data(),
    } as ProgramCoverage)
  );
}

/* ============================================================
 * ÉCOUTE TEMPS RÉEL
 * ============================================================ */

export function subscribeProgramCoverages(
  filters: ProgramCoverageQuery,
  onData: (
    coverages: ProgramCoverage[]
  ) => void,
  onError?: (error: Error) => void
): Unsubscribe {

  const q =
    buildProgramCoverageQuery(filters);

  return onSnapshot(
    q,
    snapshot => {

      const coverages =
        snapshot.docs.map(
          document => ({
            id: document.id,
            ...document.data(),
          } as ProgramCoverage)
        );

      onData(coverages);
    },
    error => {

      console.error(
        "[ProgramCoverageService]",
        error
      );

      onError?.(error);
    }
  );
}

/* ============================================================
 * SAUVEGARDER
 * ============================================================ */

export async function saveProgramCoverage(
  coverage: ProgramCoverage
): Promise<void> {

  if (!coverage.id) {
    throw new Error(
      "L'identifiant de la couverture des programmes est requis."
    );
  }

  if (!coverage.establishmentId) {
    throw new Error(
      "establishmentId est manquant."
    );
  }

  if (!coverage.departmentId) {
    throw new Error(
      "departmentId est manquant."
    );
  }

  if (!coverage.academicYear) {
    throw new Error(
      "academicYear est manquant."
    );
  }

  if (!coverage.teacherId) {
    throw new Error(
      "teacherId est manquant."
    );
  }

  await setDoc(
    doc(db, COLLECTION, coverage.id),
    {
      ...coverage,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* ============================================================
 * MISE À JOUR PARTIELLE
 * ============================================================ */

export async function updateProgramCoverage(
  id: string,
  data: Partial<ProgramCoverage>
): Promise<void> {

  if (!id) {
    throw new Error(
      "L'identifiant de la couverture est requis."
    );
  }

  await setDoc(
    doc(db, COLLECTION, id),
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* ============================================================
 * SUPPRESSION
 * ============================================================ */

export async function deleteProgramCoverage(
  id: string
): Promise<void> {

  if (!id) {
    throw new Error(
      "L'identifiant de la couverture est requis."
    );
  }

  await deleteDoc(
    doc(db, COLLECTION, id)
  );
}

/* ============================================================
 * RECHERCHE PAR ÉTABLISSEMENT + DÉPARTEMENT
 * ============================================================ */

export function subscribeToDepartmentProgramCoverages(
  establishmentId: string,
  departmentId: string,
  academicYear: string,
  trimester: Trimester,
  onData: (
    coverages: ProgramCoverage[]
  ) => void,
  onError?: (error: Error) => void
): Unsubscribe {

  return subscribeProgramCoverages(
    {
      establishmentId,
      departmentId,
      academicYear,
      trimester,
    },
    onData,
    onError
  );
}

/* ============================================================
 * RECHERCHE PAR ENSEIGNANT
 * ============================================================ */

export function subscribeToTeacherProgramCoverages(
  establishmentId: string,
  departmentId: string,
  teacherId: string,
  academicYear: string,
  trimester: Trimester,
  onData: (
    coverages: ProgramCoverage[]
  ) => void,
  onError?: (error: Error) => void
): Unsubscribe {

  return subscribeProgramCoverages(
    {
      establishmentId,
      departmentId,
      teacherId,
      academicYear,
      trimester,
    },
    onData,
    onError
  );
}