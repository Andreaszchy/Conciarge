import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BedDouble,
  Bell,
  ClipboardList,
  Grid2x2,
  KeyRound,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import type { Survey } from '../types';
import { isRoomReady, SURVEY_AREA_KEYS, toLocalIsoDate } from '../types/hotelOps';

export type MainDashboardSection =
  | 'catalogo'
  | 'housekeeping'
  | 'plano'
  | 'mantenimiento'
  | 'recepcion'
  | 'encuestas'
  | 'solicitudes'
  | 'reportes';

interface GeneralDashboardViewProps {
  userName?: string | null;
  surveys: Survey[];
  loading: boolean;
  onOpenSection: (section: MainDashboardSection) => void;
}

export function GeneralDashboardView({
  userName,
  surveys,
  loading,
  onOpenSection,
}: GeneralDashboardViewProps) {
  const {
    hotels,
    rooms,
    tickets,
    estancias,
    roomSurveys,
    solicitudes,
    unreadAlerts,
    dismissAlert,
    loading: opsLoading,
  } = useHotelOps();

  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const activeGeneralSurveys = surveys.filter((s) => s.status === 'active').length;

  const summary = useMemo(() => {
    const totalCapacity = hotels.reduce((acc, h) => acc + h.totalRooms, 0);
    const loadedCount = rooms.length;
    const readyCount = rooms.filter((r) => isRoomReady(r.estado)).length;
    const readyPct = loadedCount > 0 ? Math.round((readyCount / loadedCount) * 100) : 0;
    const dirtyCount = rooms.filter((r) => r.estado === 'sucia').length;
    const buildingsCount = new Set(rooms.map((r) => `${r.hotelId}|${r.edificio}`)).size;

    const openTickets = tickets.filter((t) => t.estado !== 'resuelto').length;
    const urgentOpenTickets = tickets.filter(
      (t) => t.prioridad === 'urgente' && t.estado === 'abierto'
    ).length;

    const llegadasHoy = estancias.filter(
      (st) => st.fechaEntrada === todayIso && st.estado === 'reservada'
    ).length;
    const salidasHoy = estancias.filter(
      (st) => st.fechaSalida === todayIso && st.estado === 'en_casa'
    ).length;

    const pendingRequests = solicitudes.filter((s) => s.estado === 'pendiente').length;
    const pendingComplaints = solicitudes.filter(
      (s) => s.estado === 'pendiente' && s.tipo === 'queja'
    ).length;

    let csatPct = 0;
    if (roomSurveys.length > 0) {
      let totalScores = 0;
      let highScores = 0;
      for (const rs of roomSurveys) {
        for (const k of SURVEY_AREA_KEYS) {
          totalScores += 1;
          if (rs.calificaciones[k] >= 4) highScores += 1;
        }
      }
      csatPct = totalScores > 0 ? Math.round((highScores / totalScores) * 100) : 0;
    }

    return {
      totalCapacity,
      loadedCount,
      readyPct,
      dirtyCount,
      buildingsCount,
      openTickets,
      urgentOpenTickets,
      llegadasHoy,
      salidasHoy,
      pendingRequests,
      pendingComplaints,
      csatPct,
      roomSurveysCount: roomSurveys.length,
    };
  }, [hotels, rooms, tickets, estancias, solicitudes, roomSurveys, todayIso]);

  const cards: Array<{
    id: MainDashboardSection;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBgClass: string;
    stat: string;
  }> = [
    {
      id: 'catalogo',
      title: 'Catálogo de Habitaciones',
      description:
        'Inventario por hotel, edificio, piso y vista con validación única e importación/exportación CSV.',
      icon: BedDouble,
      iconBgClass: 'bg-slate-100 text-slate-800',
      stat: opsLoading
        ? 'Cargando inventario...'
        : `${summary.loadedCount} / ${summary.totalCapacity} hab. · ${hotels.length} hoteles`,
    },
    {
      id: 'housekeeping',
      title: 'Housekeeping',
      description:
        'Tablero kanban por estado, cambio a un toque y asignación individual o masiva por piso.',
      icon: Sparkles,
      iconBgClass: 'bg-amber-50 text-amber-800',
      stat: opsLoading
        ? 'Cargando estados...'
        : `${summary.readyPct}% listas · ${summary.dirtyCount} sucias`,
    },
    {
      id: 'plano',
      title: 'Plano por Piso',
      description:
        'Cuadrícula por edificio y piso agrupada por vista con buscador global de habitación.',
      icon: Grid2x2,
      iconBgClass: 'bg-sky-50 text-sky-800',
      stat: opsLoading
        ? 'Cargando edificios...'
        : `${summary.buildingsCount} edificios activos · Castilla y Moro`,
    },
    {
      id: 'mantenimiento',
      title: 'Mantenimiento',
      description:
        'Tickets ligados a habitación por prioridad y responsable con bloqueo automático en urgencias.',
      icon: Wrench,
      iconBgClass: 'bg-rose-50 text-rose-800',
      stat: opsLoading
        ? 'Cargando tickets...'
        : `${summary.openTickets} activos · ${summary.urgentOpenTickets} urgentes`,
    },
    {
      id: 'recepcion',
      title: 'Recepción',
      description:
        'Disponibilidad por fechas, búsqueda por vista y nivel de piso, llegadas, salidas y check-in/out.',
      icon: KeyRound,
      iconBgClass: 'bg-emerald-50 text-emerald-800',
      stat: opsLoading
        ? 'Cargando operación...'
        : `${summary.llegadasHoy} llegadas hoy · ${summary.salidasHoy} salidas hoy`,
    },
    {
      id: 'encuestas',
      title: 'Encuestas',
      description:
        'Encuestas QR por habitación con alertas automáticas y encuestas generales de satisfacción.',
      icon: ClipboardList,
      iconBgClass: 'bg-teal-50 text-teal-800',
      stat:
        opsLoading || loading
          ? 'Cargando encuestas...'
          : `${summary.roomSurveysCount} por habitación · ${activeGeneralSurveys} generales activas`,
    },
    {
      id: 'solicitudes',
      title: 'Solicitudes de Huéspedes',
      description:
        'Registro y atención de toallas, objetos olvidados, quejas y peticiones por habitación.',
      icon: Bell,
      iconBgClass: 'bg-amber-50 text-amber-800',
      stat: opsLoading
        ? 'Cargando solicitudes...'
        : `${summary.pendingRequests} pendientes · ${summary.pendingComplaints} quejas`,
    },
    {
      id: 'reportes',
      title: 'Reportes',
      description:
        'Ocupación, CSAT, NPS, rendimiento por torre/vista/piso, tendencia semanal y exportación CSV.',
      icon: BarChart3,
      iconBgClass: 'bg-slate-100 text-slate-900',
      stat: opsLoading
        ? 'Calculando indicadores...'
        : `CSAT ${summary.csatPct}% · n = ${summary.roomSurveysCount} respuestas`,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">
          {userName ? `Hola, ${userName}` : 'Espacio de gestión hotelera'}
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Panel general</h2>
        <p className="text-sm text-slate-600 max-w-2xl">
          Accede a los 8 módulos operativos de tu complejo hotelero desde un solo lugar.
        </p>
      </section>

      {/* Active Low-Score Survey Alerts */}
      {unreadAlerts.length > 0 && (
        <section aria-label="Alertas operativas activas" className="space-y-2">
          {unreadAlerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 text-xs text-rose-950">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{alert.mensaje}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onOpenSection(alert.tipoAccion === 'ticket' ? 'mantenimiento' : 'solicitudes')
                  }
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-800 cursor-pointer"
                >
                  Atender
                </button>
                <button
                  type="button"
                  onClick={() => void dismissAlert(alert.id)}
                  aria-label="Descartar alerta"
                  className="p-1 text-rose-700 hover:text-rose-950 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section aria-label="Secciones disponibles">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onOpenSection(card.id)}
                className="group text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-teal-700 transition-colors flex flex-col justify-between gap-5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBgClass}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-all" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{card.description}</p>
                  </div>
                </div>

                <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-mono tabular-nums truncate">{card.stat}</span>
                  <span className="font-medium text-teal-800 shrink-0">Abrir</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
