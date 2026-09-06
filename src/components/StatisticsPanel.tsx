/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { GenderStatistics } from '../types';

interface StatisticsPanelProps {
  statsEnrollment: GenderStatistics;
  statsEvaluated: GenderStatistics;
  statsPassing: GenderStatistics;
  percInscritsBoys: number;
  percInscritsGirls: number;
  percEvaluatedBoys: number;
  percEvaluatedGirls: number;
  percPassingBoysEvaluated: number;
  percPassingGirlsEvaluated: number;
  percPassingOverall: number;
  boysSuccessRate: number;
  girlsSuccessRate: number;
}

export default function StatisticsPanel({
  statsEnrollment,
  statsEvaluated,
  statsPassing,
  percInscritsBoys,
  percInscritsGirls,
  percEvaluatedBoys,
  percEvaluatedGirls,
  percPassingBoysEvaluated,
  percPassingGirlsEvaluated,
  percPassingOverall,
  boysSuccessRate,
  girlsSuccessRate,
}: StatisticsPanelProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
        Statistiques et Performances de la Classe
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Effectifs */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase">Effectifs</span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-extrabold text-slate-900">{statsEnrollment.total}</span>
            <span className="text-xs text-slate-500">Inscrits au total</span>
          </div>
          <div className="text-xs text-slate-600 flex justify-between pt-1 border-t border-slate-100">
            <span>Garçons : {statsEnrollment.boys} ({percInscritsBoys.toFixed(2)}%)</span>
            <span>Filles : {statsEnrollment.girls} ({percInscritsGirls.toFixed(2)}%)</span>
          </div>
        </div>

        {/* Évalués */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase">Évalués</span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-extrabold text-slate-900">{statsEvaluated.total}</span>
            <span className="text-xs text-slate-500">Ayant composé</span>
          </div>
          <div className="text-xs text-slate-600 flex justify-between pt-1 border-t border-slate-100">
            <span>Garçons : {statsEvaluated.boys} ({percEvaluatedBoys.toFixed(2)}%)</span>
            <span>Filles : {statsEvaluated.girls} ({percEvaluatedGirls.toFixed(2)}%)</span>
          </div>
        </div>

        {/* Réussite */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase">Succès (&ge; 10/20)</span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-extrabold text-emerald-600">{statsPassing.total}</span>
            <span className="text-xs text-emerald-700 font-bold">{percPassingOverall.toFixed(2)}% Global</span>
          </div>
          <div className="text-xs text-slate-600 flex flex-col pt-1 border-t border-slate-100 space-y-0.5">
            <div className="flex justify-between">
              <span>Garçons : {statsPassing.boys}</span>
              <span>Réussite : {boysSuccessRate.toFixed(2)}% (év. {percPassingBoysEvaluated.toFixed(2)}%)</span>
            </div>
            <div className="flex justify-between">
              <span>Filles : {statsPassing.girls}</span>
              <span>Réussite : {girlsSuccessRate.toFixed(2)}% (év. {percPassingGirlsEvaluated.toFixed(2)}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}