import type { CoverTheme, StayType, SurveyQuestion } from '../types';

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  durationLabel: string;
  coverTheme: CoverTheme;
  defaultTitle: string;
  defaultWelcome: string;
  defaultThankYou: string;
  questions: SurveyQuestion[];
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'checkout-completa',
    name: 'Estancia Completa (Check-out)',
    description: 'Evalúa recepción, limpieza, comodidad de habitación, desayuno, NPS y comentarios abiertos.',
    durationLabel: '2 min · 7 preguntas',
    coverTheme: 'lobby',
    defaultTitle: 'Encuesta de Satisfacción de Estancia',
    defaultWelcome:
      'Gracias por hospedarte con nosotros. Tu opinión nos ayuda a mejorar cada detalle del hotel. Puedes responder de forma 100% anónima en menos de 2 minutos.',
    defaultThankYou:
      '¡Muchas gracias por tu tiempo! Hemos recibido tu valoración y nuestro equipo la revisará de inmediato.',
    questions: [
      {
        id: 'q_general',
        type: 'rating',
        label: '¿Cómo valorarías tu experiencia general en el hotel?',
        category: 'General',
        required: true,
      },
      {
        id: 'q_limpieza',
        type: 'rating',
        label: 'Limpieza y estado de tu habitación',
        category: 'Limpieza',
        required: true,
      },
      {
        id: 'q_recepcion',
        type: 'rating',
        label: 'Trato, rapidez y amabilidad del equipo de recepción',
        category: 'Recepción',
        required: true,
      },
      {
        id: 'q_descanso',
        type: 'rating',
        label: 'Comodidad de la cama, climatización y descanso nocturno',
        category: 'Habitación',
        required: true,
      },
      {
        id: 'q_desayuno',
        type: 'rating',
        label: 'Calidad y variedad del desayuno / restaurante',
        category: 'Gastronomía',
        required: false,
      },
      {
        id: 'q_nps',
        type: 'nps',
        label: '¿Con qué probabilidad recomendarías nuestro hotel a un familiar o colega?',
        category: 'General',
        required: true,
      },
      {
        id: 'q_comentario',
        type: 'text',
        label: '¿Qué fue lo que más te gustó y qué podríamos mejorar para tu próxima visita?',
        category: 'General',
        required: false,
      },
    ],
  },
  {
    id: 'express-30s',
    name: 'Preguntas Rápidas',
    description: 'Ideal para códigos QR en recepción o mesillas de noche con máxima tasa de respuesta.',
    durationLabel: '30 s · 4 preguntas',
    coverTheme: 'suite',
    defaultTitle: '¿Qué tal tu estancia hasta ahora?',
    defaultWelcome:
      'Solo te tomará 30 segundos y no necesitas registrarte. Cuéntanos cómo podemos hacer tu estancia aún mejor.',
    defaultThankYou: '¡Gracias! Tu opinión ya ha llegado directamente a la dirección del hotel.',
    questions: [
      {
        id: 'q_exp_general',
        type: 'rating',
        label: 'Valoración global de tu estancia',
        category: 'General',
        required: true,
      },
      {
        id: 'q_exp_destacado',
        type: 'choice',
        label: '¿Qué aspecto destacarías más de nuestra hospitalidad?',
        category: 'General',
        required: false,
        options: [
          'Atención del personal',
          'Limpieza y habitaciones',
          'Ubicación y vistas',
          'Desayuno y gastronomía',
          'Instalaciones y tranquilidad',
        ],
      },
      {
        id: 'q_exp_nps',
        type: 'nps',
        label: '¿Recomendarías este hotel a otras personas?',
        category: 'General',
        required: true,
      },
      {
        id: 'q_exp_coment',
        type: 'text',
        label: '¿Alguna sugerencia o detalle que debamos atender hoy?',
        category: 'General',
        required: false,
      },
    ],
  },
  {
    id: 'gastronomia',
    name: 'Restaurante y Desayuno',
    description: 'Enfocada en calidad culinaria, tiempos de servicio y variedad del buffet matinal.',
    durationLabel: '1 min · 5 preguntas',
    coverTheme: 'dining',
    defaultTitle: 'Valoración de Desayuno y Restaurante',
    defaultWelcome:
      'Queremos sorprenderte cada mañana. Comparte tu experiencia sobre nuestra oferta gastronómica sin necesidad de registro.',
    defaultThankYou: '¡Gracias por ayudarnos a perfeccionar nuestra cocina y servicio de sala!',
    questions: [
      {
        id: 'q_gast_calidad',
        type: 'rating',
        label: 'Calidad y frescura de los ingredientes',
        category: 'Gastronomía',
        required: true,
      },
      {
        id: 'q_gast_servicio',
        type: 'rating',
        label: 'Atención y rapidez del equipo de sala',
        category: 'Gastronomía',
        required: true,
      },
      {
        id: 'q_gast_variedad',
        type: 'choice',
        label: '¿Qué te pareció la variedad de opciones (incluyendo alternativas saludables o sin gluten)?',
        category: 'Gastronomía',
        required: true,
        options: ['Excelente variedad', 'Adecuada', 'Podría ampliarse', 'Insuficiente'],
      },
      {
        id: 'q_gast_nps',
        type: 'nps',
        label: '¿Recomendarías nuestro restaurante a otros viajeros?',
        category: 'Gastronomía',
        required: true,
      },
      {
        id: 'q_gast_comentario',
        type: 'text',
        label: '¿Qué plato te encantó o qué añadirías a la carta?',
        category: 'Gastronomía',
        required: false,
      },
    ],
  },
];

export interface SampleGuestResponseSeed {
  isAnonymous: boolean;
  guestName: string;
  guestEmail: string;
  roomNumber: string;
  stayType: StayType;
  overallRating: number;
  npsScore: number;
  answers: Record<string, string | number>;
  openComment: string;
}

export const SAMPLE_RESPONSES_SEED: SampleGuestResponseSeed[] = [
  {
    isAnonymous: false,
    guestName: 'Elena Morales',
    guestEmail: 'elena.morales@ejemplo.es',
    roomNumber: '304',
    stayType: 'Pareja',
    overallRating: 4.8,
    npsScore: 10,
    answers: {
      q_general: 5,
      q_limpieza: 5,
      q_recepcion: 5,
      q_descanso: 5,
      q_desayuno: 4,
      q_nps: 10,
      q_comentario:
        'La habitación estaba impecable y la recepción nos facilitó un check-in rapidísimo con recomendaciones locales estupendas. El desayuno muy rico, aunque a las 9:30 faltaban mesas en la terraza.',
    },
    openComment:
      'La habitación estaba impecable y la recepción nos facilitó un check-in rapidísimo con recomendaciones locales estupendas. El desayuno muy rico, aunque a las 9:30 faltaban mesas en la terraza.',
  },
  {
    isAnonymous: true,
    guestName: '',
    guestEmail: '',
    roomNumber: '212',
    stayType: 'Negocios',
    overallRating: 3.4,
    npsScore: 6,
    answers: {
      q_general: 3,
      q_limpieza: 5,
      q_recepcion: 4,
      q_descanso: 3,
      q_desayuno: 2,
      q_nps: 6,
      q_comentario:
        'Limpieza excelente y cama cómoda, pero la conexión Wi-Fi en la segunda planta se cortaba durante mis videollamadas de trabajo. Además el café del desayuno tardaba demasiado en reponerse.',
    },
    openComment:
      'Limpieza excelente y cama cómoda, pero la conexión Wi-Fi en la segunda planta se cortaba durante mis videollamadas de trabajo. Además el café del desayuno tardaba demasiado en reponerse.',
  },
  {
    isAnonymous: false,
    guestName: 'Carlos Mendoza',
    guestEmail: '',
    roomNumber: '408',
    stayType: 'Familia',
    overallRating: 4.6,
    npsScore: 9,
    answers: {
      q_general: 5,
      q_limpieza: 5,
      q_recepcion: 5,
      q_descanso: 4,
      q_desayuno: 4,
      q_nps: 9,
      q_comentario:
        'Viajamos con dos niños y nos prepararon las camas supletorias antes de llegar. El personal de recepción fue sumamente amable. Sugeriría añadir más fruta fresca cortada y opciones sin gluten en el buffet.',
    },
    openComment:
      'Viajamos con dos niños y nos prepararon las camas supletorias antes de llegar. El personal de recepción fue sumamente amable. Sugeriría añadir más fruta fresca cortada y opciones sin gluten en el buffet.',
  },
  {
    isAnonymous: true,
    guestName: '',
    guestEmail: '',
    roomNumber: '105',
    stayType: 'Ocio',
    overallRating: 2.6,
    npsScore: 4,
    answers: {
      q_general: 3,
      q_limpieza: 4,
      q_recepcion: 3,
      q_descanso: 1,
      q_desayuno: 2,
      q_nps: 4,
      q_comentario:
        'Se escuchaba mucho ruido de la calle y del pasillo a partir de las 7 de la mañana. El aire acondicionado hacía un zumbido constante por la noche que impidió descansar bien.',
    },
    openComment:
      'Se escuchaba mucho ruido de la calle y del pasillo a partir de las 7 de la mañana. El aire acondicionado hacía un zumbido constante por la noche que impidió descansar bien.',
  },
  {
    isAnonymous: false,
    guestName: 'Sofía Navarro',
    guestEmail: 'sofia.navarro@ejemplo.es',
    roomNumber: '501',
    stayType: 'Pareja',
    overallRating: 5.0,
    npsScore: 10,
    answers: {
      q_general: 5,
      q_limpieza: 5,
      q_recepcion: 5,
      q_descanso: 5,
      q_desayuno: 5,
      q_nps: 10,
      q_comentario:
        'Todo sobresaliente. Las vistas desde la quinta planta, la decoración serena y el detalle de bienvenida nos enamoraron. Volveremos sin dudarlo el próximo verano.',
    },
    openComment:
      'Todo sobresaliente. Las vistas desde la quinta planta, la decoración serena y el detalle de bienvenida nos enamoraron. Volveremos sin dudarlo el próximo verano.',
  },
  {
    isAnonymous: true,
    guestName: '',
    guestEmail: '',
    roomNumber: '',
    stayType: 'Negocios',
    overallRating: 3.8,
    npsScore: 7,
    answers: {
      q_general: 4,
      q_limpieza: 4,
      q_recepcion: 4,
      q_descanso: 4,
      q_desayuno: 3,
      q_nps: 7,
      q_comentario:
        'Buena relación calidad-precio y muy buena ubicación cerca del centro de congresos. El proceso de facturación al salir fue algo lento porque solo había una persona atendiendo a las 8:30.',
    },
    openComment:
      'Buena relación calidad-precio y muy buena ubicación cerca del centro de congresos. El proceso de facturación al salir fue algo lento porque solo había una persona atendiendo a las 8:30.',
  },
  {
    isAnonymous: false,
    guestName: 'Javier Roldán',
    guestEmail: '',
    roomNumber: '311',
    stayType: 'Ocio',
    overallRating: 4.4,
    npsScore: 9,
    answers: {
      q_general: 4,
      q_limpieza: 5,
      q_recepcion: 5,
      q_descanso: 4,
      q_desayuno: 4,
      q_nps: 9,
      q_comentario:
        'Destaco la amabilidad genuina de todo el equipo y la limpieza diaria de las habitaciones. El único punto mejorable es la señal Wi-Fi en el balcón.',
    },
    openComment:
      'Destaco la amabilidad genuina de todo el equipo y la limpieza diaria de las habitaciones. El único punto mejorable es la señal Wi-Fi en el balcón.',
  },
  {
    isAnonymous: true,
    guestName: '',
    guestEmail: '',
    roomNumber: '207',
    stayType: 'Familia',
    overallRating: 4.2,
    npsScore: 8,
    answers: {
      q_general: 4,
      q_limpieza: 5,
      q_recepcion: 4,
      q_descanso: 4,
      q_desayuno: 4,
      q_nps: 8,
      q_comentario:
        'Estancia muy agradable y tranquila. Los colchones son comodísimos. Sería genial ampliar el horario del desayuno media hora más los fines de semana.',
    },
    openComment:
      'Estancia muy agradable y tranquila. Los colchones son comodísimos. Sería genial ampliar el horario del desayuno media hora más los fines de semana.',
  },
];
