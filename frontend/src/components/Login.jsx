import React, { useState, useContext, useEffect } from "react";
import { AuthContext } from "../AuthContext";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "../styles/Auth.css";

// URL da API - pode ser movida para um arquivo de configuração
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const Login = () => {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    // Se o usuário já está logado, redirecionar para home
    if (user) {
      navigate('/home');
      return;
    }
    
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    // Remover senhas salvas antigas por segurança
    localStorage.removeItem("rememberedPassword");
  }, [user, navigate]);

  const fazerLogin = async () => {
    console.log('Iniciando login...');
    
    if (isLoading) return; // Prevenir múltiplos cliques
    
    try {
      setIsLoading(true);
      setError("");
      setSuccessMessage("");
      
      if (!email || !senha) {
        setError("Por favor, preencha todos os campos.");
        return;
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Por favor, insira um email válido.");
        return;
      }
      
      if (senha.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      console.log("Tentando login com:", { email });
      
      // Usar apenas a função login do contexto
      await login(email, senha);
      
      // Salvar apenas email se lembrar estiver marcado (não salvar senha por segurança)
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      
      console.log("Login realizado com sucesso!");
      // A navegação será feita pelo AuthContext
    } catch (error) {
      console.error("Erro detalhado no login:", error);
      setError(error.message || "Erro ao fazer login. Verifique suas credenciais.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="auth-container">
      <div className="auth-logo-container">
        <img src="/imgs/Calendario.png" alt="Logo" className="auth-logo" />
      </div>
      <div className="auth-card">
        <div className="card-body">
          {error && <div className="auth-alert-danger" role="alert">{error}</div>}
          {successMessage && <div className="auth-alert-success" role="alert">{successMessage}</div>}
          
          <div className="auth-form-group">
            <label htmlFor="email">Email</label>
            <div className="auth-input-group">
              <input
                type="email"
                className="auth-form-control"
                id="email"
                placeholder="Digite seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <span className="auth-input-icon"><i className="bi bi-envelope-fill"></i></span>
            </div>
          </div>
          
          <div className="auth-form-group">
            <label htmlFor="password">Senha</label>
            <div className="auth-input-group">
              <input
                type="password"
                className="auth-form-control"
                id="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={isLoading}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && fazerLogin()}
              />
              <span className="auth-input-icon"><i className="bi bi-lock-fill"></i></span>
            </div>
          </div>
          
          <div className="auth-form-check mb-3 d-flex justify-content-between align-items-center">
            <div>
              <input
                type="checkbox"
                className="auth-form-check-input"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <label className="auth-form-check-label" htmlFor="remember">Lembrar-me</label>
            </div>
            <button 
              className="auth-btn-primary" 
              onClick={fazerLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <><i className="bi bi-arrow-clockwise" style={{animation: 'spin 1s linear infinite'}}></i> Entrando...</>
              ) : (
                <><i className="bi bi-arrow-right"></i> Entrar</>
              )}
            </button>
          </div>
          
          <div className="auth-separator-line"></div>
          
          <div className="auth-link-container">
            <button 
              className="auth-btn-professional" 
              onClick={() => navigate('/forgot-password', { state: { email } })}
              disabled={isLoading}
            >
              Esqueci minha senha
            </button>
            <span className="auth-separator"></span>
            <Link to="/cadastro" className="auth-btn-professional">Registrar um novo membro</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;