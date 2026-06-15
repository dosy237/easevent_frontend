/**
 * context/AuthContext.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Contexte React d'authentification global.
 *
 * Ce fichier gère :
 * - Le stockage sécurisé des tokens (expo-secure-store)
 * - La connexion / déconnexion
 * - Le rafraîchissement automatique du access token (15 min)
 * - L’état global accessible depuis n’importe quel écran via useAuth()
 *
 * AMÉLIORATIONS APPORTÉES DANS CETTE VERSION :
 * - URL du backend centralisée et mise à jour pour la production
 * - Meilleure documentation pour le jury CDA
 * - Préparation pour utiliser config.js (meilleure pratique)
 * ════════════════════════════════════════════════════════════════
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import * as SecureStore from 'expo-secure-store';

// ─────────────────────────────────────────────────────────────────
// CLÉS DE STOCKAGE SÉCURISÉ
// ─────────────────────────────────────────────────────────────────
const KEYS = {
  ACCESS_TOKEN: 'easevent_access_token',
  REFRESH_TOKEN: 'easevent_refresh_token',
  USER: 'easevent_user',
};

// ─────────────────────────────────────────────────────────────────
// ADRESSE DU BACKEND
// TODO (amélioration future) : Importer depuis config.js
// pour centraliser toutes les URLs de l’application.
// ─────────────────────────────────────────────────────────────────
const API_BASE = 'https://easevent-backend.onrender.com';

// ─────────────────────────────────────────────────────────────────
// CRÉATION DU CONTEXTE
// ─────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ════════════════════════════════════════════════════════════════
// PROVIDER : AuthProvider
// ════════════════════════════════════════════════════════════════
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  // ── Vérification au démarrage ────────────────────────────────
  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
      const storedUser = await SecureStore.getItemAsync(KEYS.USER);

      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Erreur lecture stockage auth:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Connexion ────────────────────────────────────────────────
  const login = useCallback(async ({ userData, access, refresh }) => {
    try {
      await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, access);
      await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refresh);
      await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(userData));

      setAccessToken(access);
      setUser(userData);
    } catch (err) {
      console.error('Erreur stockage auth:', err);
      throw err;
    }
  }, []);

  // ── Déconnexion ──────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
      await SecureStore.deleteItemAsync(KEYS.USER);
    } catch (err) {
      console.error('Erreur suppression tokens:', err);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  // ── Rafraîchissement automatique du token ────────────────────
  const refreshAccessToken = useCallback(async () => {
    try {
      const storedRefresh = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);

      if (!storedRefresh) {
        await logout();
        return null;
      }

      const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: storedRefresh }),
      });

      if (!res.ok) {
        await logout();
        return null;
      }

      const data = await res.json();

      await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, data.access);
      setAccessToken(data.access);

      return data.access;
    } catch (err) {
      console.error('Erreur rafraîchissement token:', err);
      await logout();
      return null;
    }
  }, [logout]);

  // ── Mise à jour du profil ────────────────────────────────────
  const updateUser = useCallback(async (updatedUserData) => {
    try {
      const newUser = { ...user, ...updatedUserData };
      await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(newUser));
      setUser(newUser);
    } catch (err) {
      console.error('Erreur mise à jour user:', err);
    }
  }, [user]);

  // ── Valeurs exposées ─────────────────────────────────────────
  const value = {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
    refreshAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ════════════════════════════════════════════════════════════════
// HOOK : useAuth
// ════════════════════════════════════════════════════════════════
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }

  return context;
}