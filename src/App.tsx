import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  BarChart3,
  Building2,
  ClipboardList,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Share2,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  createSurvey,
  deleteResponse,
  deleteSurvey,
  fetchPublicSurvey,
  runAndSaveOpinionAnalysis,
  seedSampleHotelSurvey,
  subscribeToOwnerSurveys,
  subscribeToSurveyAnalyses,
  subscribeToSurveyResponses,
  toggleSurveyStatus,
  updateSurvey,
} from './services/surveyService';
import type { SurveyDraftInput } from './services/surveyService';
import type { OpinionAnalysis, Survey, SurveyResponseRecord } from './types';
import { COVER_THEMES } from './types';
import { exportSurveyToExcel } from './utils/excelExport';
import { AnalyticsView } from './components/AnalyticsView';
import { GeneralDashboardView } from './components/GeneralDashboardView';
import { GuestSurveyView } from './components/GuestSurveyView';
import { ResponsesTableView } from './components/ResponsesTableView';
import { ShareSurveyModal } from './components/ShareSurveyModal';
import { SurveyBuilderView } from './components/SurveyBuilderView';
import { SurveysListView } from './components/SurveysListView';

type DashboardSection = 'home' | 'encuestas';
type WorkspaceTab = 'analytics' | 'responses' | 'builder' | 'surveys';

function getPublicSurveyIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('encuesta') || params.get('survey');
  return id ? id.trim() : null;
}

export default function App() {
  // Public guest mode detection (?encuesta=<id>) — works with ZERO login
  const [publicSurveyId] = useState<string | null>(() => getPublicSurveyIdFromUrl());
  const [publicSurvey, setPublicSurvey] = useState<Survey | null>(null);
  const [publicLoading, setPublicLoading] = useState<boolean>(() => Boolean(getPublicSurveyIdFromUrl()));

  // Hotel manager auth state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  // Workspace data
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponseRecord[]>([]);
  const [analyses, setAnalyses] = useState<OpinionAnalysis[]>([]);

  // UI state
  const [activeSection, setActiveSection] = useState<DashboardSection>('home');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('analytics');
  const [creatingNew, setCreatingNew] = useState(false);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  const [shareModalSurvey, setShareModalSurvey] = useState<Survey | null>(null);
  const [pendingShareSurveyId, setPendingShareSurveyId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [seedingSample, setSeedingSample] = useState(false);

  // AI analysis execution state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [heroImgError, setHeroImgError] = useState(false);

  // 1. Load public survey if URL has ?encuesta=<id>
  useEffect(() => {
    if (!publicSurveyId) return;
    let cancelled = false;
    setPublicLoading(true);
    fetchPublicSurvey(publicSurveyId)
      .then((found) => {
        if (!cancelled) {
          setPublicSurvey(found);
          setPublicLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPublicSurvey(null);
          setPublicLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicSurveyId]);

  // 2. Listen to Firebase Auth state (only needed for hotel management workspace)
  useEffect(() => {
    if (publicSurveyId) return;
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsub;
  }, [publicSurveyId]);

  // 3. Subscribe to hotel manager's surveys once authenticated
  useEffect(() => {
    if (publicSurveyId || !authReady || !user) {
      setSurveys([]);
      return;
    }
    setSurveysLoading(true);
    const unsub = subscribeToOwnerSurveys(
      user.uid,
      (list) => {
        setSurveys(list);
        setSurveysLoading(false);
        setSelectedSurveyId((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      },
      () => {
        setSurveysLoading(false);
      }
    );
    return unsub;
  }, [publicSurveyId, authReady, user]);

  // 4. Subscribe to responses & analyses for the active survey
  useEffect(() => {
    if (!user || !selectedSurveyId) {
      setResponses([]);
      setAnalyses([]);
      return;
    }
    setAnalysisError('');
    const unsubResp = subscribeToSurveyResponses(selectedSurveyId, user.uid, setResponses);
    const unsubAnl = subscribeToSurveyAnalyses(selectedSurveyId, user.uid, setAnalyses);
    return () => {
      unsubResp();
      unsubAnl();
    };
  }, [user, selectedSurveyId]);

  const activeSurvey = useMemo(
    () => surveys.find((s) => s.id === selectedSurveyId) ?? null,
    [surveys, selectedSurveyId]
  );

  useEffect(() => {
    if (!pendingShareSurveyId) return;
    const found = surveys.find((s) => s.id === pendingShareSurveyId);
    if (found) {
      setShareModalSurvey(found);
      setPendingShareSurveyId(null);
    }
  }, [pendingShareSurveyId, surveys]);

  const latestAnalysis = analyses[0] ?? null;

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSelectedSurveyId(null);
    setSurveys([]);
    setResponses([]);
    setAnalyses([]);
  };

  const handleRunAnalysis = useCallback(async () => {
    if (!activeSurvey || !user || responses.length === 0) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      await runAndSaveOpinionAnalysis(activeSurvey, responses, user.uid);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'No se pudo completar el análisis automático.'
      );
    } finally {
      setAnalyzing(false);
    }
  }, [activeSurvey, user, responses]);

  const handleSaveSurvey = async (
    draft: SurveyDraftInput,
    existingId?: string
  ): Promise<string> => {
    if (!user) throw new Error('Sesión no iniciada.');
    if (existingId) {
      await updateSurvey(existingId, draft);
      return existingId;
    }
    const newId = await createSurvey(user.uid, draft);
    setSelectedSurveyId(newId);
    setCreatingNew(false);
    return newId;
  };

  const handleSeedSample = async () => {
    if (!user) return;
    setSeedingSample(true);
    try {
      const newId = await seedSampleHotelSurvey(user.uid);
      setSelectedSurveyId(newId);
      setCreatingNew(false);
      setActiveTab('analytics');
    } finally {
      setSeedingSample(false);
    }
  };

  const handleToggleStatus = async (survey: Survey) => {
    const next = survey.status === 'active' ? 'paused' : 'active';
    await toggleSurveyStatus(survey.id, next);
  };

  const handleDeleteSurvey = async (survey: Survey) => {
    await deleteSurvey(survey.id);
    if (selectedSurveyId === survey.id) {
      setSelectedSurveyId(null);
    }
  };

  // --- MODE 1: Public Online Guest Survey (?encuesta=<id>) ---
  if (publicSurveyId) {
    if (publicLoading) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-4 animate-pulse">
            <div className="h-32 bg-slate-100 rounded-xl" />
            <div className="h-5 bg-slate-100 rounded w-2/3" />
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-12 bg-slate-100 rounded-xl" />
          </div>
        </div>
      );
    }

    if (!publicSurvey || publicSurvey.status !== 'active') {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
            <h1 className="text-lg font-bold text-slate-900">Encuesta no disponible</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Este enlace no corresponde a una encuesta activa o el hotel ha finalizado la recogida
              de opiniones.
            </p>
          </div>
        </div>
      );
    }

    return <GuestSurveyView survey={publicSurvey} />;
  }

  // --- MODE 2: Live Interactive Guest Preview from Manager Panel ---
  if (previewSurvey) {
    return (
      <GuestSurveyView
        survey={previewSurvey}
        isPreview
        onExitPreview={() => setPreviewSurvey(null)}
      />
    );
  }

  // --- Auth Loading ---
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-500">Cargando espacio de trabajo...</div>
      </div>
    );
  }

  // --- MODE 3: Hotel Manager Welcome & Sign-In Screen ---
  if (!user) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col">
        {/* Strict 3-zone Top Bar Contract */}
        <header className="w-full border-b border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
            <a
              href="/"
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              CID
            </a>
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
              <a
                href="#flujo"
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Cómo funciona
              </a>
              <a
                href="#capacidades"
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Excel e IA
              </a>
              <a
                href="#privacidad"
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                Sin registro
              </a>
            </nav>
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {signingIn ? 'Conectando...' : 'Acceder al panel'}
              </button>
            </div>
          </div>
        </header>

        {/* Hero 2-Column Balanced Split */}
        <main className="flex-1">
          <section className="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                <p className="text-xs font-semibold text-teal-800">
                  Gestión de experiencia del huésped · Hoteles y alojamientos
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12]">
                  Encuestas hoteleras sin fricción, Excel al instante y análisis automático.
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                  Crea encuestas personalizadas en minutos y compártelas mediante enlace directo o
                  código QR. Tus huéspedes responden desde el móvil sin registrarse, mientras el
                  panel analiza automáticamente cada opinión y prepara informes listos para Excel.
                </p>

                {authError && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                    {authError}
                  </p>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={signingIn}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {signingIn ? 'Iniciando sesión...' : 'Comenzar con Google'}
                  </button>
                  <span className="text-xs text-slate-500">
                    Solo el hotel inicia sesión · Los huéspedes responden sin cuenta
                  </span>
                </div>
              </div>

              <div className="lg:col-span-6 min-h-[320px] lg:min-h-[460px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                {!heroImgError ? (
                  <img
                    src={COVER_THEMES.lobby.imageUrl}
                    alt="Vestíbulo luminoso de hotel boutique mediterráneo"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgError(true)}
                    className="w-full h-full lg:h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-teal-900 flex items-center justify-center">
                    <Building2 className="w-16 h-16 text-white/30" />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3-Column Feature Strip below hero */}
          <section id="capacidades" className="border-t border-slate-200 bg-slate-50">
            <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div id="privacidad" className="space-y-2">
                <p className="font-mono text-xs font-semibold text-teal-800">01. Respuesta fluida</p>
                <h2 className="text-base font-bold text-slate-900">
                  Online sin registro obligatorio
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cada encuesta genera una URL única y un código QR descargable. Los huéspedes
                  contestan en menos de dos minutos de forma anónima o dejando sus datos de manera
                  opcional.
                </p>
              </div>
              <div id="flujo" className="space-y-2">
                <p className="font-mono text-xs font-semibold text-teal-800">
                  02. Inteligencia aplicada
                </p>
                <h2 className="text-base font-bold text-slate-900">
                  Análisis automático de opiniones
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Clasifica el sentimiento de cada comentario, agrupa fortalezas, señala mejoras por
                  departamento hotelero y redacta un plan de acción ejecutivo.
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-xs font-semibold text-teal-800">
                  03. Reporte operativo
                </p>
                <h2 className="text-base font-bold text-slate-900">
                  Exportación multi-hoja a Excel
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Descarga un libro .xlsx estructurado con todas las respuestas detalladas, cálculo
                  de NPS y medias por área, además del resumen del análisis automático.
                </p>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-slate-200 py-5 px-6 text-center text-xs text-slate-500">
          CID · Plataforma de satisfacción para hoteles
        </footer>
      </div>
    );
  }

  // --- MODE 4: Authenticated Hotel Manager Workspace ---
  const tabMeta: Record<WorkspaceTab, { label: string }> = {
    analytics: { label: 'Resumen y Análisis' },
    responses: { label: 'Respuestas y Excel' },
    builder: { label: creatingNew ? 'Nueva encuesta' : 'Generador de encuestas' },
    surveys: { label: 'Mis encuestas' },
  };

  const navItems: Array<{ id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'analytics', label: 'Resumen y Análisis', icon: BarChart3 },
    { id: 'responses', label: 'Respuestas y Excel', icon: FileSpreadsheet },
    { id: 'builder', label: 'Editor de encuesta', icon: SlidersHorizontal },
    { id: 'surveys', label: 'Mis encuestas', icon: FolderKanban },
  ];

  const handleOpenSection = (section: DashboardSection) => {
    setActiveSection(section);
    setCreatingNew(false);
    setMobileMenuOpen(false);
  };

  const handleSelectNav = (tab: WorkspaceTab) => {
    setActiveSection('encuestas');
    setCreatingNew(false);
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleStartNewSurvey = () => {
    setActiveSection('encuestas');
    setCreatingNew(true);
    setActiveTab('builder');
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
          ConcIArge
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Cerrar menú"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Dashboard Sections */}
      <nav className="p-3 border-b border-slate-200 space-y-1">
        <button
          type="button"
          onClick={() => handleOpenSection('home')}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeSection === 'home'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <LayoutGrid className="w-4 h-4 shrink-0" />
          <span className="truncate">Panel general</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenSection('encuestas')}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeSection === 'encuestas'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-4 h-4 shrink-0" />
          <span className="truncate">Encuestas</span>
        </button>
      </nav>

      {/* Contextual Encuestas Sub-Workspace Controls */}
      {activeSection === 'encuestas' ? (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Active Survey Switcher */}
          <div className="p-4 border-b border-slate-200 space-y-2.5">
            <label className="block text-[11px] font-medium text-slate-500">Encuesta activa</label>
            {surveys.length > 0 ? (
              <select
                value={selectedSurveyId || ''}
                onChange={(e) => {
                  setSelectedSurveyId(e.target.value);
                  setCreatingNew(false);
                }}
                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-teal-700 focus:outline-none truncate"
              >
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.hotelName})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-slate-400">Sin encuestas aún</p>
            )}

            <button
              type="button"
              onClick={handleStartNewSurvey}
              className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva encuesta
            </button>
          </div>

          {/* Encuestas Sub-Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id && !(item.id === 'builder' && creatingNew);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            {activeSurvey && (
              <div className="pt-4 mt-4 border-t border-slate-200 px-1 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setPreviewSurvey(activeSurvey);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  Probar como huésped
                </button>
              </div>
            )}
          </nav>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Account Footer */}
      <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 truncate">
            {user.displayName || 'Dirección de Hotel'}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors shrink-0 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white h-full border-r border-slate-200">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Workspace Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir navegación"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              {activeSection === 'home' ? (
                <h1 className="font-bold text-slate-900 truncate">Panel general</h1>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenSection('home')}
                    className="text-slate-400 hover:text-slate-700 transition-colors hidden sm:inline whitespace-nowrap cursor-pointer"
                  >
                    Panel general
                  </button>
                  <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                    /
                  </span>
                  <span className="text-slate-500 hidden md:inline whitespace-nowrap">
                    Encuestas
                  </span>
                  <span className="text-slate-300 hidden md:inline" aria-hidden="true">
                    /
                  </span>
                  <h1 className="font-bold text-slate-900 truncate">{tabMeta[activeTab].label}</h1>
                </>
              )}
            </div>
          </div>

          {activeSection === 'encuestas' && activeSurvey && !creatingNew && (
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => exportSurveyToExcel(activeSurvey, responses, latestAnalysis)}
                disabled={responses.length === 0}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Excel
              </button>
              <button
                type="button"
                onClick={() => setShareModalSurvey(activeSurvey)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartir / QR
              </button>
            </div>
          )}
        </header>

        {/* Viewport Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'home' ? (
            <GeneralDashboardView
              userName={user.displayName}
              surveys={surveys}
              loading={surveysLoading}
              onOpenEncuestas={() => handleOpenSection('encuestas')}
            />
          ) : surveysLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-28 bg-white border border-slate-200 rounded-xl" />
              <div className="h-72 bg-white border border-slate-200 rounded-xl" />
            </div>
          ) : surveys.length === 0 && !creatingNew ? (
            /* Empty Onboarding State */
            <div className="max-w-3xl mx-auto my-8 bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-teal-800">Primeros pasos</p>
                <h2 className="text-2xl font-bold text-slate-900">
                  Crea tu primera encuesta de satisfacción hotelera
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                  Configura tus preguntas en segundos o carga una encuesta de ejemplo con 8
                  opiniones realistas de huéspedes para probar de inmediato los gráficos, el
                  análisis automático con IA y la exportación a Excel.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  disabled={seedingSample}
                  onClick={handleSeedSample}
                  className="text-left p-6 rounded-xl border border-teal-700 bg-teal-50/40 hover:bg-teal-50/80 transition-colors space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-teal-800">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-bold text-slate-900">
                      {seedingSample
                        ? 'Creando encuesta de ejemplo...'
                        : 'Cargar encuesta de ejemplo (8 opiniones)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Crea "Hotel CID" con respuestas anónimas y con contacto para
                    explorar el análisis automático y descargar el Excel al instante.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleStartNewSurvey}
                  className="text-left p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition-colors space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-slate-900">
                    <ClipboardList className="w-4 h-4" />
                    <span className="text-sm font-bold">Diseñar mi encuesta desde cero</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Elige una plantilla hotelera, define preguntas, fotografía de portada y genera tu
                    enlace público sin registro y código QR.
                  </p>
                </button>
              </div>
            </div>
          ) : creatingNew || activeTab === 'builder' ? (
            <SurveyBuilderView
              existingSurvey={creatingNew ? null : activeSurvey}
              onSave={handleSaveSurvey}
              onCancel={creatingNew ? () => setCreatingNew(false) : undefined}
              onSavedAndShare={(savedId) => {
                setSelectedSurveyId(savedId);
                setCreatingNew(false);
                const found = surveys.find((s) => s.id === savedId);
                if (found) {
                  setShareModalSurvey(found);
                } else {
                  setPendingShareSurveyId(savedId);
                }
              }}
              onPreviewSurvey={(s) => setPreviewSurvey(s)}
            />
          ) : activeTab === 'surveys' ? (
            <SurveysListView
              surveys={surveys}
              selectedSurveyId={selectedSurveyId}
              onSelectSurvey={(id, goToTab = 'analytics') => {
                setSelectedSurveyId(id);
                setCreatingNew(false);
                setActiveTab(goToTab);
              }}
              onCreateNew={handleStartNewSurvey}
              onShare={(s) => setShareModalSurvey(s)}
              onPreview={(s) => setPreviewSurvey(s)}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteSurvey}
            />
          ) : activeSurvey && activeTab === 'responses' ? (
            <ResponsesTableView
              survey={activeSurvey}
              responses={responses}
              latestAnalysis={latestAnalysis}
              onDeleteResponse={(respId) => deleteResponse(activeSurvey.id, respId)}
              onOpenGuestPreview={() => setPreviewSurvey(activeSurvey)}
            />
          ) : activeSurvey ? (
            <AnalyticsView
              survey={activeSurvey}
              responses={responses}
              latestAnalysis={latestAnalysis}
              analyzing={analyzing}
              analysisError={analysisError}
              onRunAnalysis={handleRunAnalysis}
              onOpenShare={() => setShareModalSurvey(activeSurvey)}
              onOpenGuestPreview={() => setPreviewSurvey(activeSurvey)}
            />
          ) : null}
        </main>
      </div>

      {/* Share & QR Modal */}
      {shareModalSurvey && (
        <ShareSurveyModal
          survey={shareModalSurvey}
          onClose={() => setShareModalSurvey(null)}
          onOpenGuestPreview={(s) => setPreviewSurvey(s)}
        />
      )}
    </div>
  );
}
