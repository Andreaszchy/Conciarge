import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  DoorOpen,
  KeyRound,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import type { Estancia, FloorLevel, Room } from '../types/hotelOps';
import {
  addDaysIso,
  compareRoomNumbers,
  FLOOR_LEVEL_LABELS,
  getFloorLevel,
  isRoomReady,
  ROOM_STATUS_META,
  STAY_STATUS_META,
  toLocalIsoDate,
} from '../types/hotelOps';

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface ParsedSmartQuery {
  floorLevel: FloorLevel | null;
  tokens: string[];
}

function parseSmartRoomQuery(raw: string): ParsedSmartQuery {
  let cleaned = normalizeText(raw);
  let floorLevel: FloorLevel | null = null;

  if (/\b(piso\s+alto|pisos\s+altos|nivel\s+alto)\b/.test(cleaned)) {
    floorLevel = 'alto';
    cleaned = cleaned.replace(/\b(piso\s+alto|pisos\s+altos|nivel\s+alto)\b/g, ' ');
  } else if (/\b(piso\s+medio|pisos\s+medios|nivel\s+medio)\b/.test(cleaned)) {
    floorLevel = 'medio';
    cleaned = cleaned.replace(/\b(piso\s+medio|pisos\s+medios|nivel\s+medio)\b/g, ' ');
  } else if (/\b(piso\s+bajo|pisos\s+bajos|nivel\s+bajo)\b/.test(cleaned)) {
    floorLevel = 'bajo';
    cleaned = cleaned.replace(/\b(piso\s+bajo|pisos\s+bajos|nivel\s+bajo)\b/g, ' ');
  }

  const stopWords = new Set(['de', 'del', 'la', 'el', 'en', 'con', 'vista', 'piso', 'hab', 'habitacion']);
  const tokens = cleaned
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !stopWords.has(t));

  return { floorLevel, tokens };
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

const SMART_QUERY_EXAMPLES = [
  'alberca Moro, piso alto',
  'alberca gruta, piso medio',
  'nivel playa, piso bajo',
  'la concha, piso alto',
];

export function ReceptionView() {
  const {
    hotels,
    rooms,
    huespedes,
    estancias,
    loading,
    error,
    reload,
    hotelById,
    roomById,
    huespedById,
    createStay,
    reassignStayRoom,
    checkInStay,
    checkOutStay,
  } = useHotelOps();

  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const [activeSubTab, setActiveSubTab] = useState<'availability' | 'stays'>('availability');

  // Availability filters
  const [dateStart, setDateStart] = useState(todayIso);
  const [dateEnd, setDateEnd] = useState(() => addDaysIso(todayIso, 2));
  const [smartQuery, setSmartQuery] = useState('');
  const [hotelFilter, setHotelFilter] = useState('all');
  const [edificioFilter, setEdificioFilter] = useState('all');
  const [vistaFilter, setVistaFilter] = useState('all');
  const [floorLevelFilter, setFloorLevelFilter] = useState<'all' | FloorLevel>('all');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'libres' | 'ocupadas'>('all');
  const [availLimit, setAvailLimit] = useState(48);

  // Stays tab filter
  const [stayViewFilter, setStayViewFilter] = useState<
    'llegadas_hoy' | 'salidas_hoy' | 'en_casa' | 'reservada' | 'finalizada'
  >('llegadas_hoy');
  const [stayFeedback, setStayFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Assign / Create Stay Modal
  const [stayModalOpen, setStayModalOpen] = useState(false);
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('existing');
  const [modalGuestId, setModalGuestId] = useState('');
  const [modalNewGuestName, setModalNewGuestName] = useState('');
  const [modalRoomId, setModalRoomId] = useState('');
  const [modalStart, setModalStart] = useState(todayIso);
  const [modalEnd, setModalEnd] = useState(() => addDaysIso(todayIso, 2));
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  // Reassign room modal
  const [reassignStay, setReassignStay] = useState<Estancia | null>(null);
  const [reassignRoomId, setReassignRoomId] = useState('');
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Occupied map for selected date window
  const occupiedRoomStayMap = useMemo(() => {
    const map = new Map<string, Estancia>();
    if (!dateStart || !dateEnd || dateEnd <= dateStart) return map;
    for (const st of estancias) {
      if (st.estado === 'finalizada') continue;
      if (rangesOverlap(st.fechaEntrada, st.fechaSalida, dateStart, dateEnd)) {
        map.set(st.roomId, st);
      }
    }
    return map;
  }, [estancias, dateStart, dateEnd]);

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

  const vistaOptions = useMemo(() => {
    const source =
      edificioFilter === 'all'
        ? roomsForHotel
        : roomsForHotel.filter((r) => r.edificio === edificioFilter);
    return Array.from(new Set(source.map((r) => r.vista))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [roomsForHotel, edificioFilter]);

  const parsedSmart = useMemo(() => parseSmartRoomQuery(smartQuery), [smartQuery]);

  const availabilityRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        if (hotelFilter !== 'all' && room.hotelId !== hotelFilter) return false;
        if (edificioFilter !== 'all' && room.edificio !== edificioFilter) return false;
        if (vistaFilter !== 'all' && room.vista !== vistaFilter) return false;

        const level = getFloorLevel(room.piso);
        if (floorLevelFilter !== 'all' && level !== floorLevelFilter) return false;
        if (parsedSmart.floorLevel && level !== parsedSmart.floorLevel) return false;

        const isOccupied = occupiedRoomStayMap.has(room.id);
        if (occupancyFilter === 'libres' && isOccupied) return false;
        if (occupancyFilter === 'ocupadas' && !isOccupied) return false;

        if (parsedSmart.tokens.length > 0) {
          const hotelName = hotelById.get(room.hotelId)?.nombre ?? '';
          const haystack = normalizeText(
            `${hotelName} ${room.edificio} ${room.vista} ${room.numero} piso ${room.piso}`
          );
          for (const token of parsedSmart.tokens) {
            if (!haystack.includes(token)) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (a.hotelId !== b.hotelId) return a.hotelId.localeCompare(b.hotelId);
        if (a.piso !== b.piso) return a.piso - b.piso;
        return compareRoomNumbers(a.numero, b.numero);
      });
  }, [
    rooms,
    hotelFilter,
    edificioFilter,
    vistaFilter,
    floorLevelFilter,
    occupancyFilter,
    parsedSmart,
    occupiedRoomStayMap,
    hotelById,
  ]);

  const availStats = useMemo(() => {
    let libres = 0;
    let ocupadas = 0;
    let listasCheckIn = 0;
    for (const r of availabilityRooms) {
      if (occupiedRoomStayMap.has(r.id)) {
        ocupadas += 1;
      } else {
        libres += 1;
        if (isRoomReady(r.estado)) listasCheckIn += 1;
      }
    }
    return { libres, ocupadas, listasCheckIn };
  }, [availabilityRooms, occupiedRoomStayMap]);

  // Daily reception metrics
  const staysMetrics = useMemo(() => {
    const llegadasHoy = estancias.filter(
      (st) => st.fechaEntrada === todayIso && st.estado === 'reservada'
    );
    const salidasHoy = estancias.filter(
      (st) => st.fechaSalida === todayIso && st.estado === 'en_casa'
    );
    const enCasa = estancias.filter((st) => st.estado === 'en_casa');
    const reservadas = estancias.filter((st) => st.estado === 'reservada');
    const finalizadas = estancias.filter((st) => st.estado === 'finalizada');
    return { llegadasHoy, salidasHoy, enCasa, reservadas, finalizadas };
  }, [estancias, todayIso]);

  const visibleStays = useMemo(() => {
    if (stayViewFilter === 'llegadas_hoy') return staysMetrics.llegadasHoy;
    if (stayViewFilter === 'salidas_hoy') return staysMetrics.salidasHoy;
    if (stayViewFilter === 'en_casa') return staysMetrics.enCasa;
    if (stayViewFilter === 'reservada') return staysMetrics.reservadas;
    return staysMetrics.finalizadas.slice(0, 40);
  }, [stayViewFilter, staysMetrics]);

  const freeRoomsForModal = useMemo(() => {
    return rooms
      .filter((r) => {
        if (r.estado === 'fuera_de_servicio') return false;
        const conflict = estancias.some(
          (st) =>
            st.roomId === r.id &&
            st.estado !== 'finalizada' &&
            rangesOverlap(st.fechaEntrada, st.fechaSalida, modalStart, modalEnd)
        );
        return !conflict;
      })
      .sort((a, b) => compareRoomNumbers(a.numero, b.numero));
  }, [rooms, estancias, modalStart, modalEnd]);

  const openAssignModal = (presetRoom?: Room) => {
    setModalError(null);
    setGuestMode('existing');
    setModalGuestId(huespedes[0]?.id ?? '');
    setModalNewGuestName('');
    setModalStart(dateStart);
    setModalEnd(dateEnd > dateStart ? dateEnd : addDaysIso(dateStart, 2));
    setModalRoomId(presetRoom?.id ?? freeRoomsForModal[0]?.id ?? rooms[0]?.id ?? '');
    setStayModalOpen(true);
  };

  const handleSaveStay = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSaving(true);
    try {
      await createStay({
        huespedId: guestMode === 'existing' ? modalGuestId : undefined,
        nuevoHuespedNombre: guestMode === 'new' ? modalNewGuestName : undefined,
        roomId: modalRoomId,
        fechaEntrada: modalStart,
        fechaSalida: modalEnd,
        estado: 'reservada',
      });
      setStayModalOpen(false);
      setStayFeedback({ type: 'ok', text: 'Estancia registrada y habitación asignada correctamente.' });
      setActiveSubTab('stays');
      setStayViewFilter(modalStart === todayIso ? 'llegadas_hoy' : 'reservada');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No se pudo registrar la estancia.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleCheckIn = async (stay: Estancia) => {
    setStayFeedback(null);
    try {
      await checkInStay(stay.id);
      const roomNum = roomById.get(stay.roomId)?.numero ?? '';
      setStayFeedback({
        type: 'ok',
        text: `Check-in completado en habitación ${roomNum}. Huésped ahora en casa.`,
      });
    } catch (err) {
      setStayFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo realizar el check-in.',
      });
    }
  };

  const handleCheckOut = async (stay: Estancia) => {
    setStayFeedback(null);
    try {
      await checkOutStay(stay.id);
      const roomNum = roomById.get(stay.roomId)?.numero ?? '';
      setStayFeedback({
        type: 'ok',
        text: `Check-out completado. La habitación ${roomNum} pasó automáticamente a estado Sucia.`,
      });
    } catch (err) {
      setStayFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo realizar el check-out.',
      });
    }
  };

  const handleReassignConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignStay || !reassignRoomId) return;
    setReassignError(null);
    try {
      await reassignStayRoom(reassignStay.id, reassignRoomId);
      setReassignStay(null);
      setStayFeedback({ type: 'ok', text: 'Habitación reasignada a la estancia.' });
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : 'No se pudo reasignar la habitación.');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Recepción</h2>
          <p className="text-sm text-slate-600">
            Disponibilidad por fechas, búsqueda por vista y nivel de piso, llegadas, salidas y
            control de check-in / check-out.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openAssignModal()}
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Asignar estancia
        </button>
      </div>

      {/* Daily Operational KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setActiveSubTab('stays');
            setStayViewFilter('llegadas_hoy');
          }}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-700 transition-colors cursor-pointer space-y-1"
        >
          <p className="text-xs font-medium text-slate-500">Llegadas de hoy</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {staysMetrics.llegadasHoy.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('stays');
            setStayViewFilter('salidas_hoy');
          }}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-700 transition-colors cursor-pointer space-y-1"
        >
          <p className="text-xs font-medium text-slate-500">Salidas de hoy</p>
          <p className="font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {staysMetrics.salidasHoy.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('stays');
            setStayViewFilter('en_casa');
          }}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-700 transition-colors cursor-pointer space-y-1"
        >
          <p className="text-xs font-medium text-slate-500">Huéspedes en casa</p>
          <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {staysMetrics.enCasa.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('availability')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-700 transition-colors cursor-pointer space-y-1"
        >
          <p className="text-xs font-medium text-slate-500">Libres listas (fechas filtro)</p>
          <p className="font-mono text-2xl font-bold text-teal-800 tabular-nums">
            {availStats.listasCheckIn}
          </p>
        </button>
      </section>

      {/* Main Sub-Tab Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('availability')}
          className={`inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeSubTab === 'availability'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Disponibilidad por fecha
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('stays')}
          className={`inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeSubTab === 'stays'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Llegadas, salidas y estancias
        </button>
      </div>

      {stayFeedback && (
        <div
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-xs ${
            stayFeedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="inline-flex items-center gap-2 font-medium">
            {stayFeedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            {stayFeedback.text}
          </span>
          <button
            type="button"
            onClick={() => setStayFeedback(null)}
            aria-label="Cerrar aviso"
            className="p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeSubTab === 'availability' ? (
        <div className="space-y-5">
          {/* Smart Search & Availability Filters */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            {/* Natural search input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Búsqueda inteligente por vista, edificio o nivel de piso
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={smartQuery}
                  onChange={(e) => {
                    setSmartQuery(e.target.value);
                    setAvailLimit(48);
                  }}
                  placeholder='Ej. "alberca Moro, piso alto" o "nivel playa, piso bajo"...'
                  aria-label="Búsqueda inteligente de habitaciones disponibles"
                  className="w-full h-10 pl-9 pr-9 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
                />
                {smartQuery && (
                  <button
                    type="button"
                    onClick={() => setSmartQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Consultas rápidas:</span>
                {SMART_QUERY_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setSmartQuery(example)}
                    className="text-teal-800 hover:underline font-medium cursor-pointer"
                  >
                    “{example}”
                  </button>
                ))}
              </div>
            </div>

            {/* Dates & Structural Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Entrada</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setDateStart(nextStart);
                    if (nextStart >= dateEnd) {
                      setDateEnd(addDaysIso(nextStart, 1));
                    }
                  }}
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Salida</label>
                <input
                  type="date"
                  value={dateEnd}
                  min={addDaysIso(dateStart, 1)}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Hotel</label>
                <select
                  value={hotelFilter}
                  onChange={(e) => {
                    setHotelFilter(e.target.value);
                    setEdificioFilter('all');
                    setVistaFilter('all');
                  }}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
                >
                  <option value="all">Todos los hoteles</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Edificio</label>
                <select
                  value={edificioFilter}
                  onChange={(e) => {
                    setEdificioFilter(e.target.value);
                    setVistaFilter('all');
                  }}
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
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Vista</label>
                <select
                  value={vistaFilter}
                  onChange={(e) => setVistaFilter(e.target.value)}
                  disabled={vistaOptions.length === 0}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none disabled:bg-slate-50"
                >
                  <option value="all">Todas las vistas</option>
                  {vistaOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">Nivel de piso</label>
                <select
                  value={floorLevelFilter}
                  onChange={(e) => setFloorLevelFilter(e.target.value as 'all' | FloorLevel)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
                >
                  <option value="all">Todos los niveles</option>
                  <option value="bajo">{FLOOR_LEVEL_LABELS.bajo}</option>
                  <option value="medio">{FLOOR_LEVEL_LABELS.medio}</option>
                  <option value="alto">{FLOOR_LEVEL_LABELS.alto}</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-500">Disponibilidad</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['all', 'libres', 'ocupadas'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setOccupancyFilter(opt)}
                      className={`h-10 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        occupancyFilter === opt
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt === 'all' ? 'Todas' : opt === 'libres' ? 'Libres' : 'Ocupadas'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span className="font-mono tabular-nums">
                {availabilityRooms.length} resultados ·{' '}
                <strong className="text-emerald-800">{availStats.libres} libres</strong> ·{' '}
                <strong className="text-amber-800">{availStats.ocupadas} ocupadas</strong> ·{' '}
                <strong className="text-teal-800">
                  {availStats.listasCheckIn} listas para check-in
                </strong>
              </span>
              {(smartQuery ||
                hotelFilter !== 'all' ||
                edificioFilter !== 'all' ||
                vistaFilter !== 'all' ||
                floorLevelFilter !== 'all' ||
                occupancyFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSmartQuery('');
                    setHotelFilter('all');
                    setEdificioFilter('all');
                    setVistaFilter('all');
                    setFloorLevelFilter('all');
                    setOccupancyFilter('all');
                  }}
                  className="inline-flex items-center gap-1 text-teal-800 font-medium hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </section>

          {/* Availability Results Grid */}
          {availabilityRooms.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
              <DoorOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">
                No hay habitaciones que coincidan
              </h3>
              <p className="text-sm text-slate-600">
                Prueba con otra combinación de fechas, vista o nivel de piso.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {availabilityRooms.slice(0, availLimit).map((room) => {
                  const stay = occupiedRoomStayMap.get(room.id);
                  const guestName = stay ? huespedById.get(stay.huespedId)?.nombre ?? 'Huésped' : null;
                  const hotelName = hotelById.get(room.hotelId)?.nombre ?? room.hotelId;
                  const statusMeta = ROOM_STATUS_META[room.estado];
                  const level = getFloorLevel(room.piso);

                  return (
                    <div
                      key={room.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                            Hab. {room.numero}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              stay ? 'text-amber-800' : 'text-emerald-800'
                            }`}
                          >
                            {stay ? 'Ocupada' : 'Libre'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {hotelName} · {room.edificio}
                        </p>
                        <p className="text-xs text-slate-500">
                          Piso {room.piso} ({level}) · {room.vista}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs pt-1">
                          <span className={`w-2 h-2 rounded-full ${statusMeta.swatchClass}`} />
                          <span className={`font-medium ${statusMeta.textClass}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      {stay ? (
                        <div className="pt-2.5 border-t border-slate-100 text-xs text-slate-600 space-y-0.5">
                          <p className="font-semibold text-slate-800 truncate">{guestName}</p>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {stay.fechaEntrada} → {stay.fechaSalida} ·{' '}
                            {STAY_STATUS_META[stay.estado].label}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={room.estado === 'fuera_de_servicio'}
                          onClick={() => openAssignModal(room)}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                        >
                          {room.estado === 'fuera_de_servicio'
                            ? 'Bloqueada (F. servicio)'
                            : 'Asignar a estancia'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {availabilityRooms.length > availLimit && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAvailLimit((v) => v + 48)}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Mostrar más habitaciones ({availabilityRooms.length - availLimit} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Llegadas, Salidas y Estancias */
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'llegadas_hoy', label: `Llegadas de hoy (${staysMetrics.llegadasHoy.length})` },
                { id: 'salidas_hoy', label: `Salidas de hoy (${staysMetrics.salidasHoy.length})` },
                { id: 'en_casa', label: `En casa (${staysMetrics.enCasa.length})` },
                { id: 'reservada', label: `Reservadas (${staysMetrics.reservadas.length})` },
                { id: 'finalizada', label: `Finalizadas (${staysMetrics.finalizadas.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStayViewFilter(tab.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  stayViewFilter === tab.id
                    ? 'bg-teal-50 text-teal-900 border-teal-700/40'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {visibleStays.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
              No hay estancias registradas en esta categoría.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Huésped</th>
                      <th className="py-3 px-4">Habitación</th>
                      <th className="py-3 px-4">Estado habitación</th>
                      <th className="py-3 px-4">Fechas</th>
                      <th className="py-3 px-4">Estancia</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {visibleStays.map((stay) => {
                      const guest = huespedById.get(stay.huespedId);
                      const room = roomById.get(stay.roomId);
                      const hotelName = room ? hotelById.get(room.hotelId)?.nombre ?? room.hotelId : '—';
                      const roomMeta = room ? ROOM_STATUS_META[room.estado] : null;
                      const stayMeta = STAY_STATUS_META[stay.estado];
                      const canCheckIn = room ? isRoomReady(room.estado) : false;

                      return (
                        <tr key={stay.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            {guest?.nombre ?? 'Huésped'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 tabular-nums">
                              Hab. {room?.numero ?? '—'}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {hotelName} · {room?.edificio ?? '—'} · P{room?.piso ?? '—'} ·{' '}
                              {room?.vista ?? '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {roomMeta ? (
                              <span className={`inline-flex items-center gap-1.5 font-semibold ${roomMeta.textClass}`}>
                                <span className={`w-2 h-2 rounded-full ${roomMeta.swatchClass}`} />
                                {roomMeta.label}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {stay.fechaEntrada} → {stay.fechaSalida}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 font-semibold ${stayMeta.textClass}`}>
                              <span className={`w-2 h-2 rounded-full ${stayMeta.swatchClass}`} />
                              {stayMeta.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {stay.estado === 'reservada' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleCheckIn(stay)}
                                    title={
                                      canCheckIn
                                        ? 'Realizar check-in'
                                        : 'Solo habitaciones limpias o inspeccionadas'
                                    }
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                      canCheckIn
                                        ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    <LogIn className="w-3.5 h-3.5" />
                                    Check-in
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReassignStay(stay);
                                      setReassignRoomId(stay.roomId);
                                      setReassignError(null);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                                  >
                                    Cambiar hab.
                                  </button>
                                </>
                              )}

                              {stay.estado === 'en_casa' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleCheckOut(stay)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
                                  >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Check-out
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReassignStay(stay);
                                      setReassignRoomId(stay.roomId);
                                      setReassignError(null);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                                  >
                                    Cambiar hab.
                                  </button>
                                </>
                              )}

                              {stay.estado === 'finalizada' && (
                                <span className="text-slate-400 text-[11px]">Completada</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assign Stay Modal (no rates or payments) */}
      {stayModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stay-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="stay-modal-title" className="text-base font-bold text-slate-900">
                Asignar habitación a estancia
              </h3>
              <button
                type="button"
                onClick={() => setStayModalOpen(false)}
                aria-label="Cerrar modal"
                className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStay} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {modalError}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setGuestMode('existing')}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      guestMode === 'existing'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Huésped registrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestMode('new')}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      guestMode === 'new'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Nuevo huésped
                  </button>
                </div>

                {guestMode === 'existing' ? (
                  <select
                    value={modalGuestId}
                    onChange={(e) => setModalGuestId(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                    required
                  >
                    {huespedes.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={modalNewGuestName}
                    onChange={(e) => setModalNewGuestName(e.target.value)}
                    placeholder="Nombre completo del huésped"
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                    required
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Fecha entrada</label>
                  <input
                    type="date"
                    value={modalStart}
                    onChange={(e) => {
                      setModalStart(e.target.value);
                      if (e.target.value >= modalEnd) {
                        setModalEnd(addDaysIso(e.target.value, 1));
                      }
                    }}
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Fecha salida</label>
                  <input
                    type="date"
                    value={modalEnd}
                    min={addDaysIso(modalStart, 1)}
                    onChange={(e) => setModalEnd(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Habitación</label>
                <select
                  value={modalRoomId}
                  onChange={(e) => setModalRoomId(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                  required
                >
                  {freeRoomsForModal.slice(0, 120).map((r) => (
                    <option key={r.id} value={r.id}>
                      Hab. {r.numero} · {hotelById.get(r.hotelId)?.nombre ?? r.hotelId} · {r.edificio} · P{r.piso} ({ROOM_STATUS_META[r.estado].label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStayModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {modalSaving ? 'Guardando...' : 'Guardar estancia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Room Modal */}
      {reassignStay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Cambiar habitación</h3>
              <button
                type="button"
                onClick={() => setReassignStay(null)}
                aria-label="Cerrar modal"
                className="p-1.5 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReassignConfirm} className="p-6 space-y-4">
              {reassignError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {reassignError}
                </div>
              )}
              <p className="text-xs text-slate-600">
                Huésped: <strong>{huespedById.get(reassignStay.huespedId)?.nombre}</strong> ·{' '}
                <span className="font-mono">
                  {reassignStay.fechaEntrada} → {reassignStay.fechaSalida}
                </span>
              </p>
              <select
                value={reassignRoomId}
                onChange={(e) => setReassignRoomId(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                required
              >
                {rooms
                  .filter((r) => r.estado !== 'fuera_de_servicio')
                  .slice(0, 120)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Hab. {r.numero} · {hotelById.get(r.hotelId)?.nombre ?? r.hotelId} · {r.edificio} · P{r.piso} ({ROOM_STATUS_META[r.estado].label})
                    </option>
                  ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassignStay(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Confirmar cambio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
