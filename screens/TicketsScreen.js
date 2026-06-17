/**
 * TicketsScreen.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Écran "Mes Billets" — onglet permanent pour l'utilisateur connecté.
 *
 * Trois sections :
 * ─────────────────
 * 1. BILLETS ACTIFS
 *    Invitations confirmées → billet avec QR code unique.
 *    Le QR code encode l'ID de l'invitation — scanné par
 *    l'organisateur le jour J pour valider la présence.
 *
 * 2. EN ATTENTE
 *    Invitations reçues mais pas encore répondues.
 *    L'utilisateur peut Accepter ou Décliner directement ici.
 *
 * 3. ARCHIVÉS
 *    Invitations déclinées ou expirées.
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar, Animated, ActivityIndicator,
  RefreshControl, Alert, Modal, Platform,
} from 'react-native';

import { SafeAreaView }   from 'react-native-safe-area-context';
import { Ionicons }       from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth }        from '../context/AuthContext';
import { eventService }   from '../services/eventService';

// QR Code — on utilise une librairie légère
// Si elle n'est pas installée, on affiche un placeholder propre
let QRCode;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch {
  QRCode = null;
}

// ─────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────
const C = {
  green:      '#1B6B4A',
  greenDark:  '#155C3C',
  greenLight: '#E8F5EE',
  orange:     '#E76F51',
  orangeL:    '#FFF0EB',
  white:      '#FFFFFF',
  bg:         '#F7F7F7',
  text:       '#1A1A1A',
  textSub:    '#555555',
  textMut:    '#9E9E9E',
  border:     '#E8E8E8',
  error:      '#E53E3E',
  errorBg:    '#FFF5F5',
};

// ─────────────────────────────────────────────────────────────────
// FONCTION : formater une date lisible
// ─────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const jours = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const mois  = ['Jan','Fév','Mar','Avr','Mai','Jun',
                   'Jul','Aoû','Sep','Oct','Nov','Déc'];
    const d  = new Date(dateStr);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()} · ${hh}h${mm}`;
  } catch { return '—'; }
};

// ─────────────────────────────────────────────────────────────────
// FONCTION : générer la donnée du QR code
// Le QR code encode un objet JSON avec toutes les infos du billet.
// Quand l'organisateur scanne, il voit : nom de l'événement,
// ID de l'invitation et statut de l'invité.
// ─────────────────────────────────────────────────────────────────
const generateQRData = (invitation, user) => {
  return JSON.stringify({
    invitation_id: invitation.id,
    event_id:      invitation.event?.id,
    event_title:   invitation.event?.title,
    guest_name:    `${user?.first_name} ${user?.last_name}`,
    status:        invitation.status,
    verified_by:   'easevent.app',
  });
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : TicketModal
// Modal plein écran affichant le billet complet avec QR code.
// S'ouvre quand l'utilisateur appuie sur un billet confirmé.
// ════════════════════════════════════════════════════════════════
const TicketModal = ({ visible, invitation, user, onClose }) => {
  if (!invitation) return null;

  const event   = invitation.event;
  const qrData  = generateQRData(invitation, user);

  // Couleur principale de l'événement (depuis la palette)
  const primaryColor = event?.palette?.primary || C.green;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={ticketStyles.root}>

        {/* Header du modal */}
        <View style={ticketStyles.header}>
          <Text style={ticketStyles.headerTitle}>Mon Billet</Text>
          <TouchableOpacity onPress={onClose} style={ticketStyles.closeBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={ticketStyles.scroll} showsVerticalScrollIndicator={false}>

          {/* Carte billet — design avec la couleur de l'événement */}
          <View style={ticketStyles.ticket}>

            {/* En-tête de la carte avec la couleur de l'événement */}
            <View style={[ticketStyles.ticketHeader, { backgroundColor: primaryColor }]}>
              {/* Image de couverture si disponible */}
              {event?.cover_image && (
                <Image
                  source={{ uri: event.cover_image }}
                  style={ticketStyles.ticketCover}
                  resizeMode="cover"
                />
              )}
              {/* Superposition sombre pour lisibilité du texte */}
              <View style={ticketStyles.ticketHeaderOverlay}>
                <View style={ticketStyles.ticketBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={primaryColor} />
                  <Text style={[ticketStyles.ticketBadgeTxt, { color: primaryColor }]}>
                    CONFIRMÉ
                  </Text>
                </View>
                <Text style={ticketStyles.ticketEventTitle} numberOfLines={2}>
                  {event?.title}
                </Text>
              </View>
            </View>

            {/* Ligne de découpe en pointillés — effet billet physique */}
            <View style={ticketStyles.tearLine}>
              <View style={ticketStyles.tearCircleLeft} />
              <View style={ticketStyles.tearDash} />
              <View style={ticketStyles.tearCircleRight} />
            </View>

            {/* Corps du billet */}
            <View style={ticketStyles.ticketBody}>

              {/* Infos de l'événement */}
              {[
                { icon: 'calendar-outline',  label: 'Date',    value: formatDate(event?.start_date) },
                { icon: 'time-outline',       label: 'Fin',     value: formatDate(event?.end_date) },
                { icon: 'location-outline',   label: 'Lieu',    value: event?.is_online ? 'En ligne' : (event?.location_address || '—') },
                { icon: 'person-outline',     label: 'Invité',  value: `${user?.first_name} ${user?.last_name}` },
              ].map((row, i) => (
                <View key={i} style={ticketStyles.infoRow}>
                  <View style={ticketStyles.infoLeft}>
                    <Ionicons name={row.icon} size={14} color={C.textMut} />
                    <Text style={ticketStyles.infoLabel}>{row.label}</Text>
                  </View>
                  <Text style={ticketStyles.infoValue} numberOfLines={2}>{row.value}</Text>
                </View>
              ))}

              {/* QR Code */}
              <View style={ticketStyles.qrSection}>
                <Text style={ticketStyles.qrLabel}>
                  Présentez ce QR code à l'entrée
                </Text>

                <View style={ticketStyles.qrContainer}>
                  {QRCode ? (
                    // QR code réel si la librairie est installée
                    <QRCode
                      value={qrData}
                      size={180}
                      color={C.text}
                      backgroundColor={C.white}
                    />
                  ) : (
                    // Placeholder propre si la librairie n'est pas installée
                    <View style={ticketStyles.qrPlaceholder}>
                      <Ionicons name="qr-code-outline" size={80} color={C.text} />
                      <Text style={ticketStyles.qrPlaceholderTxt}>
                        QR Code
                      </Text>
                    </View>
                  )}
                </View>

                {/* ID de l'invitation sous le QR code */}
                <Text style={ticketStyles.invitId}>
                  ID : {invitation.id?.substring(0, 8).toUpperCase()}
                </Text>
              </View>

              {/* Avertissement */}
              <View style={ticketStyles.warning}>
                <Ionicons name="information-circle-outline" size={14} color={C.textMut} />
                <Text style={ticketStyles.warningTxt}>
                  Ce billet est personnel et non transférable.
                  Valable uniquement pour {user?.first_name} {user?.last_name}.
                </Text>
              </View>

            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const ticketStyles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1, padding: 20 },

  // Billet
  ticket: {
    backgroundColor: C.white, borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  ticketHeader:        { height: 180, position: 'relative' },
  ticketCover:         { width: '100%', height: '100%', position: 'absolute' },
  ticketHeaderOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 16,
  },
  ticketBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.white, alignSelf: 'flex-start',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  ticketBadgeTxt:   { fontSize: 10, fontWeight: '800' },
  ticketEventTitle: { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: -0.3 },

  // Ligne de découpe
  tearLine: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg,
  },
  tearCircleLeft: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.bg, marginLeft: -12,
  },
  tearDash: {
    flex: 1, height: 1,
    borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
  },
  tearCircleRight: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.bg, marginRight: -12,
  },

  // Corps du billet
  ticketBody: { padding: 20 },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 12, color: C.textMut, fontWeight: '500' },
  infoValue: { fontSize: 13, color: C.text, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 8 },

  // QR Code
  qrSection:   { alignItems: 'center', paddingVertical: 24 },
  qrLabel:     { fontSize: 13, color: C.textMut, marginBottom: 20, textAlign: 'center' },
  qrContainer: {
    padding: 16, backgroundColor: C.white,
    borderRadius: 16, borderWidth: 2, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  qrPlaceholder: {
    width: 180, height: 180,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  qrPlaceholderTxt: { fontSize: 14, color: C.textMut, fontWeight: '600' },
  invitId: { fontSize: 12, color: C.textMut, marginTop: 12, letterSpacing: 1 },

  // Avertissement
  warning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: C.bg, borderRadius: 10, padding: 12, marginTop: 8,
  },
  warningTxt: { fontSize: 12, color: C.textMut, flex: 1, lineHeight: 17 },
});

// ════════════════════════════════════════════════════════════════
// COMPOSANT : InvitationCard
// Card représentant une invitation dans la liste.
// Affiche différentes actions selon le statut.
// ════════════════════════════════════════════════════════════════
const InvitationCard = ({ invitation, onPress, onRespond }) => {
  const event     = invitation.event;
  const [loading, setLoading] = useState(false);

  const handleRespond = async (newStatus) => {
    setLoading(true);
    await onRespond(invitation.id, newStatus);
    setLoading(false);
  };

  // Configuration visuelle selon le statut
  const statusConfig = {
    sent:      { label: 'En attente',  color: C.orange,  bg: C.orangeL,    icon: 'time-outline' },
    opened:    { label: 'Vu',          color: '#2563EB', bg: '#EFF6FF',    icon: 'eye-outline' },
    confirmed: { label: 'Confirmé ✓',  color: C.green,   bg: C.greenLight, icon: 'checkmark-circle-outline' },
    declined:  { label: 'Décliné',     color: C.error,   bg: C.errorBg,   icon: 'close-circle-outline' },
  };
  const s = statusConfig[invitation.status] || statusConfig.sent;

  const isConfirmed = invitation.status === 'confirmed';
  const isPending   = ['sent', 'opened'].includes(invitation.status);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isConfirmed && styles.cardConfirmed,
      ]}
      onPress={() => isConfirmed && onPress(invitation)}
      activeOpacity={isConfirmed ? 0.88 : 1}
    >
      {/* Image de couverture */}
      <View style={styles.cardImageBox}>
        {event?.cover_image ? (
          <Image
            source={{ uri: event.cover_image }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Ionicons name="calendar-outline" size={28} color={C.textMut} />
          </View>
        )}
        {/* Badge statut sur l'image */}
        <View style={[styles.cardStatusBadge, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon} size={11} color={s.color} />
          <Text style={[styles.cardStatusTxt, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>

      {/* Contenu */}
      <View style={styles.cardBody}>
        {/* Titre de l'événement */}
        <Text style={styles.cardTitle} numberOfLines={1}>{event?.title}</Text>

        {/* Date */}
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={12} color={C.textMut} />
          <Text style={styles.cardMetaTxt} numberOfLines={1}>
            {event?.date_formatted || formatDate(event?.start_date)}
          </Text>
        </View>

        {/* Lieu */}
        <View style={styles.cardMeta}>
          <Ionicons name="location-outline" size={12} color={C.textMut} />
          <Text style={styles.cardMetaTxt} numberOfLines={1}>
            {event?.is_online ? 'En ligne' : (event?.location_address || '—')}
          </Text>
        </View>

        {/* Actions selon le statut */}
        {isConfirmed && (
          // Billet confirmé → bouton voir le billet
          <TouchableOpacity
            style={styles.viewTicketBtn}
            onPress={() => onPress(invitation)}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code-outline" size={14} color={C.white} />
            <Text style={styles.viewTicketTxt}>Voir mon billet</Text>
          </TouchableOpacity>
        )}

        {isPending && (
          // Invitation en attente → boutons Accepter / Décliner
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => handleRespond('declined')}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.declineTxt}>Décliner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => handleRespond('confirmed')}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Text style={styles.confirmTxt}>Accepter</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ════════════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL : TicketsScreen
// ════════════════════════════════════════════════════════════════
export default function TicketsScreen({ navigation }) {

  const { user } = useAuth();

  // ── États ────────────────────────────────────────────────────
  const [invitations,      setInvitations]      = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [activeSection,    setActiveSection]    = useState('confirmed');
  const [selectedTicket,   setSelectedTicket]   = useState(null);
  const [showTicketModal,  setShowTicketModal]  = useState(false);

  // Animation d'entrée
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350, useNativeDriver: true,
    }).start();
  }, []);



  // ── Charger les invitations ──────────────────────────────────
  const loadInvitations = useCallback(async () => {
    try {
      const data = await eventService.fetchMyInvitations();
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('Erreur chargement billets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recharger à chaque fois qu'on revient sur cet écran
  useFocusEffect(
    useCallback(() => { loadInvitations(); }, [loadInvitations])
  );

  const onRefresh = () => { setRefreshing(true); loadInvitations(); };

  // ── Répondre à une invitation ────────────────────────────────
  const handleRespond = async (invitationId, newStatus) => {
    try {
      await eventService.respondToInvitation(invitationId, newStatus);

      // Mettre à jour localement sans recharger toute la liste
      setInvitations(prev =>
        prev.map(inv =>
          inv.id === invitationId
            ? { ...inv, status: newStatus }
            : inv
        )
      );

      if (newStatus === 'confirmed') {
        Alert.alert(
          '🎉 Invitation acceptée !',
          'Votre billet est maintenant disponible dans l\'onglet "Confirmés".',
          [{ text: 'Voir mon billet', onPress: () => setActiveSection('confirmed') }]
        );
      }
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de répondre à cette invitation.');
    }
  };

  // ── Ouvrir le modal billet ───────────────────────────────────
  const handleOpenTicket = (invitation) => {
    setSelectedTicket(invitation);
    setShowTicketModal(true);
  };

  // ── Filtres par section ──────────────────────────────────────
  const confirmed = invitations.filter(i => i.status === 'confirmed');
  const pending   = invitations.filter(i => ['sent', 'opened'].includes(i.status));
  const archived  = invitations.filter(i => ['declined', 'expired'].includes(i.status));

  const sections = [
    { id: 'confirmed', label: `Billets (${confirmed.length})` },
    { id: 'pending',   label: `En attente (${pending.length})` },
    { id: 'archived',  label: `Archivés (${archived.length})` },
  ];

  const currentList = {
    confirmed,
    pending,
    archived,
  }[activeSection] || [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <SafeAreaView style={styles.safe}>

        {/* ── HEADER ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mes Billets</Text>
            <Text style={styles.headerSub}>
              {confirmed.length} billet{confirmed.length > 1 ? 's' : ''} confirmé{confirmed.length > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="ticket-outline" size={22} color={C.green} />
          </View>
        </View>

        {/* ── ONGLETS DE SECTION ──────────────────────────────── */}
        <View style={styles.tabs}>
          {sections.map(sec => (
            <TouchableOpacity
              key={sec.id}
              style={[styles.tab, activeSection === sec.id && styles.tabActive]}
              onPress={() => setActiveSection(sec.id)}
            >
              <Text style={[
                styles.tabTxt,
                activeSection === sec.id && styles.tabTxtActive,
              ]}>
                {sec.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CONTENU ─────────────────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.green}
              colors={[C.green]}
            />
          }
        >
          {loading ? (
            <ActivityIndicator size="large" color={C.green} style={{ marginTop: 60 }} />
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>

              {currentList.length === 0 ? (
                // ── État vide selon la section ──────────────────
                <View style={styles.emptyBox}>
                  <Ionicons
                    name={
                      activeSection === 'confirmed' ? 'ticket-outline' :
                      activeSection === 'pending'   ? 'mail-outline'   :
                      'archive-outline'
                    }
                    size={56} color={C.textMut}
                  />
                  <Text style={styles.emptyTitle}>
                    {activeSection === 'confirmed' ? 'Aucun billet confirmé'   :
                     activeSection === 'pending'   ? 'Aucune invitation en attente' :
                     'Aucun élément archivé'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {activeSection === 'confirmed'
                      ? 'Acceptez des invitations pour obtenir vos billets. Ils apparaîtront ici avec un QR code.'
                      : activeSection === 'pending'
                      ? 'Vous n\'avez pas d\'invitation en attente de réponse.'
                      : 'Les invitations déclinées ou expirées apparaîtront ici.'
                    }
                  </Text>

                  {/* Bouton découvrir si pas de billets */}
                  {activeSection === 'confirmed' && (
                    <TouchableOpacity
                      style={styles.discoverBtn}
                      onPress={() => navigation?.getParent()?.navigate('TabDiscover')}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="compass-outline" size={16} color={C.white} />
                      <Text style={styles.discoverBtnTxt}>Découvrir des événements</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                // ── Liste des invitations / billets ─────────────
                currentList.map(inv => (
                  <InvitationCard
                    key={inv.id}
                    invitation={inv}
                    onPress={handleOpenTicket}
                    onRespond={handleRespond}
                  />
                ))
              )}

            </Animated.View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── Modal billet avec QR code ────────────────────────── */}
        <TicketModal
          visible={showTicketModal}
          invitation={selectedTicket}
          user={user}
          onClose={() => { setShowTicketModal(false); setSelectedTicket(null); }}
        />

      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.white },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: C.textMut, marginTop: 2 },
  headerBadge: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },

  // Onglets
  tabs: {
    flexDirection: 'row', backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:    { borderBottomColor: C.green },
  tabTxt:       { fontSize: 12, fontWeight: '600', color: C.textMut },
  tabTxtActive: { color: C.green, fontWeight: '800' },

  // Scroll
  scroll:    { flex: 1, backgroundColor: C.bg },
  scrollPad: { padding: 16 },

  // Card invitation / billet
  card: {
    backgroundColor: C.white, borderRadius: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardConfirmed: {
    borderColor: C.green, borderWidth: 1.5,
  },
  cardImageBox:         { position: 'relative' },
  cardImage:            { width: '100%', height: 160 },
  cardImagePlaceholder: {
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
  },
  cardStatusBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  cardStatusTxt: { fontSize: 10, fontWeight: '800' },
  cardBody:      { padding: 14 },
  cardTitle:     { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 8 },
  cardMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4,
  },
  cardMetaTxt: { fontSize: 12, color: C.textMut, fontWeight: '500', flex: 1 },

  // Bouton voir billet
  viewTicketBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.green, borderRadius: 12, paddingVertical: 12, marginTop: 12,
    shadowColor: C.green, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  viewTicketTxt: { fontSize: 14, fontWeight: '800', color: C.white },

  // Boutons accepter/décliner
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  declineBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  declineTxt: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  confirmBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.green, alignItems: 'center',
  },
  confirmTxt: { fontSize: 13, color: C.white, fontWeight: '700' },

  // État vide
  emptyBox: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '800', color: C.text,
    marginTop: 16, marginBottom: 8, textAlign: 'center',
  },
  emptySub: {
    fontSize: 14, color: C.textMut,
    textAlign: 'center', lineHeight: 21, marginBottom: 24,
  },
  discoverBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.green, borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  discoverBtnTxt: { fontSize: 14, fontWeight: '700', color: C.white },
});