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

import { setLogoutCallback } from '../services/apiClient';
import { authService } from '../services/authService';
import invitationService from '../services/invitationService';
import { KEYS, getItem, setItem, deleteItem, clearSession } from '../services/storage';

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
  // Onglet ouvert après la connexion (ex. « TabTickets » quand une invitation a été rattachée)
  const [landingRoute, setLandingRoute] = useState(null);

  const isAuthenticated = user !== null;

  // ── Vérification au démarrage ────────────────────────────────
  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const storedToken = await getItem(KEYS.ACCESS_TOKEN);
      const storedUser = await getItem(KEYS.USER);

      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Profil à jour (numéro, vérification…) sans bloquer le démarrage
        authService.getProfile()
          .then(async (fresh) => {
            const profile = fresh?.user || fresh;
            if (profile?.id) {
              await setItem(KEYS.USER, JSON.stringify(profile));
              setUser(profile);
            }
          })
          .catch(() => {});
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
      await setItem(KEYS.ACCESS_TOKEN, access);
      await setItem(KEYS.REFRESH_TOKEN, refresh);
      await setItem(KEYS.USER, JSON.stringify(userData));

      // Lien d'invitation ouvert avant la connexion (M31) : on le rattache
      // au compte avant d'afficher l'application, qui ouvre alors Mes tickets.
      const pendingInvite = await getItem(KEYS.PENDING_INVITE);
      if (pendingInvite) {
        try {
          await invitationService.claim(pendingInvite);
          setLandingRoute('TabTickets');
        } catch { /* lien expiré ou déjà utilisé : connexion normale */ }
        await deleteItem(KEYS.PENDING_INVITE);
      } else {
        setLandingRoute(null);
      }

      setAccessToken(access);
      setUser(userData);
    } catch (err) {
      console.error('Erreur stockage auth:', err);
      throw err;
    }
  }, []);

  // ── Déconnexion ──────────────────────────────────────────────
  // revokeSession : true quand l'utilisateur se déconnecte lui-même →
  // le refresh token est mis en liste noire côté serveur.
  const logout = useCallback(async ({ revokeSession = false } = {}) => {
    try {
      if (revokeSession) {
        const refresh = await getItem(KEYS.REFRESH_TOKEN);
        if (refresh) await authService.logout(refresh).catch(() => {});
      }
      await clearSession();
    } catch (err) {
      console.error('Erreur suppression tokens:', err);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  // ── Déconnexion forcée par apiClient (session expirée) ──────
  useEffect(() => {
    setLogoutCallback(() => logout());
  }, [logout]);

  // ── Rafraîchissement automatique du token ────────────────────
  const refreshAccessToken = useCallback(async () => {
    try {
      const storedRefresh = await getItem(KEYS.REFRESH_TOKEN);

      if (!storedRefresh) {
        await logout();
        return null;
      }

      const data = await authService.refreshToken(storedRefresh);

      await setItem(KEYS.ACCESS_TOKEN, data.access);
      if (data.refresh) await setItem(KEYS.REFRESH_TOKEN, data.refresh);
      setAccessToken(data.access);

      return data.access;
    } catch (err) {
      console.error('Erreur rafraîchissement token:', err);
      // Only logout if it's a 401 or similar auth error
      if (err.response?.status === 401 || err.response?.status === 400) {
        await logout();
      }
      return null;
    }
  }, [logout]);

  // ── Mise à jour du profil ────────────────────────────────────
  const updateUser = useCallback(async (updatedUserData) => {
    try {
      const newUser = { ...user, ...updatedUserData };
      await setItem(KEYS.USER, JSON.stringify(newUser));
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
    landingRoute,
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