import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowUpRight,
  Download,
  ExternalLink,
  RefreshCw,
  Share2,
  Sparkles,
} from 'lucide-react';
import type { OpinionAnalysis, Survey, SurveyResponseRecord } from '../types';
import { computeSurveyMetrics, exportSurveyToExcel } from '../utils/excelExport';

interface AnalyticsViewProps {
  survey: Survey;
  responses: SurveyResponseRecord[];
  latestAnalysis: OpinionAnalysis | null;
  analyzing: boolean;
  analysisError: string;
  onRunAnalysis: () => Promise<void>;
  onOpenShare: () => void;
  onOpenGuestPreview: () => void;
}

export function AnalyticsView({
  survey,
  responses,
  latestAnalysis,
  analyzing,
  analysisError,
  onRunAnalysis,
  onOpenShare,
  onOpenGuestPreview,
}: AnalyticsViewProps) {
  const [autoAttemptedKey, setAutoAttemptedKey] = useState('');
  const runningRef = useRef(false);

  const metrics = useMemo(() => computeSurveyMetrics(survey, responses), [survey, responses]);

  const isAnalysisStale =
    responses.length > 0 &&
    (!latestAnalysis || latestAnalysis.responseCount !== responses.length);

  // Automatic opinion analysis when enabled on the survey and new responses arrive
  useEffect(() => {
    const attemptKey = `${survey.id}:${responses.length}`;
    if (
      survey.autoAnalyze &&
      responses.length > 0 &&
      isAnalysisStale &&
      !analyzing &&
      !runningRef.current &&
      autoAttemptedKey !== attemptKey &&
      !analysisError
    ) {
      runningRef.current = true;
      setAutoAttemptedKey(attemptKey);
      onRunAnalysis().finally(() => {
        runningRef.current = false;
      });
    }
  }, [
    survey.id,
    survey.autoAnalyze,
    responses.length,
    isAnalysisStale,
    analyzing,
    autoAttemptedKey,
    analysisError,
    onRunAnalysis,
  ]);

  const sentimentTotal = latestAnalysis
    ? latestAnalysis.sentiment.positive +
      latestAnalysis.sentiment.neutral +
      latestAnalysis.sentiment.negative
    : 0;

  const positivePct =
    sentimentTotal > 0 && latestAnalysis
      ? Math.round((latestAnalysis.sentiment.positive / sentimentTotal) * 100)
      : 0;
  const neutralPct =
    sentimentTotal > 0 && latestAnalysis
      ? Math.round((latestAnalysis.sentiment.neutral / sentimentTotal) * 100)
      : 0;
  const negativePct =
    sentimentTotal > 0 && latestAnalysis
      ? Math.round((latestAnalysis.sentiment.negative / sentimentTotal) * 100)
      : 0;

  if (responses.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-2xl mx-auto my-8">
        <h2 className="text-lg font-bold text-slate-900 mb-2">
          Aún no hay respuestas para "{survey.title}"
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed mb-6">
          Comparte el enlace directo o el código QR con tus huéspedes. Podrán contestar online en
          menos de dos minutos sin registrarse, y aquí verás las métricas y el análisis automático
          de opiniones.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenShare}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            Compartir enlace y QR
          </button>
          <button
            type="button"
            onClick={onOpenGuestPreview}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            Contestar una prueba ahora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Strip — single flat bordered container with hairline vertical dividers */}
      <section
        aria-label="Indicadores clave de satisfacción"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
      >
        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium text-slate-500">Satisfacción media</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {metrics.avgRating.toFixed(2)}
            </span>
            <span className="text-sm font-mono text-slate-400">/ 5.00</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {metrics.avgRating >= 4.2
              ? 'Nivel sobresaliente en hospitalidad'
              : metrics.avgRating >= 3.5
                ? 'Nivel satisfactorio con margen de mejora'
                : 'Requiere atención operativa prioritaria'}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium text-slate-500">Índice NPS</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {metrics.nps > 0 ? `+${metrics.nps}` : metrics.nps}
            </span>
            <span className="text-xs font-medium text-teal-700">
              {metrics.nps >= 50 ? 'Excelente' : metrics.nps >= 20 ? 'Bueno' : 'Mejorable'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.promotersPct}% prom. · {metrics.passivesPct}% pas. · {metrics.detractorsPct}% det.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium text-slate-500">Respuestas recibidas</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {metrics.total}
            </span>
            <span className="text-xs text-slate-500">encuestas</span>
          </div>
          <p className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.anonymousPct}% enviadas de forma anónima
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium text-slate-500">Opiniones positivas (IA)</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {latestAnalysis ? `${positivePct}%` : '—'}
            </span>
            {latestAnalysis && (
              <span className="text-xs text-emerald-700 font-medium">
                {latestAnalysis.sentiment.positive} de {sentimentTotal}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {analyzing
              ? 'Analizando comentarios...'
              : latestAnalysis
                ? `${latestAnalysis.sentiment.negative} críticas detectadas`
                : 'Pendiente de análisis IA'}
          </p>
        </div>
      </section>

      {/* Main Grid: Automated AI Opinion Analysis + Area Scores Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left/Primary Column: Automated AI Analysis (7 cols) */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Análisis automático de opiniones
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {latestAnalysis
                  ? `Basado en ${latestAnalysis.responseCount} respuestas${
                      isAnalysisStale ? ` · Hay ${responses.length - latestAnalysis.responseCount} nuevas sin analizar` : ''
                    }`
                  : 'Procesa los comentarios abiertos y valoraciones para detectar patrones clave'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRunAnalysis}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {analyzing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {analyzing
                  ? 'Analizando...'
                  : latestAnalysis
                    ? 'Actualizar análisis'
                    : 'Analizar opiniones'}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-7">
            {analysisError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">No se pudo ejecutar el análisis automático</p>
                  <p className="text-xs mt-0.5 text-red-700">{analysisError}</p>
                </div>
              </div>
            )}

            {analyzing && !latestAnalysis && (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3" />
                <div className="h-16 bg-slate-100 rounded w-full" />
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="h-28 bg-slate-100 rounded" />
                  <div className="h-28 bg-slate-100 rounded" />
                </div>
              </div>
            )}

            {!analyzing && !latestAnalysis && !analysisError && (
              <div className="py-6 text-center space-y-3">
                <p className="text-sm text-slate-600">
                  Pulsa <strong>Analizar opiniones</strong> para clasificar el sentimiento, resumir
                  los comentarios y generar un plan de acción para tu equipo.
                </p>
              </div>
            )}

            {latestAnalysis && (
              <>
                {/* Executive Summary */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500">Resumen ejecutivo</h3>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {latestAnalysis.executiveSummary}
                  </p>
                </div>

                {/* Sentiment Bar */}
                {sentimentTotal > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Distribución de sentimiento
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        Positivo {positivePct}% · Neutro {neutralPct}% · Negativo {negativePct}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100">
                      <div
                        className="bg-emerald-600 h-full"
                        style={{ width: `${positivePct}%` }}
                        title={`Positivo: ${latestAnalysis.sentiment.positive}`}
                      />
                      <div
                        className="bg-amber-500 h-full"
                        style={{ width: `${neutralPct}%` }}
                        title={`Neutro: ${latestAnalysis.sentiment.neutral}`}
                      />
                      <div
                        className="bg-red-600 h-full"
                        style={{ width: `${negativePct}%` }}
                        title={`Negativo: ${latestAnalysis.sentiment.negative}`}
                      />
                    </div>
                  </div>
                )}

                {/* Strengths & Improvements — clean whitespace + hairline separation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">Fortalezas destacadas</h3>
                    <ul className="space-y-3">
                      {latestAnalysis.strengths.map((item, idx) => (
                        <li
                          key={idx}
                          className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {item.title}
                            </span>
                            <span className="text-xs font-mono tabular-nums text-emerald-700 shrink-0">
                              {item.mentions} menc.
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {item.detail}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">Áreas de mejora</h3>
                    <ul className="space-y-3">
                      {latestAnalysis.improvements.map((item, idx) => {
                        const priorityColor =
                          item.priority.toLowerCase().includes('alta')
                            ? 'text-red-700'
                            : item.priority.toLowerCase().includes('media')
                              ? 'text-amber-700'
                              : 'text-slate-600';
                        return (
                          <li
                            key={idx}
                            className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {item.area}
                              </span>
                              <span className={`text-xs font-medium shrink-0 ${priorityColor}`}>
                                Prioridad {item.priority}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Departamento: {item.department}
                            </p>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {item.detail}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {/* Action Plan */}
                {latestAnalysis.actionPlan.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Plan de acción recomendado
                    </h3>
                    <ol className="space-y-2.5">
                      {latestAnalysis.actionPlan.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                          <span className="font-mono tabular-nums text-xs font-semibold text-teal-700 pt-0.5 shrink-0">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Right Column: Scores by Area + Recurring Themes (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          {/* Scores by Question/Category Chart */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-2 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Valoración por departamento</h2>
                <p className="text-xs text-slate-500 mt-0.5">Escala promedio sobre 5.0 estrellas</p>
              </div>
              <button
                type="button"
                onClick={() => exportSurveyToExcel(survey, responses, latestAnalysis)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </button>
            </div>

            {metrics.questionStats.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.questionStats.map((qs) => ({
                      name: qs.category,
                      fullLabel: qs.label,
                      score: qs.average,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 5]}
                      ticks={[0, 1, 2, 3, 4, 5]}
                      tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'IBM Plex Mono' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={96}
                      tick={{ fontSize: 12, fill: '#334155' }}
                    />
                    <Tooltip
                      formatter={(value: unknown) => [`${Number(value).toFixed(2)} / 5`, 'Media']}
                      labelFormatter={(_label, payload) =>
                        payload?.[0]?.payload?.fullLabel || String(_label)
                      }
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                      {metrics.questionStats.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry.average >= 4.2
                              ? '#0F766E'
                              : entry.average >= 3.5
                                ? '#334155'
                                : '#DC2626'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                Esta encuesta no incluye preguntas de calificación por estrellas.
              </p>
            )}
          </section>

          {/* Recurring Themes Table (clean unboxed metadata, zero static pills) */}
          {latestAnalysis && latestAnalysis.themes.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900">Temas más mencionados</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extraídos automáticamente de las opiniones abiertas
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2 pr-3 font-medium">Tema</th>
                      <th className="py-2 px-3 font-medium">Sentimiento</th>
                      <th className="py-2 pl-3 text-right font-medium">Menciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {latestAnalysis.themes.map((t, idx) => {
                      const sColor =
                        t.sentiment.toLowerCase().includes('positiv')
                          ? 'text-emerald-700'
                          : t.sentiment.toLowerCase().includes('negativ')
                            ? 'text-red-700'
                            : 'text-amber-700';
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pr-3 text-slate-800 font-medium">{t.topic}</td>
                          <td className={`py-2.5 px-3 text-xs font-medium ${sColor}`}>
                            {t.sentiment}
                          </td>
                          <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-600">
                            {t.count}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Quick Action Strip */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                ¿Quieres recoger más opiniones hoy?
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Descarga el QR o envía el enlace directo sin registro
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Compartir
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
