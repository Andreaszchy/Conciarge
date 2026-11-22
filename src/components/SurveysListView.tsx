import React from 'react';
import {
  BarChart3,
  Edit3,
  ExternalLink,
  Pause,
  Play,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import type { Survey } from '../types';

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
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Mis encuestas hoteleras</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestiona todas las encuestas activas, enlaces online y códigos QR de tus alojamientos
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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-3 px-5 font-medium">Encuesta y hotel</th>
                <th className="py-3 px-4 font-medium">Estado</th>
                <th className="py-3 px-4 font-medium">Modalidad huésped</th>
                <th className="py-3 px-4 text-right font-medium">Preguntas</th>
                <th className="py-3 px-5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {surveys.map((s) => {
                const isSelected = s.id === selectedSurveyId;
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
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {s.allowAnonymous ? 'Anónima sin registro' : 'Datos básicos'}
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
      </div>
    </div>
  );
}
