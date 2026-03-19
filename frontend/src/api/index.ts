import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (username: string, password: string) => api.post('/auth/login', { username, password });
export const getCurrentUser = () => api.get('/auth/me');

// Users
export const getManagers = () => api.get('/users/managers');
export const updateManagerPhone = (managerPhone: string) => api.put('/users/phone', { managerPhone });
export const createUser = (data: any) => api.post('/users', data);
export const updateUser = (id: number, data: any) => api.put(`/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/users/${id}`);

// Clients
export const getClients = (search?: string) => api.get('/clients', { params: { search } });
export const createClient = (data: any) => api.post('/clients', data);
export const updateClient = (id: number, data: any) => api.put(`/clients/${id}`, data);
export const deleteClient = (id: number) => api.delete(`/clients/${id}`);

// Vouchers
export const getVouchers = (params?: any) => api.get('/vouchers', { params });
export const getVoucherById = (id: number) => api.get(`/vouchers/${id}`);
export const createVoucher = (data: any) => api.post('/vouchers', data);
export const updateVoucher = (id: number, data: any) => api.put(`/vouchers/${id}`, data);
export const deleteVoucher = (id: number) => api.delete(`/vouchers/${id}`);
export const restoreVoucher = (id: number) => api.post(`/vouchers/${id}/restore`);
export const copyVoucher = (id: number) => api.post(`/vouchers/${id}/copy`);
export const getTourPrices = (tourId: number, companyId: number, date: string) =>
  api.get('/vouchers/prices/lookup', { params: { tourId, companyId, date } });
export const getToursByCompany = (companyId: number) =>
  api.get(`/vouchers/by-company/${companyId}`);
export const getCompaniesByTour = (tourId: number) =>
  api.get(`/vouchers/by-tour/${tourId}`);

// Payments
export const addPayment = (data: any) => api.post('/payments', data);
export const updatePayment = (id: number, data: any) => api.put(`/payments/${id}`, data);
export const deletePayment = (id: number) => api.delete(`/payments/${id}`);

// Reports
export const getReportTotals = (params?: any) => api.get('/reports/totals', { params });
export const getReportSummary = (params?: any) => api.get('/reports/summary', { params });
export const getReportPayments = (params?: any) => api.get('/reports/payments', { params });

// Companies
export const getCompanies = (activeOnly = true) => api.get('/companies', { params: { activeOnly } });
export const createCompany = (data: any) => api.post('/companies', data);
export const updateCompany = (id: number, data: any) => api.put(`/companies/${id}`, data);

// Tours
export const getTours = (tourType?: string, activeOnly = true) =>
  api.get('/tours', { params: { tourType, activeOnly } });
export const createTour = (data: any) => api.post('/tours', data);
export const updateTour = (id: number, data: any) => api.put(`/tours/${id}`, data);

// Tour Prices
export const getTourPricesList = (tourId?: number, companyId?: number) =>
  api.get('/tour-prices', { params: { tourId, companyId, activeOnly: true } });
export const createTourPrice = (data: any) => api.post('/tour-prices', data);
export const updateTourPrice = (id: number, data: any) => api.put(`/tour-prices/${id}`, data);
export const deleteTourPrice = (id: number) => api.delete(`/tour-prices/${id}`);

// Agents
export const getAgents = (activeOnly = true) => api.get('/agents', { params: { activeOnly } });
export const createAgent = (data: any) => api.post('/agents', data);
export const updateAgent = (id: number, data: any) => api.put(`/agents/${id}`, data);
export const deleteAgent = (id: number) => api.delete(`/agents/${id}`);

// Seasons
export const getSeasons = () => api.get('/seasons');
export const createSeason = (data: any) => api.post('/seasons', data);
export const updateSeason = (id: number, data: any) => api.put(`/seasons/${id}`, data);
export const deleteSeason = (id: number) => api.delete(`/seasons/${id}`);

export default api;
