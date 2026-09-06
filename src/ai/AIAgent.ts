/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateWithAI } from "../services/aiService";
import { PromptLibrary, type PromptType } from "./PromptLibrary";

export interface AIAgentRequest {

  title: string;

  type: PromptType;

  prompt: string;

  responseSchema?: unknown;

}

export interface AIAgentResponse<T = unknown> {

  success: boolean;

  text: string;

  data: T | null;

  error?: string;

}

/**
 * Moteur IA central de la plateforme.
 * Tous les autres agents (APC, Rapports, Examens...)
 * utilisent cette fonction.
 */
export async function askAI<T = unknown>(
  request: AIAgentRequest
): Promise<AIAgentResponse<T>> {

  try {

    const result = await generateWithAI<T>({
      title: request.title,
      type: request.type,
      prompt:
        PromptLibrary[request.type] +
        "\n\n" +
        request.prompt,

      responseSchema: request.responseSchema

    });

    return {
      success: true,
      text: result.text,
      data: result.data,
    };

  } catch (error) {

    console.error("Erreur AIAgent :", error);

    return {
      success: false,
      text: "",
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Erreur inconnue",
    };

  }

}