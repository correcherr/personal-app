import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../utils/helpers';
import { translations, type TranslationKey } from '../utils/translations';

interface User {
  id: number;
  username: string;
  email: string | null;
  profile_photo: string | null;
  currency: string;
  language: string;
  theme: string;
  animation_level: string;
  neon_glow: boolean;
  compact_mode: boolean;
  haptics: boolean;
  accent_color: string;
  business_name: string;
  platform: string;
  product_type: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (newData: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const applySettings = (u: User) => {
    // Aplicar Glow
    if (u.neon_glow) {
      document.body.classList.remove('no-glow');
    } else {
      document.body.classList.add('no-glow');
    }

    // Aplicar Animaciones
    document.body.classList.remove('animations-low', 'animations-none');
    if (u.animation_level === 'low') {
      document.body.classList.add('animations-low');
    } else if (u.animation_level === 'none') {
      document.body.classList.add('animations-none');
    }
  };

  const fetchMe = async (authToken: string) => {
    try {
      const response = await fetch(`${API}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        applySettings(userData);
      } else {
        logout();
      }
    } catch (error) {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (newData: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...newData };
      setUser(updated);
      applySettings(updated);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { user } = useAuth();
  const lang = (user?.language || 'ES') as 'ES' | 'EN';
  
  const t = (key: TranslationKey | string) => {
    return (translations[lang] as any)[key] || key;
  };

  return { t, lang };
};
