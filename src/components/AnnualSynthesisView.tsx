/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from "react";
import { fetchAnnualSynthesisData, buildAnnualSynthesis, getHealthLabel, getHealthColor, formatPercentage, formatAverage } from "../services/annualSynthesisService";
import type { AnnualSynthesis } from "../types";

interface AnnualSynthesisViewProps {
  establishmentId: string;
  departmentId?: string;
  academicYear: string;
  discipline: string;
}

export const AnnualSynthesisView: React.FC<AnnualSynthesisViewProps> = ({
  establishmentId,
  departmentId,
  academicYear,
  discipline,
}) => {
  const [synthesis, setSynthesis] = useState<AnnualSynthesis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Récupération des données départementales
      const data = await fetchAnnualSynthesisData(
        establishmentId,
        academicYear,
        discipline,
        departmentId
      );

      // 2. Construction de la synthèse avec injection du contexte (ID établissement et discipline)
      const builtSynthesis = buildAnnualSynthesis(
        data.studentStats,
        data.classGradeSheets,
        data.hourCoverages,
        data.programCoverages,
        establishmentId,
        discipline
      );

      setSynthesis(builtSynthesis);
    } catch (err) {
      console.error("Erreur génération synthèse :", err);
      setError("Impossible de charger les données du département.");
    } finally {
      setLoading(false);
    }
  }, [
    establishmentId,
    departmentId,
    academicYear,
    discipline,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600 font-medium">Génération de la synthèse départementale en cours...</p>
      </div>
    );
  }

  if (error || !synthesis) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center space-y-4">
        <p className="text-red-700 font-semibold">{error || "Aucune donnée disponible."}</p>
        <button 
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête utilisant les propriétés mémorisées dans la synthèse */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Synthèse Annuelle Pédagogique</h2>
          <p className="text-sm text-gray-500 mt-1">Établissement : <span className="font-semibold text-gray-700">{synthesis.establishmentId}</span></p>
          <p className="text-sm text-gray-500">Discipline : <span className="font-semibold text-gray-700">{synthesis.discipline}</span></p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
          >
            Actualiser
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-sm font-medium text-gray-600">Santé :</span>
            <span className={`font-bold ${getHealthColor(synthesis.health)}`}>
              {getHealthLabel(synthesis.health)}
            </span>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Effectif Total</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{synthesis.totalStudents}</p>
          <p className="text-xs text-gray-400 mt-1">{synthesis.admitted} admis • {synthesis.failed} échoués</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Moyenne Générale</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{formatAverage(synthesis.average)}</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Taux de Réussite</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{formatPercentage(synthesis.successRate)}</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Couvertures (H / P)</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-xl font-bold text-gray-800">{formatPercentage(synthesis.hourCoverageRate)}</p>
            <span className="text-gray-300">/</span>
            <p className="text-xl font-bold text-gray-800">{formatPercentage(synthesis.programCoverageRate)}</p>
          </div>
        </div>
      </div>

      {/* Analyse et Recommandations */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Analyse Globale</h3>
        <p className="text-gray-700 text-sm leading-relaxed">{synthesis.summary}</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Recommandations</h3>
        <ul className="space-y-2">
          {synthesis.recommendations.map((rec, index) => (
            <li key={index} className="flex items-start gap-3 text-sm text-gray-600">
              <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">{index + 1}</span>
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}; 
export default AnnualSynthesisView;