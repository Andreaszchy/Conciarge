import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  Plus,
  Save,
  Share2,
  Trash2,
} from 'lucide-react';
import { SURVEY_TEMPLATES } from '../data/templates';
import type {
  CoverTheme,
  QuestionCategory,
  QuestionType,
  Survey,
  SurveyQuestion,
  SurveyStatus,
} from '../types';
import { COVER_THEMES, LIMITS, QUESTION_CATEGORIES } from '../types';
import type { SurveyDraftInput } from '../services/surveyService';

interface SurveyBuilderViewProps {
  existingSurvey: Survey | null;
  onSave: (draft: SurveyDraftInput, existingId?: string) => Promise<string>;
  onCancel?: () => void;
  onSavedAndShare: (surveyId: string) => void;
  onPreviewSurvey?: (survey: Survey) => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating: 'Estrellas (1–5)',
  nps: 'Recomendación NPS (0–10)',
  choice: 'Selección única',
  text: 'Opinión abierta',
};

function createInitialDraft(survey: Survey | null): SurveyDraftInput {
  if (survey) {
    return {
      hotelName: survey.hotelName,
      title: survey.title,
      welcomeMessage: survey.welcomeMessage,
      thankYouMessage: survey.thankYouMessage,
      coverTheme: survey.coverTheme,
      status: survey.status,
      allowAnonymous: survey.allowAnonymous,
      collectName: survey.collectName,
      collectEmail: survey.collectEmail,
      collectRoom: survey.collectRoom,
      collectStayType: survey.collectStayType,
      autoAnalyze: survey.autoAnalyze,
      questions: survey.questions.map((q) => ({
        ...q,
        options: q.options ? [...q.options] : undefined,
      })),
    };
  }

  const base = SURVEY_TEMPLATES[0];
  return {
    hotelName: 'Hotel Mirador del Alba',
    title: base.defaultTitle,
    welcomeMessage: base.defaultWelcome,
    thankYouMessage: base.defaultThankYou,
    coverTheme: base.coverTheme,
    status: 'active',
    allowAnonymous: true,
    collectName: true,
    collectEmail: true,
    collectRoom: true,
    collectStayType: true,
    autoAnalyze: true,
    questions: base.questions.map((q) => ({ ...q, options: q.options ? [...q.options] : undefined })),
  };
}

export function SurveyBuilderView({
  existingSurvey,
  onSave,
  onCancel,
  onSavedAndShare,
  onPreviewSurvey,
}: SurveyBuilderViewProps) {
  const [draft, setDraft] = useState<SurveyDraftInput>(() => createInitialDraft(existingSurvey));
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setDraft(createInitialDraft(existingSurvey));
    setSavedNotice(false);
    setErrorMsg('');
  }, [existingSurvey?.id]);

  const applyTemplate = (templateId: string) => {
    const tpl = SURVEY_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setDraft((prev) => ({
      ...prev,
      title: tpl.defaultTitle,
      welcomeMessage: tpl.defaultWelcome,
      thankYouMessage: tpl.defaultThankYou,
      coverTheme: tpl.coverTheme,
      questions: tpl.questions.map((q) => ({
        ...q,
        options: q.options ? [...q.options] : undefined,
      })),
    }));
  };

  const addQuestion = (type: QuestionType) => {
    if (draft.questions.length >= LIMITS.QUESTIONS_MAX) {
      setErrorMsg(`El máximo permitido es de ${LIMITS.QUESTIONS_MAX} preguntas por encuesta.`);
      return;
    }
    const id = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const defaults: Record<QuestionType, SurveyQuestion> = {
      rating: {
        id,
        type: 'rating',
        label: '¿Cómo valorarías este servicio del hotel?',
        category: 'General',
        required: false,
      },
      nps: {
        id,
        type: 'nps',
        label: '¿Con qué probabilidad recomendarías nuestro hotel?',
        category: 'General',
        required: true,
      },
      choice: {
        id,
        type: 'choice',
        label: 'Selecciona la opción que mejor refleje tu experiencia',
        category: 'General',
        required: false,
        options: ['Excelente', 'Buena', 'Regular', 'Mejorable'],
      },
      text: {
        id,
        type: 'text',
        label: 'Cuéntanos qué podemos mejorar en tu próxima estancia',
        category: 'General',
        required: false,
      },
    };
    setDraft((prev) => ({
      ...prev,
      questions: [...prev.questions, defaults[type]],
    }));
  };

  const updateQuestion = (index: number, patch: Partial<SurveyQuestion>) => {
    setDraft((prev) => {
      const next = [...prev.questions];
      const updated = { ...next[index], ...patch };
      if (patch.type === 'choice' && (!updated.options || updated.options.length === 0)) {
        updated.options = ['Excelente', 'Buena', 'Regular', 'Mejorable'];
      }
      next[index] = updated;
      return { ...prev, questions: next };
    });
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.questions.length) return prev;
      const next = [...prev.questions];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, questions: next };
    });
  };

  const removeQuestion = (index: number) => {
    if (draft.questions.length <= 1) {
      setErrorMsg('La encuesta debe tener al menos una pregunta.');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const handleSaveAction = async (openShareAfter: boolean) => {
    setErrorMsg('');
    if (!draft.hotelName.trim()) {
      setErrorMsg('Introduce el nombre del hotel.');
      return;
    }
    if (!draft.title.trim()) {
      setErrorMsg('Introduce un título para la encuesta.');
      return;
    }
    if (draft.questions.length === 0) {
      setErrorMsg('Añade al menos una pregunta a la encuesta.');
      return;
    }

    setSaving(true);
    try {
      const id = await onSave(draft, existingSurvey?.id);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
      if (openShareAfter) {
        onSavedAndShare(id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la encuesta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Templates Strip (for fast creation) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Plantillas hoteleras rápidas</h2>
            <p className="text-xs text-slate-500">
              Carga una estructura optimizada para huéspedes y personalízala a tu gusto
            </p>
          </div>
          {existingSurvey && onPreviewSurvey && (
            <button
              type="button"
              onClick={() => onPreviewSurvey(existingSurvey)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:text-teal-950 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Probar encuesta actual como huésped
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SURVEY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl.id)}
              className="text-left p-4 rounded-xl border border-slate-200 hover:border-teal-700 hover:bg-slate-50/70 transition-colors cursor-pointer"
            >
              <p className="text-sm font-semibold text-slate-900">{tpl.name}</p>
              <p className="text-xs text-slate-500 mt-1 font-mono">{tpl.durationLabel}</p>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{tpl.description}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Survey Identity, Cover & Guest Frictionless Access (5 cols) */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Configuración general</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Personaliza la cabecera y la experiencia del huésped
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nombre del hotel
              </label>
              <input
                type="text"
                maxLength={LIMITS.HOTEL_NAME_MAX}
                value={draft.hotelName}
                onChange={(e) => setDraft({ ...draft, hotelName: e.target.value })}
                placeholder="Ej. Hotel Mirador del Alba"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Título de la encuesta
              </label>
              <input
                type="text"
                maxLength={LIMITS.TITLE_MAX}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Encuesta de Satisfacción de Estancia"
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Mensaje de bienvenida
              </label>
              <textarea
                rows={3}
                maxLength={LIMITS.WELCOME_MAX}
                value={draft.welcomeMessage}
                onChange={(e) => setDraft({ ...draft, welcomeMessage: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Mensaje de agradecimiento al finalizar
              </label>
              <textarea
                rows={2}
                maxLength={LIMITS.THANK_YOU_MAX}
                value={draft.thankYouMessage}
                onChange={(e) => setDraft({ ...draft, thankYouMessage: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>

            {/* Cover Banner Selector */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-medium text-slate-700">
                Fotografía de cabecera
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(Object.keys(COVER_THEMES) as CoverTheme[]).map((themeKey) => {
                  const theme = COVER_THEMES[themeKey];
                  const selected = draft.coverTheme === themeKey;
                  return (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setDraft({ ...draft, coverTheme: themeKey })}
                      className={`text-left rounded-lg overflow-hidden border transition-colors cursor-pointer ${
                        selected
                          ? 'border-teal-700 ring-2 ring-teal-700/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="h-16 bg-slate-100 overflow-hidden">
                        <img
                          src={theme.imageUrl}
                          alt={theme.label}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="px-2 py-1.5 text-[11px] font-medium text-slate-800 truncate">
                        {theme.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Guest Frictionless Access & Optional Registration Settings */}
          <div className="pt-5 border-t border-slate-200 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Acceso online sin registro para huéspedes
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Maximiza las respuestas evitando formularios de cuenta obligatorios
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.allowAnonymous}
                onChange={(e) => setDraft({ ...draft, allowAnonymous: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <div>
                <span className="text-sm font-medium text-slate-900">
                  Permitir envío 100% anónimo (sin registro)
                </span>
                <p className="text-xs text-slate-500">
                  Los datos de contacto quedan como sección desplegable opcional al final.
                </p>
              </div>
            </label>

            <div className="pl-7 grid grid-cols-2 gap-2.5 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.collectName}
                  onChange={(e) => setDraft({ ...draft, collectName: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Nombre (opcional)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.collectEmail}
                  onChange={(e) => setDraft({ ...draft, collectEmail: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Correo (opcional)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.collectRoom}
                  onChange={(e) => setDraft({ ...draft, collectRoom: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Nº habitación
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.collectStayType}
                  onChange={(e) => setDraft({ ...draft, collectStayType: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Tipo de estancia
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.autoAnalyze}
                  onChange={(e) => setDraft({ ...draft, autoAnalyze: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                <div>
                  <span className="text-sm font-medium text-slate-900">
                    Análisis automático de opiniones con IA
                  </span>
                  <p className="text-xs text-slate-500">
                    Actualiza automáticamente sentimiento, fortalezas y mejoras cuando llegan nuevas
                    respuestas.
                  </p>
                </div>
              </label>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-medium text-slate-700">Estado de publicación</span>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as SurveyStatus })}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-teal-700 focus:outline-none"
                >
                  <option value="active">Activa (recibiendo respuestas)</option>
                  <option value="paused">Pausada (cerrada temporalmente)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Questions Builder (7 cols) */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Preguntas de la encuesta ({draft.questions.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ordena, edita categorías departamentales o añade nuevas preguntas
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {draft.questions.map((q, index) => (
              <div key={q.id} className="p-5 sm:p-6 space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <span className="font-semibold text-slate-800">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{QUESTION_TYPE_LABELS[q.type]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveQuestion(index, -1)}
                      disabled={index === 0}
                      aria-label="Subir pregunta"
                      className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === draft.questions.length - 1}
                      aria-label="Bajar pregunta"
                      className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      aria-label="Eliminar pregunta"
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  maxLength={220}
                  value={q.label}
                  onChange={(e) => updateQuestion(index, { label: e.target.value })}
                  placeholder="Escribe el enunciado de la pregunta..."
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(index, { type: e.target.value as QuestionType })}
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:border-teal-700 focus:outline-none"
                  >
                    {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((qt) => (
                      <option key={qt} value={qt}>
                        {QUESTION_TYPE_LABELS[qt]}
                      </option>
                    ))}
                  </select>

                  <select
                    value={q.category}
                    onChange={(e) =>
                      updateQuestion(index, { category: e.target.value as QuestionCategory })
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 focus:border-teal-700 focus:outline-none"
                  >
                    {QUESTION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        Área: {cat}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer sm:justify-end">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700"
                    />
                    Obligatoria
                  </label>
                </div>

                {q.type === 'choice' && (
                  <div className="pt-2 space-y-2">
                    <label className="block text-xs text-slate-500">
                      Opciones (separadas por coma)
                    </label>
                    <input
                      type="text"
                      value={(q.options || []).join(', ')}
                      onChange={(e) =>
                        updateQuestion(index, {
                          options: e.target.value.split(',').map((s) => s.trim()),
                        })
                      }
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-teal-700 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Question Bar */}
          <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 mr-1">Añadir pregunta:</span>
              {(['rating', 'nps', 'choice', 'text'] as QuestionType[]).map((qt) => (
                <button
                  key={qt}
                  type="button"
                  onClick={() => addQuestion(qt)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {QUESTION_TYPE_LABELS[qt]}
                </button>
              ))}
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
              >
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <div>
                {savedNotice && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <Check className="w-4 h-4" />
                    Cambios guardados correctamente
                  </span>
                )}
                {onCancel && !savedNotice && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveAction(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Guardando...' : existingSurvey ? 'Guardar cambios' : 'Crear encuesta'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveAction(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Guardar y obtener enlace / QR
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
