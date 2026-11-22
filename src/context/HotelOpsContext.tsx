import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hotelOpsRepository } from '../services/hotelOpsRepository';
import type {
  Camarista,
  CreateStayInput,
  CsvImportResult,
  Estancia,
  GuestRequest,
  GuestRequestInput,
  GuestRequestStatus,
  Hotel,
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
  RoomSurveyResponse,
  RoomSurveySubmissionInput,
} from '../types/hotelOps';

interface HotelOpsContextValue {
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
  unreadAlerts: OpsAlert[];
  loading: boolean;
  error: string | null;
  hotelById: Map<string, Hotel>;
  roomById: Map<string, Room>;
  camaristaById: Map<string, Camarista>;
  huespedById: Map<string, Huesped>;
  assignmentByRoomId: Map<string, string>;
  historyByRoomId: Map<string, RoomStatusHistoryEntry[]>;
  reload: () => Promise<void>;
  createRoom: (input: RoomInput) => Promise<Room>;
  updateRoom: (roomId: string, input: RoomInput) => Promise<Room>;
  deleteRoom: (roomId: string) => Promise<void>;
  changeRoomStatus: (roomId: string, newStatus: RoomStatus) => Promise<void>;
  assignCamarista: (roomId: string, camaristaId: string | null) => Promise<void>;
  assignCamaristaByFloor: (params: {
    hotelId: string;
    edificio: string;
    piso: number;
    camaristaId: string | null;
  }) => Promise<number>;
  importRoomsCsv: (csvText: string, defaultHotelId?: string) => Promise<CsvImportResult>;
  exportRoomsCsv: (targetRooms?: Room[]) => string;
  // Mantenimiento
  createTicket: (input: MaintenanceTicketInput) => Promise<void>;
  updateTicket: (
    ticketId: string,
    patch: Partial<
      Pick<MaintenanceTicket, 'estado' | 'prioridad' | 'responsable' | 'titulo' | 'descripcion'>
    >
  ) => Promise<void>;
  // Recepción
  createStay: (input: CreateStayInput) => Promise<void>;
  reassignStayRoom: (stayId: string, newRoomId: string) => Promise<void>;
  checkInStay: (stayId: string) => Promise<void>;
  checkOutStay: (stayId: string) => Promise<void>;
  // Encuestas por habitación
  submitRoomSurvey: (input: RoomSurveySubmissionInput) => Promise<RoomSurveyResponse>;
  dismissAlert: (alertId: string) => Promise<void>;
  // Solicitudes
  createGuestRequest: (input: GuestRequestInput) => Promise<void>;
  updateGuestRequestStatus: (requestId: string, estado: GuestRequestStatus) => Promise<void>;
}

const HotelOpsContext = createContext<HotelOpsContextValue | null>(null);

export function HotelOpsProvider({ children }: { children: React.ReactNode }) {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [camaristas, setCamaristas] = useState<Camarista[]>([]);
  const [responsablesMantenimiento, setResponsablesMantenimiento] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);
  const [history, setHistory] = useState<RoomStatusHistoryEntry[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [huespedes, setHuespedes] = useState<Huesped[]>([]);
  const [estancias, setEstancias] = useState<Estancia[]>([]);
  const [roomSurveys, setRoomSurveys] = useState<RoomSurveyResponse[]>([]);
  const [solicitudes, setSolicitudes] = useState<GuestRequest[]>([]);
  const [alerts, setAlerts] = useState<OpsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySnapshot = useCallback((snapshot: HotelOpsSnapshot) => {
    setHotels(snapshot.hotels);
    setRooms(snapshot.rooms);
    setCamaristas(snapshot.camaristas);
    setResponsablesMantenimiento(snapshot.responsablesMantenimiento);
    setAssignments(snapshot.assignments);
    setHistory(snapshot.history);
    setTickets(snapshot.tickets);
    setHuespedes(snapshot.huespedes);
    setEstancias(snapshot.estancias);
    setRoomSurveys(snapshot.roomSurveys);
    setSolicitudes(snapshot.solicitudes);
    setAlerts(snapshot.alerts);
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await hotelOpsRepository.loadInitialSnapshot();
      applySnapshot(snapshot);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los datos operativos del complejo.'
      );
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const hotelById = useMemo(() => new Map(hotels.map((h) => [h.id, h])), [hotels]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const camaristaById = useMemo(() => new Map(camaristas.map((c) => [c.id, c])), [camaristas]);
  const huespedById = useMemo(() => new Map(huespedes.map((g) => [g.id, g])), [huespedes]);

  const assignmentByRoomId = useMemo(
    () => new Map(assignments.map((a) => [a.roomId, a.camaristaId])),
    [assignments]
  );

  const historyByRoomId = useMemo(() => {
    const map = new Map<string, RoomStatusHistoryEntry[]>();
    for (const entry of history) {
      const list = map.get(entry.roomId);
      if (list) {
        list.push(entry);
      } else {
        map.set(entry.roomId, [entry]);
      }
    }
    return map;
  }, [history]);

  const unreadAlerts = useMemo(() => alerts.filter((a) => !a.leida), [alerts]);

  const createRoom = useCallback(async (input: RoomInput): Promise<Room> => {
    const created = await hotelOpsRepository.createRoom(input);
    setRooms((prev) => [...prev, created]);
    return created;
  }, []);

  const updateRoom = useCallback(
    async (roomId: string, input: RoomInput): Promise<Room> => {
      const updated = await hotelOpsRepository.updateRoom(roomId, input);
      const snapshot = await hotelOpsRepository.loadInitialSnapshot();
      applySnapshot(snapshot);
      return updated;
    },
    [applySnapshot]
  );

  const deleteRoom = useCallback(async (roomId: string): Promise<void> => {
    await hotelOpsRepository.deleteRoom(roomId);
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setAssignments((prev) => prev.filter((a) => a.roomId !== roomId));
    setHistory((prev) => prev.filter((h) => h.roomId !== roomId));
  }, []);

  const changeRoomStatus = useCallback(
    async (roomId: string, newStatus: RoomStatus): Promise<void> => {
      const { room, historyEntry } = await hotelOpsRepository.changeRoomStatus(roomId, newStatus);
      setRooms((prev) => prev.map((r) => (r.id === roomId ? room : r)));
      if (historyEntry) {
        setHistory((prev) => [historyEntry, ...prev]);
      }
    },
    []
  );

  const assignCamarista = useCallback(
    async (roomId: string, camaristaId: string | null): Promise<void> => {
      const updated = await hotelOpsRepository.assignCamarista(roomId, camaristaId);
      setAssignments((prev) => {
        const without = prev.filter((a) => a.roomId !== roomId);
        return updated ? [...without, updated] : without;
      });
    },
    []
  );

  const assignCamaristaByFloor = useCallback(
    async (params: {
      hotelId: string;
      edificio: string;
      piso: number;
      camaristaId: string | null;
    }): Promise<number> => {
      const { updatedRoomIds, assignments: nextAssignments } =
        await hotelOpsRepository.assignCamaristaByFloor(params);
      setAssignments(nextAssignments);
      return updatedRoomIds.length;
    },
    []
  );

  const importRoomsCsv = useCallback(
    async (csvText: string, defaultHotelId?: string): Promise<CsvImportResult> => {
      const { result, rooms: nextRooms } = await hotelOpsRepository.importRoomsFromCsv(
        csvText,
        defaultHotelId
      );
      setRooms(nextRooms);
      return result;
    },
    []
  );

  const exportRoomsCsv = useCallback(
    (targetRooms?: Room[]): string => {
      return hotelOpsRepository.exportRoomsToCsv(targetRooms ?? rooms, hotels);
    },
    [rooms, hotels]
  );

  const createTicket = useCallback(
    async (input: MaintenanceTicketInput): Promise<void> => {
      const snapshot = await hotelOpsRepository.createTicket(input);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const updateTicket = useCallback(
    async (
      ticketId: string,
      patch: Partial<
        Pick<MaintenanceTicket, 'estado' | 'prioridad' | 'responsable' | 'titulo' | 'descripcion'>
      >
    ): Promise<void> => {
      const snapshot = await hotelOpsRepository.updateTicket(ticketId, patch);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const createStay = useCallback(
    async (input: CreateStayInput): Promise<void> => {
      const snapshot = await hotelOpsRepository.createStay(input);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const reassignStayRoom = useCallback(
    async (stayId: string, newRoomId: string): Promise<void> => {
      const snapshot = await hotelOpsRepository.reassignStayRoom(stayId, newRoomId);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const checkInStay = useCallback(
    async (stayId: string): Promise<void> => {
      const snapshot = await hotelOpsRepository.checkInStay(stayId);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const checkOutStay = useCallback(
    async (stayId: string): Promise<void> => {
      const snapshot = await hotelOpsRepository.checkOutStay(stayId);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const submitRoomSurvey = useCallback(
    async (input: RoomSurveySubmissionInput): Promise<RoomSurveyResponse> => {
      const { survey, snapshot } = await hotelOpsRepository.submitRoomSurvey(input);
      applySnapshot(snapshot);
      return survey;
    },
    [applySnapshot]
  );

  const dismissAlert = useCallback(
    async (alertId: string): Promise<void> => {
      const snapshot = await hotelOpsRepository.dismissAlert(alertId);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const createGuestRequest = useCallback(
    async (input: GuestRequestInput): Promise<void> => {
      const snapshot = await hotelOpsRepository.createGuestRequest(input);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const updateGuestRequestStatus = useCallback(
    async (requestId: string, estado: GuestRequestStatus): Promise<void> => {
      const snapshot = await hotelOpsRepository.updateGuestRequestStatus(requestId, estado);
      applySnapshot(snapshot);
    },
    [applySnapshot]
  );

  const value = useMemo<HotelOpsContextValue>(
    () => ({
      hotels,
      rooms,
      camaristas,
      responsablesMantenimiento,
      assignments,
      history,
      tickets,
      huespedes,
      estancias,
      roomSurveys,
      solicitudes,
      alerts,
      unreadAlerts,
      loading,
      error,
      hotelById,
      roomById,
      camaristaById,
      huespedById,
      assignmentByRoomId,
      historyByRoomId,
      reload: loadSnapshot,
      createRoom,
      updateRoom,
      deleteRoom,
      changeRoomStatus,
      assignCamarista,
      assignCamaristaByFloor,
      importRoomsCsv,
      exportRoomsCsv,
      createTicket,
      updateTicket,
      createStay,
      reassignStayRoom,
      checkInStay,
      checkOutStay,
      submitRoomSurvey,
      dismissAlert,
      createGuestRequest,
      updateGuestRequestStatus,
    }),
    [
      hotels,
      rooms,
      camaristas,
      responsablesMantenimiento,
      assignments,
      history,
      tickets,
      huespedes,
      estancias,
      roomSurveys,
      solicitudes,
      alerts,
      unreadAlerts,
      loading,
      error,
      hotelById,
      roomById,
      camaristaById,
      huespedById,
      assignmentByRoomId,
      historyByRoomId,
      loadSnapshot,
      createRoom,
      updateRoom,
      deleteRoom,
      changeRoomStatus,
      assignCamarista,
      assignCamaristaByFloor,
      importRoomsCsv,
      exportRoomsCsv,
      createTicket,
      updateTicket,
      createStay,
      reassignStayRoom,
      checkInStay,
      checkOutStay,
      submitRoomSurvey,
      dismissAlert,
      createGuestRequest,
      updateGuestRequestStatus,
    ]
  );

  return <HotelOpsContext.Provider value={value}>{children}</HotelOpsContext.Provider>;
}

export function useHotelOps(): HotelOpsContextValue {
  const ctx = useContext(HotelOpsContext);
  if (!ctx) {
    throw new Error('useHotelOps debe utilizarse dentro de HotelOpsProvider.');
  }
  return ctx;
}
