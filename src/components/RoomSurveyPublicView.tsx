import React, { useMemo, useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, Star } from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import type { RoomSurveyRatings, RoomSurveyResponse, SurveyAreaKey } from '../types/hotelOps';
import { SURVEY_AREA_KEYS, SURVEY_AREA_LABELS } from '../types/hotelOps';

interface RoomSurveyPublicViewProps {
  roomIdParam: string;
  isPreview?: boolean;
  onExitPreview?: () => void;
}

export function RoomSurveyPublicView({
  roomIdParam,
  isPreview = false,
  onExitPreview,
}: RoomSurveyPublicViewProps) {
  const { rooms, hotelById, loading, submitRoomSurvey } = useHotelOps();

  const room = useMemo(() => {
    const normalized = roomIdParam.trim().toLowerCase();
    return (
      rooms.find(
        (r) => r.id.toLowerCase() === normalized || r.numero.toLowerCase() === normalized
      ) ?? null
    );
  }, [rooms, roomIdParam]);

  const [ratings, setRatings] = useState<RoomSurveyRatings>({
    limpieza: 5,
    recepcion: 5,
    alberca: 5,
    restaurantes: 5,
    mantenimiento: 5,
  });
  const [nps, setNps] = useState<number>(9);
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedSurvey, setSubmittedSurvey] = useState<RoomSurveyResponse | null>(null);

  const handleSetRating = (area: SurveyAreaKey, value: number) => {
    setRatings((prev) => ({ ...prev, [area]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const saved = await submitRoomSurvey({
        roomId: room.id,
        calificaciones: ratings,
        nps,
        comentario,
      });
      setSubmittedSurvey(saved);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo enviar tu encuesta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/2" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-40 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">Habitación no encontrada</h1>
          <p className="text-sm text-slate-600">
            El código QR o enlace <span className="font-mono">/encuesta/{roomIdParam}</span> no
            corresponde a una habitación registrada.
          </p>
          {onExitPreview && (
            <button
              type="button"
              onClick={onExitPreview}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al panel
            </button>
          )}
        </div>
      </div>
    );
  }

  const hotelName = hotelById.get(room.hotelId)?.nombre ?? room.hotelId;

  if (submittedSurvey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-teal-800 uppercase tracking-wider">
              CID · {hotelName}
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              ¡Muchas gracias por compartir tu opinión!
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Tu evaluación de la habitación{' '}
              <strong className="font-mono text-slate-900">{submittedSurvey.numero}</strong> (
              {submittedSurvey.edificio}, Piso {submittedSurvey.piso}) ha sido registrada. Nuestro
              equipo la revisará para seguir mejorando tu estancia.
            </p>
          </div>

          {submittedSurvey.alertaGenerada && (
            <div className="text-left p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
              Lamentamos los inconvenientes reportados. Hemos notificado de inmediato al equipo
              operativo para dar seguimiento prioritario a tu habitación.
            </div>
          )}

          {onExitPreview && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onExitPreview}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al panel y ver el registro
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        {isPreview && onExitPreview && (
          <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
            <span>
              Vista pública QR: <strong className="font-mono">/encuesta/{room.id}</strong>
            </span>
            <button
              type="button"
              onClick={onExitPreview}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al panel
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-6 py-6 border-b border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-teal-800">
              CID · {hotelName} · {room.edificio}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              ¿Cómo ha sido tu estancia en la habitación{' '}
              <span className="font-mono">{room.numero}</span>?
            </h1>
            <p className="text-xs text-slate-500">
              Piso {room.piso} · Vista {room.vista} · Toma menos de 1 minuto
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {submitError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {submitError}
              </div>
            )}

            {/* Area Star Ratings (1-5) */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                1. Califica cada área de tu estancia (1 a 5 estrellas)
              </h2>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {SURVEY_AREA_KEYS.map((area) => {
                  const val = ratings[area];
                  return (
                    <div
                      key={area}
                      className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white"
                    >
                      <span className="text-sm font-medium text-slate-800">
                        {SURVEY_AREA_LABELS[area]}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = star <= val;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleSetRating(area, star)}
                              aria-label={`${SURVEY_AREA_LABELS[area]}: ${star} estrellas`}
                              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Star
                                className={`w-6 h-6 transition-colors ${
                                  active
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-slate-300'
                                }`}
                              />
                            </button>
                          );
                        })}
                        <span className="font-mono text-xs font-semibold text-slate-600 w-7 text-right tabular-nums">
                          {val}/5
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NPS (0-10) */}
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  2. ¿Qué tan probable es que nos recomiendes? (0 a 10)
                </h2>
                <p className="text-xs text-slate-500">
                  0 = Nada probable · 10 = Totalmente probable
                </p>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                {Array.from({ length: 11 }, (_, score) => {
                  const isSelected = nps === score;
                  return (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setNps(score)}
                      className={`min-h-[42px] rounded-lg font-mono text-sm font-bold border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <label
                htmlFor="room-survey-comment"
                className="block text-sm font-bold text-slate-900"
              >
                3. Comentarios o sugerencias (opcional)
              </label>
              <textarea
                id="room-survey-comment"
                rows={4}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Cuéntanos qué te gustó o en qué podemos mejorar tu habitación..."
                className="w-full p-3.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] px-6 py-3 text-sm font-semibold text-white bg-teal-700 rounded-xl hover:bg-teal-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {submitting ? 'Enviando evaluación...' : 'Enviar encuesta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
