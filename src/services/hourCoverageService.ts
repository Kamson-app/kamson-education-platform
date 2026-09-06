/**
 * Service Firestore — Couverture des heures d'enseignement
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebaseConfig";
import type { HourCoverage } from "../types";

/* ============================================================
 * OUTILS
 * ============================================================ */

export function calculateHourCoverageRate(
  realized: number,
  planned: number
): number {
  if (!planned || planned <= 0) return 0;

  return Number(
    Math.min(
      100,
      (realized / planned) * 100
    ).toFixed(1)
  );
}

/* ============================================================
 * ID DÉTERMINISTE
 * ============================================================ */

export function buildHourCoverageId(
  establishmentId: string,
  academicYear: string,
  className: string,
  discipline: string,
  trimester: number
): string {

  const clean = (value: string) =>
    value
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\wÀ-ÿ-]/g, "");

  return (
    `hc_${clean(establishmentId)}_` +
    `${clean(academicYear)}_` +
    `${clean(className)}_` +
    `${clean(discipline)}_` +
    `${trimester}`
  );
}

/* ============================================================
 * SAUVEGARDE
 * ============================================================ */

export async function saveHourCoverage(
  coverage: HourCoverage
): Promise<void> {

  if (!coverage.id) {
    throw new Error(
      "L'identifiant de la couverture des heures est requis."
    );
  }

  if (!coverage.establishmentId) {
    throw new Error(
      "L'établissement est requis."
    );
  }

  if (!coverage.departmentId) {
    throw new Error(
      "Le département est requis."
    );
  }

  await setDoc(
    doc(
      db,
      "hourCoverages",
      coverage.id
    ),
    {
      ...coverage,

      annualCoverageRate:
        calculateHourCoverageRate(
          coverage.realizedHoursAnnual,
          coverage.plannedHoursAnnual
        ),

      trimesterCoverageRate:
        calculateHourCoverageRate(
          coverage.realizedHoursTrimester,
          coverage.plannedHoursTrimester
        ),

      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

/* ============================================================
 * MISE À JOUR
 * ============================================================ */

export async function updateHourCoverage(
  id: string,
  data: Partial<HourCoverage>
): Promise<void> {

  if (!id) {
    throw new Error(
      "L'identifiant est requis."
    );
  }

  await setDoc(
    doc(
      db,
      "hourCoverages",
      id
    ),
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
 * RÉCUPÉRATION
 * ============================================================ */

export async function getHourCoverages(
  establishmentId: string,
  academicYear: string,
  trimester?: number,
  departmentId?: string
): Promise<HourCoverage[]> {

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
    where(
      "academicYear",
      "==",
      academicYear
    ),
  ];

  if (departmentId) {
    constraints.push(
      where(
        "departmentId",
        "==",
        departmentId
      )
    );
  }

  if (trimester) {
    constraints.push(
      where(
        "trimester",
        "==",
        trimester
      )
    );
  }

  const q = query(
    collection(db, "hourCoverages"),
    ...constraints
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    item =>
      ({
        id: item.id,
        ...item.data(),
      }) as HourCoverage
  );
}

/* ============================================================
 * SYNCHRONISATION TEMPS RÉEL
 * ============================================================ */

export function subscribeHourCoverages(
  establishmentId: string,
  academicYear: string,
  trimester: number,
  onData: (
    data: HourCoverage[]
  ) => void,
  onError?: (
    error: Error
  ) => void,
  departmentId?: string
): Unsubscribe {

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
    where(
      "academicYear",
      "==",
      academicYear
    ),
    where(
      "trimester",
      "==",
      trimester
    ),
  ];

  if (departmentId) {
    constraints.push(
      where(
        "departmentId",
        "==",
        departmentId
      )
    );
  }

  const q = query(
    collection(db, "hourCoverages"),
    ...constraints
  );

  return onSnapshot(
    q,
    snapshot => {

      const data =
        snapshot.docs.map(
          item =>
            ({
              id: item.id,
              ...item.data(),
            }) as HourCoverage
        );

      onData(data);
    },
    error => {

      console.error(
        "[HourCoverageService]",
        error
      );

      onError?.(error);
    }
  );
}

/* ============================================================
 * AJOUT D'UNE HEURE APRÈS UNE SÉANCE
 * ============================================================ */

export async function addRealizedHours(
  coverage: HourCoverage,
  hours: number
): Promise<void> {

  if (hours <= 0) {
    throw new Error(
      "Le nombre d'heures doit être supérieur à zéro."
    );
  }

  const newTrimesterRealized =
    coverage.realizedHoursTrimester +
    hours;

  const newAnnualRealized =
    coverage.realizedHoursAnnual +
    hours;

  if (
    newTrimesterRealized >
    coverage.plannedHoursTrimester
  ) {
    throw new Error(
      "Les heures réalisées ne peuvent pas dépasser les heures prévues pour le trimestre."
    );
  }

  await saveHourCoverage({
    ...coverage,

    realizedHoursAnnual:
      newAnnualRealized,

    realizedHoursTrimester:
      newTrimesterRealized,
  });
}

/* ============================================================
 * SUPPRESSION
 * ============================================================ */

export async function deleteHourCoverage(
  id: string
): Promise<void> {

  if (!id) {
    throw new Error(
      "L'identifiant est requis."
    );
  }

  await deleteDoc(
    doc(
      db,
      "hourCoverages",
      id
    )
  );
}

/* ============================================================
 * HISTORIQUE
 * ============================================================ */

export async function addHourCoverageHistory(
  coverage: HourCoverage
): Promise<void> {

  await addDoc(
    collection(
      db,
      "hourCoverageHistory"
    ),
    {
      ...coverage,

      annualCoverageRate:
        calculateHourCoverageRate(
          coverage.realizedHoursAnnual,
          coverage.plannedHoursAnnual
        ),

      trimesterCoverageRate:
        calculateHourCoverageRate(
          coverage.realizedHoursTrimester,
          coverage.plannedHoursTrimester
        ),

      savedAt: serverTimestamp(),
    }
  );
}