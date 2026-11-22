import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BedDouble,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import type { CsvImportResult, Room, RoomInput, RoomStatus } from '../types/hotelOps';
import {
  compareRoomNumbers,
  getShortCamaristaName,
  ROOM_STATUS_META,
  ROOM_STATUS_ORDER,
} from '../types/hotelOps';

const PAGE_SIZE = 50;

interface RoomFormState {
  hotelId: string;
  edificio: string;
  vista: string;
  piso: string;
  numero: string;
  estado: RoomStatus;
}

export function RoomCatalogView() {
  const {
    hotels,
    rooms,
    loading,
    error,
    reload,
    hotelById,
    camaristaById,
    assignmentByRoomId,
    createRoom,
    updateRoom,
    deleteRoom,
    importRoomsCsv,
    exportRoomsCsv,
  } = useHotelOps();

  // Filters
  const [searchNumber, setSearchNumber] = useState('');
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [edificioFilter, setEdificioFilter] = useState<string>('all');
  const [pisoFilter, setPisoFilter] = useState<string>('all');
  const [vistaFilter, setVistaFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<'all' | RoomStatus>('all');
  const [page, setPage] = useState(1);

  // Modal & inline delete state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formState, setFormState] = useState<RoomFormState>({
    hotelId: 'castilla',
    edificio: '',
    vista: '',
    piso: '1',
    numero: '',
    estado: 'sucia',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // CSV Import feedback
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importFeedback, setImportFeedback] = useState<CsvImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Per-hotel room counts vs totalRooms
  const hotelCounters = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const r of rooms) {
      countMap.set(r.hotelId, (countMap.get(r.hotelId) ?? 0) + 1);
    }
    return hotels.map((hotel) => {
      const loaded = countMap.get(hotel.id) ?? 0;
      const pct = hotel.totalRooms > 0 ? Math.min(100, Math.round((loaded / hotel.totalRooms) * 100)) : 0;
      return { hotel, loaded, pct };
    });
  }, [hotels, rooms]);

  // Cascading filter options
  const roomsForHotel = useMemo(
    () => (hotelFilter === 'all' ? rooms : rooms.filter((r) => r.hotelId === hotelFilter)),
    [rooms, hotelFilter]
  );

  const edificioOptions = useMemo(() => {
    return Array.from(new Set(roomsForHotel.map((r) => r.edificio))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [roomsForHotel]);

  const roomsForEdificio = useMemo(
    () =>
      edificioFilter === 'all'
        ? roomsForHotel
        : roomsForHotel.filter((r) => r.edificio === edificioFilter),
    [roomsForHotel, edificioFilter]
  );

  const pisoOptions = useMemo(() => {
    return Array.from(new Set(roomsForEdificio.map((r) => r.piso))).sort((a, b) => a - b);
  }, [roomsForEdificio]);

  const vistaOptions = useMemo(() => {
    return Array.from(new Set(roomsForEdificio.map((r) => r.vista))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [roomsForEdificio]);

  // Suggestions for Create/Edit form based on selected hotel in form
  const formEdificioSuggestions = useMemo(() => {
    return Array.from(
      new Set(rooms.filter((r) => r.hotelId === formState.hotelId).map((r) => r.edificio))
    ).sort((a, b) => a.localeCompare(b, 'es'));
  }, [rooms, formState.hotelId]);

  const formVistaSuggestions = useMemo(() => {
    return Array.from(
      new Set(rooms.filter((r) => r.hotelId === formState.hotelId).map((r) => r.vista))
    ).sort((a, b) => a.localeCompare(b, 'es'));
  }, [rooms, formState.hotelId]);

  // Filtered + sorted rooms
  const filteredRooms = useMemo(() => {
    const query = searchNumber.trim().toLowerCase();
    return rooms
      .filter((r) => {
        if (hotelFilter !== 'all' && r.hotelId !== hotelFilter) return false;
        if (edificioFilter !== 'all' && r.edificio !== edificioFilter) return false;
        if (pisoFilter !== 'all' && String(r.piso) !== pisoFilter) return false;
        if (vistaFilter !== 'all' && r.vista !== vistaFilter) return false;
        if (estadoFilter !== 'all' && r.estado !== estadoFilter) return false;
        if (query && !r.numero.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.hotelId !== b.hotelId) return a.hotelId.localeCompare(b.hotelId);
        if (a.edificio !== b.edificio) return a.edificio.localeCompare(b.edificio, 'es');
        if (a.piso !== b.piso) return a.piso - b.piso;
        return compareRoomNumbers(a.numero, b.numero);
      });
  }, [rooms, hotelFilter, edificioFilter, pisoFilter, vistaFilter, estadoFilter, searchNumber]);

  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRooms = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRooms.slice(start, start + PAGE_SIZE);
  }, [filteredRooms, safePage]);

  const hasActiveFilters =
    searchNumber.trim().length > 0 ||
    hotelFilter !== 'all' ||
    edificioFilter !== 'all' ||
    pisoFilter !== 'all' ||
    vistaFilter !== 'all' ||
    estadoFilter !== 'all';

  const resetFilters = () => {
    setSearchNumber('');
    setHotelFilter('all');
    setEdificioFilter('all');
    setPisoFilter('all');
    setVistaFilter('all');
    setEstadoFilter('all');
    setPage(1);
  };

  const handleHotelChange = (nextHotel: string) => {
    setHotelFilter(nextHotel);
    setEdificioFilter('all');
    setPisoFilter('all');
    setVistaFilter('all');
    setPage(1);
  };

  const handleEdificioChange = (nextEdificio: string) => {
    setEdificioFilter(nextEdificio);
    setPisoFilter('all');
    setVistaFilter('all');
    setPage(1);
  };

  const openCreateModal = (presetHotelId?: string) => {
    setEditingRoom(null);
    setFormError(null);
    setFormState({
      hotelId: presetHotelId && presetHotelId !== 'all' ? presetHotelId : hotels[0]?.id ?? 'castilla',
      edificio: '',
      vista: '',
      piso: '1',
      numero: '',
      estado: 'sucia',
    });
    setModalOpen(true);
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setFormError(null);
    setFormState({
      hotelId: room.hotelId,
      edificio: room.edificio,
      vista: room.vista,
      piso: String(room.piso),
      numero: room.numero,
      estado: room.estado,
    });
    setModalOpen(true);
  };

  const duplicateNumberWarning = useMemo(() => {
    const num = formState.numero.trim().toLowerCase();
    if (!num) return null;
    const conflict = rooms.find(
      (r) => r.id !== editingRoom?.id && r.numero.trim().toLowerCase() === num
    );
    if (!conflict) return null;
    const hotelName = hotelById.get(conflict.hotelId)?.nombre ?? conflict.hotelId;
    return `El número ${conflict.numero} ya está registrado en ${hotelName} (${conflict.edificio}, piso ${conflict.piso}).`;
  }, [formState.numero, rooms, editingRoom, hotelById]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (duplicateNumberWarning) {
      setFormError(duplicateNumberWarning);
      return;
    }

    const parsedPiso = Number.parseInt(formState.piso, 10);
    if (Number.isNaN(parsedPiso) || parsedPiso < 0) {
      setFormError('Indica un número de piso válido (0 o superior).');
      return;
    }

    const payload: RoomInput = {
      hotelId: formState.hotelId,
      edificio: formState.edificio.trim(),
      vista: formState.vista.trim(),
      piso: parsedPiso,
      numero: formState.numero.trim(),
      estado: formState.estado,
    };

    setSaving(true);
    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, payload);
      } else {
        await createRoom(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la habitación.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async (roomId: string) => {
    await deleteRoom(roomId);
    setConfirmDeleteId(null);
  };

  const handleExportCsv = () => {
    const rowsToExport = filteredRooms.length > 0 ? filteredRooms : rooms;
    const csvContent = exportRoomsCsv(rowsToExport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = hotelFilter === 'all' ? 'complejo' : hotelFilter;
    link.download = `habitaciones_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    setImportFeedback(null);

    try {
      const text = await file.text();
      const result = await importRoomsCsv(
        text,
        hotelFilter !== 'all' ? hotelFilter : undefined
      );
      setImportFeedback(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'No se pudo importar el archivo CSV.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-24 bg-white border border-slate-200 rounded-xl" />
        <div className="h-96 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">No se pudo cargar el catálogo</h2>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </div>
    );
  }

  const selectedHotelObj = hotelFilter !== 'all' ? hotelById.get(hotelFilter) ?? null : null;
  const selectedHotelEmpty =
    selectedHotelObj !== null && rooms.filter((r) => r.hotelId === selectedHotelObj.id).length === 0;

  return (
    <div className="space-y-6">
      {/* Header + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Catálogo de Habitaciones
          </h2>
          <p className="text-sm text-slate-600">
            Inventario maestro por hotel, edificio, piso y vista con importación y exportación CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar CSV
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={rooms.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => openCreateModal(hotelFilter)}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva habitación
          </button>
        </div>
      </div>

      {/* Import Feedback Banners */}
      {importFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5 text-xs text-emerald-950">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                Importación completada: {importFeedback.importedCount}{' '}
                {importFeedback.importedCount === 1 ? 'habitación agregada' : 'habitaciones agregadas'}.
              </p>
              <p className="text-emerald-800">
                Filas procesadas: {importFeedback.totalProcessed} · Duplicadas omitidas:{' '}
                {importFeedback.skippedDuplicates.length} · Filas inválidas:{' '}
                {importFeedback.invalidRows}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            aria-label="Cerrar aviso"
            className="p-1 text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {importError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-xs text-rose-900">
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            aria-label="Cerrar error"
            className="p-1 text-rose-700 hover:text-rose-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hotel Counters Strip: Loaded vs TotalRooms */}
      <section aria-label="Contadores por hotel">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {hotelCounters.map(({ hotel, loaded, pct }) => {
            const isSelected = hotelFilter === hotel.id;
            return (
              <button
                key={hotel.id}
                type="button"
                onClick={() => handleHotelChange(isSelected ? 'all' : hotel.id)}
                className={`text-left bg-white border rounded-xl p-4 transition-colors cursor-pointer space-y-3 ${
                  isSelected
                    ? 'border-teal-700 ring-1 ring-teal-700 bg-teal-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900">{hotel.nombre}</span>
                  <span className="font-mono text-xs tabular-nums text-slate-500">{pct}%</span>
                </div>

                <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                  <span className="text-2xl font-bold text-slate-900">{loaded}</span>
                  <span className="text-xs text-slate-500">/ {hotel.totalRooms} habitaciones</span>
                </div>

                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      loaded === 0 ? 'bg-slate-300' : 'bg-teal-700'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filters Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search by number */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => {
                setSearchNumber(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar número..."
              aria-label="Buscar por número de habitación"
              className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-teal-700 focus:outline-none"
            />
          </div>

          {/* Hotel */}
          <select
            value={hotelFilter}
            onChange={(e) => handleHotelChange(e.target.value)}
            aria-label="Filtrar por hotel"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Todos los hoteles</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre}
              </option>
            ))}
          </select>

          {/* Edificio */}
          <select
            value={edificioFilter}
            onChange={(e) => handleEdificioChange(e.target.value)}
            aria-label="Filtrar por edificio"
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

          {/* Piso */}
          <select
            value={pisoFilter}
            onChange={(e) => {
              setPisoFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por piso"
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

          {/* Vista */}
          <select
            value={vistaFilter}
            onChange={(e) => {
              setVistaFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por vista"
            disabled={vistaOptions.length === 0}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="all">Todas las vistas</option>
            {vistaOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* Estado */}
          <select
            value={estadoFilter}
            onChange={(e) => {
              setEstadoFilter(e.target.value as 'all' | RoomStatus);
              setPage(1);
            }}
            aria-label="Filtrar por estado"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Todos los estados</option>
            {ROOM_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {ROOM_STATUS_META[status].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
          <span className="font-mono tabular-nums">
            Mostrando {filteredRooms.length} de {rooms.length} habitaciones cargadas
          </span>
          {hasActiveFilters && (
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

      {/* Table or Empty State */}
      {selectedHotelEmpty && selectedHotelObj ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4">
          <BedDouble className="w-9 h-9 text-slate-400 mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {selectedHotelObj.nombre} aún no tiene habitaciones cargadas
            </h3>
            <p className="text-sm text-slate-600">
              Capacidad configurada: <span className="font-mono font-semibold">{selectedHotelObj.totalRooms}</span> habitaciones.
              Puedes registrar habitaciones manualmente o importar un archivo CSV.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => openCreateModal(selectedHotelObj.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar habitación en {selectedHotelObj.nombre}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar CSV
            </button>
          </div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Search className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">Sin coincidencias</h3>
            <p className="text-sm text-slate-600">
              No hay habitaciones que coincidan con la búsqueda o los filtros seleccionados.
            </p>
          </div>
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Hotel</th>
                  <th className="py-3 px-4">Edificio</th>
                  <th className="py-3 px-4">Piso</th>
                  <th className="py-3 px-4">Vista</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 hidden md:table-cell">Camarista</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedRooms.map((room) => {
                  const hotelName = hotelById.get(room.hotelId)?.nombre ?? room.hotelId;
                  const meta = ROOM_STATUS_META[room.estado];
                  const assignedCamId = assignmentByRoomId.get(room.id);
                  const assignedCam = assignedCamId ? camaristaById.get(assignedCamId) : null;

                  return (
                    <tr key={room.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {room.numero}
                      </td>
                      <td className="py-3 px-4 text-slate-800 whitespace-nowrap">{hotelName}</td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{room.edificio}</td>
                      <td className="py-3 px-4 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        P{room.piso}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{room.vista}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 text-xs font-semibold ${meta.textClass}`}>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${meta.swatchClass}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 hidden md:table-cell whitespace-nowrap">
                        {assignedCam ? getShortCamaristaName(assignedCam.nombre) : 'Sin asignar'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {confirmDeleteId === room.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDeleteConfirm(room.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-700 rounded-md hover:bg-rose-800 cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(room)}
                              aria-label={`Editar habitación ${room.numero}`}
                              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(room.id)}
                              aria-label={`Eliminar habitación ${room.numero}`}
                              className="p-2 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4 text-xs text-slate-600">
              <span className="font-mono tabular-nums">
                Página {safePage} de {totalPages} · {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredRooms.length)} de {filteredRooms.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Room Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-modal-title"
        >
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 id="room-modal-title" className="text-base font-bold text-slate-900">
                {editingRoom ? `Editar habitación ${editingRoom.numero}` : 'Nueva habitación'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar modal"
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Hotel</label>
                  <select
                    value={formState.hotelId}
                    onChange={(e) => setFormState((s) => ({ ...s, hotelId: e.target.value }))}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                    required
                  >
                    {hotels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Número único
                  </label>
                  <input
                    type="text"
                    value={formState.numero}
                    onChange={(e) => setFormState((s) => ({ ...s, numero: e.target.value }))}
                    placeholder="Ej. 5101"
                    className={`w-full h-10 px-3 text-sm font-mono bg-white border rounded-lg focus:outline-none ${
                      duplicateNumberWarning
                        ? 'border-rose-400 focus:border-rose-600'
                        : 'border-slate-300 focus:border-teal-700'
                    }`}
                    required
                  />
                  {duplicateNumberWarning && (
                    <p className="text-[11px] text-rose-700 leading-snug">
                      {duplicateNumberWarning}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Edificio</label>
                  <input
                    type="text"
                    list="catalog-edificio-options"
                    value={formState.edificio}
                    onChange={(e) => setFormState((s) => ({ ...s, edificio: e.target.value }))}
                    placeholder="Ej. Torre Castilla"
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                    required
                  />
                  <datalist id="catalog-edificio-options">
                    {formEdificioSuggestions.map((ed) => (
                      <option key={ed} value={ed} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Vista</label>
                  <input
                    type="text"
                    list="catalog-vista-options"
                    value={formState.vista}
                    onChange={(e) => setFormState((s) => ({ ...s, vista: e.target.value }))}
                    placeholder="Ej. Alberca Moro"
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                    required
                  />
                  <datalist id="catalog-vista-options">
                    {formVistaSuggestions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Piso</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={formState.piso}
                    onChange={(e) => setFormState((s) => ({ ...s, piso: e.target.value }))}
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Estado</label>
                  <select
                    value={formState.estado}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, estado: e.target.value as RoomStatus }))
                    }
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:border-teal-700 focus:outline-none"
                  >
                    {ROOM_STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {ROOM_STATUS_META[status].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                  disabled={saving || Boolean(duplicateNumberWarning)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {saving
                    ? 'Guardando...'
                    : editingRoom
                      ? 'Guardar cambios'
                      : 'Crear habitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
