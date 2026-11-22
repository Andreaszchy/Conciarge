import * as XLSX from 'xlsx';
import type { OpinionAnalysis, Survey, SurveyResponseRecord } from '../types';

function formatTimestamp(ts: SurveyResponseRecord['submittedAt']): string {
  if (!ts) return '';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date();
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

export function computeSurveyMetrics(survey: Survey, responses: SurveyResponseRecord[]) {
  const total = responses.length;
  if (total === 0) {
    return {
      total: 0,
      avgRating: 0,
      nps: 0,
      promotersPct: 0,
      passivesPct: 0,
      detractorsPct: 0,
      anonymousPct: 0,
      questionStats: survey.questions
        .filter((q) => q.type === 'rating')
        .map((q) => ({ id: q.id, label: q.label, category: q.category, average: 0, count: 0 })),
    };
  }

  const rated = responses.filter((r) => r.overallRating > 0);
  const avgRating =
    rated.length > 0 ? rated.reduce((acc, r) => acc + r.overallRating, 0) / rated.length : 0;

  const npsResponses = responses.filter((r) => r.npsScore >= 0);
  let nps = 0;
  let promotersPct = 0;
  let passivesPct = 0;
  let detractorsPct = 0;

  if (npsResponses.length > 0) {
    const promoters = npsResponses.filter((r) => r.npsScore >= 9).length;
    const passives = npsResponses.filter((r) => r.npsScore >= 7 && r.npsScore <= 8).length;
    const detractors = npsResponses.filter((r) => r.npsScore <= 6).length;
    promotersPct = Math.round((promoters / npsResponses.length) * 100);
    passivesPct = Math.round((passives / npsResponses.length) * 100);
    detractorsPct = Math.round((detractors / npsResponses.length) * 100);
    nps = Math.round(((promoters - detractors) / npsResponses.length) * 100);
  }

  const anonymousCount = responses.filter((r) => r.isAnonymous).length;
  const anonymousPct = Math.round((anonymousCount / total) * 100);

  const questionStats = survey.questions
    .filter((q) => q.type === 'rating')
    .map((q) => {
      const vals = responses
        .map((r) => Number(r.answers?.[q.id]))
        .filter((v) => !Number.isNaN(v) && v >= 1 && v <= 5);
      const average = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return {
        id: q.id,
        label: q.label,
        category: q.category,
        average: Number(average.toFixed(2)),
        count: vals.length,
      };
    });

  return {
    total,
    avgRating: Number(avgRating.toFixed(2)),
    nps,
    promotersPct,
    passivesPct,
    detractorsPct,
    anonymousPct,
    questionStats,
  };
}

export function exportSurveyToExcel(
  survey: Survey,
  responses: SurveyResponseRecord[],
  analysis: OpinionAnalysis | null
) {
  const wb = XLSX.utils.book_new();
  const metrics = computeSurveyMetrics(survey, responses);

  // Sheet 1: Detailed Responses
  const detailRows = responses.map((r, index) => {
    const sentimentMeta = analysis?.responseSentiments?.[r.id];
    const row: Record<string, string | number> = {
      '#': index + 1,
      Fecha: formatTimestamp(r.submittedAt),
      Modalidad: r.isAnonymous ? 'Anónima' : 'Con datos opcionales',
      Huésped: r.guestName || 'Anónimo',
      Email: r.guestEmail || '—',
      Habitación: r.roomNumber || '—',
      'Tipo de estancia': r.stayType || 'No indicado',
      'Nota media (1-5)': r.overallRating > 0 ? Number(r.overallRating.toFixed(2)) : '—',
      'NPS (0-10)': r.npsScore >= 0 ? r.npsScore : '—',
    };

    for (const q of survey.questions) {
      const val = r.answers?.[q.id];
      row[q.label] = val !== undefined && val !== '' ? val : '—';
    }

    row['Comentario principal'] = r.openComment || '—';
    row['Sentimiento IA'] = sentimentMeta?.sentiment || 'Pendiente';
    row['Tema IA'] = sentimentMeta?.mainTopic || '—';
    row['Resumen IA'] = sentimentMeta?.briefSummary || '—';

    return row;
  });

  const wsDetails = XLSX.utils.json_to_sheet(
    detailRows.length > 0
      ? detailRows
      : [{ Aviso: 'Aún no se han recibido respuestas para esta encuesta.' }]
  );
  wsDetails['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    ...survey.questions.map(() => ({ wch: 24 })),
    { wch: 44 },
    { wch: 14 },
    { wch: 20 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Respuestas');

  // Sheet 2: Executive KPIs & Area Breakdown
  const summaryRows: Array<Record<string, string | number>> = [
    { Indicador: 'Hotel', Valor: survey.hotelName },
    { Indicador: 'Encuesta', Valor: survey.title },
    { Indicador: 'Total respuestas', Valor: metrics.total },
    { Indicador: 'Satisfacción media (sobre 5)', Valor: metrics.avgRating },
    { Indicador: 'Índice NPS (-100 a +100)', Valor: metrics.nps },
    { Indicador: 'Promotores (9-10)', Valor: `${metrics.promotersPct}%` },
    { Indicador: 'Pasivos (7-8)', Valor: `${metrics.passivesPct}%` },
    { Indicador: 'Detractores (0-6)', Valor: `${metrics.detractorsPct}%` },
    { Indicador: 'Respuestas anónimas', Valor: `${metrics.anonymousPct}%` },
    { Indicador: '', Valor: '' },
    { Indicador: '--- Valoración por pregunta (1-5) ---', Valor: 'Media' },
    ...metrics.questionStats.map((qs) => ({
      Indicador: `[${qs.category}] ${qs.label}`,
      Valor: qs.average,
    })),
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 52 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen KPIs');

  // Sheet 3: AI Opinion Analysis
  const aiRows: Array<Record<string, string | number>> = [];
  if (analysis) {
    aiRows.push({ Sección: 'Resumen Ejecutivo', Detalle: analysis.executiveSummary, Extra: '' });
    aiRows.push({
      Sección: 'Sentimiento Global',
      Detalle: `Positivas: ${analysis.sentiment.positive} | Neutras: ${analysis.sentiment.neutral} | Negativas: ${analysis.sentiment.negative}`,
      Extra: `${analysis.responseCount} respuestas analizadas`,
    });
    aiRows.push({ Sección: '', Detalle: '', Extra: '' });

    for (const s of analysis.strengths) {
      aiRows.push({
        Sección: 'Fortaleza',
        Detalle: `${s.title}: ${s.detail}`,
        Extra: `${s.mentions} menciones`,
      });
    }
    aiRows.push({ Sección: '', Detalle: '', Extra: '' });

    for (const imp of analysis.improvements) {
      aiRows.push({
        Sección: `Mejora (${imp.department})`,
        Detalle: `${imp.area}: ${imp.detail}`,
        Extra: `Prioridad ${imp.priority}`,
      });
    }
    aiRows.push({ Sección: '', Detalle: '', Extra: '' });

    analysis.actionPlan.forEach((step, idx) => {
      aiRows.push({
        Sección: `Plan de Acción #${idx + 1}`,
        Detalle: step,
        Extra: '',
      });
    });
  } else {
    aiRows.push({
      Sección: 'Análisis IA',
      Detalle: 'Ejecuta el análisis automático de opiniones desde el panel para incluir este informe.',
      Extra: '',
    });
  }

  const wsAI = XLSX.utils.json_to_sheet(aiRows);
  wsAI['!cols'] = [{ wch: 28 }, { wch: 76 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsAI, 'Analisis IA');

  const safeName = `${survey.hotelName}_${survey.title}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);

  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeName || 'encuesta_hotel'}_${dateStamp}.xlsx`);
}
