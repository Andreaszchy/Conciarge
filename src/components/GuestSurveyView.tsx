import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  Send,
  Star,
} from 'lucide-react';
import { COVER_THEMES, LIMITS, STAY_TYPES } from '../types';
import type { StayType, Survey } from '../types';
import { submitGuestResponse } from '../services/surveyService';

interface GuestSurveyViewProps {
  survey: Survey;
  isPreview?: boolean;
  onExitPreview?: () => void;
}

const STAR_LABELS: Record<number, string> = {
  1: 'Muy insatisfecho',
  2: 'Insatisfecho',
  3: 'Correcto',
  4: 'Muy bueno',
  5: 'Excelente',
};

export function GuestSurveyView({ survey, isPreview = false, onExitPreview }: GuestSurveyViewProps) {
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [stayType, setStayType] = useState<StayType>('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(!survey.allowAnonymous);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [imgError, setImgError] = useState(false);

  const cover = COVER_THEMES[survey.coverTheme] || COVER_THEMES.lobby;

  const hasOptionalFields =
    survey.collectName || survey.collectEmail || survey.collectRoom || survey.collectStayType;

  const answeredCount = useMemo(() => {
    return survey.questions.filter((q) => {
      const val = answers[q.id];
      return val !== undefined && val !== '' && val !== null;
    }).length;
  }, [answers, survey.questions]);

  const progressPct =
    survey.questions.length > 0 ? Math.round((answeredCount / survey.questions.length) * 100) : 0;

  const handleSetAnswer = (questionId: string, value: string | number) => {
    setErrorMsg('');
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const missingRequired = survey.questions.find((q) => {
      if (!q.required) return false;
      const val = answers[q.id];
      return val === undefined || val === '' || val === null;
    });

    if (missingRequired) {
      setErrorMsg(`Por favor, responde la pregunta obligatoria: "${missingRequired.label}".`);
      return;
    }

    if (!survey.allowAnonymous && survey.collectName && !guestName.trim()) {
      setErrorMsg('Por favor, indica tu nombre para enviar la encuesta.');
      setShowOptionalDetails(true);
      return;
    }

    if (guestEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      setErrorMsg('El formato del correo electrónico opcional no es válido.');
      setShowOptionalDetails(true);
      return;
    }

    setSubmitting(true);
    try {
      await submitGuestResponse(survey, {
        guestName,
        guestEmail,
        roomNumber,
        stayType,
        answers,
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo enviar tu respuesta.';
      setErrorMsg(
        msg.includes('permission')
          ? 'Esta encuesta no está aceptando respuestas en este momento.'
          : 'No pudimos guardar tu respuesta. Inténtalo de nuevo.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setAnswers({});
    setGuestName('');
    setGuestEmail('');
    setRoomNumber('');
    setStayType('');
    setSubmitted(false);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isPreview && onExitPreview && (
        <div className="sticky top-0 z-30 bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <span className="font-medium">Vista previa interactiva para huéspedes</span>
            <span className="text-slate-400 hidden sm:inline" aria-hidden="true">·</span>
            <span className="text-slate-300 hidden sm:inline">
              Las respuestas enviadas aquí se guardan en tiempo real
            </span>
          </div>
          <button
            type="button"
            onClick={onExitPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-slate-900 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al panel
          </button>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Hotel Hero Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="relative h-44 sm:h-52 w-full bg-slate-900 overflow-hidden">
            {!imgError ? (
              <img
                src={cover.imageUrl}
                alt={`Fotografía editorial de ${survey.hotelName}`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-800 via-teal-900 to-slate-900 flex items-center justify-center">
                <Building2 className="w-12 h-12 text-white/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-5 sm:p-7 text-white">
              <p className="text-xs sm:text-sm font-medium text-teal-200 mb-1">
                {survey.hotelName}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {survey.title}
              </h1>
            </div>
          </div>

          {submitted ? (
            <div className="p-8 sm:p-10 text-center">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Opinión enviada correctamente
              </h2>
              <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed mb-8">
                {survey.thankYouMessage ||
                  'Muchas gracias por compartir tu experiencia con nosotros.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetForAnother}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Enviar otra respuesta
                </button>
                {isPreview && onExitPreview && (
                  <button
                    type="button"
                    onClick={onExitPreview}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Ver respuesta en el panel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-8">
              {/* Intro & Quick Progress */}
              <div className="space-y-4 pb-6 border-b border-slate-100">
                {survey.welcomeMessage && (
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                    {survey.welcomeMessage}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>
                      {survey.allowAnonymous
                        ? 'Sin registro obligatorio · Respuesta anónima disponible'
                        : 'Encuesta directa online · Menos de 2 minutos'}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-700">
                    {answeredCount}/{survey.questions.length}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-700 transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-8">
                {survey.questions.map((q, index) => {
                  const currentVal = answers[q.id];
                  return (
                    <fieldset
                      key={q.id}
                      className="space-y-3 pb-7 border-b border-slate-100 last:border-b-0 last:pb-0"
                    >
                      <legend className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                        <span className="font-mono tabular-nums text-slate-400 mr-2">
                          {String(index + 1).padStart(2, '0')}.
                        </span>
                        {q.label}
                        {q.required && (
                          <span className="text-teal-700 ml-1" title="Obligatoria">
                            *
                          </span>
                        )}
                      </legend>

                      {/* Type: 1-5 Star Rating */}
                      {q.type === 'rating' && (
                        <div className="pt-1 space-y-2">
                          <div className="grid grid-cols-5 gap-2">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const selected = Number(currentVal) === star;
                              const active = Number(currentVal || 0) >= star;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => handleSetAnswer(q.id, star)}
                                  aria-label={`${star} de 5 estrellas - ${STAR_LABELS[star]}`}
                                  className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border text-xs font-medium transition-colors min-h-[58px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                                    selected
                                      ? 'bg-teal-50 border-teal-700 text-teal-900'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  <Star
                                    className={`w-5 h-5 ${
                                      active
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-slate-300'
                                    }`}
                                  />
                                  <span className="font-mono tabular-nums">{star}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>1 · Muy insatisfecho</span>
                            {typeof currentVal === 'number' && STAR_LABELS[currentVal] ? (
                              <span className="font-medium text-teal-800">
                                {STAR_LABELS[currentVal]}
                              </span>
                            ) : (
                              <span>5 · Excelente</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Type: NPS 0-10 */}
                      {q.type === 'nps' && (
                        <div className="pt-1 space-y-2">
                          <div className="grid grid-cols-11 gap-1 sm:gap-1.5">
                            {Array.from({ length: 11 }, (_, n) => {
                              const selected = currentVal === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => handleSetAnswer(q.id, n)}
                                  className={`h-11 rounded-lg border text-xs sm:text-sm font-mono tabular-nums font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                                    selected
                                      ? 'bg-slate-900 border-slate-900 text-white'
                                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                                  }`}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>0 · Nada probable</span>
                            <span>10 · Muy probable</span>
                          </div>
                        </div>
                      )}

                      {/* Type: Single Choice */}
                      {q.type === 'choice' && (
                        <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(q.options || []).map((option) => {
                            const selected = currentVal === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => handleSetAnswer(q.id, option)}
                                className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors min-h-[44px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                                  selected
                                    ? 'bg-teal-50 border-teal-700 text-teal-950 font-medium'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Type: Open Text */}
                      {q.type === 'text' && (
                        <div className="pt-1">
                          <textarea
                            rows={3}
                            maxLength={1200}
                            value={typeof currentVal === 'string' ? currentVal : ''}
                            onChange={(e) => handleSetAnswer(q.id, e.target.value)}
                            placeholder="Escribe aquí tus comentarios o sugerencias..."
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                          />
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </div>

              {/* Optional Guest Identification Section (Frictionless & Non-Mandatory) */}
              {hasOptionalFields && (
                <div className="pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-3 py-2 text-left cursor-pointer group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {survey.allowAnonymous
                          ? 'Datos de estancia (opcional — puedes enviarla anónimamente)'
                          : 'Datos de tu estancia'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {survey.allowAnonymous
                          ? 'Si lo deseas, déjanos tu habitación o contacto para dar seguimiento personalizado.'
                          : 'Ayúdanos a contextualizar tu experiencia.'}
                      </p>
                    </div>
                    <span className="text-slate-500 group-hover:text-slate-900 p-1">
                      {showOptionalDetails ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  {showOptionalDetails && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {survey.collectName && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Nombre {survey.allowAnonymous ? '(opcional)' : '*'}
                          </label>
                          <input
                            type="text"
                            maxLength={LIMITS.GUEST_NAME_MAX}
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="Ej. Laura García"
                            className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                          />
                        </div>
                      )}

                      {survey.collectEmail && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Correo electrónico (opcional)
                          </label>
                          <input
                            type="email"
                            maxLength={LIMITS.GUEST_EMAIL_MAX}
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            placeholder="nombre@correo.com"
                            className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                          />
                        </div>
                      )}

                      {survey.collectRoom && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Nº de habitación (opcional)
                          </label>
                          <input
                            type="text"
                            maxLength={LIMITS.ROOM_MAX}
                            value={roomNumber}
                            onChange={(e) => setRoomNumber(e.target.value)}
                            placeholder="Ej. 304"
                            className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                          />
                        </div>
                      )}

                      {survey.collectStayType && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Motivo de la estancia (opcional)
                          </label>
                          <select
                            value={stayType}
                            onChange={(e) => setStayType(e.target.value as StayType)}
                            className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                          >
                            <option value="">Prefiero no indicarlo</option>
                            {STAY_TYPES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-xs text-slate-500">
                  {!guestName && !guestEmail
                    ? 'Se enviará de forma anónima sin crear ninguna cuenta.'
                    : 'Tus datos solo serán visibles para la dirección del hotel.'}
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors min-h-[46px] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Enviando...' : 'Enviar encuesta'}
                </button>
              </div>
            </form>
          )}
        </div>

        <footer className="mt-6 text-center text-xs text-slate-400">
          Encuesta gestionada por {survey.hotelName} · AlbaStay
        </footer>
      </main>
    </div>
  );
}
