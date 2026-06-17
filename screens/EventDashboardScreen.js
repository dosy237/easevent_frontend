/**
 * EventDashboardScreen.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Tableau de bord d'un événement spécifique.
 * Accessible depuis DashboardScreen en appuyant sur "Gérer".
 *
 * Ce que l'organisateur peut faire ici :
 * ─────────────────────────────────────
 * - Voir les stats de l'événement (vues, participants, invités)
 * - Publier / Dépublier l'événement
 * - Modifier les informations
 * - Inviter des personnes (par email ou téléphone)
 * - Voir la liste des participants confirmés
 * - Voir les invitations en attente
 * - Révoquer une invitation
 * - Supprimer l'événement
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar, Animated, Alert, ActivityIndicator,
  TextInput, Modal, RefreshControl, Platform,
} from 'react-native';

import { SafeAreaView }    from 'react-native-safe-area-context';
import { Ionicons }        from '@expo/vector-icons';
import { useFocusEffect }  from '@react-navigation/native';
import { useAuth }         from '../context/AuthContext';
import { eventService }    from '../services/eventService';

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
// FONCTION : formater une date ISO
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

// ════════════════════════════════════════════════════════════════
// COMPOSANT : StatBadge
// Petite statistique avec icône, valeur et label
// ════════════════════════════════════════════════════════════════
const StatBadge = ({ icon, value, label, color = C.green }) => (
  <View style={styles.statBadge}>
    <View style={[styles.statBadgeIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={styles.statBadgeValue}>{value}</Text>
    <Text style={styles.statBadgeLabel}>{label}</Text>
  </View>
);

// ════════════════════════════════════════════════════════════════
// COMPOSANT : ParticipantRow
// Ligne représentant un participant ou invité
// ════════════════════════════════════════════════════════════════
const ParticipantRow = ({ participant, onRevoke }) => {
  const user = participant.user || {};

  // Couleur et label selon le statut
  const statusConfig = {
    sent:      { label: 'En attente', color: C.orange,  bg: C.orangeL    },
    opened:    { label: 'Vu',         color: '#2563EB', bg: '#EFF6FF'    },
    confirmed: { label: 'Confirmé',   color: C.green,   bg: C.greenLight },
    declined:  { label: 'Décliné',    color: C.error,   bg: C.errorBg   },
  };
  const s = statusConfig[participant.status] || statusConfig.sent;

  const name = user.first_name
    ? `${user.first_name} ${user.last_name}`
    : user.phone_number || 'Inconnu';

  const initial = (user.first_name?.[0] || user.phone_number?.[0] || '?').toUpperCase();

  return (
    <View style={styles.participantRow}>
      {/* Avatar ou initiale */}
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.participantAvatar} />
      ) : (
        <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder]}>
          <Text style={styles.participantInitial}>{initial}</Text>
        </View>
      )}

      {/* Infos */}
      <View style={styles.participantInfo}>
        <Text style={styles.participantName} numberOfLines={1}>{name}</Text>
        {user.email && (
          <Text style={styles.participantEmail} numberOfLines={1}>{user.email}</Text>
        )}
      </View>

      {/* Badge statut */}
      <View style={[styles.participantBadge, { backgroundColor: s.bg }]}>
        <Text style={[styles.participantBadgeTxt, { color: s.color }]}>{s.label}</Text>
      </View>

      {/* Bouton révoquer — seulement si en attente ou confirmé */}
      {['sent', 'opened', 'confirmed'].includes(participant.status) && (
        <TouchableOpacity
          style={styles.revokeBtn}
          onPress={() => onRevoke(participant)}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={20} color={C.error} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : InviteModal
// Modal pour inviter un participant par email ou téléphone
// ════════════════════════════════════════════════════════════════
const InviteModal = ({ visible, onClose, onInvite, loading }) => {
  const [email,       setEmail]       = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mode,        setMode]        = useState('email'); // 'email' ou 'phone'
  const [error,       setError]       = useState('');

  const handleInvite = () => {
    setError('');
    if (mode === 'email') {
      if (!email.trim() || !email.includes('@')) {
        setError('Entrez un email valide.');
        return;
      }
      onInvite({ email: email.trim() });
    } else {
      if (!phoneNumber.trim()) {
        setError('Entrez un numéro de téléphone valide.');
        return;
      }
      onInvite({ phone_number: phoneNumber.trim() });
    }
  };

  const handleClose = () => {
    setEmail('');
    setPhoneNumber('');
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalRoot}>

        {/* Header du modal */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Inviter un participant</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">

          {/* Sélecteur de mode : email ou téléphone */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'email' && styles.modeBtnActive]}
              onPress={() => setMode('email')}
            >
              <Ionicons name="mail-outline" size={16}
                color={mode === 'email' ? C.white : C.textMut} />
              <Text style={[styles.modeBtnTxt, mode === 'email' && { color: C.white }]}>
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'phone' && styles.modeBtnActive]}
              onPress={() => setMode('phone')}
            >
              <Ionicons name="phone-portrait-outline" size={16}
                color={mode === 'phone' ? C.white : C.textMut} />
              <Text style={[styles.modeBtnTxt, mode === 'phone' && { color: C.white }]}>
                Téléphone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Explication contextuelle */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={C.green} />
            <Text style={styles.infoBoxTxt}>
              {mode === 'email'
                ? 'Si la personne a un compte Easevent, elle recevra une notification. Sinon, elle recevra un email avec un lien d\'accès.'
                : 'Un SMS sera envoyé avec un lien d\'accès à l\'événement. La personne n\'a pas besoin d\'avoir un compte.'
              }
            </Text>
          </View>

          {/* Champ email ou téléphone */}
          {mode === 'email' ? (
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Adresse email</Text>
              <View style={styles.modalInputBox}>
                <Ionicons name="mail-outline" size={18} color={C.textMut} />
                <TextInput
                  style={styles.modalInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="exemple@email.com"
                  placeholderTextColor={C.textMut}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          ) : (
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>Numéro de téléphone</Text>
              <View style={styles.modalInputBox}>
                <Ionicons name="phone-portrait-outline" size={18} color={C.textMut} />
                <TextInput
                  style={styles.modalInput}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="+33 6 12 34 56 78"
                  placeholderTextColor={C.textMut}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}

          {/* Message d'erreur */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={C.error} />
              <Text style={styles.errorBannerTxt}>{error}</Text>
            </View>
          ) : null}

          {/* Bouton envoyer */}
          <TouchableOpacity
            style={[styles.inviteBtn, loading && { opacity: 0.7 }]}
            onPress={handleInvite}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={C.white} />
                <Text style={styles.inviteBtnTxt}>Envoyer l'invitation</Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Modal>
  );
};

// ════════════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL : EventDashboardScreen
// ════════════════════════════════════════════════════════════════
export default function EventDashboardScreen({ route, navigation }) {

  // L'événement est passé en paramètre depuis DashboardScreen
  // via navigation.navigate('EventDashboard', { event })
  const { event: initialEvent } = route.params || {};
  const { accessToken } = useAuth();

  // ── États ────────────────────────────────────────────────────
  const [event,         setEvent]         = useState(initialEvent);
  const [participants,  setParticipants]  = useState([]);
  const [stats,         setStats]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [publishing,    setPublishing]    = useState(false);
  const [showInvite,    setShowInvite]    = useState(false);
  const [inviting,      setInviting]      = useState(false);
  const [activeSection, setActiveSection] = useState('overview'); // 'overview' | 'participants' | 'invitations'

  // Animation d'entrée
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350, useNativeDriver: true,
    }).start();
  }, []);



  // ── Charger les données de l'événement ───────────────────────
  const loadData = useCallback(async () => {
    if (!event?.id) return;
    try {
      const [detailData, participantsData] = await Promise.all([
        eventService.fetchEventDetail(event.id),
        eventService.fetchEventParticipants(event.id),
      ]);

      setEvent(detailData.event);
      setStats(detailData.invitations);
      setParticipants(participantsData.participants || []);

    } catch (err) {
      console.error('Erreur chargement event dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [event?.id]);

  // Recharger à chaque fois qu'on revient sur cet écran
  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── Publier / Dépublier ──────────────────────────────────────
const handlePublish = async () => {
  const isPublished  = event.status === 'published';
  const isPrivate    = event.visibility === 'private';

  Alert.alert(
    isPublished ? 'Dépublier l\'événement' : 'Publier l\'événement',
    isPublished
      ? 'L\'événement sera retiré. Les invitations restent actives.'
      : isPrivate
        ? 'Cet événement est privé. Seuls vos invités pourront y accéder — il n\'apparaîtra pas dans le fil de découverte.'
        : 'Votre événement sera visible par tous dans le fil de découverte.',
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text:  isPublished ? 'Dépublier' : 'Publier',
        style: isPublished ? 'destructive' : 'default',
        onPress: async () => {
          setPublishing(true);
          try {
            await eventService.publishEvent(event.id, event.visibility);

            setEvent(prev => ({
              ...prev,
              status: isPublished ? 'draft' : 'published',
            }));
            Alert.alert(
              isPublished ? 'Événement dépublié' : '🎉 Événement publié !',
              isPublished
                ? 'L\'événement n\'est plus accessible.'
                : isPrivate
                  ? 'Votre événement est publié. Seuls vos invités peuvent y accéder.'
                  : 'Votre événement est maintenant visible dans le fil de découverte.',
            );
          } catch (err) {
            const detail = err.response?.data?.detail || 'Impossible de modifier le statut.';
            Alert.alert('Erreur', detail);
          } finally {
            setPublishing(false);
          }
        },
      },
    ]
  );
};

  // ── Supprimer l'événement ────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'Supprimer cet événement',
      `Voulez-vous vraiment supprimer "${event.title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text:  'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await eventService.deleteEvent(event.id);
              Alert.alert('Supprimé', 'L\'événement a été supprimé.', [{
                text: 'OK',
                onPress: () => navigation?.goBack(),
              }]);
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer cet événement.');
            }
          },
        },
      ]
    );
  };

  // ── Inviter un participant ────────────────────────────────────
  const handleInvite = async (data) => {
    setInviting(true);
    try {
      const resData = await eventService.inviteParticipant(event.id, data);
      setShowInvite(false);
      Alert.alert('✅ Invitation envoyée', resData.message || 'L\'invitation a été envoyée.');
      loadData(); // Recharger la liste
    } catch (err) {
      const detail = err.response?.data?.detail || 'Impossible d\'envoyer l\'invitation.';
      Alert.alert('Erreur', detail);
    } finally {
      setInviting(false);
    }
  };

  // ── Révoquer une invitation ──────────────────────────────────
  const handleRevoke = (participant) => {
    const name = participant.user?.first_name
      ? `${participant.user.first_name} ${participant.user.last_name}`
      : participant.user?.phone_number || 'ce participant';

    Alert.alert(
      'Retirer l\'invitation',
      `Voulez-vous retirer l\'invitation de ${name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text:  'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await eventService.revokeInvitation(participant.id);
              // Retirer localement sans recharger
              setParticipants(prev => prev.filter(p => p.id !== participant.id));
            } catch {
              Alert.alert('Erreur', 'Impossible de retirer cette invitation.');
            }
          },
        },
      ]
    );
  };

  // ── Filtres participants ──────────────────────────────────────
  const confirmed   = participants.filter(p => p.status === 'confirmed');
  const pending     = participants.filter(p => ['sent', 'opened'].includes(p.status));
  const declined    = participants.filter(p => p.status === 'declined');

  // ── Badge de statut de l'événement ───────────────────────────
  const statusConfig = {
    draft:     { label: 'Brouillon',  color: C.textMut, bg: C.bg },
    published: { label: 'Publié ✓',   color: C.green,   bg: C.greenLight },
    live:      { label: 'En cours',   color: '#D97706', bg: '#FFFBEB' },
    ended:     { label: 'Terminé',    color: C.textMut, bg: C.bg },
    archived:  { label: 'Archivé',    color: C.textMut, bg: C.bg },
  };
  const eventStatus = statusConfig[event?.status] || statusConfig.draft;
  const isPublished = event?.status === 'published';

  if (!event) return null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <SafeAreaView style={styles.safe}>

        {/* ── HEADER ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="arrow-back-outline" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{event.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: eventStatus.bg }]}>
              <Text style={[styles.statusBadgeTxt, { color: eventStatus.color }]}>
                {eventStatus.label}
              </Text>
            </View>
          </View>
          {/* Bouton modifier */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation?.navigate('EditEvent', { event })}
          >
            <Ionicons name="create-outline" size={20} color={C.green} />
          </TouchableOpacity>
        </View>

        {/* ── ONGLETS DE SECTION ──────────────────────────────── */}
        <View style={styles.sectionTabs}>
          {[
            { id: 'overview',      label: 'Aperçu' },
            { id: 'participants',  label: `Confirmés (${confirmed.length})` },
            { id: 'invitations',   label: `En attente (${pending.length})` },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.sectionTab, activeSection === tab.id && styles.sectionTabActive]}
              onPress={() => setActiveSection(tab.id)}
            >
              <Text style={[
                styles.sectionTabTxt,
                activeSection === tab.id && styles.sectionTabTxtActive,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── SCROLL PRINCIPAL ────────────────────────────────── */}
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

              {/* ════════════════════════════════════════════════
                  SECTION : APERÇU
                  Stats + Actions principales + Infos de l'événement
                  ════════════════════════════════════════════════ */}
              {activeSection === 'overview' && (
                <View>

                  {/* Image de couverture */}
                  {event.cover_image ? (
                    <Image
                      source={{ uri: event.cover_image }}
                      style={styles.coverImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="image-outline" size={40} color={C.textMut} />
                      <Text style={styles.coverPlaceholderTxt}>Aucune photo de couverture</Text>
                    </View>
                  )}

                  {/* Stats */}
                  <View style={styles.statsRow}>
                    <StatBadge
                      icon="eye-outline"
                      value={event.view_count || 0}
                      label="Vues"
                      color="#2563EB"
                    />
                    <View style={styles.statDivider} />
                    <StatBadge
                      icon="people-outline"
                      value={confirmed.length}
                      label="Confirmés"
                      color={C.green}
                    />
                    <View style={styles.statDivider} />
                    <StatBadge
                      icon="mail-outline"
                      value={pending.length}
                      label="En attente"
                      color={C.orange}
                    />
                    <View style={styles.statDivider} />
                    <StatBadge
                      icon="close-circle-outline"
                      value={declined.length}
                      label="Déclinés"
                      color={C.error}
                    />
                  </View>

                  {/* Actions principales */}
                  <View style={styles.actionsCard}>
                    <Text style={styles.cardTitle}>Actions</Text>

                    {/* Bouton Publier / Dépublier */}
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isPublished ? styles.actionBtnWarning : styles.actionBtnPrimary,
                        publishing && { opacity: 0.7 },
                      ]}
                      onPress={handlePublish}
                      disabled={publishing}
                      activeOpacity={0.85}
                    >
                      {publishing ? (
                        <ActivityIndicator size="small" color={C.white} />
                      ) : (
                        <>
                          <Ionicons
                            name={isPublished ? 'eye-off-outline' : 'globe-outline'}
                            size={18} color={C.white}
                          />
                          <Text style={styles.actionBtnTxt}>
                            {isPublished ? 'Dépublier l\'événement' : 'Publier l\'événement'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Info si publié */}
                    {isPublished && (
                      <View style={styles.publishedInfo}>
                        <Ionicons name="checkmark-circle" size={14} color={C.green} />
                        <Text style={styles.publishedInfoTxt}>
                          Visible dans le fil de découverte
                        </Text>
                      </View>
                    )}

                    {/* Bouton Inviter */}
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() => setShowInvite(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="person-add-outline" size={18} color={C.green} />
                      <Text style={[styles.actionBtnTxt, { color: C.green }]}>
                        Inviter des participants
                      </Text>
                    </TouchableOpacity>

                    {/* Bouton Supprimer */}
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      onPress={handleDelete}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash-outline" size={18} color={C.error} />
                      <Text style={[styles.actionBtnTxt, { color: C.error }]}>
                        Supprimer l'événement
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Informations de l'événement */}
                  <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>Informations</Text>

                    {[
                      { icon: 'calendar-outline',  label: 'Début',       value: formatDate(event.start_date) },
                      { icon: 'calendar-outline',  label: 'Fin',         value: formatDate(event.end_date) },
                      { icon: 'location-outline',  label: 'Lieu',        value: event.is_online ? 'En ligne' : (event.location_address || '—') },
                      { icon: 'eye-outline',       label: 'Visibilité',  value: event.visibility === 'public' ? 'Public' : 'Privé' },
                      { icon: 'color-palette-outline', label: 'Ambiance', value: event.ambiance || '—' },
                      { icon: 'link-outline',      label: 'Lien',        value: event.subdomain ? `easevent.app/${event.subdomain}` : '—' },
                    ].map((row, i) => (
                      <View key={i} style={styles.infoRow}>
                        <View style={styles.infoRowLeft}>
                          <Ionicons name={row.icon} size={16} color={C.textMut} />
                          <Text style={styles.infoLabel}>{row.label}</Text>
                        </View>
                        <Text style={styles.infoValue} numberOfLines={1}>{row.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Description */}
                  {event.description ? (
                    <View style={styles.descCard}>
                      <Text style={styles.cardTitle}>Description</Text>
                      <Text style={styles.descText}>{event.description}</Text>
                    </View>
                  ) : null}

                </View>
              )}

              {/* ════════════════════════════════════════════════
                  SECTION : PARTICIPANTS CONFIRMÉS
                  ════════════════════════════════════════════════ */}
              {activeSection === 'participants' && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {confirmed.length} participant{confirmed.length > 1 ? 's' : ''} confirmé{confirmed.length > 1 ? 's' : ''}
                    </Text>
                  </View>

                  {confirmed.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Ionicons name="people-outline" size={40} color={C.textMut} />
                      <Text style={styles.emptyTitle}>Aucun participant confirmé</Text>
                      <Text style={styles.emptySub}>
                        Les personnes qui acceptent votre invitation apparaîtront ici.
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyBtn}
                        onPress={() => setShowInvite(true)}
                      >
                        <Ionicons name="person-add-outline" size={16} color={C.white} />
                        <Text style={styles.emptyBtnTxt}>Inviter des participants</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    confirmed.map(p => (
                      <ParticipantRow
                        key={p.id}
                        participant={p}
                        onRevoke={handleRevoke}
                      />
                    ))
                  )}
                </View>
              )}

              {/* ════════════════════════════════════════════════
                  SECTION : INVITATIONS EN ATTENTE
                  ════════════════════════════════════════════════ */}
              {activeSection === 'invitations' && (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {pending.length} invitation{pending.length > 1 ? 's' : ''} en attente
                    </Text>
                    <TouchableOpacity
                      style={styles.inviteHeaderBtn}
                      onPress={() => setShowInvite(true)}
                    >
                      <Ionicons name="add" size={16} color={C.white} />
                      <Text style={styles.inviteHeaderBtnTxt}>Inviter</Text>
                    </TouchableOpacity>
                  </View>

                  {pending.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Ionicons name="mail-outline" size={40} color={C.textMut} />
                      <Text style={styles.emptyTitle}>Aucune invitation en attente</Text>
                      <Text style={styles.emptySub}>
                        Invitez des personnes à rejoindre votre événement.
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyBtn}
                        onPress={() => setShowInvite(true)}
                      >
                        <Ionicons name="person-add-outline" size={16} color={C.white} />
                        <Text style={styles.emptyBtnTxt}>Envoyer des invitations</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    pending.map(p => (
                      <ParticipantRow
                        key={p.id}
                        participant={p}
                        onRevoke={handleRevoke}
                      />
                    ))
                  )}

                  {/* Afficher aussi les déclinés */}
                  {declined.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.declinedTitle}>
                        {declined.length} refus
                      </Text>
                      {declined.map(p => (
                        <ParticipantRow
                          key={p.id}
                          participant={p}
                          onRevoke={handleRevoke}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

            </Animated.View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── Modal d'invitation ───────────────────────────────── */}
        <InviteModal
          visible={showInvite}
          onClose={() => setShowInvite(false)}
          onInvite={handleInvite}
          loading={inviting}
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
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 12 },
  headerTitle:  { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 },
  statusBadge: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3,
  },
  statusBadgeTxt: { fontSize: 11, fontWeight: '700' },
  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.greenLight, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Onglets de section
  sectionTabs: {
    flexDirection: 'row', backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16,
  },
  sectionTab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  sectionTabActive: { borderBottomColor: C.green },
  sectionTabTxt:    { fontSize: 12, fontWeight: '600', color: C.textMut },
  sectionTabTxtActive: { color: C.green, fontWeight: '800' },

  // Scroll
  scroll:    { flex: 1, backgroundColor: C.bg },
  scrollPad: { padding: 16 },

  // Cover image
  coverImage: {
    width: '100%', height: 200, borderRadius: 16, marginBottom: 16,
  },
  coverPlaceholder: {
    width: '100%', height: 160, borderRadius: 16, marginBottom: 16,
    backgroundColor: C.bg, borderWidth: 2, borderColor: C.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  coverPlaceholderTxt: { fontSize: 13, color: C.textMut },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: C.white,
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  statBadge:      { flex: 1, alignItems: 'center', gap: 4 },
  statBadgeIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  statBadgeValue: { fontSize: 18, fontWeight: '900', color: C.text },
  statBadgeLabel: { fontSize: 10, color: C.textMut, fontWeight: '500' },
  statDivider:    { width: 1, backgroundColor: C.border, marginVertical: 4 },

  // Cards
  actionsCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  infoCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  descCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 14 },

  // Boutons d'action
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14, marginBottom: 10,
  },
  actionBtnPrimary:   { backgroundColor: C.green },
  actionBtnWarning:   { backgroundColor: C.orange },
  actionBtnSecondary: {
    backgroundColor: C.greenLight,
    borderWidth: 1.5, borderColor: C.green,
  },
  actionBtnDanger: {
    backgroundColor: C.errorBg,
    borderWidth: 1.5, borderColor: '#FECACA',
  },
  actionBtnTxt: { fontSize: 15, fontWeight: '700', color: C.white },

  publishedInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10, paddingHorizontal: 4,
  },
  publishedInfoTxt: { fontSize: 12, color: C.green, fontWeight: '500' },

  // Infos de l'événement
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel:   { fontSize: 13, color: C.textMut, fontWeight: '500' },
  infoValue:   { fontSize: 13, color: C.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  descText:    { fontSize: 14, color: C.textSub, lineHeight: 21 },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text },

  // Bouton inviter dans le header de section
  inviteHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.green, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  inviteHeaderBtnTxt: { fontSize: 13, color: C.white, fontWeight: '700' },

  // Participants
  participantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  participantAvatar: { width: 44, height: 44, borderRadius: 22 },
  participantAvatarPlaceholder: {
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  participantInitial: { fontSize: 18, fontWeight: '800', color: C.green },
  participantInfo:    { flex: 1 },
  participantName:    { fontSize: 14, fontWeight: '700', color: C.text },
  participantEmail:   { fontSize: 12, color: C.textMut, marginTop: 2 },
  participantBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  participantBadgeTxt:{ fontSize: 10, fontWeight: '700' },
  revokeBtn:          { padding: 4 },

  // Déclinés
  declinedTitle: { fontSize: 14, fontWeight: '700', color: C.textMut, marginBottom: 10 },

  // État vide
  emptyCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
    borderStyle: 'dashed', gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 8 },
  emptySub:   { fontSize: 13, color: C.textMut, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.green, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 8,
  },
  emptyBtnTxt: { fontSize: 13, color: C.white, fontWeight: '700' },

  // Modal invitation
  modalRoot:   { flex: 1, backgroundColor: C.white },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: C.text },
  modalScroll: { flex: 1, padding: 20 },

  // Sélecteur de mode email/téléphone
  modeSelector: {
    flexDirection: 'row', gap: 10, marginBottom: 16,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white,
  },
  modeBtnActive:  { backgroundColor: C.green, borderColor: C.green },
  modeBtnTxt:     { fontSize: 14, fontWeight: '600', color: C.textMut },

  // Info box
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.greenLight, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#C5E8D3', marginBottom: 20,
  },
  infoBoxTxt: { fontSize: 13, color: C.green, flex: 1, lineHeight: 18 },

  // Champs du modal
  modalField:      { marginBottom: 16 },
  modalFieldLabel: {
    fontSize: 13, fontWeight: '700', color: C.textSub,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  modalInputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: C.border, borderRadius: 14,
    paddingHorizontal: 14, backgroundColor: '#F9F9F9', minHeight: 52,
  },
  modalInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 14 },

  // Erreur
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.errorBg, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 16,
  },
  errorBannerTxt: { fontSize: 13, color: C.error, flex: 1 },

  // Bouton invitation
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.green, borderRadius: 16, paddingVertical: 16,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  inviteBtnTxt: { fontSize: 16, fontWeight: '800', color: C.white },
});