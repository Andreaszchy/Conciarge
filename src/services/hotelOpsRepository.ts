import type {
  Camarista,
  CreateStayInput,
  CsvImportResult,
  Estancia,
  GuestRequest,
  GuestRequestInput,
  GuestRequestStatus,
  GuestRequestType,
  Hotel,
  HotelOpsRepository,
  HotelOpsSnapshot,
  Huesped,
  MaintenanceTicket,
  MaintenanceTicketInput,
  OpsAlert,
  Room,
  RoomAssignment,
  RoomInput,
  RoomStatus,
  RoomStatusHistoryEntry,
  RoomSurveyRatings,
  RoomSurveyResponse,
  RoomSurveySubmissionInput,
  TicketPriority,
  TicketStatus,
} from '../types/hotelOps';
import {
  addDaysIso,
  compareRoomNumbers,
  computeSurveyAverage,
  isRoomReady,
  ROOM_STATUS_ORDER,
  toLocalIsoDate,
} from '../types/hotelOps';

export const SEED_CSV_PATH = '/assets/aistudio/habitaciones_el_cid__1__181fc6a6.csv';
export const RESORT_MAP_IMAGE_PATH = '/assets/aistudio/IMG_20261121_182749_376_c8011ed7.jpg';

const INITIAL_HOTELS: Hotel[] = [
  { id: 'castilla', nombre: 'Castilla', totalRooms: 413 },
  { id: 'moro', nombre: 'Moro', totalRooms: 277 },
  { id: 'granada', nombre: 'Granada', totalRooms: 114 },
  { id: 'marina', nombre: 'Marina', totalRooms: 204 },
];

const INITIAL_CAMARISTAS: Camarista[] = [
  { id: 'cam-1', nombre: 'María Elena Lizárraga' },
  { id: 'cam-2', nombre: 'Guadalupe Osuna' },
  { id: 'cam-3', nombre: 'Rosa Imelda Tirado' },
  { id: 'cam-4', nombre: 'Carmen Patricia Quintero' },
  { id: 'cam-5', nombre: 'Leticia Paredes' },
  { id: 'cam-6', nombre: 'Verónica Beltrán' },
];

const INITIAL_RESPONSABLES: string[] = [
  'Ing. Carlos Mendoza',
  'Luis Alberto Ríos',
  'Jorge Hernández',
  'Miguel Ángel Soto',
  'Eduardo Félix',
  'Roberto Zamudio',
];

const SAMPLE_GUEST_NAMES: string[] = [
  'Alejandro Morales',
  'Sofía Ramírez',
  'Carlos Eduardo Vega',
  'Valeria Castrejón',
  'Fernando Gutiérrez',
  'Mariana López',
  'Diego Armando Herrera',
  'Camila Ortega',
  'Ricardo Salinas',
  'Paola Domínguez',
  'Javier Navarro',
  'Daniela Méndez',
  'Andrés Villarreal',
  'Lucía Cárdenas',
  'Héctor Sandoval',
  'Gabriela Espinoza',
  'Roberto Delgado',
  'Natalia Fuentes',
  'Óscar Peñaloza',
  'Elena Ibarra',
  'Mauricio Torres',
  'Claudia Pacheco',
  'Sergio Aguirre',
  'Patricia Montes',
  'Arturo Valenzuela',
  'Mónica Cisneros',
  'David Orozco',
  'Beatriz Arredondo',
  'Enrique Salgado',
  'Laura Benítez',
  'Michael Thompson',
  'Emily Carter',
  'Robert Anderson',
  'Jennifer Miller',
  'Thomas Wilson',
  'Sarah Mitchell',
  'Christopher Reed',
  'Amanda Brooks',
  'Daniel Foster',
  'Jessica Hayes',
];

const LOW_SCORE_COMMENTS = [
  'El aire acondicionado hizo ruido toda la noche y no enfriaba bien.',
  'Olor a humedad en el baño y presión baja en la regadera.',
  'Tardaron demasiado en atender el reporte del clima y faltaban toallas.',
  'La cerradura electrónica falló dos veces y el elevador estuvo lento.',
  'Ruido constante del área de alberca y detalles pendientes de mantenimiento.',
  'El balcón tenía la puerta atorada y la limpieza pudo ser mucho mejor.',
];

const MID_SCORE_COMMENTS = [
  'Estancia agradable en general, aunque el check-in tomó unos minutos de más.',
  'Buena vista y personal amable; los restaurantes estuvieron algo llenos.',
  'Habitación cómoda, pero el agua caliente tardaba en salir por la mañana.',
  'Alberca excelente; faltó reposición de amenidades el segundo día.',
  'Todo correcto para descansar en familia, detalles menores en el baño.',
];

const HIGH_SCORE_COMMENTS = [
  'Vista espectacular desde el balcón y atención impecable de todo el equipo.',
  'Habitación reluciente, camas muy cómodas y excelente servicio en alberca.',
  'Súper recomendados los restaurantes y la rapidez en recepción.',
  'Todo perfecto desde la llegada hasta la salida, sin duda volveremos.',
  'La mejor vista del complejo, el personal siempre atento y servicial.',
  'Limpieza extraordinaria y ambiente increíble en la alberca.',
];

function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveHotelId(rawHotel: string, hotels: Hotel[], fallbackHotelId?: string): string | null {
  const normalized = normalizeKey(rawHotel);
  if (!normalized) return fallbackHotelId ?? null;
  const direct = hotels.find(
    (h) => normalizeKey(h.id) === normalized || normalizeKey(h.nombre) === normalized
  );
  if (direct) return direct.id;
  if (normalized.includes('castilla')) return 'castilla';
  if (normalized.includes('moro')) return 'moro';
  if (normalized.includes('granada')) return 'granada';
  if (normalized.includes('marina')) return 'marina';
  return fallbackHotelId ?? null;
}

function parseRoomStatus(raw?: string): RoomStatus | null {
  if (!raw) return null;
  const normalized = normalizeKey(raw).replace(/\s+/g, '_');
  if (normalized === 'sucia') return 'sucia';
  if (normalized === 'en_limpieza' || normalized === 'limpieza') return 'en_limpieza';
  if (normalized === 'limpia') return 'limpia';
  if (normalized === 'inspeccionada') return 'inspeccionada';
  if (normalized === 'fuera_de_servicio' || normalized === 'fuera_servicio') {
    return 'fuera_de_servicio';
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function deterministicInitialStatus(roomNumber: string, index: number): RoomStatus {
  let hash = index * 17;
  for (let i = 0; i < roomNumber.length; i += 1) {
    hash = (hash * 31 + roomNumber.charCodeAt(i)) % 1000;
  }
  const bucket = hash % 100;
  if (bucket < 24) return 'sucia';
  if (bucket < 38) return 'en_limpieza';
  if (bucket < 68) return 'limpia';
  if (bucket < 97) return 'inspeccionada';
  return 'fuera_de_servicio';
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

/**
 * In-memory implementation of HotelOpsRepository.
 * Isolated behind the HotelOpsRepository contract so it can be swapped to
 * Firestore later without rewriting React state or UI components.
 */
class InMemoryHotelOpsRepository implements HotelOpsRepository {
  private hotels: Hotel[] = INITIAL_HOTELS.map((h) => ({ ...h }));
  private rooms: Room[] = [];
  private camaristas: Camarista[] = INITIAL_CAMARISTAS.map((c) => ({ ...c }));
  private responsablesMantenimiento: string[] = [...INITIAL_RESPONSABLES];
  private assignments: Map<string, string> = new Map();
  private history: RoomStatusHistoryEntry[] = [];
  private tickets: MaintenanceTicket[] = [];
  private huespedes: Huesped[] = [];
  private estancias: Estancia[] = [];
  private roomSurveys: RoomSurveyResponse[] = [];
  private solicitudes: GuestRequest[] = [];
  private alerts: OpsAlert[] = [];
  private initialized = false;

  private cloneSnapshot(): HotelOpsSnapshot {
    const assignmentsList: RoomAssignment[] = Array.from(this.assignments.entries()).map(
      ([roomId, camaristaId]) => ({ roomId, camaristaId })
    );
    return {
      hotels: this.hotels.map((h) => ({ ...h })),
      rooms: this.rooms.map((r) => ({ ...r })),
      camaristas: this.camaristas.map((c) => ({ ...c })),
      responsablesMantenimiento: [...this.responsablesMantenimiento],
      assignments: assignmentsList,
      history: this.history.map((entry) => ({ ...entry })),
      tickets: this.tickets.map((t) => ({ ...t })),
      huespedes: this.huespedes.map((g) => ({ ...g })),
      estancias: this.estancias.map((e) => ({ ...e })),
      roomSurveys: this.roomSurveys.map((s) => ({
        ...s,
        calificaciones: { ...s.calificaciones },
        alertaGenerada: s.alertaGenerada ? { ...s.alertaGenerada } : null,
      })),
      solicitudes: this.solicitudes.map((req) => ({ ...req })),
      alerts: this.alerts.map((a) => ({ ...a })),
    };
  }

  private setRoomStatusInternal(roomId: string, newStatus: RoomStatus): RoomStatusHistoryEntry | null {
    const index = this.rooms.findIndex((r) => r.id === roomId);
    if (index === -1) return null;
    const current = this.rooms[index];
    if (current.estado === newStatus) return null;

    const updated: Room = { ...current, estado: newStatus };
    const entry: RoomStatusHistoryEntry = {
      id: createId('hist'),
      roomId,
      previousStatus: current.estado,
      newStatus,
      timestamp: new Date().toISOString(),
    };
    const next = [...this.rooms];
    next[index] = updated;
    this.rooms = next;
    this.history = [entry, ...this.history];
    return entry;
  }

  private assertUniqueRoomNumber(numero: string, ignoreRoomId?: string): void {
    const normalized = numero.trim().toLowerCase();
    if (!normalized) {
      throw new Error('El número de habitación es obligatorio.');
    }
    const existing = this.rooms.find(
      (r) => r.id !== ignoreRoomId && r.numero.trim().toLowerCase() === normalized
    );
    if (existing) {
      const hotelName = this.hotels.find((h) => h.id === existing.hotelId)?.nombre ?? existing.hotelId;
      throw new Error(
        `Ya existe la habitación ${existing.numero} en ${hotelName} (${existing.edificio}, piso ${existing.piso}).`
      );
    }
  }

  private seedOperationalData(): void {
    const rand = createPrng(20261122);
    const now = Date.now();
    const todayIso = toLocalIsoDate(new Date());

    // 1. Seed Camarista assignments & initial status history
    this.assignments.clear();
    this.history = [];

    const floorKeys = Array.from(
      new Set(this.rooms.map((r) => `${r.hotelId}|${r.edificio}|${r.piso}`))
    );
    const floorCamaristaMap = new Map<string, string>();
    floorKeys.forEach((key, idx) => {
      if (idx % 5 !== 4) {
        floorCamaristaMap.set(key, this.camaristas[idx % this.camaristas.length].id);
      }
    });

    this.rooms.forEach((room, idx) => {
      const floorKey = `${room.hotelId}|${room.edificio}|${room.piso}`;
      const assignedCam = floorCamaristaMap.get(floorKey);
      if (assignedCam) {
        this.assignments.set(room.id, assignedCam);
      }

      if (idx % 3 === 0 && room.estado !== 'sucia') {
        const prevMap: Record<RoomStatus, RoomStatus> = {
          sucia: 'inspeccionada',
          en_limpieza: 'sucia',
          limpia: 'en_limpieza',
          inspeccionada: 'limpia',
          fuera_de_servicio: 'sucia',
        };
        const minutesAgo = 15 + ((idx * 13) % 240);
        this.history.push({
          id: `hist-seed-${room.id}`,
          roomId: room.id,
          previousStatus: prevMap[room.estado],
          newStatus: room.estado,
          timestamp: new Date(now - minutesAgo * 60_000).toISOString(),
        });
      }
    });

    // 2. Seed 40 Guests
    this.huespedes = SAMPLE_GUEST_NAMES.map((nombre, idx) => ({
      id: `guest-${idx + 1}`,
      nombre,
    }));

    // 3. Seed Stays over the last 8 weeks (including today's arrivals, departures, active in-house, upcoming, and finished)
    this.estancias = [];
    const occupiedTodayRoomIds = new Set<string>();
    const pickAvailableRoomForToday = (preferredIndex: number): Room => {
      for (let offset = 0; offset < this.rooms.length; offset += 1) {
        const candidate = this.rooms[(preferredIndex + offset) % this.rooms.length];
        if (!occupiedTodayRoomIds.has(candidate.id) && candidate.estado !== 'fuera_de_servicio') {
          occupiedTodayRoomIds.add(candidate.id);
          return candidate;
        }
      }
      return this.rooms[preferredIndex % this.rooms.length];
    };

    // 3a. 42 Active in-house stays today (some departing tomorrow/in 2-4 days, 10 departing TODAY)
    for (let i = 0; i < 42; i += 1) {
      const room = pickAvailableRoomForToday(i * 15 + 3);
      const guest = this.huespedes[i % this.huespedes.length];
      const daysSinceArrival = 1 + Math.floor(rand() * 4);
      const departingToday = i < 10;
      const daysUntilDeparture = departingToday ? 0 : 1 + Math.floor(rand() * 4);

      this.estancias.push({
        id: `stay-active-${i + 1}`,
        huespedId: guest.id,
        roomId: room.id,
        fechaEntrada: addDaysIso(todayIso, -daysSinceArrival),
        fechaSalida: addDaysIso(todayIso, daysUntilDeparture),
        estado: 'en_casa',
      });
    }

    // 3b. 12 Arrivals TODAY (reservada, fechaEntrada === today)
    // Make 8 of their rooms limpia/inspeccionada so check-in works immediately, and 4 sucia/en_limpieza to demonstrate check-in guard
    for (let i = 0; i < 12; i += 1) {
      const room = pickAvailableRoomForToday(i * 23 + 11);
      const roomIdx = this.rooms.findIndex((r) => r.id === room.id);
      if (roomIdx !== -1) {
        const desiredStatus: RoomStatus =
          i < 5 ? 'inspeccionada' : i < 8 ? 'limpia' : i < 10 ? 'en_limpieza' : 'sucia';
        this.rooms[roomIdx] = { ...this.rooms[roomIdx], estado: desiredStatus };
      }
      const guest = this.huespedes[(i + 10) % this.huespedes.length];
      const nights = 2 + Math.floor(rand() * 4);
      this.estancias.push({
        id: `stay-arr-today-${i + 1}`,
        huespedId: guest.id,
        roomId: room.id,
        fechaEntrada: todayIso,
        fechaSalida: addDaysIso(todayIso, nights),
        estado: 'reservada',
      });
    }

    // 3c. 16 Upcoming reserved stays (1 to 10 days from now)
    for (let i = 0; i < 16; i += 1) {
      const room = pickAvailableRoomForToday(i * 19 + 7);
      const guest = this.huespedes[(i + 20) % this.huespedes.length];
      const startOffset = 1 + Math.floor(rand() * 9);
      const nights = 2 + Math.floor(rand() * 5);
      this.estancias.push({
        id: `stay-future-${i + 1}`,
        huespedId: guest.id,
        roomId: room.id,
        fechaEntrada: addDaysIso(todayIso, startOffset),
        fechaSalida: addDaysIso(todayIso, startOffset + nights),
        estado: 'reservada',
      });
    }

    // 3d. 70 Completed historical stays across the last 8 weeks (days -56 to -1)
    const pastStays: Estancia[] = [];
    for (let i = 0; i < 70; i += 1) {
      const room = this.rooms[Math.floor(rand() * this.rooms.length)];
      const guest = this.huespedes[Math.floor(rand() * this.huespedes.length)];
      const endOffset = -(1 + Math.floor(rand() * 52));
      const nights = 2 + Math.floor(rand() * 5);
      const stay: Estancia = {
        id: `stay-past-${i + 1}`,
        huespedId: guest.id,
        roomId: room.id,
        fechaEntrada: addDaysIso(todayIso, endOffset - nights),
        fechaSalida: addDaysIso(todayIso, endOffset),
        estado: 'finalizada',
      };
      pastStays.push(stay);
      this.estancias.push(stay);
    }

    // 4. Seed 25 Maintenance Tickets (ensure urgent open tickets set room to fuera_de_servicio)
    const ticketTemplates: Array<{
      titulo: string;
      descripcion: string;
      prioridad: TicketPriority;
      estado: TicketStatus;
      origen: 'manual' | 'encuesta';
      preferBuilding?: string;
    }> = [
      {
        titulo: 'Fuga de agua en tubería de regadera',
        descripcion: 'Fuga activa detrás de la mezcladora del baño principal; requiere cierre de válvula.',
        prioridad: 'urgente',
        estado: 'abierto',
        origen: 'manual',
        preferBuilding: 'Lateral C',
      },
      {
        titulo: 'Aire acondicionado sin enfriar (compresor)',
        descripcion: 'Equipo de clima arroja aire caliente y presenta vibración intensa.',
        prioridad: 'urgente',
        estado: 'abierto',
        origen: 'encuesta',
        preferBuilding: 'Lateral C',
      },
      {
        titulo: 'Cortocircuito en contacto de cabecera',
        descripcion: 'Se disparó la pastilla del circuito principal de la habitación.',
        prioridad: 'urgente',
        estado: 'abierto',
        origen: 'manual',
        preferBuilding: 'Ampliación Castilla',
      },
      {
        titulo: 'Cerradura electrónica bloqueada',
        descripcion: 'No reconoce tarjetas maestras ni de huésped; batería sulfatada.',
        prioridad: 'urgente',
        estado: 'abierto',
        origen: 'encuesta',
        preferBuilding: 'Lateral C',
      },
      {
        titulo: 'Filtración por puerta corrediza de balcón',
        descripcion: 'Sello desgastado permite entrada de agua con brisa marina.',
        prioridad: 'alta',
        estado: 'abierto',
        origen: 'encuesta',
        preferBuilding: 'Lateral C',
      },
      {
        titulo: 'Ruido excesivo en extractor del baño',
        descripcion: 'Motor desbalanceado genera zumbido perceptible desde la recámara.',
        prioridad: 'alta',
        estado: 'en_progreso',
        origen: 'encuesta',
        preferBuilding: 'Ampliación Castilla',
      },
      {
        titulo: 'Presión insuficiente de agua caliente',
        descripcion: 'Huésped reporta agua tibia por la mañana en la regadera.',
        prioridad: 'alta',
        estado: 'abierto',
        origen: 'encuesta',
        preferBuilding: 'Lateral C',
      },
      {
        titulo: 'Televisor sin señal en canales HD',
        descripcion: 'Revisar decodificador y cable coaxial detrás del mueble.',
        prioridad: 'media',
        estado: 'en_progreso',
        origen: 'manual',
        preferBuilding: 'Torre El Moro',
      },
      {
        titulo: 'Lámpara de buró parpadea',
        descripcion: 'Sustituir foco LED y revisar apagador lateral.',
        prioridad: 'baja',
        estado: 'abierto',
        origen: 'manual',
        preferBuilding: 'Torre Castilla',
      },
      {
        titulo: 'Persiana blackout descarrilada',
        descripcion: 'Riel superior suelto del lado izquierdo del ventanal.',
        prioridad: 'media',
        estado: 'abierto',
        origen: 'manual',
        preferBuilding: 'Lateral B',
      },
      {
        titulo: 'Caja fuerte no acepta código nuevo',
        descripcion: 'Requiere reinicio maestro y cambio de baterías AA.',
        prioridad: 'media',
        estado: 'resuelto',
        origen: 'manual',
        preferBuilding: 'Torre El Moro',
      },
      {
        titulo: 'Manija de puerta de baño floja',
        descripcion: 'Ajustar tornillería interna y lubricar pestillo.',
        prioridad: 'baja',
        estado: 'resuelto',
        origen: 'manual',
        preferBuilding: 'Torre Castilla',
      },
      {
        titulo: 'Goteo constante en condensador de A/C',
        descripcion: 'Charola de drenaje obstruida en techo falso del acceso.',
        prioridad: 'alta',
        estado: 'en_progreso',
        origen: 'encuesta',
        preferBuilding: 'Lateral C',
      },
      {
        titulo: 'Desagüe lento en lavabo',
        descripcion: 'Desazolvar trampa y revisar empaque inferior.',
        prioridad: 'media',
        estado: 'en_progreso',
        origen: 'manual',
        preferBuilding: 'Ampliación Moro',
      },
      {
        titulo: 'Control remoto de clima sin respuesta',
        descripcion: 'Sensor infrarrojo descalibrado o baterías agotadas.',
        prioridad: 'baja',
        estado: 'resuelto',
        origen: 'manual',
        preferBuilding: 'Torre El Moro',
      },
      {
        titulo: 'Bisagra de clóset desprendida',
        descripcion: 'Reparar madera de marco y colocar bisagra nueva.',
        prioridad: 'baja',
        estado: 'abierto',
        origen: 'manual',
        preferBuilding: 'Lateral B',
      },
      {
        titulo: 'Falla en minibar (no enfría)',
        descripcion: 'Termostato en máximo sin bajar temperatura interior.',
        prioridad: 'media',
        estado: 'abierto',
        origen: 'encuesta',
        preferBuilding: 'Ampliación Castilla',
      },
      {
        titulo: 'Sellado de silicón deteriorado en tina',
        descripcion: 'Retirar silicón viejo y aplicar sellador antihongos.',
        prioridad: 'media',
        estado: 'resuelto',
        origen: 'encuesta',
        preferBuilding: 'Lateral C',
      },
      {
        titulo: 'Barandal de balcón con tornillo flojo',
        descripcion: 'Inspección inmediata de anclaje y apriete preventivo.',
        prioridad: 'alta',
        estado: 'en_progreso',
        origen: 'manual',
        preferBuilding: 'Torre El Moro',
      },
      {
        titulo: 'Fuga menor en manguera de WC',
        descripcion: 'Reemplazar manguera alimentadora trenzada.',
        prioridad: 'alta',
        estado: 'resuelto',
        origen: 'manual',
        preferBuilding: 'Torre Castilla',
      },
      {
        titulo: 'Teléfono de habitación sin tono',
        descripcion: 'Verificar roseta RJ11 y extensión en conmutador.',
        prioridad: 'baja',
        estado: 'resuelto',
        origen: 'manual',
        preferBuilding: 'Torre El Moro',
      },
      {
        titulo: 'Puerta de terraza roza al cerrar',
        descripcion: 'Cambiar carretillas inferiores y lubricar riel.',
        prioridad: 'media',
        estado: 'en_progreso',
        origen: 'encuesta',
        preferBuilding: 'Lateral C',
      },
      {
        titulo: 'Espejo de vanidad con luz fundida',
        descripcion: 'Reemplazar tira LED perimetral.',
        prioridad: 'baja',
        estado: 'abierto',
        origen: 'manual',
        preferBuilding: 'Torre Castilla',
      },
      {
        titulo: 'Humedad en plafón de acceso',
        descripcion: 'Revisar línea de drenaje del piso superior y resanar.',
        prioridad: 'alta',
        estado: 'abierto',
        origen: 'encuesta',
        preferBuilding: 'Ampliación Castilla',
      },
      {
        titulo: 'Reemplazo de regadera calcificada',
        descripcion: 'Instalar cabezal nuevo de alta presión.',
        prioridad: 'media',
        estado: 'resuelto',
        origen: 'manual',
        preferBuilding: 'Ampliación Moro',
      },
    ];

    this.tickets = [];
    const usedTicketRooms = new Set<string>();
    ticketTemplates.forEach((tpl, idx) => {
      const candidates = tpl.preferBuilding
        ? this.rooms.filter((r) => r.edificio === tpl.preferBuilding && !usedTicketRooms.has(r.id))
        : this.rooms.filter((r) => !usedTicketRooms.has(r.id));
      const pool = candidates.length > 0 ? candidates : this.rooms;
      const room = pool[(idx * 7) % pool.length];
      usedTicketRooms.add(room.id);

      const hoursAgo = 4 + idx * 14 + Math.floor(rand() * 10);
      const createdAt = new Date(now - hoursAgo * 3_600_000).toISOString();
      const closedAt =
        tpl.estado === 'resuelto'
          ? new Date(now - Math.max(1, hoursAgo - 6) * 3_600_000).toISOString()
          : null;

      this.tickets.push({
        id: `tkt-${idx + 1}`,
        roomId: room.id,
        titulo: tpl.titulo,
        descripcion: tpl.descripcion,
        prioridad: tpl.prioridad,
        estado: tpl.estado,
        responsable: this.responsablesMantenimiento[idx % this.responsablesMantenimiento.length],
        origen: tpl.origen,
        fechaCreacion: createdAt,
        fechaCierre: closedAt,
      });

      // Enforce business rule: urgent + open ticket forces room to fuera_de_servicio
      if (tpl.prioridad === 'urgente' && tpl.estado === 'abierto') {
        const roomIndex = this.rooms.findIndex((r) => r.id === room.id);
        if (roomIndex !== -1) {
          this.rooms[roomIndex] = { ...this.rooms[roomIndex], estado: 'fuera_de_servicio' };
        }
      }
    });

    // 5. Seed 224 Room Surveys across the last 8 weeks with a clear performance story
    // Lateral C (esp. Nivel playa & Alberca Moro) + Ampliación Castilla score visibly lower
    // Torre El Moro (La Concha & Alberca Gruta) + Torre Castilla score higher
    this.roomSurveys = [];
    this.alerts = [];
    const hotelNameById = new Map(this.hotels.map((h) => [h.id, h.nombre]));
    const totalSurveysToSeed = 224;

    for (let i = 0; i < totalSurveysToSeed; i += 1) {
      const daysAgo = Math.floor((i / totalSurveysToSeed) * 55) + Math.floor(rand() * 2);
      const surveyDate = new Date(now - daysAgo * 86_400_000 - Math.floor(rand() * 36_000_000));
      const weekIndex = Math.min(7, Math.floor(daysAgo / 7)); // 0 = this week, 7 = 8 weeks ago

      // Pick room weighted across all 6 buildings so every building/view has healthy sample sizes (n)
      const room = this.rooms[(i * 11 + Math.floor(rand() * 7)) % this.rooms.length];
      const hotelName = hotelNameById.get(room.hotelId) ?? room.hotelId;

      // Baseline quality score by building/view to create a clear, actionable narrative
      let baseScore = 4.15;
      let maintPenalty = 0;
      let cleanPenalty = 0;

      if (room.edificio === 'Lateral C') {
        baseScore = room.vista === 'Nivel playa' ? 2.75 : room.vista === 'Alberca Moro' ? 3.05 : 3.4;
        maintPenalty = 0.85;
        cleanPenalty = 0.45;
      } else if (room.edificio === 'Ampliación Castilla') {
        baseScore = 3.15;
        maintPenalty = 0.7;
        cleanPenalty = 0.35;
      } else if (room.edificio === 'Lateral B') {
        baseScore = 3.85;
        maintPenalty = 0.2;
      } else if (room.edificio === 'Torre Castilla') {
        baseScore = room.piso >= 15 ? 4.55 : 4.25;
      } else if (room.edificio === 'Torre El Moro') {
        baseScore =
          room.vista === 'La Concha'
            ? 4.75
            : room.vista === 'Alberca Gruta'
              ? 4.5
              : 4.35;
      } else if (room.edificio === 'Ampliación Moro') {
        baseScore = 4.25;
      }

      // Subtle weekly trend (dip around weeks 3-4, recovering in recent 2 weeks)
      const weekWave =
        weekIndex === 3 || weekIndex === 4 ? -0.25 : weekIndex <= 1 ? 0.12 : 0;

      // Force a handful of very low-scoring surveys (<= 2) in Lateral C / Ampliación Castilla
      const forceCritical =
        (room.edificio === 'Lateral C' || room.edificio === 'Ampliación Castilla') && i % 29 === 0;

      const makeAreaRating = (penalty: number): number => {
        if (forceCritical) {
          return clamp(Math.round(1.2 + rand() * 1.1), 1, 2);
        }
        const noise = (rand() - 0.5) * 1.4;
        return clamp(Math.round(baseScore + weekWave - penalty + noise), 1, 5);
      };

      const calificaciones: RoomSurveyRatings = {
        limpieza: makeAreaRating(cleanPenalty),
        recepcion: makeAreaRating(0),
        alberca: makeAreaRating(room.vista === 'Nivel playa' ? 0.35 : -0.1),
        restaurantes: makeAreaRating(-0.05),
        mantenimiento: makeAreaRating(maintPenalty),
      };

      const promedio = computeSurveyAverage(calificaciones);
      const npsRaw = Math.round((promedio - 1) * 2.3 + (rand() - 0.5) * 1.8);
      const nps = clamp(npsRaw, 0, 10);

      const commentPool =
        promedio <= 2.4
          ? LOW_SCORE_COMMENTS
          : promedio < 4
            ? MID_SCORE_COMMENTS
            : HIGH_SCORE_COMMENTS;
      const comentario = commentPool[(i + Math.floor(rand() * 3)) % commentPool.length];

      const linkedStay = pastStays.find((st) => st.roomId === room.id) ?? null;

      const surveyRecord: RoomSurveyResponse = {
        id: `rsurv-${i + 1}`,
        estanciaId: linkedStay?.id ?? null,
        roomId: room.id,
        hotel: hotelName,
        edificio: room.edificio,
        piso: room.piso,
        vista: room.vista,
        numero: room.numero,
        calificaciones,
        nps,
        comentario,
        fecha: surveyDate.toISOString(),
        promedio,
        alertaGenerada:
          promedio <= 2
            ? {
                tipo: 'ticket',
                referenciaId: this.tickets[i % this.tickets.length]?.id ?? 'tkt-2',
              }
            : null,
      };

      this.roomSurveys.push(surveyRecord);

      // Surface up to 2 recent critical alerts in the active alerts strip
      if (promedio <= 2 && daysAgo <= 14 && this.alerts.length < 2) {
        this.alerts.push({
          id: `alert-seed-${surveyRecord.id}`,
          roomId: room.id,
          roomNumero: room.numero,
          hotelNombre: hotelName,
          promedio,
          tipoAccion: 'ticket',
          referenciaId: surveyRecord.alertaGenerada?.referenciaId ?? 'tkt-2',
          mensaje: `Encuesta crítica (${promedio.toFixed(1)}/5) en Hab. ${room.numero} (${hotelName} · ${room.edificio}). Se generó ticket automático de seguimiento.`,
          fecha: surveyDate.toISOString(),
          leida: false,
        });
      }
    }

    this.roomSurveys.sort((a, b) => b.fecha.localeCompare(a.fecha));

    // 6. Seed 30 Guest Requests (toallas, objeto_olvidado, queja, otro)
    const requestTemplates: Array<{ tipo: GuestRequestType; descripcion: string }> = [
      { tipo: 'toallas', descripcion: 'Solicita 3 toallas adicionales para alberca y 2 de baño.' },
      { tipo: 'toallas', descripcion: 'Cambio urgente de toallas húmedas y tapete de baño.' },
      { tipo: 'toallas', descripcion: 'Toallas extra y batas para 2 adultos.' },
      { tipo: 'objeto_olvidado', descripcion: 'Cargador USB-C blanco olvidado junto al buró derecho.' },
      { tipo: 'objeto_olvidado', descripcion: 'Lentes de sol polarizados dejados en el balcón.' },
      { tipo: 'objeto_olvidado', descripcion: 'Reloj deportivo olvidado en la caja de seguridad.' },
      { tipo: 'objeto_olvidado', descripcion: 'Sudadera infantil azul en el clóset principal.' },
      { tipo: 'queja', descripcion: 'Ruido elevado en pasillo después de las 23:00 h.' },
      { tipo: 'queja', descripcion: 'Demora de 40 minutos en entrega de servicio a cuarto.' },
      { tipo: 'queja', descripcion: 'Olor a cigarro proveniente de habitación contigua.' },
      { tipo: 'queja', descripcion: 'Aire acondicionado goteando cerca del acceso.' },
      { tipo: 'otro', descripcion: 'Solicita almohadas hipoalergénicas adicionales.' },
      { tipo: 'otro', descripcion: 'Pide cuna portátil para bebé instalada antes de las 19:00.' },
      { tipo: 'otro', descripcion: 'Solicita tabla de planchar y plancha de vapor.' },
      { tipo: 'otro', descripcion: 'Requiere apoyo con equipaje para salida temprana.' },
    ];

    this.solicitudes = [];
    for (let i = 0; i < 30; i += 1) {
      const tpl = requestTemplates[i % requestTemplates.length];
      const room = this.rooms[(i * 19 + 5) % this.rooms.length];
      const hoursAgo = 1 + i * 5 + Math.floor(rand() * 4);
      const estado: GuestRequestStatus = i < 14 ? 'pendiente' : 'atendida';

      this.solicitudes.push({
        id: `sol-${i + 1}`,
        roomId: room.id,
        tipo: tpl.tipo,
        descripcion: tpl.descripcion,
        estado,
        fecha: new Date(now - hoursAgo * 3_600_000).toISOString(),
      });
    }

    this.history.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    this.tickets.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
    this.solicitudes.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async loadInitialSnapshot(): Promise<HotelOpsSnapshot> {
    if (this.initialized) {
      return this.cloneSnapshot();
    }

    const response = await fetch(SEED_CSV_PATH);
    if (!response.ok) {
      throw new Error('No se pudo cargar el catálogo inicial de habitaciones desde el archivo CSV.');
    }
    const csvText = await response.text();
    const cleaned = csvText.replace(/^\uFEFF/, '');
    const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);

    const parsedRooms: Room[] = [];
    const seenNumbers = new Set<string>();

    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 5) continue;

      const [rawHotel, rawEdificio, rawVista, rawPiso, rawNumero, rawEstado] = cols;
      const hotelId = resolveHotelId(rawHotel, this.hotels);
      const numero = rawNumero.trim();
      const piso = Number.parseInt(rawPiso, 10);

      if (!hotelId || !numero || Number.isNaN(piso)) continue;
      const numberKey = numero.toLowerCase();
      if (seenNumbers.has(numberKey)) continue;
      seenNumbers.add(numberKey);

      const estado =
        parseRoomStatus(rawEstado) ?? deterministicInitialStatus(numero, parsedRooms.length);

      parsedRooms.push({
        id: `room-${hotelId}-${numero}`,
        hotelId,
        edificio: rawEdificio.trim(),
        vista: rawVista.trim(),
        piso,
        numero,
        estado,
      });
    }

    parsedRooms.sort((a, b) => {
      if (a.hotelId !== b.hotelId) return a.hotelId.localeCompare(b.hotelId);
      if (a.edificio !== b.edificio) return a.edificio.localeCompare(b.edificio, 'es');
      if (a.piso !== b.piso) return a.piso - b.piso;
      return compareRoomNumbers(a.numero, b.numero);
    });

    this.rooms = parsedRooms;
    this.seedOperationalData();
    this.initialized = true;

    return this.cloneSnapshot();
  }

  async createRoom(input: RoomInput): Promise<Room> {
    const numero = input.numero.trim();
    const edificio = input.edificio.trim();
    const vista = input.vista.trim();

    if (!this.hotels.some((h) => h.id === input.hotelId)) {
      throw new Error('Selecciona un hotel válido.');
    }
    if (!edificio) throw new Error('El edificio es obligatorio.');
    if (!vista) throw new Error('La vista es obligatoria.');
    if (!Number.isFinite(input.piso) || input.piso < 0) {
      throw new Error('El piso debe ser un número válido.');
    }
    if (!ROOM_STATUS_ORDER.includes(input.estado)) {
      throw new Error('Estado de habitación no válido.');
    }

    this.assertUniqueRoomNumber(numero);

    const newRoom: Room = {
      id: createId(`room-${input.hotelId}`),
      hotelId: input.hotelId,
      edificio,
      vista,
      piso: Math.trunc(input.piso),
      numero,
      estado: input.estado,
    };

    this.rooms = [...this.rooms, newRoom];
    return { ...newRoom };
  }

  async updateRoom(roomId: string, input: RoomInput): Promise<Room> {
    const index = this.rooms.findIndex((r) => r.id === roomId);
    if (index === -1) throw new Error('No se encontró la habitación seleccionada.');

    const existing = this.rooms[index];
    const numero = input.numero.trim();
    const edificio = input.edificio.trim();
    const vista = input.vista.trim();

    if (!this.hotels.some((h) => h.id === input.hotelId)) {
      throw new Error('Selecciona un hotel válido.');
    }
    if (!edificio) throw new Error('El edificio es obligatorio.');
    if (!vista) throw new Error('La vista es obligatoria.');
    if (!Number.isFinite(input.piso) || input.piso < 0) {
      throw new Error('El piso debe ser un número válido.');
    }

    this.assertUniqueRoomNumber(numero, roomId);

    const updated: Room = {
      ...existing,
      hotelId: input.hotelId,
      edificio,
      vista,
      piso: Math.trunc(input.piso),
      numero,
      estado: input.estado,
    };

    if (existing.estado !== input.estado) {
      this.history = [
        {
          id: createId('hist'),
          roomId,
          previousStatus: existing.estado,
          newStatus: input.estado,
          timestamp: new Date().toISOString(),
        },
        ...this.history,
      ];
    }

    const nextRooms = [...this.rooms];
    nextRooms[index] = updated;
    this.rooms = nextRooms;
    return { ...updated };
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (!this.rooms.some((r) => r.id === roomId)) {
      throw new Error('No se encontró la habitación a eliminar.');
    }
    this.rooms = this.rooms.filter((r) => r.id !== roomId);
    this.assignments.delete(roomId);
    this.history = this.history.filter((entry) => entry.roomId !== roomId);
  }

  async changeRoomStatus(
    roomId: string,
    newStatus: RoomStatus
  ): Promise<{ room: Room; historyEntry: RoomStatusHistoryEntry | null }> {
    const index = this.rooms.findIndex((r) => r.id === roomId);
    if (index === -1) throw new Error('No se encontró la habitación.');

    const historyEntry = this.setRoomStatusInternal(roomId, newStatus);
    const updated = this.rooms.find((r) => r.id === roomId)!;
    return { room: { ...updated }, historyEntry: historyEntry ? { ...historyEntry } : null };
  }

  async assignCamarista(
    roomId: string,
    camaristaId: string | null
  ): Promise<RoomAssignment | null> {
    if (!this.rooms.some((r) => r.id === roomId)) {
      throw new Error('No se encontró la habitación.');
    }
    if (!camaristaId) {
      this.assignments.delete(roomId);
      return null;
    }
    if (!this.camaristas.some((c) => c.id === camaristaId)) {
      throw new Error('Camarista no válida.');
    }
    this.assignments.set(roomId, camaristaId);
    return { roomId, camaristaId };
  }

  async assignCamaristaByFloor(params: {
    hotelId: string;
    edificio: string;
    piso: number;
    camaristaId: string | null;
  }): Promise<{ updatedRoomIds: string[]; assignments: RoomAssignment[] }> {
    const matchingRooms = this.rooms.filter(
      (r) =>
        r.hotelId === params.hotelId &&
        r.edificio === params.edificio &&
        r.piso === params.piso
    );

    if (params.camaristaId && !this.camaristas.some((c) => c.id === params.camaristaId)) {
      throw new Error('Camarista no válida.');
    }

    const updatedRoomIds: string[] = [];
    for (const room of matchingRooms) {
      if (params.camaristaId) {
        this.assignments.set(room.id, params.camaristaId);
      } else {
        this.assignments.delete(room.id);
      }
      updatedRoomIds.push(room.id);
    }

    const assignments: RoomAssignment[] = Array.from(this.assignments.entries()).map(
      ([roomId, camaristaId]) => ({ roomId, camaristaId })
    );

    return { updatedRoomIds, assignments };
  }

  async importRoomsFromCsv(
    csvText: string,
    defaultHotelId?: string
  ): Promise<{ result: CsvImportResult; rooms: Room[] }> {
    const cleaned = csvText.replace(/^\uFEFF/, '');
    const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return {
        result: {
          importedCount: 0,
          skippedDuplicates: [],
          invalidRows: 0,
          totalProcessed: 0,
        },
        rooms: this.rooms.map((r) => ({ ...r })),
      };
    }

    const firstCols = parseCsvLine(lines[0]).map((c) => normalizeKey(c));
    const hasHeader =
      firstCols.includes('numero') ||
      firstCols.includes('edificio') ||
      firstCols.includes('hotel');

    const headerMap = {
      hotel: hasHeader ? firstCols.indexOf('hotel') : 0,
      edificio: hasHeader ? firstCols.indexOf('edificio') : 1,
      vista: hasHeader ? firstCols.indexOf('vista') : 2,
      piso: hasHeader ? firstCols.indexOf('piso') : 3,
      numero: hasHeader ? firstCols.indexOf('numero') : 4,
      estado: hasHeader ? firstCols.indexOf('estado') : 5,
    };

    const existingNumbers = new Set(this.rooms.map((r) => r.numero.trim().toLowerCase()));
    const skippedDuplicates: string[] = [];
    const newlyAdded: Room[] = [];
    let invalidRows = 0;

    const startRow = hasHeader ? 1 : 0;
    for (let i = startRow; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      const rawHotel = headerMap.hotel >= 0 ? cols[headerMap.hotel] ?? '' : '';
      const rawEdificio = headerMap.edificio >= 0 ? cols[headerMap.edificio] ?? '' : '';
      const rawVista = headerMap.vista >= 0 ? cols[headerMap.vista] ?? '' : '';
      const rawPiso = headerMap.piso >= 0 ? cols[headerMap.piso] ?? '' : '';
      const rawNumero = headerMap.numero >= 0 ? cols[headerMap.numero] ?? '' : '';
      const rawEstado = headerMap.estado >= 0 ? cols[headerMap.estado] ?? '' : '';

      const hotelId = resolveHotelId(rawHotel, this.hotels, defaultHotelId);
      const edificio = rawEdificio.trim();
      const vista = rawVista.trim() || 'Sin vista especificada';
      const piso = Number.parseInt(rawPiso, 10);
      const numero = rawNumero.trim();

      if (!hotelId || !edificio || !numero || Number.isNaN(piso) || piso < 0) {
        invalidRows += 1;
        continue;
      }

      const numberKey = numero.toLowerCase();
      if (existingNumbers.has(numberKey)) {
        skippedDuplicates.push(numero);
        continue;
      }

      existingNumbers.add(numberKey);
      const estado = parseRoomStatus(rawEstado) ?? 'sucia';

      newlyAdded.push({
        id: createId(`room-${hotelId}`),
        hotelId,
        edificio,
        vista,
        piso,
        numero,
        estado,
      });
    }

    if (newlyAdded.length > 0) {
      this.rooms = [...this.rooms, ...newlyAdded];
    }

    return {
      result: {
        importedCount: newlyAdded.length,
        skippedDuplicates,
        invalidRows,
        totalProcessed: lines.length - startRow,
      },
      rooms: this.rooms.map((r) => ({ ...r })),
    };
  }

  exportRoomsToCsv(rooms: Room[], hotels: Hotel[]): string {
    const hotelMap = new Map(hotels.map((h) => [h.id, h.nombre]));
    const header = 'hotel,edificio,vista,piso,numero,estado';
    const rows = rooms.map((room) =>
      [
        escapeCsvCell(hotelMap.get(room.hotelId) ?? room.hotelId),
        escapeCsvCell(room.edificio),
        escapeCsvCell(room.vista),
        escapeCsvCell(room.piso),
        escapeCsvCell(room.numero),
        escapeCsvCell(room.estado),
      ].join(',')
    );
    return `\uFEFF${header}\r\n${rows.join('\r\n')}`;
  }

  // --- Mantenimiento ---
  async createTicket(input: MaintenanceTicketInput): Promise<HotelOpsSnapshot> {
    const room = this.rooms.find((r) => r.id === input.roomId);
    if (!room) throw new Error('Selecciona una habitación válida.');
    const titulo = input.titulo.trim();
    if (!titulo) throw new Error('El título del ticket es obligatorio.');

    const responsable = input.responsable.trim() || this.responsablesMantenimiento[0];
    if (!this.responsablesMantenimiento.includes(responsable)) {
      this.responsablesMantenimiento = [...this.responsablesMantenimiento, responsable];
    }

    const ticket: MaintenanceTicket = {
      id: createId('tkt'),
      roomId: room.id,
      titulo,
      descripcion: input.descripcion.trim(),
      prioridad: input.prioridad,
      estado: 'abierto',
      responsable,
      origen: input.origen ?? 'manual',
      fechaCreacion: new Date().toISOString(),
      fechaCierre: null,
    };

    this.tickets = [ticket, ...this.tickets];

    // Business rule: Urgent + Open ticket moves room to fuera_de_servicio
    if (ticket.prioridad === 'urgente' && ticket.estado === 'abierto') {
      this.setRoomStatusInternal(room.id, 'fuera_de_servicio');
    }

    return this.cloneSnapshot();
  }

  async updateTicket(
    ticketId: string,
    patch: Partial<
      Pick<MaintenanceTicket, 'estado' | 'prioridad' | 'responsable' | 'titulo' | 'descripcion'>
    >
  ): Promise<HotelOpsSnapshot> {
    const idx = this.tickets.findIndex((t) => t.id === ticketId);
    if (idx === -1) throw new Error('No se encontró el ticket.');

    const current = this.tickets[idx];
    const nextEstado = patch.estado ?? current.estado;
    const nextPrioridad = patch.prioridad ?? current.prioridad;
    const nextResponsable = patch.responsable?.trim() || current.responsable;

    const fechaCierre =
      nextEstado === 'resuelto'
        ? current.fechaCierre ?? new Date().toISOString()
        : null;

    const updated: MaintenanceTicket = {
      ...current,
      ...patch,
      estado: nextEstado,
      prioridad: nextPrioridad,
      responsable: nextResponsable,
      fechaCierre,
    };

    const nextTickets = [...this.tickets];
    nextTickets[idx] = updated;
    this.tickets = nextTickets;

    // Enforce urgent + open -> fuera_de_servicio
    if (updated.prioridad === 'urgente' && updated.estado === 'abierto') {
      this.setRoomStatusInternal(updated.roomId, 'fuera_de_servicio');
    }

    return this.cloneSnapshot();
  }

  // --- Recepción ---
  async createStay(input: CreateStayInput): Promise<HotelOpsSnapshot> {
    const room = this.rooms.find((r) => r.id === input.roomId);
    if (!room) throw new Error('Selecciona una habitación válida.');

    if (!input.fechaEntrada || !input.fechaSalida || input.fechaSalida <= input.fechaEntrada) {
      throw new Error('La fecha de salida debe ser posterior a la fecha de entrada.');
    }

    // Check overlap against non-finalized stays on the same room
    const conflict = this.estancias.find(
      (st) =>
        st.roomId === room.id &&
        st.estado !== 'finalizada' &&
        rangesOverlap(st.fechaEntrada, st.fechaSalida, input.fechaEntrada, input.fechaSalida)
    );
    if (conflict) {
      throw new Error(
        `La habitación ${room.numero} ya tiene una estancia asignada del ${conflict.fechaEntrada} al ${conflict.fechaSalida}.`
      );
    }

    let huespedId = input.huespedId?.trim() ?? '';
    if (!huespedId) {
      const nombre = input.nuevoHuespedNombre?.trim() ?? '';
      if (!nombre) throw new Error('Selecciona un huésped o ingresa el nombre de un huésped nuevo.');
      const newGuest: Huesped = { id: createId('guest'), nombre };
      this.huespedes = [newGuest, ...this.huespedes];
      huespedId = newGuest.id;
    }

    const desiredStatus = input.estado ?? 'reservada';
    if (desiredStatus === 'en_casa' && !isRoomReady(room.estado)) {
      throw new Error(
        `No se puede hacer check-in en la habitación ${room.numero}: actualmente está "${room.estado.replace('_', ' ')}". Solo se permite en habitaciones limpias o inspeccionadas.`
      );
    }

    const stay: Estancia = {
      id: createId('stay'),
      huespedId,
      roomId: room.id,
      fechaEntrada: input.fechaEntrada,
      fechaSalida: input.fechaSalida,
      estado: desiredStatus,
    };

    this.estancias = [stay, ...this.estancias];
    return this.cloneSnapshot();
  }

  async reassignStayRoom(stayId: string, newRoomId: string): Promise<HotelOpsSnapshot> {
    const idx = this.estancias.findIndex((st) => st.id === stayId);
    if (idx === -1) throw new Error('Estancia no encontrada.');

    const current = this.estancias[idx];
    const targetRoom = this.rooms.find((r) => r.id === newRoomId);
    if (!targetRoom) throw new Error('Habitación no válida.');

    if (current.estado === 'en_casa' && !isRoomReady(targetRoom.estado)) {
      throw new Error(
        `Para cambiar a la habitación ${targetRoom.numero} estando en casa, debe estar limpia o inspeccionada.`
      );
    }

    const conflict = this.estancias.find(
      (st) =>
        st.id !== stayId &&
        st.roomId === newRoomId &&
        st.estado !== 'finalizada' &&
        rangesOverlap(st.fechaEntrada, st.fechaSalida, current.fechaEntrada, current.fechaSalida)
    );
    if (conflict) {
      throw new Error(
        `La habitación ${targetRoom.numero} ya está ocupada o reservada en esas fechas.`
      );
    }

    const next = [...this.estancias];
    next[idx] = { ...current, roomId: newRoomId };
    this.estancias = next;
    return this.cloneSnapshot();
  }

  async checkInStay(stayId: string): Promise<HotelOpsSnapshot> {
    const idx = this.estancias.findIndex((st) => st.id === stayId);
    if (idx === -1) throw new Error('Estancia no encontrada.');

    const stay = this.estancias[idx];
    const room = this.rooms.find((r) => r.id === stay.roomId);
    if (!room) throw new Error('No se encontró la habitación asignada.');

    if (!isRoomReady(room.estado)) {
      throw new Error(
        `Check-in bloqueado: la habitación ${room.numero} no está limpia ni inspeccionada (estado actual: ${room.estado.replace(/_/g, ' ')}).`
      );
    }

    const next = [...this.estancias];
    next[idx] = { ...stay, estado: 'en_casa' };
    this.estancias = next;
    return this.cloneSnapshot();
  }

  async checkOutStay(stayId: string): Promise<HotelOpsSnapshot> {
    const idx = this.estancias.findIndex((st) => st.id === stayId);
    if (idx === -1) throw new Error('Estancia no encontrada.');

    const stay = this.estancias[idx];
    const next = [...this.estancias];
    next[idx] = { ...stay, estado: 'finalizada' };
    this.estancias = next;

    // Business rule: Check-out automatically marks the room as sucia
    this.setRoomStatusInternal(stay.roomId, 'sucia');

    return this.cloneSnapshot();
  }

  // --- Encuestas por habitación ---
  async submitRoomSurvey(input: RoomSurveySubmissionInput): Promise<{
    survey: RoomSurveyResponse;
    snapshot: HotelOpsSnapshot;
  }> {
    if (!this.initialized) {
      await this.loadInitialSnapshot();
    }

    const normalizedRef = input.roomId.trim().toLowerCase();
    const room = this.rooms.find(
      (r) => r.id.toLowerCase() === normalizedRef || r.numero.toLowerCase() === normalizedRef
    );
    if (!room) {
      throw new Error('No se encontró la habitación asociada a este enlace de encuesta.');
    }

    const hotelName = this.hotels.find((h) => h.id === room.hotelId)?.nombre ?? room.hotelId;
    const activeStay =
      this.estancias.find((st) => st.roomId === room.id && st.estado === 'en_casa') ?? null;
    const promedio = computeSurveyAverage(input.calificaciones);
    const nowIso = new Date().toISOString();

    let alertaGenerada: RoomSurveyResponse['alertaGenerada'] = null;

    // Business rule: average <= 2 auto-creates a maintenance ticket (if maintenance <= 2) or a complaint request + alert
    if (promedio <= 2) {
      const isMaintenanceIssue = input.calificaciones.mantenimiento <= 2;

      if (isMaintenanceIssue) {
        const ticketId = createId('tkt');
        const priority: TicketPriority = promedio <= 1.5 ? 'urgente' : 'alta';
        const autoTicket: MaintenanceTicket = {
          id: ticketId,
          roomId: room.id,
          titulo: `Incidencia por encuesta crítica (${promedio.toFixed(1)}/5) · Hab. ${room.numero}`,
          descripcion:
            input.comentario.trim() ||
            `Calificación promedio ${promedio.toFixed(1)}/5 (Mantenimiento: ${input.calificaciones.mantenimiento}/5, NPS: ${input.nps}/10).`,
          prioridad: priority,
          estado: 'abierto',
          responsable: this.responsablesMantenimiento[0],
          origen: 'encuesta',
          fechaCreacion: nowIso,
          fechaCierre: null,
        };
        this.tickets = [autoTicket, ...this.tickets];
        if (priority === 'urgente') {
          this.setRoomStatusInternal(room.id, 'fuera_de_servicio');
        }
        alertaGenerada = { tipo: 'ticket', referenciaId: ticketId };

        this.alerts = [
          {
            id: createId('alert'),
            roomId: room.id,
            roomNumero: room.numero,
            hotelNombre: hotelName,
            promedio,
            tipoAccion: 'ticket',
            referenciaId: ticketId,
            mensaje: `Alerta: Encuesta con promedio ${promedio.toFixed(1)}/5 en Hab. ${room.numero} (${hotelName} · ${room.edificio}). Se creó automáticamente un ticket de mantenimiento (${priority}).`,
            fecha: nowIso,
            leida: false,
          },
          ...this.alerts,
        ];
      } else {
        const reqId = createId('sol');
        const autoComplaint: GuestRequest = {
          id: reqId,
          roomId: room.id,
          tipo: 'queja',
          descripcion:
            input.comentario.trim() ||
            `Queja generada automáticamente por encuesta con promedio ${promedio.toFixed(1)}/5 (NPS: ${input.nps}/10).`,
          estado: 'pendiente',
          fecha: nowIso,
        };
        this.solicitudes = [autoComplaint, ...this.solicitudes];
        alertaGenerada = { tipo: 'solicitud', referenciaId: reqId };

        this.alerts = [
          {
            id: createId('alert'),
            roomId: room.id,
            roomNumero: room.numero,
            hotelNombre: hotelName,
            promedio,
            tipoAccion: 'solicitud',
            referenciaId: reqId,
            mensaje: `Alerta: Encuesta con promedio ${promedio.toFixed(1)}/5 en Hab. ${room.numero} (${hotelName} · ${room.edificio}). Se registró automáticamente una queja en Solicitudes.`,
            fecha: nowIso,
            leida: false,
          },
          ...this.alerts,
        ];
      }
    }

    const survey: RoomSurveyResponse = {
      id: createId('rsurv'),
      estanciaId: input.estanciaId ?? activeStay?.id ?? null,
      roomId: room.id,
      hotel: hotelName,
      edificio: room.edificio,
      piso: room.piso,
      vista: room.vista,
      numero: room.numero,
      calificaciones: { ...input.calificaciones },
      nps: clamp(Math.round(input.nps), 0, 10),
      comentario: input.comentario.trim(),
      fecha: nowIso,
      promedio,
      alertaGenerada,
    };

    this.roomSurveys = [survey, ...this.roomSurveys];

    return {
      survey: { ...survey, calificaciones: { ...survey.calificaciones } },
      snapshot: this.cloneSnapshot(),
    };
  }

  async dismissAlert(alertId: string): Promise<HotelOpsSnapshot> {
    this.alerts = this.alerts.map((a) => (a.id === alertId ? { ...a, leida: true } : a));
    return this.cloneSnapshot();
  }

  // --- Solicitudes de huéspedes ---
  async createGuestRequest(input: GuestRequestInput): Promise<HotelOpsSnapshot> {
    const room = this.rooms.find((r) => r.id === input.roomId);
    if (!room) throw new Error('Selecciona una habitación válida.');
    const descripcion = input.descripcion.trim();
    if (!descripcion) throw new Error('Describe la solicitud del huésped.');

    const req: GuestRequest = {
      id: createId('sol'),
      roomId: room.id,
      tipo: input.tipo,
      descripcion,
      estado: 'pendiente',
      fecha: new Date().toISOString(),
    };

    this.solicitudes = [req, ...this.solicitudes];
    return this.cloneSnapshot();
  }

  async updateGuestRequestStatus(
    requestId: string,
    estado: GuestRequestStatus
  ): Promise<HotelOpsSnapshot> {
    const idx = this.solicitudes.findIndex((s) => s.id === requestId);
    if (idx === -1) throw new Error('Solicitud no encontrada.');
    const next = [...this.solicitudes];
    next[idx] = { ...next[idx], estado };
    this.solicitudes = next;
    return this.cloneSnapshot();
  }
}

export const hotelOpsRepository: HotelOpsRepository = new InMemoryHotelOpsRepository();
