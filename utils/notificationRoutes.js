/**
 * utils/notificationRoutes.js — où mène une notification (M17, push)
 * ════════════════════════════════════════════════════════════════
 * Même destination qu'on la touche dans la liste des notifications
 * ou sur l'écran verrouillé (notification push).
 * n : { type, event?, event_id?, ticket_id?, data?, title? }
 * ════════════════════════════════════════════════════════════════
 */
export function openNotification(navigation, n) {
  if (!navigation || !n) return;
  const data = n.data || {};
  const eventId = n.event?.id || n.event_id || data.event_id;
  const ticketId = n.ticket_id || data.ticket_id;
  const tickets = (params) => navigation.navigate('TabTickets', { screen: 'Tickets', params });
  // Écrans de l'organisateur : le tableau de bord reste dessous (bouton retour)
  const manage = () => eventId && navigation.navigate('TabDashboard', {
    screen: 'EventDashboard', initial: false, params: { event: n.event || { id: eventId } },
  });

  switch (n.type) {
    case 'invitation_received':
    case 'ticket_to_validate':
    case 'payment_failed':
      return tickets({ tab: 'pending' });
    case 'ticket_generated':
    case 'ticket_gift':
    case 'reminder':
    case 'payment_succeeded':
      return tickets({ tab: 'generated', openTicketId: ticketId || undefined });
    case 'payment_refunded':
    case 'event_cancelled':
    case 'invitation_revoked':
      return tickets({ tab: 'archived' });
    case 'event_updated':
      return eventId && navigation.navigate('TabDiscover', {
        screen: 'EventDetail', initial: false, params: { event: n.event || { id: eventId } },
      });
    case 'daily_summary':
    case 'guest_response':
    case 'event_full':
      return manage();
    case 'question_to_answer':                    // question transmise par l'assistant : la conversation
    case 'message_received': {
      const conversationId = data.conversation_id || n.conversation_id;
      if (!conversationId) return navigation.navigate('TabDashboard', { screen: 'Conversations', initial: false });
      return navigation.navigate('TabDashboard', {
        screen: 'Chat', initial: false, params: { conversationId, title: n.title },
      });
    }
    case 'minisite_ready':
      return eventId && navigation.navigate('TabDashboard', {
        screen: 'TemplatePicker', initial: false, params: { event: n.event || { id: eventId } },
      });
    case 'team_invite':                           // proposition d'équipe : réponse sur le tableau de bord
      return navigation.navigate('TabDashboard', { screen: 'Dashboard' });
    case 'team_response':
      return eventId && navigation.navigate('TabDashboard', {
        screen: 'EventTeam', initial: false, params: { event: n.event || { id: eventId } },
      });
    case 'event_broadcast': {
      const conversationId = data.conversation_id;
      return conversationId
        ? navigation.navigate('TabTickets', { screen: 'Chat', initial: false, params: { conversationId, title: n.title } })
        : tickets({ tab: 'generated' });
    }
    case 'event_comment':
      return eventId && navigation.navigate('TabDashboard', {
        screen: 'Memories', initial: false, params: { event: n.event || { id: eventId }, tab: 'comments' },
      });
    case 'memories_added':
      return eventId && navigation.navigate('TabTickets', {
        screen: 'Memories', initial: false, params: { event: n.event || { id: eventId }, tab: 'photos' },
      });
    case 'payouts_ready':
      return navigation.navigate('TabProfile', { screen: 'Payouts', initial: false });
    case 'subscription':
      return navigation.navigate('TabProfile', { screen: 'Plans', initial: false });
    case 'friend_request':
      return navigation.navigate('TabProfile', { screen: 'Friends', initial: false, params: { tab: 'requests' } });
    case 'friend_accepted':
      return navigation.navigate('TabProfile', { screen: 'Friends', initial: false, params: { tab: 'friends' } });
    default:
      return navigation.navigate('TabDashboard', { screen: 'Notifications', initial: false });
  }
}
