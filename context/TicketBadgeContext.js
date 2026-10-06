/**
 * context/TicketBadgeContext.js — Easevent
 * Compteur affiché sur l'onglet « Tickets » : tickets en attente +
 * invitations à répondre (MD §2). Rafraîchi au plus toutes les 30 s
 * lors de la navigation (éco-conception) et après chaque action.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

import ticketService from '../services/ticketService';

const TicketBadgeContext = createContext({ badge: 0, counts: null, refresh: () => {} });
const MIN_INTERVAL = 30000;

export function TicketBadgeProvider({ children }) {
  const [counts, setCounts] = useState(null);
  const last = useRef(0);

  const refresh = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - last.current < MIN_INTERVAL) return;
    last.current = now;
    try {
      setCounts(await ticketService.fetchCounts());
    } catch { /* hors ligne : on garde la dernière valeur */ }
  }, []);

  return (
    <TicketBadgeContext.Provider value={{ counts, badge: counts?.badge || 0, refresh }}>
      {children}
    </TicketBadgeContext.Provider>
  );
}

export const useTicketBadge = () => useContext(TicketBadgeContext);
