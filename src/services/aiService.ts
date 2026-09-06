/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { AI_CONFIG } from "../config/ai";

export type AIRequestType =
  | "APC"
  | "REPORT"
  | "PROGRESSION"
  | "EXAM"
  | "STATISTICS"
  | "COVERAGE"
  | "LESSON";

export interface AIRequest {
  title: string;
  type: AIRequestType;
  prompt: string;
  responseSchema?: unknown;
}

export interface AIResponse<T = unknown> {
  text: string;
  data: T | null;
}

console.log("CLÉ GEMINI :", import.meta.env.VITE_GEMINI_API_KEY);
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export async function generateWithAI<T = unknown>(
  request: AIRequest
): Promise<AIResponse<T>> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const config: any = {
        model: AI_CONFIG.model,
        contents: request.prompt,
      };

      if (request.responseSchema) {
        config.config = {
          responseMimeType: "application/json",
          responseSchema: request.responseSchema,
        };
      }

      const response = await ai.models.generateContent(config);

      const text = response.text ?? "";

      try {
        return {
          text,
          data: JSON.parse(text) as T,
        };
      } catch {
        return {
          text,
          data: null,
        };
      }
    } catch (error: any) {
      attempt++;
      console.warn(`===== AVERTISSEMENT GEMINI (Tentative ${attempt}/${maxRetries}) =====`);
      console.warn(error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isServiceUnavailable = 
        errorMessage.includes("503") || 
        errorMessage.toLowerCase().includes("overloaded") ||
        errorMessage.toLowerCase().includes("service unavailable");

      if (isServiceUnavailable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(`Erreur 503 / Surcharge détectée. Nouvelle tentative dans ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (attempt >= maxRetries) {
        console.error("===== ERREUR FATALE GEMINI : Nombre maximal de tentatives atteint =====");
      }

      return {
        text: "",
        data: null,
      };
    }
  }

  return {
    text: "",
    data: null,
  };
}