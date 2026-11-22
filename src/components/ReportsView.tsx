import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Download, RotateCcw } from 'lucide-react';
import { useHotelOps } from '../context/HotelOpsContext';
import type { RoomSurveyResponse } from '../types/hotelOps';
import { SURVEY_AREA_KEYS, SURVEY_AREA_LABELS } from '../types/hotelOps';

type BreakdownDimension = 'hotel' | 'edificio' | 'vista' | 'piso';

interface MetricBucket {
  key: string;
  label: string;
  sublabel?: string;
  n: number;
  avg: number;
  csat: number;
  nps: number;
}

function calcMetrics(surveys: RoomSurveyResponse[]): {
  n: number;
  avg: number;
  csat: number;
  nps: number;
} {
  const n = surveys.length;
  if (n === 0) return { n: 0, avg: 0, csat: 0, nps: 0 };

  let avgSum = 0;
  let totalAreaScores = 0;
  let satisfiedScores = 0;
  let promoters = 0;
  let detractors = 0;

  for (const s of surveys) {
    avgSum += s.promedio;
    for (const k of SURVEY_AREA_KEYS) {
      const score = s.calificaciones[k];
      totalAreaScores += 1;
      if (score >= 4) satisfiedScores += 1;
    }
    if (s.nps >= 9) promoters += 1;
    else if (s.nps <= 6) detractors += 1;
  }

  return {
    n,
    avg: Math.round((avgSum / n) * 100) / 100,
    csat: totalAreaScores > 0 ? Math.round((satisfiedScores / totalAreaScores) * 100) : 0,
    nps: Math.round(((promoters - detractors) / n) * 100),
  };
}

function getMondayIso(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

function formatWeekLabel(mondayIso: string): string {
  const [y, m, d] = mondayIso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(
    new Date(y, m - 1, d)
  );
}

function escapeCsv(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function ReportsView() {
  const {
    hotels,
    rooms,
    estancias,
    roomSurveys,
    loading,
    error,
    reload,
    hotelById,
  } = useHotelOps();

  const [hotelFilter, setHotelFilter] = useState('all');
  const [dimension, setDimension] = useState<BreakdownDimension>('edificio');

  // Filter surveys by selected hotel
  const filteredSurveys = useMemo(() => {
    if (hotelFilter === 'all') return roomSurveys;
    const targetName = hotelById.get(hotelFilter)?.nombre ?? hotelFilter;
    return roomSurveys.filter((s) => s.hotel === targetName);
  }, [roomSurveys, hotelFilter, hotelById]);

  const overallMetrics = useMemo(() => calcMetrics(filteredSurveys), [filteredSurveys]);

  // Occupancy by hotel & building (using active 'en_casa' stays)
  const occupancyData = useMemo(() => {
    const activeRoomIds = new Set(
      estancias.filter((st) => st.estado === 'en_casa').map((st) => st.roomId)
    );

    const byHotel = hotels.map((h) => {
      const hotelRooms = rooms.filter((r) => r.hotelId === h.id);
      const occupied = hotelRooms.filter((r) => activeRoomIds.has(r.id)).length;
      const pct = hotelRooms.length > 0 ? Math.round((occupied / hotelRooms.length) * 100) : 0;
      return {
        hotelId: h.id,
        nombre: h.nombre,
        cargadas: hotelRooms.length,
        capacidad: h.totalRooms,
        ocupadas: occupied,
        pct,
      };
    });

    const buildingMap = new Map<
      string,
      { hotel: string; edificio: string; total: number; ocupadas: number }
    >();
    const targetRooms =
      hotelFilter === 'all' ? rooms : rooms.filter((r) => r.hotelId === hotelFilter);
    for (const r of targetRooms) {
      const hName = hotelById.get(r.hotelId)?.nombre ?? r.hotelId;
      const key = `${hName}|${r.edificio}`;
      const existing = buildingMap.get(key) ?? {
        hotel: hName,
        edificio: r.edificio,
        total: 0,
        ocupadas: 0,
      };
      existing.total += 1;
      if (activeRoomIds.has(r.id)) existing.ocupadas += 1;
      buildingMap.set(key, existing);
    }

    const byBuilding = Array.from(buildingMap.values())
      .map((item) => ({
        ...item,
        label: item.edificio,
        pct: item.total > 0 ? Math.round((item.ocupadas / item.total) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    const totalLoaded = targetRooms.length;
    const totalOccupied = targetRooms.filter((r) => activeRoomIds.has(r.id)).length;
    const totalPct = totalLoaded > 0 ? Math.round((totalOccupied / totalLoaded) * 100) : 0;

    return { byHotel, byBuilding, totalLoaded, totalOccupied, totalPct };
  }, [hotels, rooms, estancias, hotelFilter, hotelById]);

  // Average by area
  const areaData = useMemo(() => {
    const n = filteredSurveys.length;
    return SURVEY_AREA_KEYS.map((key) => {
      if (n === 0) {
        return { area: SURVEY_AREA_LABELS[key], avg: 0, csat: 0, n: 0 };
      }
      let sum = 0;
      let sat = 0;
      for (const s of filteredSurveys) {
        const val = s.calificaciones[key];
        sum += val;
        if (val >= 4) sat += 1;
      }
      return {
        area: SURVEY_AREA_LABELS[key],
        avg: Math.round((sum / n) * 100) / 100,
        csat: Math.round((sat / n) * 100),
        n,
      };
    }).sort((a, b) => a.avg - b.avg);
  }, [filteredSurveys]);

  // Breakdown by Hotel / Edificio / Vista / Piso — sorted ascending so worst-rated surfaces first!
  const breakdownData = useMemo<MetricBucket[]>(() => {
    const map = new Map<string, { label: string; sublabel?: string; list: RoomSurveyResponse[] }>();

    for (const s of filteredSurveys) {
      let key = '';
      let label = '';
      let sublabel: string | undefined;

      if (dimension === 'hotel') {
        key = s.hotel;
        label = s.hotel;
      } else if (dimension === 'edificio') {
        key = `${s.hotel}|${s.edificio}`;
        label = s.edificio;
        sublabel = s.hotel;
      } else if (dimension === 'vista') {
        key = `${s.edificio}|${s.vista}`;
        label = s.vista;
        sublabel = `${s.hotel} · ${s.edificio}`;
      } else {
        key = `${s.edificio}|P${s.piso}`;
        label = `Piso ${s.piso}`;
        sublabel = `${s.hotel} · ${s.edificio}`;
      }

      const bucket = map.get(key) ?? { label, sublabel, list: [] };
      bucket.list.push(s);
      map.set(key, bucket);
    }

    return Array.from(map.entries())
      .map(([key, bucket]) => {
        const m = calcMetrics(bucket.list);
        return {
          key,
          label: bucket.label,
          sublabel: bucket.sublabel,
          ...m,
        };
      })
      .sort((a, b) => a.avg - b.avg);
  }, [filteredSurveys, dimension]);

  // Weekly satisfaction trend
  const weeklyTrend = useMemo(() => {
    const map = new Map<string, RoomSurveyResponse[]>();
    for (const s of filteredSurveys) {
      const mondayIso = getMondayIso(new Date(s.fecha));
      const list = map.get(mondayIso);
      if (list) list.push(s);
      else map.set(mondayIso, [s]);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mondayIso, list]) => {
        const m = calcMetrics(list);
        return {
          weekIso: mondayIso,
          semana: formatWeekLabel(mondayIso),
          avg: m.avg,
          csat: m.csat,
          nps: m.nps,
          n: m.n,
        };
      });
  }, [filteredSurveys]);

  const worstPerformer = breakdownData[0] ?? null;

  const handleExportCsv = () => {
    const lines: string[] = [];
    lines.push('SECCION,CATEGORIA,DETALLE,PROMEDIO_5,CSAT_PCT,NPS,RESPUESTAS_N');
    lines.push(
      [
        'Resumen General',
        hotelFilter === 'all' ? 'Todo el complejo' : hotelById.get(hotelFilter)?.nombre ?? hotelFilter,
        `Ocupación ${occupancyData.totalPct}% (${occupancyData.totalOccupied}/${occupancyData.totalLoaded})`,
        overallMetrics.avg,
        overallMetrics.csat,
        overallMetrics.nps,
        overallMetrics.n,
      ]
        .map(escapeCsv)
        .join(',')
    );

    for (const a of areaData) {
      lines.push(['Por Área', a.area, '', a.avg, a.csat, '', a.n].map(escapeCsv).join(','));
    }

    for (const b of breakdownData) {
      lines.push(
        [`Por ${dimension}`, b.label, b.sublabel ?? '', b.avg, b.csat, b.nps, b.n]
          .map(escapeCsv)
          .join(',')
      );
    }

    for (const w of weeklyTrend) {
      lines.push(
        ['Tendencia Semanal', w.semana, w.weekIso, w.avg, w.csat, w.nps, w.n]
          .map(escapeCsv)
          .join(',')
      );
    }

    const csv = `\uFEFF${lines.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_operativo_cid_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-xl" />
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
      {/* Header + Filter + Export */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Reportes</h2>
          <p className="text-sm text-slate-600">
            Ocupación, CSAT, NPS, desempeño por torre/vista/piso y tendencia semanal con tamaño de
            muestra (n) visible.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={hotelFilter}
            onChange={(e) => setHotelFilter(e.target.value)}
            aria-label="Filtrar reportes por hotel"
            className="h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:border-teal-700 focus:outline-none"
          >
            <option value="all">Todo el complejo</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Top KPI Strip (always showing n) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Ocupación actual</p>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-slate-900">{occupancyData.totalPct}%</span>
            <span className="text-xs text-slate-500">
              ({occupancyData.totalOccupied}/{occupancyData.totalLoaded} hab.)
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">CSAT (calificaciones 4 o 5)</p>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-teal-800">{overallMetrics.csat}%</span>
            <span className="text-xs text-slate-500">(n = {overallMetrics.n})</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">NPS</p>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span
              className={`text-2xl font-bold ${
                overallMetrics.nps >= 30
                  ? 'text-emerald-700'
                  : overallMetrics.nps >= 0
                    ? 'text-amber-700'
                    : 'text-rose-700'
              }`}
            >
              {overallMetrics.nps > 0 ? `+${overallMetrics.nps}` : overallMetrics.nps}
            </span>
            <span className="text-xs text-slate-500">(n = {overallMetrics.n})</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-slate-500">Promedio general</p>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-slate-900">
              {overallMetrics.avg.toFixed(2)} / 5
            </span>
            <span className="text-xs text-slate-500">(n = {overallMetrics.n})</span>
          </div>
        </div>
      </section>

      {/* Spotlight insight on worst-rated segment */}
      {worstPerformer && overallMetrics.n > 0 && (
        <section className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
          <span>
            Foco de atención ({dimension}):{' '}
            <strong>
              {worstPerformer.label}
              {worstPerformer.sublabel ? ` (${worstPerformer.sublabel})` : ''}
            </strong>{' '}
            registra la calificación más baja con{' '}
            <strong className="font-mono">{worstPerformer.avg.toFixed(2)}/5</strong>, CSAT{' '}
            <strong className="font-mono">{worstPerformer.csat}%</strong> y NPS{' '}
            <strong className="font-mono">{worstPerformer.nps}</strong>{' '}
            <span className="font-mono">(n = {worstPerformer.n})</span>.
          </span>
        </section>
      )}

      {/* Charts Grid Row 1: Weekly Trend + Area Averages */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Satisfaction Trend */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tendencia semanal de satisfacción</h3>
              <p className="text-xs text-slate-500">
                Promedio semanal sobre 5 y CSAT (%) en las últimas 8 semanas
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              n = {overallMetrics.n}
            </span>
          </div>

          {weeklyTrend.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">
              Sin respuestas suficientes para trazar la tendencia semanal.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrend} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: unknown, name: unknown, item: { payload?: { n?: number; csat?: number } }) => {
                      const num = typeof value === 'number' ? value.toFixed(2) : String(value);
                      return [
                        `${num}/5 · CSAT ${item.payload?.csat ?? 0}% (n = ${item.payload?.n ?? 0})`,
                        name === 'avg' ? 'Promedio' : String(name),
                      ];
                    }}
                    contentStyle={{
                      borderRadius: '0.75rem',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0f766e' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Area Averages */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Promedio por área</h3>
              <p className="text-xs text-slate-500">Ordenado de menor a mayor puntaje</p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              n = {overallMetrics.n}
            </span>
          </div>

          {overallMetrics.n === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">Sin datos de encuestas.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={areaData}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    type="category"
                    dataKey="area"
                    width={96}
                    tick={{ fontSize: 11, fill: '#334155' }}
                  />
                  <Tooltip
                    formatter={(value: unknown, _name: unknown, item: { payload?: { csat?: number; n?: number } }) => [
                      `${typeof value === 'number' ? value.toFixed(2) : value}/5 · CSAT ${item.payload?.csat ?? 0}% (n = ${item.payload?.n ?? 0})`,
                      'Calificación',
                    ]}
                    contentStyle={{
                      borderRadius: '0.75rem',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                    {areaData.map((entry) => (
                      <Cell
                        key={entry.area}
                        fill={
                          entry.avg < 3.4 ? '#be123c' : entry.avg < 4 ? '#d97706' : '#0f766e'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Breakdown Ranking: Hotel / Edificio / Vista / Piso (Worst First) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Calificaciones por ubicación (peor evaluadas primero)
            </h3>
            <p className="text-xs text-slate-500">
              Identifica qué hotel, edificio, vista o piso requiere intervención prioritaria.
            </p>
          </div>

          <div className="inline-flex bg-slate-100 rounded-lg p-0.5 self-start">
            {(
              [
                { id: 'hotel', label: 'Hotel' },
                { id: 'edificio', label: 'Edificio' },
                { id: 'vista', label: 'Vista' },
                { id: 'piso', label: 'Piso' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDimension(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  dimension === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {breakdownData.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            No hay respuestas registradas para este filtro.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Bar chart of top 10 lowest-rated buckets */}
            <div className="lg:col-span-5 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={breakdownData.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={118}
                    tick={{ fontSize: 11, fill: '#334155' }}
                  />
                  <Tooltip
                    formatter={(value: unknown, _name: unknown, item: { payload?: MetricBucket }) => [
                      `${typeof value === 'number' ? value.toFixed(2) : value}/5 · CSAT ${item.payload?.csat ?? 0}% · NPS ${item.payload?.nps ?? 0} (n = ${item.payload?.n ?? 0})`,
                      item.payload?.sublabel || 'Promedio',
                    ]}
                    contentStyle={{
                      borderRadius: '0.75rem',
                      borderColor: '#e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                    {breakdownData.slice(0, 10).map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={
                          entry.avg < 3.4 ? '#be123c' : entry.avg < 4 ? '#d97706' : '#0f766e'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table with explicit n */}
            <div className="lg:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3.5">Segmento</th>
                    <th className="py-2.5 px-3.5 text-right">Promedio</th>
                    <th className="py-2.5 px-3.5 text-right">CSAT</th>
                    <th className="py-2.5 px-3.5 text-right">NPS</th>
                    <th className="py-2.5 px-3.5 text-right">Respuestas (n)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {breakdownData.slice(0, 14).map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3.5">
                        <span className="font-semibold text-slate-900 block">{row.label}</span>
                        {row.sublabel && (
                          <span className="text-[11px] text-slate-500">{row.sublabel}</span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-3.5 text-right font-mono font-bold tabular-nums ${
                          row.avg < 3.4
                            ? 'text-rose-700'
                            : row.avg < 4
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {row.avg.toFixed(2)} / 5
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-700 tabular-nums">
                        {row.csat}%
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-700 tabular-nums">
                        {row.nps > 0 ? `+${row.nps}` : row.nps}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-600 tabular-nums">
                        n = {row.n}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Occupancy by Hotel and Building */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Ocupación por hotel y edificio</h3>
          <p className="text-xs text-slate-500">
            Habitaciones con estancia activa (en casa) frente al inventario cargado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {occupancyData.byHotel.map((h) => (
            <div key={h.hotelId} className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-900">{h.nombre}</span>
                <span className="font-mono text-sm font-bold text-teal-800 tabular-nums">
                  {h.pct}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-700 rounded-full" style={{ width: `${h.pct}%` }} />
              </div>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                {h.ocupadas} ocupadas · {h.cargadas} cargadas (cap. {h.capacidad})
              </p>
            </div>
          ))}
        </div>

        {occupancyData.byBuilding.length > 0 && (
          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={occupancyData.byBuilding}
                margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(
                    value: unknown,
                    _name: unknown,
                    item: { payload?: { ocupadas?: number; total?: number; hotel?: string } }
                  ) => [
                    `${value}% (${item.payload?.ocupadas ?? 0}/${item.payload?.total ?? 0} hab.)`,
                    item.payload?.hotel ?? 'Ocupación',
                  ]}
                  contentStyle={{
                    borderRadius: '0.75rem',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="pct" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
