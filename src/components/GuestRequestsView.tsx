import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import type { GuestRequestStatus, GuestRequestType } from '../types/hotelOps';
import {
  compareRoomNumbers,
  GUEST_REQUEST_TYPE_META,
  GUEST_REQUEST_TYPES,
} from '../types/hotelOps';

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function GuestRequestsView() {
  const {
    hotels,
    rooms,
    solicitudes,
    loading,
    error,
    reload,
    hotelById,
    roomById,
    createGuestRequest,
    updateGuestRequestStatus,
  } = useHotelOps();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GuestRequestStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | GuestRequestType>('all');
  const [hotelFilter, setHotelFilter] = useState('all');

  // New request modal
  const [modalOpen, setModalOpen] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [tipo, setTipo] = useState<GuestRequestType>('toallas');
  const [descripcion, setDescripcion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return solicitudes.filter((req) => {
      const room = roomById.get(req.roomId);
      if (statusFilter !== 'all' && req.estado !== statusFilter) return false;
      if (typeFilter !== 'all' && req.tipo !== typeFilter) return false;
      if (hotelFilter !== 'all' && room?.hotelId !== hotelFilter) return false;
      if (q) {
        const hay = `${req.descripcion} ${room?.numero ?? ''} ${room?.edificio ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [solicitudes, roomById, statusFilter, typeFilter, hotelFilter, searchQuery]);

  const counts = useMemo(() => {
    let pendientes = 0;
    let atendidas = 0;
    let quejasPendientes = 0;
    for (const r of solicitudes) {
      if (r.estado === 'pendiente') {
        pendientes += 1;
        if (r.tipo === 'queja') quejasPendientes += 1;
      } else {
        atendidas += 1;
      }
    }
    return { pendientes, atendidas, quejasPendientes, total: solicitudes.length };
  }, [solicitudes]);

  const modalRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    const list = q
      ? rooms.filter(
          (r) =>
            r.numero.toLowerCase().includes(q) ||
            r.edificio.toLowerCase().includes(q) ||
            (hotelById.get(r.hotelId)?.nombre ?? '').toLowerCase().includes(q)
        )
      : rooms;
    return [...list].sort((a, b) => compareRoomNumbers(a.numero, b.numero)).slice(0, 60);
  }, [rooms, roomSearch, hotelById]);

  const openModal = () => {
    setFormError(null);
    setRoomSearch('');
    setSelectedRoomId(rooms[0]?.id ?? '');
    setTipo('toallas');
    setDescripcion('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedRoomId) {
      setFormError('Selecciona una habitación.');
      return;
    }
    if (!descripcion.trim()) {
      setFormError('Describe la solicitud del huésped.');
      return;
    }
    setSaving(true);
    try {
      await createGuestRequest({
        roomId: selectedRoomId,
        tipo,
        descripcion: descripcion.trim(),
      });
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo registrar la solicitud.');
    } finally {
      setSaving(false);
    }
  };

  const hasFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    hotelFilter !== 'all';

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <p className="text-sm text-slate-600">{error}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Solicitudes de Huéspedes
          </h2>
          <p className="text-sm text-slate-600">
            Atención rápida de toallas, objetos olvidados, quejas y peticiones asociadas a cada
            habitación.
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Registrar solicitud
        </button>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Pendientes</p>
          <p className="font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {counts.pendientes}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Quejas pendientes</p>
          <p className="font-mono text-2xl font-bold text-rose-700 tabular-nums">
            {counts.quejasPendientes}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Atendidas</p>
          <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {counts.atendidas}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Total registradas</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">{counts.total}</p>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar habitación o detalle..."
              className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-700 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | GuestRequestStatus)}
            aria-label="Filtrar solicitudes por estado"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="atendida">Atendidas</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | GuestRequestType)}
            aria-label="Filtrar solicitudes por tipo"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="all">Todos los tipos</option>
            {GUEST_REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {GUEST_REQUEST_TYPE_META[t].label}
              </option>
            ))}
          </select>

          <select
            value={hotelFilter}
            onChange={(e) => setHotelFilter(e.target.value)}
            aria-label="Filtrar solicitudes por hotel"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="all">Todos los hoteles</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span className="font-mono tabular-nums">
            Mostrando {filteredRequests.length} de {solicitudes.length} solicitudes
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
                setHotelFilter('all');
              }}
              className="inline-flex items-center gap-1 text-teal-800 font-medium hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <Bell className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Sin solicitudes con estos filtros</h3>
          <p className="text-sm text-slate-600">
            Ajusta los filtros o registra una nueva petición de huésped.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredRequests.map((req) => {
            const room = roomById.get(req.roomId);
            const hotelName = room ? hotelById.get(room.hotelId)?.nombre ?? room.hotelId : '—';
            const typeMeta = GUEST_REQUEST_TYPE_META[req.tipo];
            const isPending = req.estado === 'pendiente';

            return (
              <article
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          Hab. {room?.numero ?? '—'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600">
                          {hotelName} · {room?.edificio ?? '—'} · P{room?.piso ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`w-2 h-2 rounded-full ${typeMeta.swatchClass}`} />
                        <span className={`text-xs font-semibold ${typeMeta.textClass}`}>
                          {typeMeta.label}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatShortDate(req.fecha)}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                        isPending ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {isPending ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {isPending ? 'Pendiente' : 'Atendida'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{req.descripcion}</p>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex justify-end">
                  {isPending ? (
                    <button
                      type="button"
                      onClick={() => void updateGuestRequestStatus(req.id, 'atendida')}
                      className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
                    >
                      Marcar como atendida
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void updateGuestRequestStatus(req.id, 'pendiente')}
                      className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Reabrir solicitud
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* New Request Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="request-modal-title" className="text-base font-bold text-slate-900">
                Registrar solicitud de huésped
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar modal"
                className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Habitación</label>
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Filtrar por número o edificio..."
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  required
                >
                  {modalRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Hab. {r.numero} · {hotelById.get(r.hotelId)?.nombre ?? r.hotelId} · {r.edificio} · P{r.piso}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as GuestRequestType)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  {GUEST_REQUEST_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {GUEST_REQUEST_TYPE_META[t].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Descripción</label>
                <textarea
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Solicita 2 toallas extra de alberca antes de las 17:00..."
                  className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg resize-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
