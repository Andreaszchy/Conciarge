import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SAMPLE_RESPONSES_SEED, SURVEY_TEMPLATES } from '../data/templates';
import type {
  CoverTheme,
  OpinionAnalysis,
  ResponseSentimentEntry,
  StayType,
  Survey,
  SurveyQuestion,
  SurveyResponseRecord,
  SurveyStatus,
  SurveyType,
} from '../types';
import { LIMITS } from '../types';

function makeSafeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}

function getTimestampMillis(ts: Survey['createdAt']): number {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  return 0;
}

export function subscribeToOwnerSurveys(
  ownerId: string,
  onData: (surveys: Survey[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'surveys';
  const q = query(collection(db, path), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Survey[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Survey, 'id'>),
      }));
      list.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export function subscribeToSurveyResponses(
  surveyId: string,
  ownerId: string,
  onData: (responses: SurveyResponseRecord[]) => void,
  onError?: (err: Error) => void
) {
  const path = `surveys/${surveyId}/responses`;
  const q = query(collection(db, path), where('surveyOwnerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: SurveyResponseRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SurveyResponseRecord, 'id'>),
      }));
      list.sort((a, b) => getTimestampMillis(b.submittedAt) - getTimestampMillis(a.submittedAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export function subscribeToSurveyAnalyses(
  surveyId: string,
  ownerId: string,
  onData: (analyses: OpinionAnalysis[]) => void,
  onError?: (err: Error) => void
) {
  const path = `surveys/${surveyId}/analyses`;
  const q = query(collection(db, path), where('surveyOwnerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: OpinionAnalysis[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<OpinionAnalysis, 'id'>),
      }));
      list.sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export interface SurveyDraftInput {
  hotelName: string;
  hotelLocation: string;
  title: string;
  welcomeMessage: string;
  thankYouMessage: string;
  coverTheme: CoverTheme;
  surveyType: SurveyType;
  status: SurveyStatus;
  allowAnonymous: boolean;
  collectName: boolean;
  collectEmail: boolean;
  collectRoom: boolean;
  collectStayType: boolean;
  autoAnalyze: boolean;
  questions: SurveyQuestion[];
}

function sanitizeQuestions(questions: SurveyQuestion[]): SurveyQuestion[] {
  return questions.slice(0, LIMITS.QUESTIONS_MAX).map((q, idx) => ({
    id: q.id && /^[a-zA-Z0-9_-]+$/.test(q.id) ? q.id : `q_${idx + 1}`,
    type: q.type,
    label: q.label.trim().slice(0, 220) || `Pregunta ${idx + 1}`,
    category: q.category || 'General',
    required: Boolean(q.required),
    ...(q.type === 'choice'
      ? {
          options: (q.options || ['Excelente', 'Buena', 'Regular', 'Mejorable'])
            .map((o) => o.trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 8),
        }
      : {}),
  }));
}

export async function createSurvey(ownerId: string, input: SurveyDraftInput): Promise<string> {
  const surveyId = makeSafeId('enc');
  const path = `surveys/${surveyId}`;
  const payload = {
    ownerId,
    hotelName: input.hotelName.trim().slice(0, LIMITS.HOTEL_NAME_MAX) || 'Mi Hotel',
    hotelLocation: input.hotelLocation.trim().slice(0, LIMITS.HOTEL_LOCATION_MAX),
    title: input.title.trim().slice(0, LIMITS.TITLE_MAX) || 'Encuesta de Satisfacción',
    welcomeMessage: input.welcomeMessage.trim().slice(0, LIMITS.WELCOME_MAX),
    thankYouMessage: input.thankYouMessage.trim().slice(0, LIMITS.THANK_YOU_MAX),
    coverTheme: input.coverTheme,
    surveyType: input.surveyType,
    status: input.status,
    allowAnonymous: Boolean(input.allowAnonymous),
    collectName: Boolean(input.collectName),
    collectEmail: Boolean(input.collectEmail),
    collectRoom: Boolean(input.collectRoom),
    collectStayType: Boolean(input.collectStayType),
    autoAnalyze: Boolean(input.autoAnalyze),
    questions: sanitizeQuestions(input.questions),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'surveys', surveyId), payload);
    return surveyId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSurvey(
  surveyId: string,
  input: SurveyDraftInput
): Promise<void> {
  const path = `surveys/${surveyId}`;
  const updates = {
    hotelName: input.hotelName.trim().slice(0, LIMITS.HOTEL_NAME_MAX) || 'Mi Hotel',
    hotelLocation: input.hotelLocation.trim().slice(0, LIMITS.HOTEL_LOCATION_MAX),
    title: input.title.trim().slice(0, LIMITS.TITLE_MAX) || 'Encuesta de Satisfacción',
    welcomeMessage: input.welcomeMessage.trim().slice(0, LIMITS.WELCOME_MAX),
    thankYouMessage: input.thankYouMessage.trim().slice(0, LIMITS.THANK_YOU_MAX),
    coverTheme: input.coverTheme,
    surveyType: input.surveyType,
    status: input.status,
    allowAnonymous: Boolean(input.allowAnonymous),
    collectName: Boolean(input.collectName),
    collectEmail: Boolean(input.collectEmail),
    collectRoom: Boolean(input.collectRoom),
    collectStayType: Boolean(input.collectStayType),
    autoAnalyze: Boolean(input.autoAnalyze),
    questions: sanitizeQuestions(input.questions),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'surveys', surveyId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleSurveyStatus(surveyId: string, status: SurveyStatus): Promise<void> {
  const path = `surveys/${surveyId}`;
  try {
    await updateDoc(doc(db, 'surveys', surveyId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSurvey(surveyId: string): Promise<void> {
  const path = `surveys/${surveyId}`;
  try {
    await deleteDoc(doc(db, 'surveys', surveyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteResponse(surveyId: string, responseId: string): Promise<void> {
  const path = `surveys/${surveyId}/responses/${responseId}`;
  try {
    await deleteDoc(doc(db, 'surveys', surveyId, 'responses', responseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchPublicSurvey(surveyId: string): Promise<Survey | null> {
  const path = `surveys/${surveyId}`;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(surveyId)) {
    return null;
  }
  try {
    const snap = await getDoc(doc(db, 'surveys', surveyId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<Survey, 'id'>),
    };
  } catch (error) {
    // If paused survey denies public get, return null so guest UI shows a clear unavailable message
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface GuestSubmissionInput {
  guestName: string;
  guestEmail: string;
  roomNumber: string;
  stayType: StayType;
  answers: Record<string, string | number>;
}

export async function submitGuestResponse(
  survey: Survey,
  input: GuestSubmissionInput
): Promise<string> {
  const responseId = makeSafeId('resp');
  const path = `surveys/${survey.id}/responses/${responseId}`;

  const ratingValues: number[] = [];
  let npsScore = -1;
  const textParts: string[] = [];
  const cleanAnswers: Record<string, string | number> = {};

  for (const q of survey.questions) {
    const raw = input.answers[q.id];
    if (raw === undefined || raw === null || raw === '') continue;

    if (q.type === 'rating') {
      const num = Math.min(5, Math.max(1, Math.round(Number(raw))));
      if (!Number.isNaN(num)) {
        cleanAnswers[q.id] = num;
        ratingValues.push(num);
      }
    } else if (q.type === 'nps') {
      const num = Math.min(10, Math.max(0, Math.round(Number(raw))));
      if (!Number.isNaN(num)) {
        cleanAnswers[q.id] = num;
        npsScore = num;
      }
    } else if (q.type === 'text') {
      const txt = String(raw).trim().slice(0, 1200);
      if (txt) {
        cleanAnswers[q.id] = txt;
        textParts.push(txt);
      }
    } else {
      const str = String(raw).trim().slice(0, 160);
      if (str) cleanAnswers[q.id] = str;
    }
  }

  const overallRating =
    ratingValues.length > 0
      ? Number((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(2))
      : 0;

  const guestName = input.guestName.trim().slice(0, LIMITS.GUEST_NAME_MAX);
  const guestEmail = input.guestEmail.trim().slice(0, LIMITS.GUEST_EMAIL_MAX);
  const roomNumber = input.roomNumber.trim().slice(0, LIMITS.ROOM_MAX);
  const openComment = textParts.join(' | ').slice(0, LIMITS.COMMENT_MAX);
  const isAnonymous = !guestName && !guestEmail;

  const payload = {
    surveyId: survey.id,
    surveyOwnerId: survey.ownerId,
    isAnonymous,
    guestName,
    guestEmail,
    roomNumber,
    stayType: input.stayType || '',
    overallRating,
    npsScore,
    answers: cleanAnswers,
    openComment,
    submittedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'surveys', survey.id, 'responses', responseId), payload);
    return responseId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function seedSampleHotelSurvey(ownerId: string): Promise<string> {
  const base = SURVEY_TEMPLATES[0];
  const surveyId = await createSurvey(ownerId, {
    hotelName: 'Hotel CID',
    hotelLocation: 'Hotel CID',
    title: base.defaultTitle,
    welcomeMessage: base.defaultWelcome,
    thankYouMessage: base.defaultThankYou,
    coverTheme: base.coverTheme,
    surveyType: base.surveyType,
    status: 'active',
    allowAnonymous: true,
    collectName: true,
    collectEmail: true,
    collectRoom: true,
    collectStayType: true,
    autoAnalyze: true,
    questions: base.questions,
  });

  // Seed 8 varied Spanish guest responses sequentially so all parent checks pass cleanly
  for (const item of SAMPLE_RESPONSES_SEED) {
    const responseId = makeSafeId('resp');
    const path = `surveys/${surveyId}/responses/${responseId}`;
    try {
      await setDoc(doc(db, 'surveys', surveyId, 'responses', responseId), {
        surveyId,
        surveyOwnerId: ownerId,
        isAnonymous: item.isAnonymous,
        guestName: item.guestName,
        guestEmail: item.guestEmail,
        roomNumber: item.roomNumber,
        stayType: item.stayType,
        overallRating: item.overallRating,
        npsScore: item.npsScore,
        answers: item.answers,
        openComment: item.openComment,
        submittedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  return surveyId;
}

export async function runAndSaveOpinionAnalysis(
  survey: Survey,
  responses: SurveyResponseRecord[],
  ownerId: string
): Promise<OpinionAnalysis> {
  const res = await fetch('/api/analyze-opinions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hotelName: survey.hotelName,
      surveyTitle: survey.title,
      questions: survey.questions.map((q) => ({
        id: q.id,
        label: q.label,
        type: q.type,
        category: q.category,
      })),
      responses: responses.slice(0, 120).map((r) => ({
        id: r.id,
        guestName: r.guestName,
        isAnonymous: r.isAnonymous,
        roomNumber: r.roomNumber,
        stayType: r.stayType,
        overallRating: r.overallRating,
        npsScore: r.npsScore,
        openComment: r.openComment,
        answers: r.answers,
      })),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Error al analizar las opiniones con IA.');
  }

  const responseSentimentsMap: Record<string, ResponseSentimentEntry> = {};
  if (Array.isArray(data.responseSentiments)) {
    for (const item of data.responseSentiments.slice(0, 200)) {
      if (item && typeof item.responseId === 'string') {
        responseSentimentsMap[item.responseId] = {
          sentiment: String(item.sentiment || 'Neutro').slice(0, 30),
          mainTopic: String(item.mainTopic || 'General').slice(0, 80),
          briefSummary: String(item.briefSummary || '').slice(0, 240),
        };
      }
    }
  }

  const analysisId = makeSafeId('anl');
  const path = `surveys/${survey.id}/analyses/${analysisId}`;

  const docPayload = {
    surveyId: survey.id,
    surveyOwnerId: ownerId,
    responseCount: responses.length,
    executiveSummary: String(data.executiveSummary || 'Análisis completado.').slice(0, 2500),
    sentiment: {
      positive: Number(data.sentiment?.positive || 0),
      neutral: Number(data.sentiment?.neutral || 0),
      negative: Number(data.sentiment?.negative || 0),
    },
    strengths: Array.isArray(data.strengths) ? data.strengths.slice(0, 10) : [],
    improvements: Array.isArray(data.improvements) ? data.improvements.slice(0, 10) : [],
    actionPlan: Array.isArray(data.actionPlan)
      ? data.actionPlan.slice(0, 10).map((s: unknown) => String(s).slice(0, 400))
      : [],
    themes: Array.isArray(data.themes) ? data.themes.slice(0, 12) : [],
    responseSentiments: responseSentimentsMap,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'surveys', survey.id, 'analyses', analysisId), docPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    id: analysisId,
    ...docPayload,
    createdAt: null,
  };
}
