import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Columns3,
  List,
  Plus,
  RotateCcw,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import type {
  MaintenanceTicket,
  TicketPriority,
  TicketStatus,
} from '../types/hotelOps';
import {
  compareRoomNumbers,
  ROOM_STATUS_META,
  TICKET_PRIORITY_META,
  TICKET_PRIORITY_ORDER,
  TICKET_STATUS_META,
  TICKET_STATUS_ORDER,
} from '../types/hotelOps';

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
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

export function MaintenanceView() {
  const {
    hotels,
    rooms,
    tickets,
    responsablesMantenimiento,
    loading,
    error,
    reload,
    hotelById,
    roomById,
    createTicket,
    updateTicket,
  } = useHotelOps();

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [hotelFilter, setHotelFilter] = useState('all');
  const [edificioFilter, setEdificioFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [responsableFilter, setResponsableFilter] = useState('all');

  // Create Ticket Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<TicketPriority>('media');
  const [responsable, setResponsable] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const edificioOptions = useMemo(() => {
    const source = hotelFilter === 'all' ? rooms : rooms.filter((r) => r.hotelId === hotelFilter);
    return Array.from(new Set(source.map((r) => r.edificio))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [rooms, hotelFilter]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const room = roomById.get(ticket.roomId);
      if (hotelFilter !== 'all' && room?.hotelId !== hotelFilter) return false;
      if (edificioFilter !== 'all' && room?.edificio !== edificioFilter) return false;
      if (priorityFilter !== 'all' && ticket.prioridad !== priorityFilter) return false;
      if (statusFilter !== 'all' && ticket.estado !== statusFilter) return false;
      if (responsableFilter !== 'all' && ticket.responsable !== responsableFilter) return false;
      if (q) {
        const hay = `${ticket.titulo} ${ticket.descripcion} ${room?.numero ?? ''} ${room?.edificio ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    tickets,
    roomById,
    hotelFilter,
    edificioFilter,
    priorityFilter,
    statusFilter,
    responsableFilter,
    searchQuery,
  ]);

  const ticketsByStatus = useMemo(() => {
    const grouped: Record<TicketStatus, MaintenanceTicket[]> = {
      abierto: [],
      en_progreso: [],
      resuelto: [],
    };
    for (const t of filteredTickets) {
      grouped[t.estado].push(t);
    }
    return grouped;
  }, [filteredTickets]);

  const summary = useMemo(() => {
    let abiertos = 0;
    let enProgreso = 0;
    let resueltos = 0;
    let urgentesAbiertos = 0;
    for (const t of filteredTickets) {
      if (t.estado === 'abierto') abiertos += 1;
      else if (t.estado === 'en_progreso') enProgreso += 1;
      else resueltos += 1;
      if (t.prioridad === 'urgente' && t.estado === 'abierto') urgentesAbiertos += 1;
    }
    return { abiertos, enProgreso, resueltos, urgentesAbiertos };
  }, [filteredTickets]);

  const matchingModalRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    const list = q
      ? rooms.filter(
          (r) =>
            r.numero.toLowerCase().includes(q) ||
            r.edificio.toLowerCase().includes(q) ||
            (hotelById.get(r.hotelId)?.nombre ?? '').toLowerCase().includes(q)
        )
      : rooms;
    return [...list]
      .sort((a, b) => compareRoomNumbers(a.numero, b.numero))
      .slice(0, 60);
  }, [rooms, roomSearch, hotelById]);

  const hasFilters =
    searchQuery.trim().length > 0 ||
    hotelFilter !== 'all' ||
    edificioFilter !== 'all' ||
    priorityFilter !== 'all' ||
    statusFilter !== 'all' ||
    responsableFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setHotelFilter('all');
    setEdificioFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
    setResponsableFilter('all');
  };

  const openModal = () => {
    setFormError(null);
    setRoomSearch('');
    setSelectedRoomId(rooms[0]?.id ?? '');
    setTitulo('');
    setDescripcion('');
    setPrioridad('media');
    setResponsable(responsablesMantenimiento[0] ?? '');
    setModalOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedRoomId) {
      setFormError('Selecciona una habitación.');
      return;
    }
    if (!titulo.trim()) {
      setFormError('Escribe un título para el ticket.');
      return;
    }
    setSaving(true);
    try {
      await createTicket({
        roomId: selectedRoomId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        prioridad,
        responsable: responsable || responsablesMantenimiento[0] || 'Mantenimiento',
        origen: 'manual',
      });
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el ticket.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-white border border-slate-200 rounded-xl" />
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

  const renderTicketCard = (ticket: MaintenanceTicket) => {
    const room = roomById.get(ticket.roomId);
    const hotelName = room ? hotelById.get(room.hotelId)?.nombre ?? room.hotelId : '—';
    const prioMeta = TICKET_PRIORITY_META[ticket.prioridad];
    const roomStatusMeta = room ? ROOM_STATUS_META[room.estado] : null;

    return (
      <div
        key={ticket.id}
        className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 hover:border-slate-300 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                Hab. {room?.numero ?? '—'}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600 truncate">
                {hotelName} · {room?.edificio ?? '—'} · P{room?.piso ?? '—'}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-snug">{ticket.titulo}</h4>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${prioMeta.textClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${prioMeta.swatchClass}`} />
            {prioMeta.label}
          </span>
        </div>

        {ticket.descripcion && (
          <p className="text-xs text-slate-600 leading-relaxed">{ticket.descripcion}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>
            Origen: <strong className="font-medium text-slate-700">{ticket.origen === 'encuesta' ? 'Encuesta' : 'Manual'}</strong>
          </span>
          <span>·</span>
          <span className="font-mono tabular-nums">Creado: {formatShortDate(ticket.fechaCreacion)}</span>
          {ticket.fechaCierre && (
            <>
              <span>·</span>
              <span className="font-mono tabular-nums">
                Cierre: {formatShortDate(ticket.fechaCierre)}
              </span>
            </>
          )}
        </div>

        {ticket.prioridad === 'urgente' && ticket.estado === 'abierto' && roomStatusMeta && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-rose-900 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>
              Habitación bloqueada automáticamente como <strong>{roomStatusMeta.label}</strong>
            </span>
          </div>
        )}

        {/* Inline Controls: Status + Priority + Responsable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <select
            value={ticket.estado}
            onChange={(e) =>
              void updateTicket(ticket.id, { estado: e.target.value as TicketStatus })
            }
            aria-label={`Estado de ticket ${ticket.titulo}`}
            className="w-full h-9 px-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-teal-700 focus:outline-none"
          >
            {TICKET_STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {TICKET_STATUS_META[st].label}
              </option>
            ))}
          </select>

          <select
            value={ticket.responsable}
            onChange={(e) => void updateTicket(ticket.id, { responsable: e.target.value })}
            aria-label={`Responsable de ticket ${ticket.titulo}`}
            className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-teal-700 focus:outline-none"
          >
            {responsablesMantenimiento.map((resp) => (
              <option key={resp} value={resp}>
                {resp}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Mantenimiento</h2>
          <p className="text-sm text-slate-600">
            Control de incidencias por habitación. Un ticket urgente abierto marca automáticamente la
            habitación como fuera de servicio.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Tablero
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
          </div>

          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo ticket
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Abiertos</p>
          <p className="font-mono text-2xl font-bold text-rose-700 tabular-nums">
            {summary.abiertos}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">En progreso</p>
          <p className="font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {summary.enProgreso}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Resueltos</p>
          <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {summary.resueltos}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Urgentes abiertos (F. servicio)</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary.urgentesAbiertos}
          </p>
        </div>
      </section>

      {/* Filters Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar hab. o falla..."
              aria-label="Buscar tickets por habitación o descripción"
              className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none"
            />
          </div>

          <select
            value={hotelFilter}
            onChange={(e) => {
              setHotelFilter(e.target.value);
              setEdificioFilter('all');
            }}
            aria-label="Filtrar tickets por hotel"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Todos los hoteles</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre}
              </option>
            ))}
          </select>

          <select
            value={edificioFilter}
            onChange={(e) => setEdificioFilter(e.target.value)}
            aria-label="Filtrar tickets por edificio"
            disabled={edificioOptions.length === 0}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none disabled:bg-slate-50"
          >
            <option value="all">Todos los edificios</option>
            {edificioOptions.map((ed) => (
              <option key={ed} value={ed}>
                {ed}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | TicketPriority)}
            aria-label="Filtrar tickets por prioridad"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Todas las prioridades</option>
            {TICKET_PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {TICKET_PRIORITY_META[p].label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | TicketStatus)}
            aria-label="Filtrar tickets por estado"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Todos los estados</option>
            {TICKET_STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {TICKET_STATUS_META[st].label}
              </option>
            ))}
          </select>

          <select
            value={responsableFilter}
            onChange={(e) => setResponsableFilter(e.target.value)}
            aria-label="Filtrar tickets por responsable"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Todos los responsables</option>
            {responsablesMantenimiento.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span className="font-mono tabular-nums">
            {filteredTickets.length} de {tickets.length} tickets
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-teal-800 font-medium hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {/* Board or List */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Wrench className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No hay tickets con estos filtros</h3>
            <p className="text-sm text-slate-600">
              Ajusta los filtros o registra una nueva orden de mantenimiento.
            </p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer filtros
            </button>
          )}
        </div>
      ) : viewMode === 'board' ? (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {TICKET_STATUS_ORDER.map((status) => {
            const meta = TICKET_STATUS_META[status];
            const list = ticketsByStatus[status];
            return (
              <div
                key={status}
                className={`bg-slate-100/70 border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[75vh] ${meta.columnHeaderClass}`}
              >
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${meta.swatchClass}`} />
                    <h3 className="text-xs font-bold text-slate-900">{meta.label}</h3>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                    {list.length}
                  </span>
                </div>
                <div className="p-3 space-y-3 overflow-y-auto flex-1">
                  {list.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-400">Sin tickets</p>
                  ) : (
                    list.map(renderTicketCard)
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Habitación</th>
                  <th className="py-3 px-4">Incidencia</th>
                  <th className="py-3 px-4">Prioridad</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Origen</th>
                  <th className="py-3 px-4">Fechas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTickets.map((ticket) => {
                  const room = roomById.get(ticket.roomId);
                  const hotelName = room ? hotelById.get(room.hotelId)?.nombre ?? room.hotelId : '—';
                  const prioMeta = TICKET_PRIORITY_META[ticket.prioridad];
                  return (
                    <tr key={ticket.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 block tabular-nums">
                          {room?.numero ?? '—'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {hotelName} · {room?.edificio ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="font-semibold text-slate-900">{ticket.titulo}</p>
                        {ticket.descripcion && (
                          <p className="text-slate-500 truncate mt-0.5">{ticket.descripcion}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={ticket.prioridad}
                          onChange={(e) =>
                            void updateTicket(ticket.id, {
                              prioridad: e.target.value as TicketPriority,
                            })
                          }
                          aria-label={`Cambiar prioridad de ${ticket.titulo}`}
                          className={`h-8 px-2 text-xs font-semibold bg-white border border-slate-200 rounded-md ${prioMeta.textClass}`}
                        >
                          {TICKET_PRIORITY_ORDER.map((p) => (
                            <option key={p} value={p}>
                              {TICKET_PRIORITY_META[p].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={ticket.estado}
                          onChange={(e) =>
                            void updateTicket(ticket.id, {
                              estado: e.target.value as TicketStatus,
                            })
                          }
                          aria-label={`Cambiar estado de ${ticket.titulo}`}
                          className="h-8 px-2 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-800"
                        >
                          {TICKET_STATUS_ORDER.map((st) => (
                            <option key={st} value={st}>
                              {TICKET_STATUS_META[st].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={ticket.responsable}
                          onChange={(e) =>
                            void updateTicket(ticket.id, { responsable: e.target.value })
                          }
                          aria-label={`Reasignar responsable de ${ticket.titulo}`}
                          className="h-8 px-2 text-xs bg-white border border-slate-200 rounded-md text-slate-800"
                        >
                          {responsablesMantenimiento.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {ticket.origen === 'encuesta' ? 'Encuesta' : 'Manual'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500 tabular-nums">
                        <div>Alta: {formatShortDate(ticket.fechaCreacion)}</div>
                        {ticket.fechaCierre && <div>Cierre: {formatShortDate(ticket.fechaCierre)}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Create Ticket Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="ticket-modal-title" className="text-base font-bold text-slate-900">
                Nuevo ticket de mantenimiento
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

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Habitación asociada
                </label>
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Filtrar habitación por número o edificio..."
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-700 focus:outline-none"
                />
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                  required
                >
                  {matchingModalRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Hab. {r.numero} · {hotelById.get(r.hotelId)?.nombre ?? r.hotelId} · {r.edificio} · P{r.piso}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej. Fuga en regadera o A/C sin enfriar"
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Descripción</label>
                <textarea
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalles técnicos o reporte del área..."
                  className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Prioridad</label>
                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as TicketPriority)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                  >
                    {TICKET_PRIORITY_ORDER.map((p) => (
                      <option key={p} value={p}>
                        {TICKET_PRIORITY_META[p].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Responsable</label>
                  <select
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                  >
                    {responsablesMantenimiento.map((resp) => (
                      <option key={resp} value={resp}>
                        {resp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {prioridad === 'urgente' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    Al crear este ticket urgente abierto, la habitación pasará automáticamente a{' '}
                    <strong>Fuera de servicio</strong>.
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {saving ? 'Creando...' : 'Crear ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
