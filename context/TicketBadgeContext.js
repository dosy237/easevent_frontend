/**
 * context/TicketBadgeContext.js — Easevent
 * Compteurs affichés dans la navigation :
 *  - onglet « Tickets » : tickets en attente + invitations à répondre (MD §2) ;
 *  - cloche : notifications non lues (M17).
 * Rafraîchis au plus toutes les 30 s lors de la navigation
 * (éco-conception) et après chaque action (force).
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

import ticketService from '../services/ticketService';
import notificationService from '../services/notificationService';

const TicketBadgeContext = createContext({
  badge: 0, counts: null, notifications: 0, refresh: () => {}, setNotifications: () => {},
});
const MIN_INTERVAL = 30000;

export function TicketBadgeProvider({ children }) {
  const [counts, setCounts] = useState(null);
  const [notifications, setNotifications] = useState(0);
  const last = useRef(0);

  const refresh = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - last.current < MIN_INTERVAL) return;
    last.current = now;
    const [tickets, unread] = await Promise.allSettled([
      ticketService.fetchCounts(),
      notificationService.unreadCount(),
    ]);
    // Hors ligne : on garde la dernière valeur
    if (tickets.status === 'fulfilled') setCounts(tickets.value);
    if (unread.status === 'fulfilled') setNotifications(unread.value);
  }, []);

  return (
    <TicketBadgeContext.Provider value={{ counts, badge: counts?.badge || 0, notifications, setNotifications, refresh }}>
      {children}
    </TicketBadgeContext.Provider>
  );
}

export const useTicketBadge = () => useContext(TicketBadgeContext);
