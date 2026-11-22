export type RoomStatus =
  | 'sucia'
  | 'en_limpieza'
  | 'limpia'
  | 'inspeccionada'
  | 'fuera_de_servicio';

export type FloorLevel = 'bajo' | 'medio' | 'alto';

export interface Hotel {
  id: string;
  nombre: string;
  totalRooms: number;
}

export interface Room {
  id: string;
  hotelId: string;
  edificio: string;
  vista: string;
  piso: number;
  numero: string;
  estado: RoomStatus;
}

export interface RoomInput {
  hotelId: string;
  edificio: string;
  vista: string;
  piso: number;
  numero: string;
  estado: RoomStatus;
}

export interface Camarista {
  id: string;
  nombre: string;
}

export interface RoomAssignment {
  roomId: string;
  camaristaId: string;
}

export interface RoomStatusHistoryEntry {
  id: string;
  roomId: string;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  timestamp: string;
}

// --- Mantenimiento ---
export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';
export type TicketStatus = 'abierto' | 'en_progreso' | 'resuelto';
export type TicketOrigin = 'manual' | 'encuesta';

export interface MaintenanceTicket {
  id: string;
  roomId: string;
  titulo: string;
  descripcion: string;
  prioridad: TicketPriority;
  estado: TicketStatus;
  responsable: string;
  origen: TicketOrigin;
  fechaCreacion: string;
  fechaCierre: string | null;
}

export interface MaintenanceTicketInput {
  roomId: string;
  titulo: string;
  descripcion: string;
  prioridad: TicketPriority;
  responsable: string;
  origen?: TicketOrigin;
}

// --- Recepción (Huéspedes y Estancias, sin tarifas ni pagos) ---
export type StayStatus = 'reservada' | 'en_casa' | 'finalizada';

export interface Huesped {
  id: string;
  nombre: string;
}

export interface Estancia {
  id: string;
  huespedId: string;
  roomId: string;
  fechaEntrada: string; // YYYY-MM-DD
  fechaSalida: string; // YYYY-MM-DD
  estado: StayStatus;
}

export interface CreateStayInput {
  huespedId?: string;
  nuevoHuespedNombre?: string;
  roomId: string;
  fechaEntrada: string;
  fechaSalida: string;
  estado?: StayStatus;
}

// --- Encuestas por habitación (QR /encuesta/:roomId) ---
export type SurveyAreaKey =
  | 'limpieza'
  | 'recepcion'
  | 'alberca'
  | 'restaurantes'
  | 'mantenimiento';

export type RoomSurveyRatings = Record<SurveyAreaKey, number>;

export interface RoomSurveyResponse {
  id: string;
  estanciaId: string | null;
  roomId: string;
  hotel: string;
  edificio: string;
  piso: number;
  vista: string;
  numero: string;
  calificaciones: RoomSurveyRatings;
  nps: number; // 0 to 10
  comentario: string;
  fecha: string; // ISO
  promedio: number;
  alertaGenerada?: {
    tipo: 'ticket' | 'solicitud';
    referenciaId: string;
  } | null;
}

export interface RoomSurveySubmissionInput {
  roomId: string;
  estanciaId?: string | null;
  calificaciones: RoomSurveyRatings;
  nps: number;
  comentario: string;
}

// --- Solicitudes de huéspedes ---
export type GuestRequestType = 'toallas' | 'objeto_olvidado' | 'queja' | 'otro';
export type GuestRequestStatus = 'pendiente' | 'atendida';

export interface GuestRequest {
  id: string;
  roomId: string;
  tipo: GuestRequestType;
  descripcion: string;
  estado: GuestRequestStatus;
  fecha: string; // ISO
}

export interface GuestRequestInput {
  roomId: string;
  tipo: GuestRequestType;
  descripcion: string;
}

// --- Alertas operativas en tiempo real (ej. encuesta con promedio <= 2) ---
export interface OpsAlert {
  id: string;
  roomId: string;
  roomNumero: string;
  hotelNombre: string;
  promedio: number;
  tipoAccion: 'ticket' | 'solicitud';
  referenciaId: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
}

export interface CsvImportResult {
  importedCount: number;
  skippedDuplicates: string[];
  invalidRows: number;
  totalProcessed: number;
}

export interface HotelOpsSnapshot {
  hotels: Hotel[];
  rooms: Room[];
  camaristas: Camarista[];
  responsablesMantenimiento: string[];
  assignments: RoomAssignment[];
  history: RoomStatusHistoryEntry[];
  tickets: MaintenanceTicket[];
  huespedes: Huesped[];
  estancias: Estancia[];
  roomSurveys: RoomSurveyResponse[];
  solicitudes: GuestRequest[];
  alerts: OpsAlert[];
}

export interface HotelOpsRepository {
  loadInitialSnapshot(): Promise<HotelOpsSnapshot>;
  createRoom(input: RoomInput): Promise<Room>;
  updateRoom(roomId: string, input: RoomInput): Promise<Room>;
  deleteRoom(roomId: string): Promise<void>;
  changeRoomStatus(
    roomId: string,
    newStatus: RoomStatus
  ): Promise<{ room: Room; historyEntry: RoomStatusHistoryEntry | null }>;
  assignCamarista(roomId: string, camaristaId: string | null): Promise<RoomAssignment | null>;
  assignCamaristaByFloor(params: {
    hotelId: string;
    edificio: string;
    piso: number;
    camaristaId: string | null;
  }): Promise<{ updatedRoomIds: string[]; assignments: RoomAssignment[] }>;
  importRoomsFromCsv(csvText: string, defaultHotelId?: string): Promise<{
    result: CsvImportResult;
    rooms: Room[];
  }>;
  exportRoomsToCsv(rooms: Room[], hotels: Hotel[]): string;

  // Mantenimiento
  createTicket(input: MaintenanceTicketInput): Promise<HotelOpsSnapshot>;
  updateTicket(
    ticketId: string,
    patch: Partial<Pick<MaintenanceTicket, 'estado' | 'prioridad' | 'responsable' | 'titulo' | 'descripcion'>>
  ): Promise<HotelOpsSnapshot>;

  // Recepción
  createStay(input: CreateStayInput): Promise<HotelOpsSnapshot>;
  reassignStayRoom(stayId: string, newRoomId: string): Promise<HotelOpsSnapshot>;
  checkInStay(stayId: string): Promise<HotelOpsSnapshot>;
  checkOutStay(stayId: string): Promise<HotelOpsSnapshot>;

  // Encuestas por habitación
  submitRoomSurvey(input: RoomSurveySubmissionInput): Promise<{
    survey: RoomSurveyResponse;
    snapshot: HotelOpsSnapshot;
  }>;
  dismissAlert(alertId: string): Promise<HotelOpsSnapshot>;

  // Solicitudes
  createGuestRequest(input: GuestRequestInput): Promise<HotelOpsSnapshot>;
  updateGuestRequestStatus(requestId: string, estado: GuestRequestStatus): Promise<HotelOpsSnapshot>;
}

export const ROOM_STATUS_ORDER: RoomStatus[] = [
  'sucia',
  'en_limpieza',
  'limpia',
  'inspeccionada',
  'fuera_de_servicio',
];

export interface RoomStatusMeta {
  label: string;
  shortLabel: string;
  swatchClass: string;
  cellClass: string;
  cellSelectedRing: string;
  textClass: string;
  columnHeaderClass: string;
  buttonActiveClass: string;
  nextStatus?: RoomStatus;
  nextActionLabel?: string;
}

export const ROOM_STATUS_META: Record<RoomStatus, RoomStatusMeta> = {
  sucia: {
    label: 'Sucia',
    shortLabel: 'Sucia',
    swatchClass: 'bg-rose-600',
    cellClass: 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100/80',
    cellSelectedRing: 'ring-2 ring-rose-600 ring-offset-1',
    textClass: 'text-rose-800',
    columnHeaderClass: 'border-t-2 border-t-rose-600',
    buttonActiveClass: 'bg-rose-700 text-white border-rose-700',
    nextStatus: 'en_limpieza',
    nextActionLabel: 'Iniciar limpieza',
  },
  en_limpieza: {
    label: 'En limpieza',
    shortLabel: 'Limpieza',
    swatchClass: 'bg-amber-500',
    cellClass: 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100/80',
    cellSelectedRing: 'ring-2 ring-amber-600 ring-offset-1',
    textClass: 'text-amber-800',
    columnHeaderClass: 'border-t-2 border-t-amber-500',
    buttonActiveClass: 'bg-amber-600 text-white border-amber-600',
    nextStatus: 'limpia',
    nextActionLabel: 'Marcar limpia',
  },
  limpia: {
    label: 'Limpia',
    shortLabel: 'Limpia',
    swatchClass: 'bg-sky-600',
    cellClass: 'bg-sky-50 border-sky-300 text-sky-950 hover:bg-sky-100/80',
    cellSelectedRing: 'ring-2 ring-sky-600 ring-offset-1',
    textClass: 'text-sky-800',
    columnHeaderClass: 'border-t-2 border-t-sky-600',
    buttonActiveClass: 'bg-sky-700 text-white border-sky-700',
    nextStatus: 'inspeccionada',
    nextActionLabel: 'Inspeccionar',
  },
  inspeccionada: {
    label: 'Inspeccionada',
    shortLabel: 'Inspec.',
    swatchClass: 'bg-emerald-600',
    cellClass: 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100/80',
    cellSelectedRing: 'ring-2 ring-emerald-600 ring-offset-1',
    textClass: 'text-emerald-800',
    columnHeaderClass: 'border-t-2 border-t-emerald-600',
    buttonActiveClass: 'bg-emerald-700 text-white border-emerald-700',
    nextStatus: 'sucia',
    nextActionLabel: 'Marcar sucia',
  },
  fuera_de_servicio: {
    label: 'Fuera de servicio',
    shortLabel: 'F. servicio',
    swatchClass: 'bg-slate-600',
    cellClass: 'bg-slate-200/80 border-slate-400 text-slate-900 hover:bg-slate-200',
    cellSelectedRing: 'ring-2 ring-slate-700 ring-offset-1',
    textClass: 'text-slate-700',
    columnHeaderClass: 'border-t-2 border-t-slate-600',
    buttonActiveClass: 'bg-slate-800 text-white border-slate-800',
    nextStatus: 'sucia',
    nextActionLabel: 'Rehabilitar (sucia)',
  },
};

export const TICKET_PRIORITY_ORDER: TicketPriority[] = ['urgente', 'alta', 'media', 'baja'];

export const TICKET_PRIORITY_META: Record<
  TicketPriority,
  { label: string; textClass: string; swatchClass: string }
> = {
  urgente: { label: 'Urgente', textClass: 'text-rose-800', swatchClass: 'bg-rose-600' },
  alta: { label: 'Alta', textClass: 'text-amber-800', swatchClass: 'bg-amber-500' },
  media: { label: 'Media', textClass: 'text-sky-800', swatchClass: 'bg-sky-600' },
  baja: { label: 'Baja', textClass: 'text-slate-600', swatchClass: 'bg-slate-400' },
};

export const TICKET_STATUS_ORDER: TicketStatus[] = ['abierto', 'en_progreso', 'resuelto'];

export const TICKET_STATUS_META: Record<
  TicketStatus,
  { label: string; textClass: string; swatchClass: string; columnHeaderClass: string }
> = {
  abierto: {
    label: 'Abierto',
    textClass: 'text-rose-800',
    swatchClass: 'bg-rose-600',
    columnHeaderClass: 'border-t-2 border-t-rose-600',
  },
  en_progreso: {
    label: 'En progreso',
    textClass: 'text-amber-800',
    swatchClass: 'bg-amber-500',
    columnHeaderClass: 'border-t-2 border-t-amber-500',
  },
  resuelto: {
    label: 'Resuelto',
    textClass: 'text-emerald-800',
    swatchClass: 'bg-emerald-600',
    columnHeaderClass: 'border-t-2 border-t-emerald-600',
  },
};

export const STAY_STATUS_META: Record<StayStatus, { label: string; textClass: string; swatchClass: string }> = {
  reservada: { label: 'Reservada', textClass: 'text-sky-800', swatchClass: 'bg-sky-600' },
  en_casa: { label: 'En casa', textClass: 'text-emerald-800', swatchClass: 'bg-emerald-600' },
  finalizada: { label: 'Finalizada', textClass: 'text-slate-600', swatchClass: 'bg-slate-400' },
};

export const SURVEY_AREA_KEYS: SurveyAreaKey[] = [
  'limpieza',
  'recepcion',
  'alberca',
  'restaurantes',
  'mantenimiento',
];

export const SURVEY_AREA_LABELS: Record<SurveyAreaKey, string> = {
  limpieza: 'Limpieza',
  recepcion: 'Recepción',
  alberca: 'Alberca',
  restaurantes: 'Restaurantes',
  mantenimiento: 'Mantenimiento',
};

export const GUEST_REQUEST_TYPES: GuestRequestType[] = [
  'toallas',
  'objeto_olvidado',
  'queja',
  'otro',
];

export const GUEST_REQUEST_TYPE_META: Record<
  GuestRequestType,
  { label: string; textClass: string; swatchClass: string }
> = {
  toallas: { label: 'Toallas', textClass: 'text-sky-800', swatchClass: 'bg-sky-600' },
  objeto_olvidado: {
    label: 'Objeto olvidado',
    textClass: 'text-amber-800',
    swatchClass: 'bg-amber-500',
  },
  queja: { label: 'Queja', textClass: 'text-rose-800', swatchClass: 'bg-rose-600' },
  otro: { label: 'Otro', textClass: 'text-slate-700', swatchClass: 'bg-slate-500' },
};

export const FLOOR_LEVEL_LABELS: Record<FloorLevel, string> = {
  bajo: 'Piso bajo (1–8)',
  medio: 'Piso medio (9–14)',
  alto: 'Piso alto (15+)',
};

export function getFloorLevel(piso: number): FloorLevel {
  if (piso >= 15) return 'alto';
  if (piso >= 9) return 'medio';
  return 'bajo';
}

export function isRoomReady(status: RoomStatus): boolean {
  return status === 'limpia' || status === 'inspeccionada';
}

export function computeSurveyAverage(ratings: RoomSurveyRatings): number {
  const sum = SURVEY_AREA_KEYS.reduce((acc, k) => acc + ratings[k], 0);
  return Math.round((sum / SURVEY_AREA_KEYS.length) * 100) / 100;
}

export function compareRoomNumbers(a: string, b: string): number {
  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
    return numA - numB;
  }
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

export function getShortCamaristaName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  return `${parts[0]} ${parts[1][0]}.`;
}

export function toLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toLocalIsoDate(dt);
}
