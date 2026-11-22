import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import type { Room, RoomStatus } from '../types/hotelOps';
import {
  compareRoomNumbers,
  isRoomReady,
  ROOM_STATUS_META,
  ROOM_STATUS_ORDER,
} from '../types/hotelOps';

const INITIAL_COLUMN_LIMIT = 30;

export function HousekeepingView({
  onGoToCatalog,
}: {
  onGoToCatalog?: () => void;
}) {
  const {
    hotels,
    rooms,
    camaristas,
    loading,
    error,
    reload,
    hotelById,
    assignmentByRoomId,
    changeRoomStatus,
    assignCamarista,
    assignCamaristaByFloor,
  } = useHotelOps();

  // Board filters
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [edificioFilter, setEdificioFilter] = useState<string>('all');
  const [pisoFilter, setPisoFilter] = useState<string>('all');
  const [camaristaFilter, setCamaristaFilter] = useState<string>('all');
  const [mobileActiveStatus, setMobileActiveStatus] = useState<RoomStatus>('sucia');
  const [columnLimits, setColumnLimits] = useState<Record<RoomStatus, number>>({
    sucia: INITIAL_COLUMN_LIMIT,
    en_limpieza: INITIAL_COLUMN_LIMIT,
    limpia: INITIAL_COLUMN_LIMIT,
    inspeccionada: INITIAL_COLUMN_LIMIT,
    fuera_de_servicio: INITIAL_COLUMN_LIMIT,
  });

  // Bulk floor assignment panel state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkHotelId, setBulkHotelId] = useState<string>('castilla');
  const [bulkEdificio, setBulkEdificio] = useState<string>('');
  const [bulkPiso, setBulkPiso] = useState<string>('');
  const [bulkCamaristaId, setBulkCamaristaId] = useState<string>('');
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);

  // Filter options
  const roomsForHotel = useMemo(
    () => (hotelFilter === 'all' ? rooms : rooms.filter((r) => r.hotelId === hotelFilter)),
    [rooms, hotelFilter]
  );

  const edificioOptions = useMemo(
    () =>
      Array.from(new Set(roomsForHotel.map((r) => r.edificio))).sort((a, b) =>
        a.localeCompare(b, 'es')
      ),
    [roomsForHotel]
  );

  const roomsForEdificio = useMemo(
    () =>
      edificioFilter === 'all'
        ? roomsForHotel
        : roomsForHotel.filter((r) => r.edificio === edificioFilter),
    [roomsForHotel, edificioFilter]
  );

  const pisoOptions = useMemo(
    () => Array.from(new Set(roomsForEdificio.map((r) => r.piso))).sort((a, b) => a - b),
    [roomsForEdificio]
  );

  // Bulk assignment cascading options
  const bulkEdificioOptions = useMemo(
    () =>
      Array.from(
        new Set(rooms.filter((r) => r.hotelId === bulkHotelId).map((r) => r.edificio))
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [rooms, bulkHotelId]
  );

  const effectiveBulkEdificio = bulkEdificioOptions.includes(bulkEdificio)
    ? bulkEdificio
    : bulkEdificioOptions[0] ?? '';

  const bulkPisoOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rooms
            .filter((r) => r.hotelId === bulkHotelId && r.edificio === effectiveBulkEdificio)
            .map((r) => r.piso)
        )
      ).sort((a, b) => a - b),
    [rooms, bulkHotelId, effectiveBulkEdificio]
  );

  const effectiveBulkPiso = bulkPisoOptions.some((p) => String(p) === bulkPiso)
    ? bulkPiso
    : bulkPisoOptions[0] !== undefined
      ? String(bulkPisoOptions[0])
      : '';

  const bulkMatchingCount = useMemo(() => {
    if (!effectiveBulkEdificio || effectiveBulkPiso === '') return 0;
    const pisoNum = Number.parseInt(effectiveBulkPiso, 10);
    return rooms.filter(
      (r) =>
        r.hotelId === bulkHotelId &&
        r.edificio === effectiveBulkEdificio &&
        r.piso === pisoNum
    ).length;
  }, [rooms, bulkHotelId, effectiveBulkEdificio, effectiveBulkPiso]);

  // Filtered rooms for Kanban
  const filteredRooms = useMemo(() => {
    return rooms
      .filter((r) => {
        if (hotelFilter !== 'all' && r.hotelId !== hotelFilter) return false;
        if (edificioFilter !== 'all' && r.edificio !== edificioFilter) return false;
        if (pisoFilter !== 'all' && String(r.piso) !== pisoFilter) return false;
        if (camaristaFilter !== 'all') {
          const assigned = assignmentByRoomId.get(r.id) ?? null;
          if (camaristaFilter === 'unassigned') {
            if (assigned !== null) return false;
          } else if (assigned !== camaristaFilter) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (a.piso !== b.piso) return a.piso - b.piso;
        return compareRoomNumbers(a.numero, b.numero);
      });
  }, [rooms, hotelFilter, edificioFilter, pisoFilter, camaristaFilter, assignmentByRoomId]);

  const roomsByStatus = useMemo(() => {
    const grouped: Record<RoomStatus, Room[]> = {
      sucia: [],
      en_limpieza: [],
      limpia: [],
      inspeccionada: [],
      fuera_de_servicio: [],
    };
    for (const r of filteredRooms) {
      grouped[r.estado].push(r);
    }
    return grouped;
  }, [filteredRooms]);

  const summary = useMemo(() => {
    const total = filteredRooms.length;
    const readyCount = filteredRooms.filter((r) => isRoomReady(r.estado)).length;
    const readyPct = total > 0 ? Math.round((readyCount / total) * 100) : 0;
    return { total, readyCount, readyPct };
  }, [filteredRooms]);

  const hasFilters =
    hotelFilter !== 'all' ||
    edificioFilter !== 'all' ||
    pisoFilter !== 'all' ||
    camaristaFilter !== 'all';

  const resetFilters = () => {
    setHotelFilter('all');
    setEdificioFilter('all');
    setPisoFilter('all');
    setCamaristaFilter('all');
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBulkEdificio || effectiveBulkPiso === '') return;

    setBulkApplying(true);
    setBulkFeedback(null);
    try {
      const pisoNum = Number.parseInt(effectiveBulkPiso, 10);
      const camaristaId = bulkCamaristaId === '' ? null : bulkCamaristaId;
      const count = await assignCamaristaByFloor({
        hotelId: bulkHotelId,
        edificio: effectiveBulkEdificio,
        piso: pisoNum,
        camaristaId,
      });
      const camName = camaristaId
        ? camaristas.find((c) => c.id === camaristaId)?.nombre ?? 'Camarista'
        : 'Sin asignar';
      setBulkFeedback(
        `${count} habitaciones del piso ${pisoNum} (${effectiveBulkEdificio}) actualizadas a: ${camName}.`
      );
    } finally {
      setBulkApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-white border border-slate-200 rounded-xl" />
        <div className="h-16 bg-white border border-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-96 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
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

  const selectedHotelObj = hotelFilter !== 'all' ? hotelById.get(hotelFilter) ?? null : null;
  const selectedHotelHasNoRooms =
    selectedHotelObj !== null && rooms.filter((r) => r.hotelId === selectedHotelObj.id).length === 0;

  const renderRoomCard = (room: Room) => {
    const meta = ROOM_STATUS_META[room.estado];
    const hotelName = hotelById.get(room.hotelId)?.nombre ?? room.hotelId;
    const assignedCamId = assignmentByRoomId.get(room.id) ?? '';

    return (
      <div
        key={room.id}
        className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 hover:border-slate-300 transition-colors"
      >
        {/* Top Row: Room Number + Location Meta */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                {room.numero}
              </span>
              <span className="text-xs font-medium text-slate-500">Piso {room.piso}</span>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {hotelName} · {room.edificio} · {room.vista}
            </p>
          </div>
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${meta.swatchClass}`}
            aria-hidden="true"
          />
        </div>

        {/* Individual Camarista Selector */}
        <div>
          <select
            value={assignedCamId}
            onChange={(e) =>
              void assignCamarista(room.id, e.target.value === '' ? null : e.target.value)
            }
            aria-label={`Camarista asignada a habitación ${room.numero}`}
            className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-teal-700 focus:outline-none"
          >
            <option value="">Sin camarista asignada</option>
            {camaristas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Primary One-Tap Advance Action (Large Touch Target on Mobile) */}
        {meta.nextStatus && meta.nextActionLabel && (
          <button
            type="button"
            onClick={() => void changeRoomStatus(room.id, meta.nextStatus!)}
            className="w-full min-h-[44px] lg:min-h-[36px] px-3 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>{meta.nextActionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Direct One-Tap Status Grid for any status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-1.5 pt-0.5">
          {ROOM_STATUS_ORDER.filter((st) => st !== room.estado && st !== meta.nextStatus).map(
            (targetStatus) => {
              const targetMeta = ROOM_STATUS_META[targetStatus];
              return (
                <button
                  key={targetStatus}
                  type="button"
                  onClick={() => void changeRoomStatus(room.id, targetStatus)}
                  className="min-h-[40px] lg:min-h-[30px] px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${targetMeta.swatchClass}`} />
                  <span className="truncate">{targetMeta.shortLabel}</span>
                </button>
              );
            }
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header + Bulk Assign Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Housekeeping</h2>
          <p className="text-sm text-slate-600">
            Tablero operativo de limpieza, inspección y asignación de camaristas en tiempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setBulkOpen((v) => !v);
            setBulkFeedback(null);
          }}
          className={`inline-flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
            bulkOpen
              ? 'bg-teal-700 text-white border-teal-700'
              : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Asignación masiva por piso
        </button>
      </div>

      {/* Top Operational Summary: Counts by Status + % Ready */}
      <section
        aria-label="Resumen de estado de habitaciones"
        className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-slate-500">
              Disponibilidad de limpieza (Limpias + Inspeccionadas)
            </p>
            <div className="flex items-baseline gap-2.5 font-mono tabular-nums">
              <span className="text-3xl font-bold text-slate-900">{summary.readyPct}%</span>
              <span className="text-xs text-slate-600">
                {summary.readyCount} de {summary.total} habitaciones listas
              </span>
            </div>
          </div>

          <div className="w-full sm:w-64 space-y-1.5">
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-700 rounded-full transition-all duration-300"
                style={{ width: `${summary.readyPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums">
              <span>0%</span>
              <span>Meta 100%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          {ROOM_STATUS_ORDER.map((status) => {
            const meta = ROOM_STATUS_META[status];
            const count = roomsByStatus[status].length;
            const isMobileSelected = mobileActiveStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setMobileActiveStatus(status)}
                className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                  isMobileSelected
                    ? 'border-slate-900 bg-slate-50 lg:border-slate-200 lg:bg-white'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.swatchClass}`} />
                  <span className="text-xs font-medium text-slate-600 truncate">{meta.label}</span>
                </div>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {count}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Collapsible Bulk Floor Assignment Panel */}
      {bulkOpen && (
        <section className="bg-white border border-teal-700/40 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Asignar camarista a un piso completo
              </h3>
              <p className="text-xs text-slate-600">
                Selecciona hotel, edificio y piso para asignar o liberar todas sus habitaciones en
                un paso.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              aria-label="Cerrar asignación masiva"
              className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={handleBulkAssign}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Hotel</label>
              <select
                value={bulkHotelId}
                onChange={(e) => {
                  setBulkHotelId(e.target.value);
                  setBulkEdificio('');
                  setBulkPiso('');
                }}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Edificio</label>
              <select
                value={effectiveBulkEdificio}
                onChange={(e) => {
                  setBulkEdificio(e.target.value);
                  setBulkPiso('');
                }}
                disabled={bulkEdificioOptions.length === 0}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none disabled:bg-slate-50"
              >
                {bulkEdificioOptions.length === 0 ? (
                  <option value="">Sin edificios cargados</option>
                ) : (
                  bulkEdificioOptions.map((ed) => (
                    <option key={ed} value={ed}>
                      {ed}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Piso</label>
              <select
                value={effectiveBulkPiso}
                onChange={(e) => setBulkPiso(e.target.value)}
                disabled={bulkPisoOptions.length === 0}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none disabled:bg-slate-50"
              >
                {bulkPisoOptions.length === 0 ? (
                  <option value="">Sin pisos</option>
                ) : (
                  bulkPisoOptions.map((p) => (
                    <option key={p} value={String(p)}>
                      Piso {p}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">Camarista</label>
              <select
                value={bulkCamaristaId}
                onChange={(e) => setBulkCamaristaId(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
              >
                <option value="">Quitar asignación</option>
                {camaristas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={bulkApplying || bulkMatchingCount === 0}
              className="w-full h-10 px-4 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
            >
              {bulkApplying
                ? 'Asignando...'
                : `Aplicar (${bulkMatchingCount} hab.)`}
            </button>
          </form>

          {bulkFeedback && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{bulkFeedback}</span>
            </div>
          )}
        </section>
      )}

      {/* Filters Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={hotelFilter}
            onChange={(e) => {
              setHotelFilter(e.target.value);
              setEdificioFilter('all');
              setPisoFilter('all');
            }}
            aria-label="Filtrar housekeeping por hotel"
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
            onChange={(e) => {
              setEdificioFilter(e.target.value);
              setPisoFilter('all');
            }}
            aria-label="Filtrar housekeeping por edificio"
            disabled={edificioOptions.length === 0}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="all">Todos los edificios</option>
            {edificioOptions.map((ed) => (
              <option key={ed} value={ed}>
                {ed}
              </option>
            ))}
          </select>

          <select
            value={pisoFilter}
            onChange={(e) => setPisoFilter(e.target.value)}
            aria-label="Filtrar housekeeping por piso"
            disabled={pisoOptions.length === 0}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="all">Todos los pisos</option>
            {pisoOptions.map((p) => (
              <option key={p} value={String(p)}>
                Piso {p}
              </option>
            ))}
          </select>

          <select
            value={camaristaFilter}
            onChange={(e) => setCamaristaFilter(e.target.value)}
            aria-label="Filtrar housekeeping por camarista"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Todas las camaristas</option>
            <option value="unassigned">Sin asignar</option>
            {camaristas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="font-mono tabular-nums">
              {filteredRooms.length} habitaciones en vista
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-teal-800 font-medium hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          </div>
        )}
      </section>

      {/* Empty state for Granada / Marina or empty filter */}
      {selectedHotelHasNoRooms && selectedHotelObj ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4">
          <BedDouble className="w-9 h-9 text-slate-400 mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {selectedHotelObj.nombre} no tiene habitaciones cargadas
            </h3>
            <p className="text-sm text-slate-600">
              Carga las {selectedHotelObj.totalRooms} habitaciones desde el Catálogo para gestionar
              su operación de Housekeeping.
            </p>
          </div>
          {onGoToCatalog && (
            <button
              type="button"
              onClick={onGoToCatalog}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Ir al Catálogo de Habitaciones
            </button>
          )}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <h3 className="text-base font-bold text-slate-900">No hay habitaciones con estos filtros</h3>
          <p className="text-sm text-slate-600">
            Ajusta el hotel, edificio, piso o camarista para ver tareas disponibles.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer filtros
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Single-Column Focus View (< lg) with Large Touch Targets */}
          <section className="lg:hidden space-y-3" aria-label="Columna activa en móvil">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${ROOM_STATUS_META[mobileActiveStatus].swatchClass}`}
                />
                <h3 className="text-sm font-bold text-slate-900">
                  {ROOM_STATUS_META[mobileActiveStatus].label}
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {roomsByStatus[mobileActiveStatus].length} habitaciones
              </span>
            </div>

            {roomsByStatus[mobileActiveStatus].length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                No hay habitaciones en estado {ROOM_STATUS_META[mobileActiveStatus].label.toLowerCase()}.
              </div>
            ) : (
              <div className="space-y-3">
                {roomsByStatus[mobileActiveStatus]
                  .slice(0, columnLimits[mobileActiveStatus])
                  .map(renderRoomCard)}

                {roomsByStatus[mobileActiveStatus].length > columnLimits[mobileActiveStatus] && (
                  <button
                    type="button"
                    onClick={() =>
                      setColumnLimits((prev) => ({
                        ...prev,
                        [mobileActiveStatus]: prev[mobileActiveStatus] + INITIAL_COLUMN_LIMIT,
                      }))
                    }
                    className="w-full min-h-[44px] py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Mostrar más (
                    {roomsByStatus[mobileActiveStatus].length - columnLimits[mobileActiveStatus]}{' '}
                    restantes)
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Desktop 5-Column Kanban Board (lg+) */}
          <section
            className="hidden lg:grid lg:grid-cols-5 gap-4 items-start"
            aria-label="Tablero kanban de housekeeping"
          >
            {ROOM_STATUS_ORDER.map((status) => {
              const meta = ROOM_STATUS_META[status];
              const list = roomsByStatus[status];
              const limit = columnLimits[status];
              const visibleList = list.slice(0, limit);

              return (
                <div
                  key={status}
                  className={`bg-slate-100/70 border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[74vh] ${meta.columnHeaderClass}`}
                >
                  <div className="px-3.5 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.swatchClass}`} />
                      <h3 className="text-xs font-bold text-slate-900 truncate">{meta.label}</h3>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums shrink-0">
                      {list.length}
                    </span>
                  </div>

                  <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                    {list.length === 0 ? (
                      <div className="py-10 px-3 text-center text-xs text-slate-400">
                        Sin habitaciones
                      </div>
                    ) : (
                      <>
                        {visibleList.map(renderRoomCard)}
                        {list.length > limit && (
                          <button
                            type="button"
                            onClick={() =>
                              setColumnLimits((prev) => ({
                                ...prev,
                                [status]: prev[status] + INITIAL_COLUMN_LIMIT,
                              }))
                            }
                            className="w-full py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            Ver más ({list.length - limit})
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
