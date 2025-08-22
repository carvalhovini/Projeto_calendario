// src/utils/axiosConfig.js
import axios from 'axios';

// URLs padrão
const PROD_URL = 'https://projeto-calendario.onrender.com/api';
const LOCAL_URL = 'http://localhost:3001/api';

// tenta ler da env (Vite ou CRA), depois decide pelo host, senão local
const ENV_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  (typeof window !== 'undefined' &&
    (window.location.hostname.includes('onrender.com') ||
     window.location.hostname.includes('vercel.app') ||
     window.location.hostname.includes('netlify.app'))
    ? PROD_URL
    : LOCAL_URL);

// garante que termina sem barra
const baseURL = `${ENV_URL}`.replace(/\/+$/, '');

const axiosInstance = axios.create({
  baseURL, // ex.: https://projeto-calendario.onrender.com/api
  timeout: 15000,
});

// Interceptador de request → adiciona Authorization: Bearer <token>
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptador de response → trata 401 e 403
axiosInstance.interceptors.response.use(
  (response) => response,
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
      console.warn('[axios] 403: acesso não autorizado para este recurso');
    }

    return Promise.reject(error);
  }
);

// opcional: permitir trocar a base em runtime (útil para debug/teste)
export const setApiBase = (url) => {
  axiosInstance.defaults.baseURL = `${url}`.replace(/\/+$/, '');
  console.info('[axios] baseURL alterada para', axiosInstance.defaults.baseURL);
};

export default axiosInstance;
