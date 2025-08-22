import React, { createContext, useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Configurar axios com base URL
  const api = axios.create({
    baseURL: 'http://localhost:3001/api',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  useEffect(() => {
    // Verificar se há usuário salvo no localStorage na inicialização
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("authToken");
    
    if (savedUser && savedToken) {
      try {
        const userData = JSON.parse(savedUser);
        console.log("[AuthContext] Usuário recuperado do localStorage:", userData);
        
        // Verificar se os dados essenciais estão presentes
        if (userData.uid && userData.email && savedToken) {
          // Verificar se o token não está vazio ou inválido
          if (savedToken.startsWith('mock-token-') || savedToken.length > 20) {
            setUser(userData);
            console.log("[AuthContext] Token válido, usuário autenticado");
          } else {
            console.warn("[AuthContext] Token inválido detectado, limpando dados");
            localStorage.removeItem("user");
            localStorage.removeItem("authToken");
          }
        } else {
          console.warn("[AuthContext] Dados de usuário incompletos, limpando localStorage");
          localStorage.removeItem("user");
          localStorage.removeItem("authToken");
        }
      } catch (error) {
        console.error("[AuthContext] Erro ao parsear usuário do localStorage:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("authToken");
      }
    }
    
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      console.log("[Login] Iniciando login com SQLite API...");
      
      const response = await api.post('/login', {
        email,
        password
      });
      
      console.log("[Login] Resposta da API:", response.data);
      
      const { token, user: userFromApi } = response.data;
      
      if (!token || !userFromApi) {
        throw new Error("Resposta inválida do servidor");
      }
      
      const userData = {
        uid: userFromApi.uid,
        email: userFromApi.email,
        nomeCompleto: userFromApi.nomeCompleto,
        cargo: userFromApi.cargo || "usuario",
        token
      };
      
      console.log("[Login] userData completo:", userData);
      
      setUser(userData);
      localStorage.setItem("authToken", token);
      localStorage.setItem("user", JSON.stringify(userData));
      
      navigate("/home");
    } catch (error) {
      console.error("[Login] Erro detalhado:", error);
      
      if (error.response) {
        // Erro da API
        throw new Error(error.response.data.error || "Erro no servidor");
      } else if (error.request) {
        // Erro de rede
        throw new Error("Erro de conexão com o servidor");
      } else {
        // Outro erro
        throw new Error(error.message || "Erro desconhecido");
      }
    }
  };

  const logout = async () => {
    try {
      console.log("[Logout] Fazendo logout...");
      
      setUser(null);
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      localStorage.removeItem("rememberedEmail");
      localStorage.removeItem("rememberedPassword");
      
      navigate("/");
      console.log("[Logout] Logout concluído");
    } catch (error) {
      console.error("[Logout] Erro no logout:", error);
      throw new Error("Falha no logout: " + error.message);
    }
  };

  const clearStorageAndRefresh = () => {
    console.log("[Debug] Limpando localStorage e fazendo logout forçado...");
    localStorage.clear();
    setUser(null);
    navigate("/");
    window.location.reload();
  };

  const isAdmin = user?.cargo === "admin";
  
  // Debug log para verificar isAdmin
  console.log("[AuthContext] user:", user);
  console.log("[AuthContext] user.cargo:", user?.cargo);
  console.log("[AuthContext] isAdmin:", isAdmin);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, clearStorageAndRefresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};