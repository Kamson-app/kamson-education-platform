/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EstablishmentSettings,
  EstablishmentHeaders,
  SyncStatus,
} from "../types";

export const DEFAULT_ESTABLISHMENT: EstablishmentSettings = {
  id: "",
  ministry: "MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES",
  region: "",
  delegation: "",
  establishmentName: "",
  academicYear: "",
  motto: "Paix - Travail - Patrie",
  town: "",
  departmentName: "",
  logoUrl: "",
};

export const DEFAULT_HEADERS: EstablishmentHeaders = {
  id: "",
  ministry: "MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES",
  delegation: "",
  establishmentName: "",
  departmentName: "",
  academicYear: "",
  town: "",
  logoUrl: "",
};

export const DEFAULT_SYNC_STATUS: SyncStatus = {
  lastSync: undefined,
  isOnline: true,
  canSync: true,
};

export const COMPETENCY_STATUS_OPTIONS = [
  "Non acquis",
  "En cours d'acquisition",
  "Acquis",
  "Maîtrisé",
] as const;

export const TRIMESTERS = [1, 2, 3] as const;