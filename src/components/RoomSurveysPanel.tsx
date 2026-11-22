import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  QrCode,
  RotateCcw,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import {
  compareRoomNumbers,
  SURVEY_AREA_KEYS,
  SURVEY_AREA_LABELS,
} from '../types/hotelOps';

interface RoomSurveysPanelProps {
  onOpenPublicForm: (roomId: string) => void;
  onGoToMaintenance?: () => void;
  onGoToRequests?: () => void;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function RoomSurveysPanel({
  onOpenPublicForm,
  onGoToMaintenance,
  onGoToRequests,
}: RoomSurveysPanelProps) {
  const {
    hotels,
    rooms,
    roomSurveys,
    unreadAlerts,
    loading,
    hotelById,
    dismissAlert,
  } = useHotelOps();

  // QR generator room picker
  const [qrRoomSearch, setQrRoomSearch] = useState('');
  const [selectedQrRoomId, setSelectedQrRoomId] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Response list filters
  const [searchQuery, setSearchQuery] = useState('');
  const [hotelFilter, setHotelFilter] = useState('all');
  const [edificioFilter, setEdificioFilter] = useState('all');
  const [vistaFilter, setVistaFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'criticas' | 'medias' | 'altas'>('all');
  const [visibleLimit, setVisibleLimit] = useState(30);

  const qrCandidateRooms = useMemo(() => {
    const q = qrRoomSearch.trim().toLowerCase();
    const list = q
      ? rooms.filter(
          (r) =>
            r.numero.toLowerCase().includes(q) ||
            r.edificio.toLowerCase().includes(q) ||
            (hotelById.get(r.hotelId)?.nombre ?? '').toLowerCase().includes(q)
        )
      : rooms;
    return [...list].sort((a, b) => compareRoomNumbers(a.numero, b.numero)).slice(0, 60);
  }, [rooms, qrRoomSearch, hotelById]);

  const activeQrRoom = useMemo(() => {
    if (selectedQrRoomId) {
      const found = rooms.find((r) => r.id === selectedQrRoomId);
      if (found) return found;
    }
    return qrCandidateRooms[0] ?? rooms[0] ?? null;
  }, [selectedQrRoomId, qrCandidateRooms, rooms]);

  const qrPublicUrl = useMemo(() => {
    if (!activeQrRoom) return '';
    return `${window.location.origin}/encuesta/${activeQrRoom.id}`;
  }, [activeQrRoom]);

  const edificioOptions = useMemo(() => {
    const src =
      hotelFilter === 'all'
        ? roomSurveys
        : roomSurveys.filter((s) => s.hotel === hotelFilter);
    return Array.from(new Set(src.map((s) => s.edificio))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [roomSurveys, hotelFilter]);

  const vistaOptions = useMemo(() => {
    const src = roomSurveys.filter((s) => {
      if (hotelFilter !== 'all' && s.hotel !== hotelFilter) return false;
      if (edificioFilter !== 'all' && s.edificio !== edificioFilter) return false;
      return true;
    });
    return Array.from(new Set(src.map((s) => s.vista))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
  }, [roomSurveys, hotelFilter, edificioFilter]);

  const filteredResponses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roomSurveys.filter((resp) => {
      if (hotelFilter !== 'all' && resp.hotel !== hotelFilter) return false;
      if (edificioFilter !== 'all' && resp.edificio !== edificioFilter) return false;
      if (vistaFilter !== 'all' && resp.vista !== vistaFilter) return false;
      if (scoreFilter === 'criticas' && resp.promedio > 2) return false;
      if (scoreFilter === 'medias' && (resp.promedio <= 2 || resp.promedio >= 4)) return false;
      if (scoreFilter === 'altas' && resp.promedio < 4) return false;
      if (q) {
        const hay = `${resp.numero} ${resp.edificio} ${resp.vista} ${resp.comentario}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roomSurveys, hotelFilter, edificioFilter, vistaFilter, scoreFilter, searchQuery]);

  const handleCopyUrl = async () => {
    if (!qrPublicUrl) return;
    try {
      await navigator.clipboard.writeText(qrPublicUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Fallback ignored in restricted frames
    }
  };

  const hasFilters =
    searchQuery.trim().length > 0 ||
    hotelFilter !== 'all' ||
    edificioFilter !== 'all' ||
    vistaFilter !== 'all' ||
    scoreFilter !== 'all';

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-44 bg-white border border-slate-200 rounded-xl" />
        <div className="h-80 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unread Critical Alerts from Low-Score Room Surveys (<= 2) */}
      {unreadAlerts.length > 0 && (
        <section aria-label="Alertas por calificación crítica" className="space-y-2.5">
          {unreadAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 text-xs text-rose-950">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">{alert.mensaje}</p>
                  <p className="text-[11px] text-rose-800 font-mono tabular-nums">
                    {formatDateTime(alert.fecha)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {alert.tipoAccion === 'ticket' && onGoToMaintenance && (
                  <button
                    type="button"
                    onClick={onGoToMaintenance}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-800 cursor-pointer"
                  >
                    Ver en Mantenimiento
                  </button>
                )}
                {alert.tipoAccion === 'solicitud' && onGoToRequests && (
                  <button
                    type="button"
                    onClick={onGoToRequests}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-800 cursor-pointer"
                  >
                    Ver en Solicitudes
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void dismissAlert(alert.id)}
                  aria-label="Descartar alerta"
                  className="p-1.5 text-rose-700 hover:text-rose-950 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* QR & Public Link Generator (/encuesta/:roomId) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-teal-800 text-xs font-semibold">
                <QrCode className="w-4 h-4" />
                <span>Enlace público y código QR por habitación</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Encuesta pública directa por habitación
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cada habitación tiene su enlace único <span className="font-mono">/encuesta/:roomId</span>.
                Al responder, el sistema copia automáticamente hotel, edificio, piso, vista y número.
                Si el promedio es <strong>2.0 o menor</strong>, genera automáticamente un ticket de
                mantenimiento o una queja y dispara una alerta operativa.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">
                  Buscar habitación
                </label>
                <input
                  type="text"
                  value={qrRoomSearch}
                  onChange={(e) => setQrRoomSearch(e.target.value)}
                  placeholder="Ej. 4124, 5101, Lateral C..."
                  className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">
                  Habitación seleccionada
                </label>
                <select
                  value={activeQrRoom?.id ?? ''}
                  onChange={(e) => setSelectedQrRoomId(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:border-teal-700 focus:outline-none"
                >
                  {qrCandidateRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Hab. {r.numero} · {hotelById.get(r.hotelId)?.nombre ?? r.hotelId} · {r.edificio} · P{r.piso}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeQrRoom && (
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <div className="flex-1 min-w-[220px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-700 truncate">
                  /encuesta/{activeQrRoom.id}
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar enlace
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPublicForm(activeQrRoom.id)}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir formulario público
                </button>
              </div>
            )}
          </div>

          {/* QR Code Preview */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            {activeQrRoom ? (
              <>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <QRCodeSVG value={qrPublicUrl} size={132} level="M" />
                </div>
                <div className="text-center">
                  <p className="font-mono text-sm font-bold text-slate-900">
                    Habitación {activeQrRoom.numero}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {hotelById.get(activeQrRoom.hotelId)?.nombre} · {activeQrRoom.edificio} ·{' '}
                    {activeQrRoom.vista}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">Sin habitaciones cargadas</p>
            )}
          </div>
        </div>
      </section>

      {/* Filters for Room Survey Responses */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar hab. o comentario..."
              className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-700 focus:outline-none"
            />
          </div>

          <select
            value={hotelFilter}
            onChange={(e) => {
              setHotelFilter(e.target.value);
              setEdificioFilter('all');
              setVistaFilter('all');
            }}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="all">Todos los hoteles</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.nombre}>
                {h.nombre}
              </option>
            ))}
          </select>

          <select
            value={edificioFilter}
            onChange={(e) => {
              setEdificioFilter(e.target.value);
              setVistaFilter('all');
            }}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="all">Todos los edificios</option>
            {edificioOptions.map((ed) => (
              <option key={ed} value={ed}>
                {ed}
              </option>
            ))}
          </select>

          <select
            value={vistaFilter}
            onChange={(e) => setVistaFilter(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="all">Todas las vistas</option>
            {vistaOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={scoreFilter}
            onChange={(e) =>
              setScoreFilter(e.target.value as 'all' | 'criticas' | 'medias' | 'altas')
            }
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-800"
          >
            <option value="all">Todas las calificaciones</option>
            <option value="criticas">Críticas (≤ 2.0)</option>
            <option value="medias">Intermedias (2.1 – 3.9)</option>
            <option value="altas">Positivas (4.0 – 5.0)</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span className="font-mono tabular-nums">
            {filteredResponses.length} de {roomSurveys.length} respuestas (n = {filteredResponses.length})
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setHotelFilter('all');
                setEdificioFilter('all');
                setVistaFilter('all');
                setScoreFilter('all');
              }}
              className="inline-flex items-center gap-1 text-teal-800 font-medium hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {/* Responses List */}
      {filteredResponses.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
          No hay encuestas por habitación que coincidan con los filtros actuales.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredResponses.slice(0, visibleLimit).map((resp) => {
            const isCritical = resp.promedio <= 2;
            return (
              <article
                key={resp.id}
                className={`bg-white border rounded-xl p-4 space-y-3 ${
                  isCritical ? 'border-rose-300' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        Hab. {resp.numero}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-medium text-slate-800">{resp.hotel}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">{resp.edificio}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-xs text-slate-600">Piso {resp.piso}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-600">{resp.vista}</span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {formatDateTime(resp.fecha)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 font-mono tabular-nums">
                    <div className="text-right">
                      <span className="block text-[10px] uppercase text-slate-400">Promedio</span>
                      <span
                        className={`inline-flex items-center gap-1 text-sm font-bold ${
                          isCritical
                            ? 'text-rose-700'
                            : resp.promedio >= 4
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {resp.promedio.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] uppercase text-slate-400">NPS</span>
                      <span className="text-sm font-bold text-slate-900">{resp.nps}/10</span>
                    </div>
                  </div>
                </div>

                {/* Area ratings inline */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs">
                  {SURVEY_AREA_KEYS.map((area) => (
                    <div key={area} className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg">
                      <span className="text-slate-600 truncate">{SURVEY_AREA_LABELS[area]}</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {resp.calificaciones[area]}/5
                      </span>
                    </div>
                  ))}
                </div>

                {resp.comentario && (
                  <p className="text-xs text-slate-700 leading-relaxed">“{resp.comentario}”</p>
                )}

                {resp.alertaGenerada && (
                  <div className="text-[11px] font-medium text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>
                      Seguimiento automático creado:{' '}
                      {resp.alertaGenerada.tipo === 'ticket'
                        ? 'Ticket de mantenimiento'
                        : 'Solicitud de queja'}
                    </span>
                  </div>
                )}
              </article>
            );
          })}

          {filteredResponses.length > visibleLimit && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((v) => v + 30)}
                className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Mostrar más respuestas ({filteredResponses.length - visibleLimit} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
