import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BedDouble,
  Clock,
  Map as MapIcon,
  MapPin,
  RotateCcw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import { RESORT_MAP_IMAGE_PATH } from '../services/hotelOpsRepository';
import type { Room, RoomStatus } from '../types/hotelOps';
import {
  compareRoomNumbers,
  getShortCamaristaName,
  ROOM_STATUS_META,
  ROOM_STATUS_ORDER,
} from '../types/hotelOps';

const PREFERRED_VIEW_ORDER: Record<string, string[]> = {
  'Torre El Moro': ['Alberca Gruta', 'La Concha', 'Alberca Moro'],
  'Lateral C': ['Alberca Castilla', 'Nivel playa', 'Alberca Moro'],
};

function formatHistoryDate(iso: string): string {
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

export function FloorPlanView({
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
    camaristaById,
    assignmentByRoomId,
    historyByRoomId,
    changeRoomStatus,
    assignCamarista,
  } = useHotelOps();

  // Default to Moro -> Torre El Moro so the multi-vista floor grouping is showcased right away
  const [selectedHotelId, setSelectedHotelId] = useState<string>('moro');
  const [selectedEdificio, setSelectedEdificio] = useState<string>('Torre El Moro');
  const [selectedPiso, setSelectedPiso] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showResortMap, setShowResortMap] = useState(false);

  // Global room locator search state
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [locatedRoomId, setLocatedRoomId] = useState<string | null>(null);
  const [searchNotFound, setSearchNotFound] = useState<string | null>(null);
  const roomCellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const roomsForHotel = useMemo(
    () => rooms.filter((r) => r.hotelId === selectedHotelId),
    [rooms, selectedHotelId]
  );

  const edificioOptions = useMemo(
    () =>
      Array.from(new Set(roomsForHotel.map((r) => r.edificio))).sort((a, b) =>
        a.localeCompare(b, 'es')
      ),
    [roomsForHotel]
  );

  const activeEdificio = edificioOptions.includes(selectedEdificio)
    ? selectedEdificio
    : edificioOptions[0] ?? '';

  const pisoOptions = useMemo(
    () =>
      Array.from(
        new Set(
          roomsForHotel.filter((r) => r.edificio === activeEdificio).map((r) => r.piso)
        )
      ).sort((a, b) => a - b),
    [roomsForHotel, activeEdificio]
  );

  const activePiso = pisoOptions.some((p) => String(p) === selectedPiso)
    ? selectedPiso
    : pisoOptions[0] !== undefined
      ? String(pisoOptions[0])
      : '';

  const floorRooms = useMemo(() => {
    if (!activeEdificio || activePiso === '') return [];
    const pisoNum = Number.parseInt(activePiso, 10);
    return roomsForHotel
      .filter((r) => r.edificio === activeEdificio && r.piso === pisoNum)
      .sort((a, b) => compareRoomNumbers(a.numero, b.numero));
  }, [roomsForHotel, activeEdificio, activePiso]);

  // Group rooms by vista, keeping rooms inside each vista sorted numerically
  const roomsByVista = useMemo(() => {
    const map = new Map<string, Room[]>();
    for (const room of floorRooms) {
      const existing = map.get(room.vista);
      if (existing) {
        existing.push(room);
      } else {
        map.set(room.vista, [room]);
      }
    }

    const preferred = PREFERRED_VIEW_ORDER[activeEdificio] ?? [];
    const entries = Array.from(map.entries()).map(([vista, list]) => ({
      vista,
      rooms: [...list].sort((a, b) => compareRoomNumbers(a.numero, b.numero)),
    }));

    entries.sort((a, b) => {
      const idxA = preferred.indexOf(a.vista);
      const idxB = preferred.indexOf(b.vista);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.vista.localeCompare(b.vista, 'es');
    });

    return entries;
  }, [floorRooms, activeEdificio]);

  const floorStatusCounts = useMemo(() => {
    const counts: Record<RoomStatus, number> = {
      sucia: 0,
      en_limpieza: 0,
      limpia: 0,
      inspeccionada: 0,
      fuera_de_servicio: 0,
    };
    for (const room of floorRooms) {
      counts[room.estado] += 1;
    }
    return counts;
  }, [floorRooms]);

  const selectedRoom = useMemo(
    () => (selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) ?? null : null),
    [rooms, selectedRoomId]
  );

  const selectedRoomHistory = useMemo(
    () => (selectedRoom ? historyByRoomId.get(selectedRoom.id) ?? [] : []),
    [selectedRoom, historyByRoomId]
  );

  const locatedRoom = useMemo(
    () => (locatedRoomId ? rooms.find((r) => r.id === locatedRoomId) ?? null : null),
    [rooms, locatedRoomId]
  );

  const searchMatches = useMemo(() => {
    const query = roomSearchQuery.trim().toLowerCase();
    if (!query) return [];
    const exact: Room[] = [];
    const prefix: Room[] = [];
    const partial: Room[] = [];

    for (const r of rooms) {
      const num = r.numero.toLowerCase();
      if (num === query) {
        exact.push(r);
      } else if (num.startsWith(query)) {
        prefix.push(r);
      } else if (num.includes(query)) {
        partial.push(r);
      }
    }

    prefix.sort((a, b) => compareRoomNumbers(a.numero, b.numero));
    partial.sort((a, b) => compareRoomNumbers(a.numero, b.numero));
    return [...exact, ...prefix, ...partial].slice(0, 8);
  }, [rooms, roomSearchQuery]);

  const locateRoom = (room: Room) => {
    setSelectedHotelId(room.hotelId);
    setSelectedEdificio(room.edificio);
    setSelectedPiso(String(room.piso));
    setLocatedRoomId(room.id);
    setRoomSearchQuery(room.numero);
    setSearchFocused(false);
    setSearchNotFound(null);
  };

  const handleRoomSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = roomSearchQuery.trim();
    if (!trimmed) {
      setLocatedRoomId(null);
      setSearchNotFound(null);
      return;
    }
    const exact = rooms.find((r) => r.numero.toLowerCase() === trimmed.toLowerCase());
    const target = exact ?? searchMatches[0] ?? null;
    if (target) {
      locateRoom(target);
    } else {
      setLocatedRoomId(null);
      setSearchNotFound(trimmed);
      setSearchFocused(false);
    }
  };

  useEffect(() => {
    if (!locatedRoomId) return;
    const frameId = window.requestAnimationFrame(() => {
      const el = roomCellRefs.current.get(locatedRoomId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [locatedRoomId, selectedHotelId, activeEdificio, activePiso]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-white border border-slate-200 rounded-xl" />
        <div className="h-14 bg-white border border-slate-200 rounded-xl" />
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

  const activeHotel = hotelById.get(selectedHotelId) ?? null;

  return (
    <div className="space-y-6">
      {/* Header + Resort Reference Map Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Plano por Piso</h2>
          <p className="text-sm text-slate-600">
            Visualización de habitaciones ordenadas por número y agrupadas por orientación o vista.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowResortMap(true)}
          className="inline-flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
        >
          <MapIcon className="w-4 h-4" />
          Plano general del complejo
        </button>
      </div>

      {/* Room Locator Search + Cascading Floor Selectors */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        {/* Global Room Search Bar */}
        <div className="space-y-2.5 pb-4 border-b border-slate-100">
          <form onSubmit={handleRoomSearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={roomSearchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => setSearchFocused(false), 160);
                }}
                onChange={(e) => {
                  setRoomSearchQuery(e.target.value);
                  setSearchNotFound(null);
                  setSearchFocused(true);
                  if (!e.target.value.trim()) {
                    setLocatedRoomId(null);
                  }
                }}
                placeholder="Buscar habitación en el plano (ej. 4124, 5101, 4097)..."
                aria-label="Buscar habitación para ubicarla en el plano"
                className="w-full h-10 pl-9 pr-9 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
              />
              {roomSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setRoomSearchQuery('');
                    setLocatedRoomId(null);
                    setSearchNotFound(null);
                  }}
                  aria-label="Limpiar búsqueda de habitación"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Live Search Suggestions Dropdown */}
              {searchFocused && roomSearchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {searchMatches.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-slate-500">
                      Sin habitaciones con el número «{roomSearchQuery.trim()}».
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                      {searchMatches.map((match) => {
                        const matchHotel = hotelById.get(match.hotelId)?.nombre ?? match.hotelId;
                        const matchMeta = ROOM_STATUS_META[match.estado];
                        return (
                          <li key={match.id}>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => locateRoom(match)}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                                    {match.numero}
                                  </span>
                                  <span className="text-xs text-slate-600 truncate">
                                    {matchHotel} · {match.edificio} · Piso {match.piso}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate">
                                  Vista: {match.vista}
                                </p>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0 ${matchMeta.textClass}`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${matchMeta.swatchClass}`}
                                />
                                {matchMeta.shortLabel}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              Ubicar en plano
            </button>
          </form>

          {searchNotFound && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              No se encontró ninguna habitación cargada con el número{' '}
              <span className="font-mono font-semibold">{searchNotFound}</span>.
            </p>
          )}

          {locatedRoom && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-teal-50/70 border border-teal-700/30 rounded-lg px-3.5 py-2.5">
              <div className="flex items-start sm:items-center gap-2 text-xs text-teal-950">
                <MapPin className="w-4 h-4 text-teal-700 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  Habitación{' '}
                  <strong className="font-mono tabular-nums">{locatedRoom.numero}</strong> ubicada
                  en{' '}
                  <strong>
                    {hotelById.get(locatedRoom.hotelId)?.nombre ?? locatedRoom.hotelId}
                  </strong>{' '}
                  · {locatedRoom.edificio} · <strong>Piso {locatedRoom.piso}</strong> · Vista{' '}
                  <strong>{locatedRoom.vista}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedRoomId(locatedRoom.id)}
                  className="px-2.5 py-1 text-xs font-semibold text-teal-900 bg-white border border-teal-700/30 rounded-md hover:bg-teal-50 cursor-pointer"
                >
                  Ver detalle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocatedRoomId(null);
                    setRoomSearchQuery('');
                  }}
                  aria-label="Cerrar ubicación resaltada"
                  className="p-1 text-teal-800 hover:text-teal-950 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">Hotel</label>
            <select
              value={selectedHotelId}
              onChange={(e) => {
                setSelectedHotelId(e.target.value);
                setSelectedEdificio('');
                setSelectedPiso('');
                setSelectedRoomId(null);
                setLocatedRoomId(null);
              }}
              aria-label="Seleccionar hotel para plano por piso"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              {hotels.map((h) => {
                const count = rooms.filter((r) => r.hotelId === h.id).length;
                return (
                  <option key={h.id} value={h.id}>
                    {h.nombre} ({count}/{h.totalRooms})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">Edificio</label>
            <select
              value={activeEdificio}
              onChange={(e) => {
                setSelectedEdificio(e.target.value);
                setSelectedPiso('');
                setSelectedRoomId(null);
              }}
              disabled={edificioOptions.length === 0}
              aria-label="Seleccionar edificio para plano por piso"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-teal-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              {edificioOptions.length === 0 ? (
                <option value="">Sin edificios cargados</option>
              ) : (
                edificioOptions.map((ed) => (
                  <option key={ed} value={ed}>
                    {ed}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">Piso</label>
            <select
              value={activePiso}
              onChange={(e) => {
                setSelectedPiso(e.target.value);
                setSelectedRoomId(null);
              }}
              disabled={pisoOptions.length === 0}
              aria-label="Seleccionar piso"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-teal-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              {pisoOptions.length === 0 ? (
                <option value="">Sin pisos cargados</option>
              ) : (
                pisoOptions.map((p) => (
                  <option key={p} value={String(p)}>
                    Piso {p}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Quick Floor Stepper Bar when multiple floors exist */}
        {pisoOptions.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 mr-1 shrink-0">Pisos:</span>
            {pisoOptions.map((p) => {
              const isCurrent = String(p) === activePiso;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSelectedPiso(String(p));
                    setSelectedRoomId(null);
                  }}
                  className={`min-w-[38px] h-8 px-2.5 rounded-lg font-mono text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  P{p}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Color Legend Bar */}
      <section
        aria-label="Leyenda de estados"
        className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {ROOM_STATUS_ORDER.map((status) => {
            const meta = ROOM_STATUS_META[status];
            return (
              <div key={status} className="inline-flex items-center gap-2 text-xs text-slate-700">
                <span className={`w-3 h-3 rounded-sm shrink-0 ${meta.swatchClass}`} />
                <span className="font-medium">{meta.label}</span>
                {floorRooms.length > 0 && (
                  <span className="font-mono text-slate-500 tabular-nums">
                    ({floorStatusCounts[status]})
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {floorRooms.length > 0 && (
          <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
            {floorRooms.length} habitaciones en piso {activePiso}
          </span>
        )}
      </section>

      {/* Main Floor Grid or Empty State */}
      {roomsForHotel.length === 0 && activeHotel ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4">
          <BedDouble className="w-9 h-9 text-slate-400 mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {activeHotel.nombre} aún no tiene plano cargado
            </h3>
            <p className="text-sm text-slate-600">
              Este hotel tiene registradas{' '}
              <span className="font-mono font-semibold">0 de {activeHotel.totalRooms}</span>{' '}
              habitaciones. Agrega habitaciones o importa un CSV en el Catálogo para visualizar su
              plano por piso.
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
      ) : roomsByVista.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
          No hay habitaciones cargadas en este piso.
        </div>
      ) : (
        <div className="space-y-5">
          {roomsByVista.map(({ vista, rooms: vistaRooms }) => (
            <section
              key={vista}
              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Vista / Orientación
                  </p>
                  <h3 className="text-base font-bold text-slate-900">{vista}</h3>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {vistaRooms.length}{' '}
                  {vistaRooms.length === 1 ? 'habitación' : 'habitaciones'} ·{' '}
                  {vistaRooms[0]?.numero}–{vistaRooms[vistaRooms.length - 1]?.numero}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
                {vistaRooms.map((room) => {
                  const meta = ROOM_STATUS_META[room.estado];
                  const assignedCamId = assignmentByRoomId.get(room.id);
                  const assignedCam = assignedCamId ? camaristaById.get(assignedCamId) : null;
                  const isSelected = selectedRoomId === room.id;
                  const isLocated = locatedRoomId === room.id;

                  return (
                    <button
                      key={room.id}
                      ref={(node) => {
                        if (node) {
                          roomCellRefs.current.set(room.id, node);
                        } else {
                          roomCellRefs.current.delete(room.id);
                        }
                      }}
                      type="button"
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`text-left min-h-[82px] p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                        meta.cellClass
                      } ${
                        isLocated
                          ? 'ring-2 ring-teal-700 ring-offset-2 shadow-md'
                          : isSelected
                            ? meta.cellSelectedRing
                            : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="inline-flex items-center gap-1 font-mono text-base font-bold tabular-nums">
                          {isLocated && (
                            <MapPin className="w-3.5 h-3.5 text-teal-800 shrink-0" />
                          )}
                          {room.numero}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.swatchClass}`}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold leading-tight truncate">
                          {meta.label}
                        </p>
                        <p className="text-[10px] opacity-80 truncate">
                          {assignedCam ? getShortCamaristaName(assignedCam.nombre) : 'Sin asignar'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Room Detail Slide-Over Panel */}
      {selectedRoom && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="floor-room-detail-title"
        >
          <div
            className="flex-1"
            onClick={() => setSelectedRoomId(null)}
            aria-hidden="true"
          />
          <aside className="w-full max-w-md bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  {hotelById.get(selectedRoom.hotelId)?.nombre ?? selectedRoom.hotelId} ·{' '}
                  {selectedRoom.edificio}
                </p>
                <h3
                  id="floor-room-detail-title"
                  className="text-xl font-bold font-mono text-slate-900 tabular-nums"
                >
                  Habitación {selectedRoom.numero}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoomId(null)}
                aria-label="Cerrar panel de habitación"
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Metadata summary */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                <div>
                  <span className="text-slate-500 block">Piso</span>
                  <span className="font-mono font-bold text-slate-900">
                    Piso {selectedRoom.piso}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Vista</span>
                  <span className="font-semibold text-slate-900">{selectedRoom.vista}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Estado actual</span>
                  <span
                    className={`inline-flex items-center gap-1.5 font-semibold ${
                      ROOM_STATUS_META[selectedRoom.estado].textClass
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        ROOM_STATUS_META[selectedRoom.estado].swatchClass
                      }`}
                    />
                    {ROOM_STATUS_META[selectedRoom.estado].label}
                  </span>
                </div>
              </div>

              {/* One-tap Status Controls */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Cambiar estado
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {ROOM_STATUS_ORDER.map((status) => {
                    const meta = ROOM_STATUS_META[status];
                    const isActive = selectedRoom.estado === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void changeRoomStatus(selectedRoom.id, status)}
                        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isActive
                            ? meta.buttonActiveClass
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isActive ? 'bg-white' : meta.swatchClass
                            }`}
                          />
                          {meta.label}
                        </span>
                        {isActive && <span className="text-xs font-medium opacity-90">Actual</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Camarista Assignment */}
              <div className="space-y-2">
                <label
                  htmlFor="floor-detail-camarista"
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Camarista asignada
                </label>
                <select
                  id="floor-detail-camarista"
                  value={assignmentByRoomId.get(selectedRoom.id) ?? ''}
                  onChange={(e) =>
                    void assignCamarista(
                      selectedRoom.id,
                      e.target.value === '' ? null : e.target.value
                    )
                  }
                  className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-teal-700 focus:outline-none"
                >
                  <option value="">Sin camarista asignada</option>
                  {camaristas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Change History */}
              <div className="space-y-2.5">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  Historial de cambios de estado
                </h4>
                {selectedRoomHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                    Aún no hay cambios de estado registrados para esta habitación.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {selectedRoomHistory.map((entry) => (
                      <li key={entry.id} className="px-3.5 py-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-800">
                            {ROOM_STATUS_META[entry.previousStatus].label}{' '}
                            <span className="text-slate-400">→</span>{' '}
                            <span className={ROOM_STATUS_META[entry.newStatus].textClass}>
                              {ROOM_STATUS_META[entry.newStatus].label}
                            </span>
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatHistoryDate(entry.timestamp)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Reference Resort Distribution Image Modal */}
      {showResortMap && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resort-map-title"
        >
          <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 id="resort-map-title" className="text-base font-bold text-slate-900">
                  Distribución general del complejo
                </h3>
                <p className="text-xs text-slate-500">
                  Referencia visual de La Marina, El Moro, Castilla y Granada
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResortMap(false)}
                aria-label="Cerrar plano general"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 max-h-[78vh] overflow-auto">
              <img
                src={RESORT_MAP_IMAGE_PATH}
                alt="Plano general del complejo hotelero: La Marina, El Moro, Castilla y Granada"
                referrerPolicy="no-referrer"
                className="w-full h-auto rounded-xl border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
