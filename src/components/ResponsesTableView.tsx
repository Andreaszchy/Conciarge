import React, { useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { OpinionAnalysis, Survey, SurveyResponseRecord } from '../types';
import { exportSurveyToExcel } from '../utils/excelExport';

interface ResponsesTableViewProps {
  survey: Survey;
  responses: SurveyResponseRecord[];
  latestAnalysis: OpinionAnalysis | null;
  onDeleteResponse: (responseId: string) => Promise<void>;
  onOpenGuestPreview: () => void;
}

function formatDate(ts: SurveyResponseRecord['submittedAt']): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Reciente';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts.toDate());
}

export function ResponsesTableView({
  survey,
  responses,
  latestAnalysis,
  onDeleteResponse,
  onOpenGuestPreview,
}: ResponsesTableViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'Positivo' | 'Neutro' | 'Negativo'>(
    'all'
  );
  const [modeFilter, setModeFilter] = useState<'all' | 'anonymous' | 'identified'>('all');
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponseRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredResponses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return responses.filter((r) => {
      if (modeFilter === 'anonymous' && !r.isAnonymous) return false;
      if (modeFilter === 'identified' && r.isAnonymous) return false;

      const aiEntry = latestAnalysis?.responseSentiments?.[r.id];
      if (sentimentFilter !== 'all') {
        const s = (aiEntry?.sentiment || '').toLowerCase();
        if (!s.includes(sentimentFilter.toLowerCase().slice(0, 5))) return false;
      }

      if (!q) return true;
      const haystack = [
        r.guestName,
        r.guestEmail,
        r.roomNumber,
        r.stayType,
        r.openComment,
        aiEntry?.mainTopic || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [responses, searchTerm, sentimentFilter, modeFilter, latestAnalysis]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteResponse(id);
      if (selectedResponse?.id === id) setSelectedResponse(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar: Search, Segmented Filters, Excel Export */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por comentario, huésped o habitación..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
            />
          </div>

          {/* Interactive Filter Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['all', 'Todas'],
                ['anonymous', 'Anónimas'],
                ['identified', 'Con contacto'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setModeFilter(val)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  modeFilter === val
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {latestAnalysis && (
            <select
              value={sentimentFilter}
              onChange={(e) =>
                setSentimentFilter(
                  e.target.value as 'all' | 'Positivo' | 'Neutro' | 'Negativo'
                )
              }
              aria-label="Filtrar por sentimiento IA"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-teal-700 focus:outline-none"
            >
              <option value="all">Sentimiento: Todos</option>
              <option value="Positivo">Solo positivas</option>
              <option value="Neutro">Solo neutras</option>
              <option value="Negativo">Solo negativas</option>
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={() => exportSurveyToExcel(survey, responses, latestAnalysis)}
          disabled={responses.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar a Excel (.xlsx)
        </button>
      </div>

      {/* Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {responses.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              Todavía no se han registrado respuestas
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Cuando los huéspedes respondan online, cada valoración aparecerá aquí al instante y
              podrás exportarla a Excel con un solo clic.
            </p>
            <button
              type="button"
              onClick={onOpenGuestPreview}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Enviar respuesta de prueba
            </button>
          </div>
        ) : filteredResponses.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No hay respuestas que coincidan con los filtros actuales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 font-medium">Fecha</th>
                  <th className="py-3 px-4 font-medium">Huésped</th>
                  <th className="py-3 px-4 font-medium">Hab. / Estancia</th>
                  <th className="py-3 px-4 text-right font-medium">Media</th>
                  <th className="py-3 px-4 text-right font-medium">NPS</th>
                  <th className="py-3 px-4 font-medium">Opinión y resumen IA</th>
                  <th className="py-3 px-4 font-medium">Sentimiento</th>
                  <th className="py-3 px-4 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredResponses.map((r) => {
                  const ai = latestAnalysis?.responseSentiments?.[r.id];
                  const sentimentText = ai?.sentiment || 'Sin analizar';
                  const sentimentClass = sentimentText.toLowerCase().includes('positiv')
                    ? 'text-emerald-700 font-medium'
                    : sentimentText.toLowerCase().includes('negativ')
                      ? 'text-red-700 font-medium'
                      : sentimentText.toLowerCase().includes('neutr')
                        ? 'text-amber-700 font-medium'
                        : 'text-slate-400';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedResponse(r)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(r.submittedAt)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-900">
                          {r.guestName || 'Huésped anónimo'}
                        </p>
                        {r.guestEmail && (
                          <p className="text-xs text-slate-500">{r.guestEmail}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        <span className="font-mono tabular-nums">
                          {r.roomNumber ? `Hab. ${r.roomNumber}` : '—'}
                        </span>
                        {r.stayType && (
                          <>
                            <span className="mx-1.5 text-slate-300" aria-hidden="true">·</span>
                            <span>{r.stayType}</span>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {r.overallRating > 0 ? r.overallRating.toFixed(1) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {r.npsScore >= 0 ? r.npsScore : '—'}
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                          {r.openComment || 'Sin comentario escrito'}
                        </p>
                        {ai?.mainTopic && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Tema: {ai.mainTopic}
                          </p>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-xs whitespace-nowrap ${sentimentClass}`}>
                        {sentimentText}
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={deletingId === r.id}
                          onClick={() => handleDelete(r.id)}
                          aria-label="Eliminar respuesta"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Response Detail Modal */}
      {selectedResponse && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedResponse.guestName || 'Huésped anónimo'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {formatDate(selectedResponse.submittedAt)}
                  {selectedResponse.roomNumber ? ` · Hab. ${selectedResponse.roomNumber}` : ''}
                  {selectedResponse.stayType ? ` · ${selectedResponse.stayType}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResponse(null)}
                aria-label="Cerrar detalle"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {latestAnalysis?.responseSentiments?.[selectedResponse.id] && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-xs font-semibold text-slate-900">
                    Análisis IA ·{' '}
                    {latestAnalysis.responseSentiments[selectedResponse.id].sentiment} ·{' '}
                    {latestAnalysis.responseSentiments[selectedResponse.id].mainTopic}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {latestAnalysis.responseSentiments[selectedResponse.id].briefSummary}
                  </p>
                </div>
              )}

              {selectedResponse.guestEmail && (
                <div className="text-xs text-slate-600">
                  <span className="font-medium text-slate-800">Contacto opcional:</span>{' '}
                  {selectedResponse.guestEmail}
                </div>
              )}

              <div className="divide-y divide-slate-100">
                {survey.questions.map((q) => {
                  const val = selectedResponse.answers?.[q.id];
                  return (
                    <div key={q.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-xs font-medium text-slate-500">{q.label}</p>
                      <div className="mt-1 text-sm text-slate-900">
                        {val === undefined || val === '' ? (
                          <span className="text-slate-400">Sin respuesta</span>
                        ) : q.type === 'rating' ? (
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            {val} / 5
                          </span>
                        ) : q.type === 'nps' ? (
                          <span className="font-mono tabular-nums font-semibold">{val} / 10</span>
                        ) : (
                          <p className="leading-relaxed">{String(val)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
