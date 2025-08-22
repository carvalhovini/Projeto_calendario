import axios from 'axios';


// Configuração base do axios
const axiosInstance = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 10000,
});

// Interceptador para adicionar token automaticamente
axiosInstance.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Usar token armazenado diretamente para evitar quota exceeded
      config.headers.Authorization = `Bearer ${token}`;
      
      // Só tentar refresh se o token estiver realmente expirado
      // (comentado para evitar quota exceeded em desenvolvimento)
      /*
      try {
        if (auth.currentUser) {
          const freshToken = await auth.currentUser.getIdToken(false); // false = não força refresh
          config.headers.Authorization = `Bearer ${freshToken}`;
        }
      } catch (error) {
        console.warn('Usando token armazenado devido a:', error.code);
      }
      */
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptador para lidar com respostas de erro
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[axios] Token inválido ou expirado, fazendo logout');
      // Token expirado ou inválido
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberedPassword');
      
      // Só redirecionar se não estivermos já na página de login
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
