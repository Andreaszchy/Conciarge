import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Edit3,
  ExternalLink,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import type { Survey, SurveyType } from '../types';
import {
  resolveHotelLocation,
  resolveSurveyType,
  SURVEY_TYPE_LABELS,
  SURVEY_TYPES,
} from '../types';

interface SurveysListViewProps {
  surveys: Survey[];
  selectedSurveyId: string | null;
  onSelectSurvey: (surveyId: string, goToTab?: 'analytics' | 'builder') => void;
  onCreateNew: () => void;
  onShare: (survey: Survey) => void;
  onPreview: (survey: Survey) => void;
  onToggleStatus: (survey: Survey) => Promise<void>;
  onDelete: (survey: Survey) => Promise<void>;
}

export function SurveysListView({
  surveys,
  selectedSurveyId,
  onSelectSurvey,
  onCreateNew,
  onShare,
  onPreview,
  onToggleStatus,
  onDelete,
}: SurveysListViewProps) {
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | SurveyType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const hotelOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of surveys) {
      const hotel = resolveHotelLocation(s);
      map.set(hotel, (map.get(hotel) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [surveys]);

  const surveysMatchingHotel = useMemo(() => {
    if (hotelFilter === 'all') return surveys;
    return surveys.filter((s) => resolveHotelLocation(s) === hotelFilter);
  }, [surveys, hotelFilter]);

  const countsByType = useMemo(() => {
    const counts: Record<SurveyType, number> = {
      estancia: 0,
      rapida: 0,
      gastronomia: 0,
      spa: 0,
      personalizada: 0,
    };
    for (const s of surveysMatchingHotel) {
      counts[resolveSurveyType(s)] += 1;
    }
    return counts;
  }, [surveysMatchingHotel]);

  const filteredSurveys = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return surveysMatchingHotel.filter((s) => {
      if (typeFilter !== 'all' && resolveSurveyType(s) !== typeFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      const typeLabel = SURVEY_TYPE_LABELS[resolveSurveyType(s)].toLowerCase();
      const hotelLoc = resolveHotelLocation(s).toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.hotelName.toLowerCase().includes(q) ||
        hotelLoc.includes(q) ||
        typeLabel.includes(q)
      );
    });
  }, [surveysMatchingHotel, typeFilter, statusFilter, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Mis encuestas hoteleras</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Filtra por hotel y tipo de encuesta para localizar rápidamente cada restaurante o área
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva encuesta
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, restaurante u hotel..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={hotelFilter}
              onChange={(e) => setHotelFilter(e.target.value)}
              aria-label="Filtrar por hotel"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-teal-700 focus:outline-none max-w-[240px]"
            >
              <option value="all">Hotel: Todos ({surveys.length})</option>
              {hotelOptions.map(([hotel, count]) => (
                <option key={hotel} value={hotel}>
                  {hotel} ({count})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused')}
              aria-label="Filtrar por estado"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-teal-700 focus:outline-none"
            >
              <option value="all">Estado: Todas</option>
              <option value="active">Solo activas</option>
              <option value="paused">Solo pausadas</option>
            </select>
          </div>
        </div>

        {/* Interactive Type Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({surveysMatchingHotel.length})
          </button>
          {SURVEY_TYPES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setTypeFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === st
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {SURVEY_TYPE_LABELS[st]} ({countsByType[st]})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredSurveys.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800">
              No hay encuestas que coincidan con este filtro
            </p>
            <button
              type="button"
              onClick={() => {
                setHotelFilter('all');
                setTypeFilter('all');
                setStatusFilter('all');
                setSearchTerm('');
              }}
              className="text-xs font-medium text-teal-800 hover:text-teal-950 cursor-pointer"
            >
              Mostrar todas las encuestas
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5 font-medium">Encuesta y establecimiento</th>
                  <th className="py-3 px-4 font-medium">Hotel</th>
                  <th className="py-3 px-4 font-medium">Tipo</th>
                  <th className="py-3 px-4 font-medium">Estado</th>
                  <th className="py-3 px-4 text-right font-medium">Preguntas</th>
                  <th className="py-3 px-5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredSurveys.map((s) => {
                  const isSelected = s.id === selectedSurveyId;
                  const resolvedType = resolveSurveyType(s);
                  const resolvedHotel = resolveHotelLocation(s);
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-teal-50/35' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3.5 px-5">
                        <button
                          type="button"
                          onClick={() => onSelectSurvey(s.id, 'analytics')}
                          className="text-left group cursor-pointer"
                        >
                          <p className="font-semibold text-slate-900 group-hover:text-teal-800 transition-colors">
                            {s.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{s.hotelName}</p>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                        {resolvedHotel}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {SURVEY_TYPE_LABELS[resolvedType]}
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            s.status === 'active'
                              ? 'font-medium text-emerald-700'
                              : 'font-medium text-slate-500'
                          }
                        >
                          {s.status === 'active' ? 'Activa' : 'Pausada'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                        {s.questions.length}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectSurvey(s.id, 'analytics')}
                            title="Ver análisis y resultados"
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectSurvey(s.id, 'builder')}
                            title="Editar encuesta"
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onShare(s)}
                            title="Compartir enlace y QR"
                            className="p-2 text-slate-500 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPreview(s)}
                            title="Probar como huésped"
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleStatus(s)}
                            title={s.status === 'active' ? 'Pausar encuesta' : 'Activar encuesta'}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            {s.status === 'active' ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(s)}
                            title="Eliminar encuesta"
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
