// src/utils/axiosConfig.js
import axios from 'axios';

// Em produção (Render) use o próprio domínio do app, SEM /api aqui:
const PROD_URL = 'https://projeto-calendario.onrender.com';
// Em dev local você pode usar http://localhost:3001, mas como está hospedado,
// também pode apontar para o mesmo PROD_URL para evitar mixed content em testes.
const LOCAL_URL = 'http://localhost:3001';

const ENV_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  (typeof window !== 'undefined' &&
    (window.location.hostname.includes('onrender.com') ||
     window.location.hostname.includes('vercel.app') ||
     window.location.hostname.includes('netlify.app'))
    ? PROD_URL
    : LOCAL_URL);

// base SEM /api — nós prefixaremos /api nas chamadas
const baseURL = `${ENV_URL}`.replace(/\/+$/, '');

const axiosInstance = axios.create({
  baseURL,
  timeout: 15000,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      console.warn('[axios] 401: limpando sessão e redirecionando para login');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberedPassword');
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    } else if (status === 403) {
      console.warn('[axios] 403: acesso negado');
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
export const setApiBase = (url) => {
  axiosInstance.defaults.baseURL = `${url}`.replace(/\/+$/, '');
  console.info('[axios] baseURL alterada para', axiosInstance.defaults.baseURL);
};
