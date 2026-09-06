/**
 * Réponses générées par l'IA
 */

import type { APCPrepFiche } from "../types";

export type AIResponseData =
  | APCPrepFiche
  | string
  | Record<string, unknown>;

export interface AIResponse<T = AIResponseData> {
  text: string;
  data: T | null;
}

export type AIRequestType =
  | "APC"
  | "REPORT"
  | "EXAM"
  | "STATISTICS"
  | "LESSON";