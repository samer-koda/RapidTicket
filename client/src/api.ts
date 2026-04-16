// Central API client — all fetch calls go through here.

let _baseUrl = 'http://localhost:3000';
let _token: string | null = null;
let _stationId: string | null = null;

export function setBaseUrl(url: string) { _baseUrl = url.replace(/\/$/, ''); }
export function setToken(token: string | null) { _token = token; }
export function getToken() { return _token; }
export function setStationId(id: string | null) { _stationId = id; }
export function getStationId() { return _stationId; }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // If the module-level token was cleared (e.g. by HMR), recover it from sessionStorage.
  if (!_token) {
    try {
      const saved = sessionStorage.getItem('rt_session');
      if (saved) {
        const { token: t } = JSON.parse(saved) as { token?: string };
        if (t) { _token = t; }
      }
    } catch { /* ignore */ }
  }

  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  if (_stationId) headers['X-Station-Id'] = _stationId;

  const res = await fetch(`${_baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Shared types ────────────────────────────────────────────────────────────
export interface StationRow {
  id: string;
  name: string;
  macAddress: string;
  printerType: string;
  printerName: string | null;
  defaultFloorPlanId: string | null;
  createdAt: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    setupStatus: () => request<{ needsSetup: boolean }>('GET', '/auth/setup-status'),
    bootstrap: (body: { name: string; pin: string }) =>
      request<{ token: string; user: { id: string; name: string; role: string } }>('POST', '/auth/bootstrap', body),
    login: (pin: string) => request<{ token: string; user: { id: string; name: string; role: string } }>('POST', '/auth/login', { pin }),
    logout: () => request<{ success: boolean }>('POST', '/auth/logout'),
  },

  // ── Stations ────────────────────────────────────────────────────────────────
  stations: {
    register: (body: { stationName: string; macAddress: string; printerType: string; printerName: string | null }) =>
      request<{ stationId: string; license: string }>('POST', '/stations/register', body),
    list: () => request<StationRow[]>('GET', '/stations'),
    get: (id: string) => request<StationRow>('GET', `/stations/${id}`),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/stations/${id}`),
    resetLockout: (id: string) => request<{ success: boolean }>('POST', `/stations/${id}/reset-lockout`),
    setDefaultFloor: (id: string, defaultFloorPlanId: string | null) =>
      request<StationRow>('PATCH', `/stations/${id}/default-floor`, { defaultFloorPlanId }),
  },

  // ── Floor plans ─────────────────────────────────────────────────────────────
  floorPlans: {
    list: () => request<FloorPlan[]>('GET', '/floor-plans'),
    get: (id: string) => request<FloorPlan>('GET', `/floor-plans/${id}`),
    create: (body: { name: string; sortOrder?: number }) => request<FloorPlan>('POST', '/floor-plans', body),
    update: (id: string, body: Partial<{ name: string; sortOrder: number }>) => request<FloorPlan>('PATCH', `/floor-plans/${id}`, body),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/floor-plans/${id}`),
  },

  // ── Tables ──────────────────────────────────────────────────────────────────
  tables: {
    list: (floorPlanId?: string) => request<TableRow[]>('GET', `/tables${floorPlanId ? `?floorPlanId=${floorPlanId}` : ''}`),
    create: (body: object) => request<TableRow>('POST', '/tables', body),
    update: (id: string, body: object) => request<TableRow>('PATCH', `/tables/${id}`, body),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/tables/${id}`),
    listSeats: (id: string) => request<Seat[]>('GET', `/tables/${id}/seats`),
    createSeat: (id: string, body: { label: string }) => request<Seat>('POST', `/tables/${id}/seats`, body),
    updateSeat: (tableId: string, seatId: string, body: { label: string }) => request<Seat>('PATCH', `/tables/${tableId}/seats/${seatId}`, body),
    deleteSeat: (tableId: string, seatId: string) => request<void>('DELETE', `/tables/${tableId}/seats/${seatId}`),
  },

  // ── Menu ────────────────────────────────────────────────────────────────────
  menu: {
    categories: () => request<Category[]>('GET', '/menu/categories'),
    listCategories: () => request<Category[]>('GET', '/menu/categories'),
    createCategory: (body: object) => request<Category>('POST', '/menu/categories', body),
    updateCategory: (id: string, body: object) => request<Category>('PATCH', `/menu/categories/${id}`, body),
    deleteCategory: (id: string) => request<void>('DELETE', `/menu/categories/${id}`),
    items: (params?: { categoryId?: string; type?: string }) => {
      const q = new URLSearchParams((params ?? {}) as Record<string, string>).toString();
      return request<MenuItem[]>('GET', `/menu/items${q ? `?${q}` : ''}`);
    },
    listItems: (params?: { categoryId?: string; type?: string }) => {
      const q = new URLSearchParams((params ?? {}) as Record<string, string>).toString();
      return request<MenuItem[]>('GET', `/menu/items${q ? `?${q}` : ''}`);
    },
    createItem: (body: object) => request<MenuItem>('POST', '/menu/items', body),
    updateItem: (id: string, body: object) => request<MenuItem>('PATCH', `/menu/items/${id}`, body),
    deleteItem: (id: string) => request<void>('DELETE', `/menu/items/${id}`),
    modifiers: () => request<Modifier[]>('GET', '/menu/modifiers'),
    createModifier: (body: object) => request<Modifier>('POST', '/menu/modifiers', body),
    updateModifier: (modifierId: string, body: object) => request<Modifier>('PATCH', `/menu/modifiers/${modifierId}`, body),
    deleteModifier: (modifierId: string) => request<void>('DELETE', `/menu/modifiers/${modifierId}`),
    listItemModifiers: (itemId: string) => request<Modifier[]>('GET', `/menu/items/${itemId}/modifiers`),
    assignModifier: (itemId: string, modifierId: string) => request<void>('POST', `/menu/items/${itemId}/modifiers/${modifierId}`),
    unassignModifier: (itemId: string, modifierId: string) => request<void>('DELETE', `/menu/items/${itemId}/modifiers/${modifierId}`),
  },

  // ── Orders ──────────────────────────────────────────────────────────────────
  orders: {
    list: (params?: { status?: string; tableId?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<OrderSummary[]>('GET', `/orders${q ? `?${q}` : ''}`);
    },
    get: (id: string) => request<OrderDetail>('GET', `/orders/${id}`),
    create: (body: { tableId: string; items: OrderItemInput[] }) => request<{ id: string; status: string }>('POST', '/orders', body),
    addItems: (id: string, body: { items: OrderItemInput[] }) => request<OrderDetail>('PATCH', `/orders/${id}`, body),
    updateItemStatus: (orderId: string, itemId: string, status: string) =>
      request<{ id: string; status: string }>('PATCH', `/orders/${orderId}/items/${itemId}`, { status }),
  },

  // ── Payments ────────────────────────────────────────────────────────────────
  payments: {
    create: (body: { orderId: string; method: string; tipAmount?: number }) => request<PaymentResult>('POST', '/payments', body),
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  settings: {
    list: () => request<Setting[]>('GET', '/settings'),
    set: (key: string, value: string) => request<Setting>('PUT', `/settings/${key}`, { value }),
    getTaxRate: () => request<{ taxRate: number }>('GET', '/settings/tax-rate'),
    setTaxRate: (taxRate: number) => request<{ taxRate: number }>('PATCH', '/settings/tax-rate', { taxRate }),
    getLockout: () => request<{ pinLockoutThreshold: number; pinLockoutDuration: number }>('GET', '/settings/lockout'),
    setLockout: (body: { pinLockoutThreshold: number; pinLockoutDuration: number }) =>
      request<{ pinLockoutThreshold: number; pinLockoutDuration: number }>('PATCH', '/settings/lockout', body),
    factoryReset: (pin: string) => request<{ success: boolean }>('POST', '/settings/factory-reset', { pin }),
  },

  // ── Printers ────────────────────────────────────────────────────────────────
  printers: {
    list: () => request<PrinterRow[]>('GET', '/printers'),
    create: (body: object) => request<PrinterRow>('POST', '/printers', body),
    update: (id: string, body: object) => request<PrinterRow>('PATCH', `/printers/${id}`, body),
    delete: (id: string) => request<void>('DELETE', `/printers/${id}`),
    test: (id: string) => request<{ reachable: boolean; latencyMs: number }>('POST', `/printers/${id}/test`),
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  users: {
    list: () => request<UserRow[]>('GET', '/users'),
    create: (body: { name: string; role: string; pin: string }) => request<UserRow>('POST', '/users', body),
    update: (id: string, body: { name?: string; role?: string; pin?: string }) => request<UserRow>('PATCH', `/users/${id}`, body),
    delete: (id: string) => request<void>('DELETE', `/users/${id}`),
  },

  // ── Reports ─────────────────────────────────────────────────────────────────
  reports: {
    daily: (date?: string) => request<DailyReport>('GET', `/reports/daily${date ? `?date=${date}` : ''}`),
    tables: () => request<TableReport[]>('GET', '/reports/tables'),
  },
};

// ── Shared types ─────────────────────────────────────────────────────────────
export interface FloorPlan { id: string; name: string; sortOrder: number; tables: TableRow[]; }
export interface TableRow { id: string; floorPlanId: string; floorPlanName: string; label: string; name: string; shape: 'RECTANGLE' | 'ROUND'; positionX: number; positionY: number; status: string; occupied: boolean; seatCount: number; seats: number; }
export interface Seat { id: string; tableId: string; label: string; }
export interface Category { id: string; name: string; sortOrder: number; }
export interface Modifier { id: string; label: string; action: 'ADD' | 'REMOVE'; priceDelta: number; sortOrder: number; }
export interface MenuItem { id: string; name: string; categoryId: string; price: number; type: 'FOOD' | 'DRINK'; isTaxable: boolean; printDestination: 'KITCHEN' | 'BAR' | 'NONE'; isAvailable: boolean; available: boolean; sortOrder: number; modifiers: Modifier[]; }
export interface OrderSummary { id: string; tableId: string; status: string; total: number; createdAt: string; createdBy: string; }
export interface OrderItemModifier { label: string; action: string; priceDelta: number; }
export interface OrderItem { id: string; name: string; quantity: number; unitPrice: number; isTaxable: boolean; printDestination: string; appliedModifiers: OrderItemModifier[]; notes: string; status: string; }
export interface OrderDetail { id: string; tableId: string; createdBy: string; status: string; subtotal: number; taxableSubtotal: number; taxAmount: number; total: number; items: OrderItem[]; }
export interface OrderItemInput { menuItemId: string; quantity: number; modifierIds?: string[]; notes?: string; }
export interface PaymentResult { id: string; status: string; subtotal: number; taxableSubtotal: number; taxRate: number; taxAmount: number; tipAmount: number; total: number; }
export interface PrinterRow { id: string; name: string; ipAddress: string; port: number; type: 'KITCHEN' | 'BAR' | 'RECEIPT'; }
export interface UserRow { id: string; name: string; role: 'admin' | 'server' | 'bartender'; createdAt: string; }
export interface Setting { key: string; value: string; }
export interface DailyReport { date: string; totalOrders: number; orderCount: number; totalRevenue: number; totalTax: number; totalTips: number; pendingRevenue: number; cashRevenue: number; cardRevenue: number; openTables: number; coverCount: number; tableReports: TableReport[]; }
export interface TableReport { tableId: string; tableLabel: string; name: string; floorPlanId: string; floorPlanName: string; status: string; occupied: boolean; openOrderTotal: number; openSince: string; orderCount: number; totalRevenue: number; }
