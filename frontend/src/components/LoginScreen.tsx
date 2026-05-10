import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API } from '../utils/helpers';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const data = await response.json();

      if (response.ok) {
        await login(data.access_token);
      } else {
        setError(data.detail || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container animate-fade-in" style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '20px'
    }}>
      <div className="login-card animate-scale-in" style={{
        width: '100%',
        maxWidth: '400px',
        background: 'var(--bg-surface)',
        padding: '40px 32px',
        borderRadius: '24px',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚀</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px' }}>Hustle</h1>
        <p style={{ color: 'var(--text-3)', marginBottom: '32px', fontSize: '0.9rem' }}>Gestiona tus compras y ventas con estilo</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Usuario</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu nombre de usuario"
              required
              style={{
                width: '100%',
                padding: '14px 18px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                color: 'var(--text-1)',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div className="form-group" style={{ textAlign: 'left', marginBottom: '32px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '14px 18px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                color: 'var(--text-1)',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
          </div>

          {error && (
            <div style={{ 
              background: 'rgba(255, 76, 76, 0.1)', 
              color: '#FF4C4C', 
              padding: '12px', 
              borderRadius: '10px', 
              fontSize: '0.85rem', 
              marginBottom: '24px',
              border: '1px solid rgba(255, 76, 76, 0.2)'
            }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="btn-submit"
            style={{
              width: '100%',
              padding: '16px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontSize: '1rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 8px 20px var(--accent-glow)',
              transition: 'transform 0.2s, filter 0.2s'
            }}
          >
            {loading ? 'Iniciando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ marginTop: '32px', fontSize: '0.85rem', color: 'var(--text-3)' }}>
          ¿No tienes cuenta? <span style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Contacta con soporte</span>
        </p>
      </div>
    </div>
  );
}
