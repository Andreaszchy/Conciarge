import type { Timestamp } from 'firebase/firestore';

export type QuestionType = 'rating' | 'nps' | 'choice' | 'text';

export type QuestionCategory =
  | 'General'
  | 'Recepción'
  | 'Limpieza'
  | 'Habitación'
  | 'Gastronomía'
  | 'Instalaciones'
  | 'Ubicación';

export type CoverTheme = 'lobby' | 'suite' | 'dining';

export type SurveyStatus = 'active' | 'paused';

export type StayType = '' | 'Ocio' | 'Negocios' | 'Familia' | 'Pareja' | 'Otro';

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  label: string;
  category: QuestionCategory;
  required: boolean;
  options?: string[];
}

export interface Survey {
  id: string;
  ownerId: string;
  hotelName: string;
  title: string;
  welcomeMessage: string;
  thankYouMessage: string;
  coverTheme: CoverTheme;
  status: SurveyStatus;
  allowAnonymous: boolean;
  collectName: boolean;
  collectEmail: boolean;
  collectRoom: boolean;
  collectStayType: boolean;
  autoAnalyze: boolean;
  questions: SurveyQuestion[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SurveyResponseRecord {
  id: string;
  surveyId: string;
  surveyOwnerId: string;
  isAnonymous: boolean;
  guestName: string;
  guestEmail: string;
  roomNumber: string;
  stayType: StayType;
  overallRating: number;
  npsScore: number;
  answers: Record<string, string | number>;
  openComment: string;
  submittedAt: Timestamp | null;
}

export interface AnalysisStrength {
  title: string;
  detail: string;
  mentions: number;
}

export interface AnalysisImprovement {
  area: string;
  department: string;
  priority: 'Alta' | 'Media' | 'Baja' | string;
  detail: string;
}

export interface AnalysisTheme {
  topic: string;
  sentiment: 'Positivo' | 'Neutro' | 'Negativo' | string;
  count: number;
}

export interface ResponseSentimentEntry {
  sentiment: 'Positivo' | 'Neutro' | 'Negativo' | string;
  mainTopic: string;
  briefSummary: string;
}

export interface OpinionAnalysis {
  id: string;
  surveyId: string;
  surveyOwnerId: string;
  responseCount: number;
  executiveSummary: string;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  strengths: AnalysisStrength[];
  improvements: AnalysisImprovement[];
  actionPlan: string[];
  themes: AnalysisTheme[];
  responseSentiments: Record<string, ResponseSentimentEntry>;
  createdAt: Timestamp | null;
}

// Blueprint-synchronized volumetric limits
export const LIMITS = {
  HOTEL_NAME_MAX: 120,
  TITLE_MAX: 160,
  WELCOME_MAX: 600,
  THANK_YOU_MAX: 400,
  QUESTIONS_MAX: 25,
  GUEST_NAME_MAX: 120,
  GUEST_EMAIL_MAX: 160,
  ROOM_MAX: 32,
  COMMENT_MAX: 2500,
} as const;

export const COVER_THEMES: Record<
  CoverTheme,
  { label: string; description: string; imageUrl: string }
> = {
  lobby: {
    label: 'Recepción',
    description: 'Vestíbulo luminoso en piedra travertino y madera natural',
    imageUrl: '/src/assets/images/hotel_lobby_header_1795223559130.jpg',
  },
  suite: {
    label: 'Suite y Descanso',
    description: 'Habitación serena con luz de mañana y tejidos en lino',
    imageUrl: '/src/assets/images/hotel_suite_banner_1795223559530.jpg',
  },
  dining: {
    label: 'Especialidades',
    description: 'Mesa matinal con vistas al mar para experiencias gastronómicas',
    imageUrl: '/src/assets/images/hotel_dining_banner_1795223559657.jpg',
  },
};

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  'General',
  'Recepción',
  'Limpieza',
  'Habitación',
  'Gastronomía',
  'Instalaciones',
  'Ubicación',
];

export const STAY_TYPES: Exclude<StayType, ''>[] = [
  'Ocio',
  'Negocios',
  'Familia',
  'Pareja',
  'Otro',
];
