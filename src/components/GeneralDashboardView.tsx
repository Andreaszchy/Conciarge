import React from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import type { Survey } from '../types';

interface GeneralDashboardViewProps {
  userName?: string | null;
  surveys: Survey[];
  loading: boolean;
  onOpenEncuestas: () => void;
}

export function GeneralDashboardView({
  userName,
  surveys,
  loading,
  onOpenEncuestas,
}: GeneralDashboardViewProps) {
  const activeCount = surveys.filter((s) => s.status === 'active').length;

  return (
    <div className="space-y-8">
      <section className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">
          {userName ? `Hola, ${userName}` : 'Espacio de gestión hotelera'}
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Panel general</h2>
        <p className="text-sm text-slate-600 max-w-2xl">
          Accede a los módulos operativos de tu hotel desde un solo lugar.
        </p>
      </section>

      <section aria-label="Secciones disponibles">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button
            type="button"
            onClick={onOpenEncuestas}
            className="group text-left bg-white border border-slate-200 rounded-2xl p-6 hover:border-teal-700 transition-colors flex flex-col justify-between gap-6 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                  Encuestas
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Encuestas de satisfacción online sin registro para huéspedes, exportación a Excel
                  y análisis automático de opiniones.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              {loading ? (
                <span>Cargando estado...</span>
              ) : surveys.length > 0 ? (
                <span className="font-mono tabular-nums">
                  {surveys.length} {surveys.length === 1 ? 'encuesta' : 'encuestas'} · {activeCount}{' '}
                  {activeCount === 1 ? 'activa' : 'activas'}
                </span>
              ) : (
                <span>Listo para crear tu primera encuesta</span>
              )}
              <span className="font-medium text-teal-800">Abrir</span>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
