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
 * - Inviter des personnes → M12 (InviteGuests)
 * - Invités & réponses (confirmés, en attente, relances) → M13 (GuestList)
 * - Messages des invités (M15), questions RSVP (M14), mini-site (M06)
 * - Supprimer l'événement
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, StatusBar, Animated, Alert, ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { SafeAreaView }    from 'react-native-safe-area-context';
import { Ionicons }        from '@expo/vector-icons';
import { useFocusEffect }  from '@react-navigation/native';
import { useAuth }         from '../context/AuthContext';
import eventService    from '../services/eventService';
import { showAlert } from '../utils/dialog';
import { logDev } from '../utils/log';

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
// COMPOSANT : ActionRow (M11 — Inviter, Invités, Messages, RSVP)
// ════════════════════════════════════════════════════════════════
const ActionRow = ({ icon, title, subtitle, onPress, badge, last }) => (
  <TouchableOpacity
    style={[styles.actionRow, last && { borderBottomWidth: 0 }]}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={`${title}. ${subtitle}`}
  >
    <View style={styles.actionRowIcon}><Ionicons name={icon} size={20} color={C.green} /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.actionRowTitle}>{title}</Text>
      <Text style={styles.actionRowSub} numberOfLines={1}>{subtitle}</Text>
    </View>
    {badge ? <View style={styles.actionRowBadge}><Text style={styles.actionRowBadgeTxt}>{badge}</Text></View> : null}
    <Ionicons name="chevron-forward" size={18} color={C.textMut} />
  </TouchableOpacity>
);

const formatPriceLabel = (event) => {
  const value = Number(event?.price || 0);
  if (!event?.is_paid || value <= 0) return 'Gratuit (0,00 €)';
  return `${value.toFixed(2).replace('.', ',')} ${event.currency === 'EUR' || !event.currency ? '€' : event.currency}`;
};

export default function EventDashboardScreen({ route, navigation }) {

  // L'événement est passé en paramètre depuis DashboardScreen
  // via navigation.navigate('EventDashboard', { event })
  const { event: initialEvent } = route.params || {};
  const { accessToken } = useAuth();

  // ── États ────────────────────────────────────────────────────
  const [event,         setEvent]         = useState(initialEvent);
  const [counts,        setCounts]        = useState({ confirmed: 0, pending: 0, declined: 0, total: 0 });
  const [stats,         setStats]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [publishing,    setPublishing]    = useState(false);

  // Nouvel événement passé en paramètre (écran déjà monté) et « Publier et inviter »
  const openInvite = route.params?.openInvite;
  useEffect(() => {
    if (initialEvent?.id && initialEvent.id !== event?.id) setEvent(initialEvent);
  }, [initialEvent?.id]);
  useEffect(() => {
    if (openInvite && initialEvent) navigation.navigate('InviteGuests', { event: initialEvent });
  }, [openInvite]);

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
      setCounts(participantsData.counts || { confirmed: 0, pending: 0, declined: 0, total: 0 });

    } catch (err) {
      logDev('Erreur chargement event dashboard:', err);
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

  showAlert(
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
            showAlert(
              isPublished ? 'Événement dépublié' : 'Événement publié',
              isPublished
                ? 'L\'événement n\'est plus accessible.'
                : isPrivate
                  ? 'Votre événement est publié. Seuls vos invités peuvent y accéder.'
                  : 'Votre événement est maintenant visible dans le fil de découverte.',
            );
          } catch (err) {
            const detail = err.response?.data?.detail || 'Impossible de modifier le statut.';
            showAlert('Action impossible', detail);
          } finally {
            setPublishing(false);
          }
        },
      },
    ]
  );
};

  // ── Public ↔ Privé (modifiable à tout moment) ─────────────────
  const [savingVisibility, setSavingVisibility] = useState(false);
  const changeVisibility = (next) => {
    if (next === event.visibility || savingVisibility) return;
    const toPrivate = next === 'private';
    showAlert(
      toPrivate ? 'Passer en privé ?' : 'Passer en public ?',
      toPrivate
        ? "L'événement n'apparaîtra plus dans Découvrir. Seuls vos invités et les personnes qui ont déjà un ticket pourront le voir."
        : (event.status === 'published'
          ? "L'événement apparaîtra dans Découvrir : tout le monde pourra le voir et prendre un ticket."
          : "Une fois publié, l'événement apparaîtra dans Découvrir et tout le monde pourra le voir."),
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: toPrivate ? 'Passer en privé' : 'Passer en public',
          onPress: async () => {
            setSavingVisibility(true);
            try {
              const data = await eventService.updateEvent(event.id, { visibility: next });
              setEvent((prev) => ({ ...prev, visibility: data.event?.visibility || next }));
            } catch (err) {
              showAlert('Action impossible', err.response?.data?.detail || 'Impossible de changer la visibilité.');
            } finally {
              setSavingVisibility(false);
            }
          },
        },
      ]
    );
  };

  // ── Supprimer l'événement ────────────────────────────────────
  const handleDelete = () => {
    const n = counts.confirmed + counts.pending;
    showAlert(
      'Supprimer cet événement',
      n
        ? `« ${event.title} » sera annulé. ${n} participant${n > 1 ? 's' : ''} ${n > 1 ? 'seront prévenus' : 'sera prévenu'} et les tickets payés seront remboursés automatiquement. Cette action est irréversible.`
        : `Voulez-vous vraiment supprimer « ${event.title} » ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text:  'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await eventService.deleteEvent(event.id);
              showAlert('Événement supprimé', res?.message || "L'événement a été supprimé.", [{
                text: 'OK',
                onPress: () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard')),
              }]);
            } catch {
              showAlert('Suppression impossible', 'Vérifiez votre connexion et réessayez.');
            }
          },
        },
      ]
    );
  };

  // ── Invités (M12, M13) ────────────────────────────────────────
  // Inviter ouvre l'événement aux invités : il doit être publié d'abord
  const goInvite = () => {
    if (event.status !== 'published') {
      showAlert("Publiez d'abord l'événement",
        event.visibility === 'private'
          ? "Il restera privé : seules les personnes invitées pourront le voir."
          : 'Il apparaîtra dans Découvrir, puis vous pourrez inviter vos proches.',
        [{ text: 'Plus tard', style: 'cancel' }, {
          text: 'Publier et inviter', onPress: async () => {
            try {
              await eventService.publishEvent(event.id, event.visibility);
              const published = { ...event, status: 'published' };
              setEvent(published);
              navigation.navigate('InviteGuests', { event: published });
            } catch (err) {
              showAlert('Publication impossible', err.response?.data?.detail || 'Réessayez.');
            }
          },
        }]);
      return;
    }
    navigation.navigate('InviteGuests', { event });
  };
  const goGuests = (filter = 'all') => navigation.navigate('GuestList', { event, filter });

  // ── Badge de statut de l'événement ───────────────────────────
  const statusConfig = {
    draft:     { label: 'Brouillon',  color: C.textMut, bg: C.bg },
    published: { label: 'Publié',   color: C.green,   bg: C.greenLight },
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation?.navigate('Conversations', { eventId: event.id, eventTitle: event.title })}
              accessibilityRole="button"
              accessibilityLabel="Messages des invités"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={C.green} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation?.navigate('EditEvent', { event })}
              accessibilityRole="button"
              accessibilityLabel="Modifier l'événement"
            >
              <Ionicons name="create-outline" size={20} color={C.green} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ONGLETS : Aperçu ici ; Confirmés / En attente ouvrent M13 ── */}
        <View style={styles.sectionTabs} accessibilityRole="tablist">
          {[
            { id: 'overview',  label: 'Aperçu',                           onPress: null },
            { id: 'confirmed', label: `Confirmés (${counts.confirmed})`,  onPress: () => goGuests('confirmed') },
            { id: 'pending',   label: `En attente (${counts.pending})`,   onPress: () => goGuests('pending') },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.sectionTab, tab.id === 'overview' && styles.sectionTabActive]}
              onPress={tab.onPress || undefined}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab.id === 'overview' }} aria-selected={tab.id === 'overview'}
            >
              <Text style={[styles.sectionTabTxt, tab.id === 'overview' && styles.sectionTabTxtActive]}>
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
              {(
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
                      value={counts.confirmed}
                      label="Confirmés"
                      color={C.green}
                    />
                    <View style={styles.statDivider} />
                    <StatBadge
                      icon="mail-outline"
                      value={counts.pending}
                      label="En attente"
                      color={C.orange}
                    />
                    <View style={styles.statDivider} />
                    <StatBadge
                      icon="close-circle-outline"
                      value={counts.declined}
                      label="Déclinés"
                      color={C.error}
                    />
                  </View>

                  {/* Mini-site (lot IA) */}
                  <TouchableOpacity
                    style={styles.minisiteCard}
                    onPress={() => navigation.navigate('MiniSiteGenerating', { event })}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Générer le mini-site avec l'IA"
                  >
                    <View style={styles.actionRowIcon}><Ionicons name="sparkles-outline" size={20} color={C.green} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionRowTitle}>Pas encore de mini-site</Text>
                      <Text style={styles.actionRowSub}>Générez-le avec l'IA à partir de vos photos.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textMut} />
                  </TouchableOpacity>

                  {/* Invités, messages, RSVP */}
                  <View style={styles.rowsCard}>
                    <ActionRow icon="person-add-outline" title="Inviter des participants"
                      subtitle="Membres, email, SMS ou fichier CSV" onPress={goInvite} />
                    <ActionRow icon="people-outline" title="Invités & réponses"
                      subtitle={counts.total ? `${counts.total} invité${counts.total > 1 ? 's' : ''} · ${counts.confirmed} confirmé${counts.confirmed > 1 ? 's' : ''}` : 'Aucun invité pour le moment'}
                      onPress={() => goGuests('all')} />
                    <ActionRow icon="chatbubbles-outline" title="Messages des invités"
                      subtitle="Échangez avec vos invités" onPress={() => navigation.navigate('Conversations', { eventId: event.id, eventTitle: event.title })} />
                    <ActionRow icon="qr-code-outline" title="Scanner les tickets"
                      subtitle="Contrôle à l'entrée avec l'appareil photo" onPress={() => navigation.navigate('ScanTickets', { event })} />
                    <ActionRow icon="help-circle-outline" title="Questions RSVP" last
                      subtitle="Posez jusqu'à 5 questions à vos invités" onPress={() => navigation.navigate('RsvpQuestions', { event })} />
                  </View>

                  {/* Actions principales */}
                  <View style={styles.actionsCard}>
                    <Text style={styles.cardTitle}>Actions</Text>

                    {/* Visibilité : Public / Privé */}
                    <Text style={styles.visLabel} nativeID="visLabel">Visibilité</Text>
                    <View style={styles.visRow} accessibilityRole="radiogroup" accessibilityLabel="Visibilité">
                      {[
                        { value: 'public',  label: 'Public', icon: 'earth-outline',       desc: 'Visible par tous' },
                        { value: 'private', label: 'Privé',  icon: 'lock-closed-outline', desc: 'Sur invitation' },
                      ].map((v) => {
                        const active = event.visibility === v.value;
                        return (
                          <TouchableOpacity key={v.value} style={[styles.visOpt, active && styles.visOptActive]}
                            onPress={() => changeVisibility(v.value)} disabled={savingVisibility} activeOpacity={0.85}
                            accessibilityRole="radio" accessibilityState={{ checked: active, disabled: savingVisibility }} aria-checked={active} aria-disabled={savingVisibility}
                            accessibilityLabel={`${v.label} : ${v.desc}`}>
                            <Ionicons name={v.icon} size={18} color={active ? C.white : C.green} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.visOptTxt, active && { color: C.white }]}>{v.label}</Text>
                              <Text style={[styles.visOptSub, active && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>{v.desc}</Text>
                            </View>
                            {active && savingVisibility ? <ActivityIndicator size="small" color={C.white} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

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
                          {event.visibility === 'private' ? 'Accessible uniquement à vos invités' : 'Visible dans le fil de découverte'}
                        </Text>
                      </View>
                    )}

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
                      { icon: 'pricetag-outline',  label: 'Prix du ticket', value: formatPriceLabel(event) },
                      { icon: 'shirt-outline',     label: 'Dress code',  value: event.dress_code || '—' },
                      { icon: 'eye-outline',       label: 'Visibilité',  value: event.visibility === 'public' ? 'Public' : 'Privé' },
                      { icon: 'color-palette-outline', label: 'Ambiance', value: event.ambiance || '—' },
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

            </Animated.View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  visLabel:     { fontSize: 12, fontWeight: '700', color: C.textMut, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  visRow:       { flexDirection: 'row', gap: 10, marginBottom: 14 },
  visOpt:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  visOptActive: { backgroundColor: C.green, borderColor: C.green },
  visOptTxt:    { fontSize: 14, fontWeight: '800', color: C.text },
  visOptSub:    { fontSize: 11, color: C.textMut },
  // M11 — lignes d'action
  rowsCard: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, marginBottom: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderBottomWidth: 1, borderBottomColor: C.border },
  actionRowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  actionRowTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  actionRowSub: { fontSize: 12, color: C.textSub, marginTop: 2 },
  actionRowBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  actionRowBadgeTxt: { fontSize: 11, fontWeight: '800', color: C.white },
  minisiteCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 18, borderWidth: 1.5, borderColor: C.green, borderStyle: 'dashed', padding: 14, marginBottom: 14 },


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
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 12 },
  infoLabel:   { fontSize: 13, color: C.textMut, fontWeight: '500' },
  infoValue:   { fontSize: 13, color: C.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  descText:    { fontSize: 14, color: C.textSub, lineHeight: 21 },

});