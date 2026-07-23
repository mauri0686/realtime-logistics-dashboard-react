import axios from 'axios';

export const API_BASE_URL = 'http://localhost:5080';

const TOKEN_KEY = 'shiptrack.token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Single axios instance for the whole app. The request interceptor attaches the JWT and the
 * response interceptor centralises 401 handling (the React analogue of an Angular HTTP
 * interceptor) — components never deal with auth headers.
 */
export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Registered once from AuthProvider so a 401 anywhere logs the user out. */
export function onUnauthorized(handler: () => void): () => void {
  const id = api.interceptors.response.use(
    (res) => res,
    (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) handler();
      return Promise.reject(error);
    },
  );
  return () => api.interceptors.response.eject(id);
}
