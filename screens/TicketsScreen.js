/**
 * TicketsScreen.js — Easevent (M25 / M28, ex-E10 « Mes billets »)
 * ════════════════════════════════════════════════════════════════
 * « Mes Tickets » — règle unique : chaque participation donne un ticket.
 *
 * Onglets :
 *   - Générés (M28)   : tickets générés → « Voir mon ticket » (M27)
 *   - En attente (M25): 1. Invitation à répondre (Accepter / Décliner)
 *                       2. Tickets à valider : gratuit → Valider,
 *                          payant → Payer et générer (M26), Annuler
 *   - Archivés        : tickets annulés / expirés, invitations déclinées
 *
 * Paramètres : tab ('generated' | 'pending' | 'archived'),
 *              openTicketId + justPaid (retour du paiement).
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar, Animated, ActivityIndicator, Pressable,
  RefreshControl, Modal, Platform,
} from 'react-native';

import { SafeAreaView }   from 'react-native-safe-area-context';
import { Ionicons }       from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import eventService   from '../services/eventService';
import ticketService  from '../services/ticketService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';
import { formatDayMonth, formatDateRelative, formatPrice } from '../utils/format';
import TicketView from '../components/TicketView';
import { SkeletonGroup, EventCardSkeleton, Bone } from '../components/ui/Skeleton';
import LoadingMessages from '../components/ui/LoadingMessages';
import { useTicketBadge } from '../context/TicketBadgeContext';
import { useAuth } from '../context/AuthContext';
import { isRsvpCancel } from '../utils/rsvp';
import SafeImage from '../components/ui/SafeImage';
import { passWord } from '../utils/wording';

// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────
const C = {
  green:      '#1B6B4A',
  greenDark:  '#155C3C',
  greenLight: '#E8F5EE',
  orange:     '#E76F51',
  orangeL:    '#FFF0EB',
  orangeText: '#B4492E',
  white:      '#FFFFFF',
  bg:         '#F7F7F7',
  text:       '#1A1A1A',
  textSub:    '#555555',
  textMut:    '#757575',
  border:     '#E8E8E8',
  error:      '#E53E3E',
  errorBg:    '#FFF5F5',
};

const LOADING_MESSAGES = [
  'Nous rassemblons vos invitations et billets…',
  'On vérifie vos invitations…',
  'Encore un instant…',
];

// ════════════════════════════════════════════════════════════════
// COMPOSANT : TicketModal (M27)
// ════════════════════════════════════════════════════════════════
const TicketModal = ({ ticket, justPaid, onClose }) => (
  <Modal visible={!!ticket} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={ticketStyles.root}>
      <View style={ticketStyles.header}>
        <Text style={ticketStyles.headerTitle} accessibilityRole="header">{ticket ? passWord(ticket.event).My : ''}</Text>
        <TouchableOpacity onPress={onClose} style={ticketStyles.closeBtn} accessibilityRole="button" accessibilityLabel="Fermer">
          <Ionicons name="close" size={22} color={C.text} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={ticketStyles.scroll} showsVerticalScrollIndicator={false}>
        {ticket ? <TicketView ticket={ticket} justPaid={justPaid} /> : null}
      </ScrollView>
    </View>
  </Modal>
);

const ticketStyles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 48, width: '100%', maxWidth: 560, alignSelf: 'center' },
});

// ════════════════════════════════════════════════════════════════
// Découpe façon billet (cercles + pointillés)
// ════════════════════════════════════════════════════════════════
const TearLine = () => (
  <View style={styles.tear}>
    <View style={[styles.tearHole, { marginLeft: -10 }]} />
    <View style={styles.tearDash} />
    <View style={[styles.tearHole, { marginRight: -10 }]} />
  </View>
);

const Chip = ({ label, dark, warm }) => (
  <View style={[styles.chip, dark && styles.chipDark, warm && styles.chipWarm]}>
    <Text style={[styles.chipTxt, dark && { color: C.white }, warm && { color: C.orangeText }]} numberOfLines={1}>{label}</Text>
  </View>
);

// ════════════════════════════════════════════════════════════════
// COMPOSANT : InvitationCard — « Invitation à répondre »
// ════════════════════════════════════════════════════════════════
const InvitationCard = ({ invitation, onRespond, onOpenEvent }) => {
  const event = invitation.event || {};
  const [busy, setBusy] = useState(null);
  const respond = async (status) => { setBusy(status); await onRespond(invitation, status); setBusy(null); };
  const price = event.is_paid ? formatPrice(event.price, event.currency) : 'Gratuit';

  return (
    <View style={styles.invCard}>
      <Pressable onPress={() => onOpenEvent?.(event)} accessibilityRole="button" accessibilityLabel={`Voir l'événement ${event.title || ''}`}>
        <SafeImage uri={event.cover_image} style={styles.invImg} icon="calendar-outline" iconSize={24} />
      </Pressable>
      <View style={styles.invBody}>
        <View style={styles.invFrom}>
          <Text style={styles.invFromTxt} numberOfLines={1}>
            Invitation de {event.organizer?.name?.split(' ')[0] || "l'organisateur"}
          </Text>
        </View>
        <Text style={styles.invTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.invMeta}>{formatDayMonth(event.start_date)} · {price}</Text>
        <View style={styles.invActions}>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => respond('declined')}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel={`Décliner l'invitation à ${event.title}`}
          >
            {busy === 'declined' ? <ActivityIndicator size="small" color={C.textSub} /> : <Text style={styles.declineTxt}>Décliner</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => respond('confirmed')}
            disabled={!!busy}
            accessibilityRole="button"
            accessibilityLabel={`Accepter l'invitation à ${event.title}`}
          >
            {busy === 'confirmed' ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.confirmTxt}>Accepter</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : PendingTicketCard — « Tickets à valider »
// ════════════════════════════════════════════════════════════════
const PendingTicketCard = ({ ticket, onValidate, onPay, onCancel, onOpenEvent }) => {
  const e = ticket.event || {};
  const free = Number(ticket.price) <= 0;
  const unfinished = ['failed', 'processing'].includes(ticket.payment_status) || !!ticket.payment_started;
  const processing = ticket.payment_status === 'processing';
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { await fn(ticket); } finally { setBusy(false); } };

  return (
    <View style={[styles.tCard, !free && unfinished && styles.tCardWarn]}>
      <View style={styles.tTop}>
        <Pressable onPress={() => onOpenEvent?.(e)} accessibilityRole="button" accessibilityLabel={`Voir l'événement ${e.title || ''}`}>
          <SafeImage uri={e.cover_image} style={styles.tThumb} icon="ticket-outline" iconSize={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.tTitle} numberOfLines={2}>{e.title}</Text>
          <Text style={styles.tMeta} numberOfLines={1}>
            {formatDayMonth(e.start_date)} · {e.is_online ? 'En ligne' : (e.location_address || '—')}
          </Text>
          <View style={styles.chips}>
            <Chip label={formatPrice(ticket.price, ticket.currency)} dark={!free} />
            {processing ? <Chip label="Paiement en cours de confirmation" warm />
              : (!free && ticket.payment_status === 'failed') ? <Chip label="Paiement non finalisé" warm />
              : ticket.dress_code ? <Chip label={ticket.dress_code} warm /> : null}
          </View>
        </View>
      </View>
      <TearLine />
      <View style={styles.tActions}>
        <TouchableOpacity
          style={styles.tCancel}
          onPress={() => onCancel(ticket)}
          disabled={busy || processing}
          accessibilityRole="button"
          accessibilityLabel={`Annuler ${passWord(e).my} pour ${e.title}`}
        >
          <Text style={[styles.tCancelTxt, processing && { color: C.textMut }]}>Annuler</Text>
        </TouchableOpacity>
        {free ? (
          <TouchableOpacity style={styles.tMain} onPress={() => run(onValidate)} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator size="small" color={C.white} /> : (
              <>
                <Ionicons name="checkmark" size={16} color={C.white} />
                <Text style={styles.tMainTxt}>{`Valider ${passWord(e).my}`}</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.tMain, processing && styles.tMainOff]}
            onPress={() => onPay(ticket)}
            disabled={processing}
            accessibilityRole="button"
            accessibilityState={{ disabled: processing }} aria-disabled={processing}
          >
            <Ionicons name="card-outline" size={16} color={C.white} />
            <Text style={styles.tMainTxt}>
              {processing ? 'Confirmation en cours' : `Payer ${formatPrice(ticket.price, ticket.currency)} et générer`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : GeneratedTicketCard (M28)
// ════════════════════════════════════════════════════════════════
const GeneratedTicketCard = ({ ticket, onOpen }) => {
  const e = ticket.event || {};
  const free = Number(ticket.price) <= 0;
  return (
    <View style={styles.gCard}>
      <View style={styles.gImgBox}>
        <SafeImage uri={e.cover_image} style={styles.gImg} icon="ticket-outline" iconSize={30} />
        <View style={styles.gPrice}>
          <Text style={[styles.gPriceTxt, free && { color: C.green }]}>
            {formatPrice(ticket.price, ticket.currency)} · {free ? 'Gratuit' : 'Payé'}
          </Text>
        </View>
        <View style={styles.gDate}><Text style={styles.gDateTxt}>{formatDateRelative(e.start_date)}</Text></View>
      </View>
      <View style={styles.gBody}>
        <Text style={styles.gTitle} numberOfLines={2}>{e.title}</Text>
        {ticket.offered_by ? (
          <View style={styles.gDress}>
            <Ionicons name="gift-outline" size={13} color={C.green} />
            <Text style={[styles.gDressTxt, { color: C.green }]} numberOfLines={1}>{`Offert${passWord(e).e} par ${ticket.offered_by.name}`}</Text>
          </View>
        ) : null}
        {ticket.dress_code ? (
          <View style={styles.gDress}>
            <Ionicons name="shirt-outline" size={13} color={C.orangeText} />
            <Text style={styles.gDressTxt} numberOfLines={1}>Dress code : {ticket.dress_code}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.gBtn} onPress={() => onOpen(ticket)} accessibilityRole="button"
          accessibilityLabel={`Voir ${passWord(e).my} pour ${e.title}`}>
          <Ionicons name="qr-code-outline" size={14} color={C.white} />
          <Text style={styles.gBtnTxt}>{`Voir ${passWord(e).my}`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ArchivedRow = ({ title, date, label }) => (
  <View style={styles.aRow}>
    <Ionicons name="archive-outline" size={18} color={C.textMut} />
    <View style={{ flex: 1 }}>
      <Text style={styles.aTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.aMeta}>{date}</Text>
    </View>
    <View style={styles.aBadge}><Text style={styles.aBadgeTxt}>{label}</Text></View>
  </View>
);

// ════════════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL : TicketsScreen
// ════════════════════════════════════════════════════════════════
export default function TicketsScreen({ navigation, route }) {
  const { user: authUser } = useAuth();
  const { refresh: refreshBadge } = useTicketBadge();

  const [tickets,       setTickets]       = useState([]);
  const [invitations,   setInvitations]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [loadError,     setLoadError]     = useState('');
  const [activeSection, setActiveSection] = useState(route?.params?.tab || 'pending');
  const [openTicket,    setOpenTicket]    = useState(null);
  const [justPaid,      setJustPaid]      = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);

  // ── Charger tickets + invitations ────────────────────────────
  const load = useCallback(async () => {
    try {
      const [t, inv] = await Promise.all([ticketService.fetchMine(), eventService.fetchMyInvitations()]);
      setTickets(t.tickets || []);
      setInvitations(inv.invitations || []);
      setLoadError('');
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Impossible de charger vos invitations et billets.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      refreshBadge({ force: true });
    }
  }, [refreshBadge]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Paramètres de navigation (onglet, ticket à ouvrir après paiement) ──
  useEffect(() => {
    const p = route?.params || {};
    if (p.tab) setActiveSection(p.tab);
    if (p.openTicketId) {
      ticketService.fetchOne(p.openTicketId)
        .then((t) => {
          if (t.status === 'generated') { setJustPaid(!!p.justPaid); setOpenTicket(t); setActiveSection('generated'); }
        })
        .catch(() => {});
      navigation.setParams({ openTicketId: undefined, justPaid: undefined });
    }
  }, [route?.params?.tab, route?.params?.openTicketId]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // ── Actions ──────────────────────────────────────────────────
  const openEvent = (ev) => ev?.id && navigation.navigate('TabDiscover', { screen: 'EventDetail', initial: false, params: { event: ev } });

  const handleRespond = async (invitation, status) => {
    try {
      await eventService.respondToInvitation(invitation.id, status);
      await load();
    } catch (err) {
      if (isRsvpCancel(err)) return;
      showAlert('Réponse impossible', apiErrorMessage(err, 'Impossible de répondre à cette invitation.'));
    }
  };

  const handleValidate = async (ticket) => {
    try {
      const generated = await ticketService.validate(ticket.id);
      setJustPaid(false);
      setOpenTicket(generated);
      setActiveSection('generated');
      await load();
    } catch (err) {
      showAlert('Validation impossible', apiErrorMessage(err));
    }
  };

  const handlePay = (ticket) => navigation.navigate('TicketCheckout', { ticketId: ticket.id });

  const handleCancel = (ticket) => {
    showAlert(
      `Annuler ${passWord(ticket.event).my} ?`,
      `${passWord(ticket.event).your.charAt(0).toUpperCase()}${passWord(ticket.event).your.slice(1)} pour « ${ticket.event?.title} » sera archivé${passWord(ticket.event).e}${ticket.invitation_id ? ' et l\'invitation déclinée' : ''}.`,
      [
        { text: 'Garder', style: 'cancel' },
        {
          text: `Annuler ${passWord(ticket.event).the}`, style: 'destructive',
          onPress: async () => {
            try { await ticketService.cancel(ticket.id); await load(); }
            catch (err) { showAlert('Action impossible', apiErrorMessage(err)); }
          },
        },
      ],
    );
  };

  // ── Répartition ──────────────────────────────────────────────
  const generated    = tickets.filter((t) => t.status === 'generated');
  const pendingTix   = tickets.filter((t) => t.status === 'pending');
  const toAnswer     = invitations.filter((i) => ['sent', 'opened'].includes(i.status));
  const archivedTix  = tickets.filter((t) => ['cancelled', 'expired'].includes(t.status));
  const archivedInv  = invitations.filter((i) => ['declined', 'expired'].includes(i.status)
    && !archivedTix.some((t) => t.invitation_id === i.id));

  const counts = {
    generated: generated.length,
    pending:   pendingTix.length + toAnswer.length,
    archived:  archivedTix.length + archivedInv.length,
  };
  const sections = [
    { id: 'generated', label: `Générés (${counts.generated})` },
    { id: 'pending',   label: `En attente (${counts.pending})` },
    { id: 'archived',  label: `Archivés (${counts.archived})` },
  ];
  const subtitle = activeSection === 'generated'
    ? `${counts.generated} prêt${counts.generated > 1 ? 's' : ''} pour l'entrée`
    : `${pendingTix.length} à valider`;

  const Empty = ({ icon, title, text, cta }) => (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={56} color={C.textMut} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{text}</Text>
      {cta}
    </View>
  );

  const discoverBtn = (
    <TouchableOpacity
      style={styles.discoverBtn}
      onPress={() => navigation?.getParent()?.navigate('TabDiscover')}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      <Ionicons name="compass-outline" size={16} color={C.white} />
      <Text style={styles.discoverBtnTxt}>Découvrir des événements</Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (activeSection === 'generated') {
      return generated.length === 0
        ? <Empty icon="ticket-outline" title="Rien de généré pour l’instant"
            text="Validez une invitation en attente ou participez à un événement : votre invitation ou votre billet apparaîtra ici avec son QR code." cta={discoverBtn} />
        : generated.map((t) => <GeneratedTicketCard key={t.id} ticket={t} onOpen={(x) => { setJustPaid(false); setOpenTicket(x); }} />);
    }
    if (activeSection === 'pending') {
      // Invité par SMS : le numéro vérifié relie les invitations au compte
      const phoneBanner = !authUser?.phone_verified ? (
        <TouchableOpacity style={styles.phoneBanner} onPress={() => navigation.navigate('VerifyPhone')}
          activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="call-outline" size={18} color={C.green} />
          <Text style={styles.phoneBannerTxt}>
            {authUser?.phone ? `Confirmez votre numéro ${authUser.phone}` : 'Invité par SMS ? Ajoutez votre numéro'} pour retrouver vos invitations.
          </Text>
          <Ionicons name="chevron-forward" size={16} color={C.green} />
        </TouchableOpacity>
      ) : null;
      if (toAnswer.length === 0 && pendingTix.length === 0) {
        return (
          <>
            {phoneBanner}
            <Empty icon="hourglass-outline" title="Rien en attente"
              text="Les invitations reçues et les billets à valider apparaîtront ici." cta={discoverBtn} />
          </>
        );
      }
      return (
        <>
          {phoneBanner}
          {toAnswer.length > 0 && (
            <>
              <Text style={styles.sectionLabel} accessibilityRole="header">Invitation à répondre</Text>
              {toAnswer.map((inv) => <InvitationCard key={inv.id} invitation={inv} onRespond={handleRespond} onOpenEvent={openEvent} />)}
            </>
          )}
          {pendingTix.length > 0 && (
            <>
              <Text style={styles.sectionLabel} accessibilityRole="header">À valider</Text>
              {pendingTix.map((t) => (
                <PendingTicketCard key={t.id} ticket={t} onValidate={handleValidate} onPay={handlePay} onCancel={handleCancel} onOpenEvent={openEvent} />
              ))}
            </>
          )}
        </>
      );
    }
    if (counts.archived === 0) {
      return <Empty icon="archive-outline" title="Aucun élément archivé"
        text="Les billets annulés ou expirés et les invitations déclinées apparaîtront ici." />;
    }
    return (
      <>
        {archivedTix.map((t) => (
          <ArchivedRow key={t.id} title={t.event?.title} date={formatDayMonth(t.event?.start_date)}
            label={t.status === 'expired' ? 'Expiré' : t.payment_status === 'refunded' ? 'Annulé · remboursé' : 'Annulé'} />
        ))}
        {archivedInv.map((i) => (
          <ArchivedRow key={i.id} title={i.event?.title} date={formatDayMonth(i.event?.start_date)}
            label={i.status === 'expired' ? 'Expirée' : 'Déclinée'} />
        ))}
      </>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── HEADER ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle} accessibilityRole="header">Mes invitations</Text>
            <Text style={styles.headerSub}>{subtitle}</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="ticket-outline" size={22} color={C.green} />
          </View>
        </View>

        {/* ── ONGLETS ─────────────────────────────────────────── */}
        <View style={styles.tabs} accessibilityRole="tablist">
          {sections.map((sec) => (
            <TouchableOpacity
              key={sec.id}
              style={[styles.tab, activeSection === sec.id && styles.tabActive]}
              onPress={() => setActiveSection(sec.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeSection === sec.id }} aria-selected={activeSection === sec.id}
            >
              <Text style={[styles.tabTxt, activeSection === sec.id && styles.tabTxtActive]}>{sec.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CONTENU ─────────────────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} colors={[C.green]} />}
        >
          {loading ? (
            <SkeletonGroup label="Chargement de vos invitations">
              <LoadingMessages messages={LOADING_MESSAGES} />
              <Bone width={150} height={14} style={{ marginBottom: 12 }} />
              <EventCardSkeleton horizontal />
              <EventCardSkeleton horizontal />
            </SkeletonGroup>
          ) : loadError && tickets.length === 0 && invitations.length === 0 ? (
            <Empty icon="cloud-offline-outline" title="Oups" text={loadError}
              cta={(
                <TouchableOpacity style={styles.discoverBtn} onPress={() => { setLoading(true); load(); }} accessibilityRole="button">
                  <Text style={styles.discoverBtnTxt}>Réessayer</Text>
                </TouchableOpacity>
              )} />
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>{renderContent()}</Animated.View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── M27 : ticket généré ──────────────────────────────── */}
        <TicketModal ticket={openTicket} justPaid={justPaid} onClose={() => { setOpenTicket(null); setJustPaid(false); }} />
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  phoneBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E8F5EE', borderRadius: 14,
    borderWidth: 1, borderColor: '#C5E8D3', padding: 12, marginBottom: 14, minHeight: 48,
  },
  phoneBannerTxt: { flex: 1, fontSize: 13, color: '#155C3C', fontWeight: '600', lineHeight: 18 },
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: C.textMut, marginTop: 2 },
  headerBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16 },
  tab: { flex: 1, minHeight: 44, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:    { borderBottomColor: C.green },
  tabTxt:       { fontSize: 12, fontWeight: '600', color: C.textMut },
  tabTxtActive: { color: C.green, fontWeight: '800' },

  scroll:    { flex: 1, backgroundColor: C.bg },
  scrollPad: { padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.textMut, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  imgPlaceholder: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },

  // Invitation à répondre
  invCard: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 20 },
  invImg: { width: 96, alignSelf: 'stretch', minHeight: 130 },
  invBody: { flex: 1, padding: 12 },
  invFrom: { alignSelf: 'flex-start', backgroundColor: C.orangeL, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  invFromTxt: { fontSize: 10, fontWeight: '700', color: C.orangeText },
  invTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 4 },
  invMeta: { fontSize: 12, color: C.textMut, marginBottom: 10 },
  invActions: { flexDirection: 'row', gap: 8 },
  declineBtn: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  declineTxt: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  confirmBtn: { flex: 1, minHeight: 40, borderRadius: 10, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  confirmTxt: { fontSize: 13, color: C.white, fontWeight: '700' },

  // Ticket à valider
  tCard: {
    backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  tCardWarn: { borderWidth: 1.5, borderColor: C.orange },
  tTop: { flexDirection: 'row', gap: 12, padding: 14 },
  tThumb: { width: 64, height: 64, borderRadius: 12 },
  tTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  tMeta: { fontSize: 12, color: C.textMut, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: C.greenLight, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 220 },
  chipDark: { backgroundColor: C.text },
  chipWarm: { backgroundColor: C.orangeL },
  chipTxt: { fontSize: 11, fontWeight: '800', color: C.green },
  tear: { flexDirection: 'row', alignItems: 'center' },
  tearHole: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.bg },
  tearDash: { flex: 1, borderTopWidth: 2, borderColor: C.border, borderStyle: 'dashed' },
  tActions: { flexDirection: 'row', gap: 8, padding: 14, paddingTop: 12 },
  tCancel: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  tCancelTxt: { fontSize: 13, fontWeight: '600', color: C.textSub },
  tMain: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  tMainOff: { backgroundColor: '#8DB5A3' },
  tMainTxt: { fontSize: 14, fontWeight: '800', color: C.white },

  // Ticket généré
  gCard: {
    backgroundColor: C.white, borderRadius: 18, borderWidth: 1.5, borderColor: C.green, overflow: 'hidden', marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  gImgBox: { height: 120 },
  gImg: { width: '100%', height: '100%' },
  gPrice: { position: 'absolute', top: 10, right: 10, backgroundColor: C.white, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gPriceTxt: { fontSize: 11, fontWeight: '900', color: C.text },
  gDate: {
    position: 'absolute', left: 10, bottom: 10, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  gDateTxt: { fontSize: 11, fontWeight: '700', color: C.white },
  gBody: { padding: 14 },
  gTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 6 },
  gDress: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gDressTxt: { fontSize: 12, fontWeight: '700', color: C.orangeText, flex: 1 },
  gBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, borderRadius: 12, marginTop: 12 },
  gBtnTxt: { fontSize: 14, fontWeight: '800', color: C.white },

  // Archivés
  aRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  aTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  aMeta: { fontSize: 12, color: C.textMut, marginTop: 2 },
  aBadge: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  aBadgeTxt: { fontSize: 11, fontWeight: '700', color: C.textSub },

  // État vide
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, color: C.textMut, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  discoverBtn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.green, borderRadius: 14, paddingHorizontal: 20 },
  discoverBtnTxt: { fontSize: 14, fontWeight: '700', color: C.white },
});
