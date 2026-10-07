/**
 * EventDetailScreen.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Page de détail d'un événement public.
 *
 * Comment les données arrivent ici ?
 * ────────────────────────────────────
 * Quand l'utilisateur clique sur une card dans HomeScreen,
 * on appelle navigation.navigate('EventDetail', { event }).
 * React Navigation passe l'objet event dans route.params.
 * On le récupère ici avec : const { event } = route.params
 *
 * Pas besoin d'un appel API supplémentaire — les données sont
 * déjà là. Si demain on veut afficher plus d'infos (commentaires,
 * photos uploadées par les invités...), on fera un appel API
 * supplémentaire avec event.id.
 *
 * Fonctionnalités :
 * - Affichage complet des infos de l'événement
 * - Lieu cliquable → Google Maps
 * - Bouton "Participer" → téléchargement de l'app
 * - Bouton retour avec animation
 * ════════════════════════════════════════════════════════════════
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Pressable,
  StatusBar,
  Animated,
  Platform,
  Linking,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';

// SafeAreaView de react-native-safe-area-context est plus fiable
// que celui de React Native natif — évite le warning de dépréciation
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import ticketService from '../services/ticketService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';
import { seedLikes } from '../utils/likes';
import { eventTime } from '../utils/timezone';
import EventMap, { openInMaps } from '../components/maps/EventMap';
import LikeButton from '../components/events/LikeButton';
import ShareSheet from '../components/events/ShareSheet';
import Price from '../components/ui/Price';
import EventVideo from '../components/events/EventVideo';
import { formatPrice } from '../utils/format';
import { useTicketBadge } from '../context/TicketBadgeContext';
import { isRsvpCancel } from '../utils/rsvp';
import SafeImage from '../components/ui/SafeImage';
import ImageViewer from '../components/ui/ImageViewer';
import { Bone, SkeletonGroup } from '../components/ui/Skeleton';
import { passWord } from '../utils/wording';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────
// PALETTE — même que HomeScreen pour la cohérence visuelle
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
  textMut:    '#757575',
  border:     '#E8E8E8',
  overlay:    'rgba(15, 30, 20, 0.52)',
};

// ─────────────────────────────────────────────────────────────────
// LIEN APP STORE / PLAY STORE
// À remplacer par les vrais liens quand l'app sera publiée
// ─────────────────────────────────────────────────────────────────
const STORE_URL = 'https://play.google.com/store/apps/details?id=com.eranis.easevent';

// ─────────────────────────────────────────────────────────────────
// FONCTION : ouvrir Google Maps
// Même logique que dans HomeScreen — réutilisable
// ─────────────────────────────────────────────────────────────────
// Le lien https Google Maps ouvre l'application Maps quand elle est installée
// (Android et iOS), sinon le navigateur — et fonctionne aussi sur le web.
const openGoogleMaps = (address) => {
  if (!address) return;
  openInMaps(null, address);
};

// ─────────────────────────────────────────────────────────────────
// FONCTION : formater une date complète
// Transforme "2026-06-13T21:00:00+02:00" en "Samedi 13 juin 2026"
// ─────────────────────────────────────────────────────────────────
const formatDateComplete = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day:     'numeric',
      month:   'long',
      year:    'numeric',
    });
  } catch { return ''; }
};

// ─────────────────────────────────────────────────────────────────
// FONCTION : formater une heure
// Transforme "2026-06-13T21:00:00+02:00" en "21h00"
// ─────────────────────────────────────────────────────────────────
const formatHeure = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour:   '2-digit',
      minute: '2-digit',
    }).replace(':', 'h');
  } catch { return ''; }
};

// ─────────────────────────────────────────────────────────────────
// FONCTION : libellé du type d'événement en français
// ─────────────────────────────────────────────────────────────────
const typeLabel = (type) => {
  const labels = {
    conference:   'Conférence',
    mariage:      'Mariage',
    soiree:       'Soirée',
    anniversaire: 'Anniversaire',
    concert:      'Concert',
    autre:        'Événement',
  };
  return labels[type] || 'Événement';
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : InfoRow
// Ligne d'information avec icône + label + valeur.
// Utilisé pour les infos clés : date, heure, ambiance, participants.
//
// Props :
// - icon    : nom d'icône Ionicons
// - label   : étiquette de la ligne (ex: "Date")
// - value   : valeur affichée (ex: "Samedi 13 juin 2026")
// - onPress : optionnel — rend la ligne cliquable
// ════════════════════════════════════════════════════════════════
const InfoRow = ({ icon, label, value, onPress, extra }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={styles.infoRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Icône dans un carré arrondi vert clair */}
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={17} color={C.green} />
      </View>

      {/* Textes */}
      <View style={styles.infoTextBox}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={onPress ? 1 : 3}>
          {value}
        </Text>
        {extra}
      </View>

      {/* Flèche si cliquable */}
      {onPress && (
        <Ionicons name="chevron-forward-outline" size={16} color={C.textMut} />
      )}
    </Wrapper>
  );
};

// ════════════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL : EventDetailScreen
//
// Props reçues de React Navigation :
// - route      : contient route.params.event — l'objet événement
//               passé depuis HomeScreen
// - navigation : pour naviguer (goBack, navigate...)
// ════════════════════════════════════════════════════════════════
export default function EventDetailScreen({ route, navigation }) {

  // Événement passé depuis une liste, ou seulement son identifiant (lien partagé, notification)
  const params = route?.params || {};
  const event = params.event || (params.id ? { id: params.id } : null);

  // insets : zones non sûres de l'écran (encoche, barre de statut)
  // useSafeAreaInsets() nous donne les valeurs exactes pour chaque bord
  const insets = useSafeAreaInsets();

  const { isAuthenticated, user } = useAuth();
  const { refresh: refreshBadge } = useTicketBadge();
  const [ticketBusy, setTicketBusy] = useState(false);
  const [fullEvent, setFullEvent] = useState(event);
  const [loading, setLoading]   = useState(!event?.description);
  const [error, setError]       = useState(null);
  const [viewer, setViewer]     = useState(null);     // photo affichée en plein écran
  const [sharing, setSharing]   = useState(false);    // feuille de partage
  const [chooser, setChooser]   = useState(false);    // « Pour moi » ou « Pour un proche »

  // « Je participe » touché dans le mini-site : même parcours que le bouton de cette page
  const participateRef = useRef(null);
  const participateToken = params.participate;
  useEffect(() => {
    if (!participateToken || !fullEvent?.title || loading || !participateRef.current) return;
    navigation.setParams({ participate: undefined });
    participateRef.current();
  }, [participateToken, fullEvent?.title, loading]);

  // Animations d'entrée du contenu
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // scrollY : suit la position verticale du scroll.
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation d'entrée parallèle : fade + slide depuis le bas
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 380, useNativeDriver: true,
      }),
    ]).start();

    // Si on n'a que des données partielles (ex: depuis la liste), on recharge tout
    if (event?.id) {
       loadEventDetail(event.id);
    }
  }, [event?.id]);

  const loadEventDetail = async (id) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/events/publics/${id}/`);
      seedLikes([response.data]);
      setFullEvent(response.data);
      setError(null);
    } catch (err) {
      const code = err.response?.status;
      // L'organisateur qui ouvre son brouillon : écran de gestion
      if (code === 404 && isAuthenticated) {
        try {
          const own = await apiClient.get(`/api/events/${id}/detail/`);
          navigation.replace('EventDashboard', { event: own.data.event });
          return;
        } catch { /* pas son événement */ }
      }
      setError(code === 403 ? 'private' : code === 404 ? 'missing' : 'network');
    } finally {
      setLoading(false);
    }
  };

  // Opacité du fond du header selon le scroll
  // Entre 0 et 80px de scroll → opacité passe de 0 à 1
  const headerBgOpacity = scrollY.interpolate({
    inputRange:  [0, 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
    // clamp = ne dépasse pas les bornes (reste entre 0 et 1)
  });

  // Couleur du bouton retour selon le scroll
  // Au départ blanc (sur image sombre), devient vert au scroll
  const backBtnBg = scrollY.interpolate({
    inputRange:  [0, 80],
    outputRange: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.95)'],
    extrapolate: 'clamp',
  });

  const goBack = () => (navigation.canGoBack() ? navigation.goBack()
    : navigation.navigate(isAuthenticated ? 'TabDiscover' : 'Home'));

  // Pas d'événement, ou chargement impossible sans données à afficher
  if (!event || (error && !fullEvent?.title)) {
    const texts = {
      private: ['Événement privé', "Seules les personnes invitées peuvent voir cet événement. Si vous avez reçu une invitation, connectez-vous avec le compte invité."],
      missing: ['Événement introuvable', "Cet événement n'existe plus ou a été annulé par son organisateur."],
      network: ['Connexion impossible', 'Vérifiez votre connexion internet puis réessayez.'],
    };
    const [title, sub] = texts[error] || texts.missing;
    return (
      <View style={styles.errorFull}>
        <Ionicons name={error === 'private' ? 'lock-closed-outline' : error === 'network' ? 'wifi-outline' : 'alert-circle-outline'} size={48} color={C.textMut} />
        <Text style={styles.errorFullTitle} accessibilityRole="header">{title}</Text>
        <Text style={{ fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20, maxWidth: 360 }}>{sub}</Text>
        {error === 'network' && event?.id ? (
          <TouchableOpacity style={styles.errorBackBtn} onPress={() => { setError(null); loadEventDetail(event.id); }} accessibilityRole="button">
            <Text style={styles.errorBackTxt}>Réessayer</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.errorBackBtn} onPress={goBack} accessibilityRole="button">
          <Text style={styles.errorBackTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Ouvert depuis un lien ou une notification : squelette le temps du chargement
  if (!fullEvent?.title) {
    return (
      <View style={[styles.root, { backgroundColor: C.white }]}>
        <SkeletonGroup label="Chargement de l'événement">
          <Bone height={320} radius={0} />
          <View style={{ padding: 20, gap: 12 }}>
            <Bone width="70%" height={24} />
            <Bone width="45%" height={16} />
            <Bone height={140} radius={18} />
            <Bone height={90} radius={18} />
          </View>
        </SkeletonGroup>
      </View>
    );
  }

  // ── M24 : bouton du bas selon l'état du ticket de l'utilisateur ──
  const isPaid    = !!fullEvent.is_paid && Number(fullEvent.price) > 0;
  const priceTxt  = isPaid ? formatPrice(fullEvent.price, fullEvent.currency) : 'Gratuit';
  const myTicket  = fullEvent.my_ticket;
  const isOrganizer = !!user && fullEvent.organizer?.id === user.id;
  const soldOut   = fullEvent.spots_left === 0 && !myTicket;
  const pw        = passWord(fullEvent);

  const openTicket = (ticketId) => navigation.navigate('TabTickets', {
    screen: 'Tickets', params: { tab: 'generated', openTicketId: ticketId },
  });

  // « Payer pour un proche » : événements publics publiés, à venir, non complets
  const giftable = isAuthenticated && !isOrganizer && fullEvent.visibility === 'public' && !soldOut
    && (!fullEvent.status || fullEvent.status === 'published') && (!fullEvent.end_date || new Date(fullEvent.end_date) > new Date());
  const openGift = () => { setChooser(false); navigation.navigate('Gift', { event: fullEvent }); };

  const ticketAction = async (forMe = false) => {
    // Première participation : pour soi, ou pour un proche ?
    if (!forMe && giftable && !myTicket) { setChooser(true); return; }
    setChooser(false);
    if (isOrganizer) {
      navigation.navigate('TabDashboard', { screen: 'EventDashboard', initial: false, params: { event: fullEvent } });
      return;
    }
    if (myTicket?.status === 'generated') { openTicket(myTicket.id); return; }
    setTicketBusy(true);
    try {
      if (myTicket?.status === 'pending') {
        if (isPaid) navigation.navigate('TicketCheckout', { ticketId: myTicket.id });
        else openTicket((await ticketService.validate(myTicket.id)).id);
        return;
      }
      const ticket = await ticketService.take(fullEvent.id);
      refreshBadge({ force: true });
      if (ticket.status === 'generated') openTicket(ticket.id);
      else navigation.navigate('TicketCheckout', { ticketId: ticket.id });
    } catch (err) {
      if (isRsvpCancel(err)) return;
      showAlert('Impossible de continuer', apiErrorMessage(err));
    } finally {
      setTicketBusy(false);
      loadEventDetail(fullEvent.id);
    }
  };

  const ticketLabel = isOrganizer ? 'Gérer mon événement'
    : myTicket?.status === 'generated' ? `Voir ${pw.my}`
    : myTicket?.status === 'pending' ? `Finaliser ${pw.my}`
    : soldOut ? 'Complet'
    : isPaid ? `Payer et recevoir ${pw.my}`
    : pw.kind === 'invitation' ? 'Je participe' : 'Participer — billet gratuit';

  participateRef.current = () => (isAuthenticated ? ticketAction() : handleParticipate());

  const contactOrganizer = () => navigation.navigate('Chat', {
    eventId: fullEvent.id, organizerName: fullEvent.organizer?.name,
  });

  const handleParticipate = async () => {
    // Ouvre le store pour télécharger l'app
    // En production : si l'utilisateur est connecté, on l'amène
    // directement à la page de confirmation RSVP
    // Dans l'application : se connecter pour participer ; sur le site : télécharger l'application
    if (Platform.OS !== 'web') {
      navigation.navigate('Login', { mode: 'register' });
      return;
    }
    Linking.openURL(STORE_URL).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageViewer uri={viewer} onClose={() => setViewer(null)} />
      {fullEvent?.share_url ? (
        <ShareSheet event={fullEvent} visible={sharing} onClose={() => setSharing(false)} isAuthenticated={isAuthenticated}
          onAddFriends={() => navigation.navigate('TabProfile', { screen: 'Friends', initial: false, params: { tab: 'add' } })}
          onSent={(res) => showAlert('Partagé', res.message || 'Envoyé.')} />
      ) : null}

      {/* ══ HEADER FLOTTANT ═══════════════════════════════════
          Position absolute — flotte au-dessus du scroll.
          Devient opaque quand on fait défiler vers le bas.
          ══════════════════════════════════════════════════════ */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 8 }]}>

        {/* Fond blanc animé — apparaît au scroll */}
        <Animated.View
          style={[styles.floatingHeaderBg, { opacity: headerBgOpacity }]}
        />

        {/* Bouton retour */}
        <Animated.View style={[styles.backBtnWrap, { backgroundColor: backBtnBg }]}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back-outline" size={22} color={C.white} />
          </TouchableOpacity>
        </Animated.View>

        {/* Badge type d'événement */}
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeTxt}>{fullEvent.event_type_display || typeLabel(fullEvent.event_type)}</Text>
        </View>
      </View>

      {/* ══ SCROLL PRINCIPAL ════════════════════════════════════
          onScroll : met à jour scrollY à chaque frame de scroll.
          scrollEventThrottle={16} = 60fps (1000ms / 60 ≈ 16ms)
          ══════════════════════════════════════════════════════ */}
      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* ── IMAGE HERO ──────────────────────────────────── */}
        <View style={styles.heroBox}>
          <Pressable onPress={() => fullEvent.cover_image && setViewer(fullEvent.cover_image)} style={StyleSheet.absoluteFill}
            accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo de l'événement">
            <SafeImage uri={fullEvent.cover_image} style={styles.heroImage} icon="calendar-outline" iconSize={56} />
          </Pressable>

          {/* Overlay sombre pour lisibilité du texte */}
          <View style={styles.heroOverlay} pointerEvents="none" />

          {/* Texte sur l'image */}
          <View style={[styles.heroContent, { paddingBottom: insets.bottom + 24 }]}>

            {/* Date en badge orange */}
            <View style={styles.heroBadges}>
              <View style={styles.heroDateBadge}>
                <Ionicons name="calendar-outline" size={12} color={C.white} />
                <Text style={styles.heroDateTxt}>{fullEvent.date_formatted}</Text>
              </View>
              <View style={styles.heroPriceBadge}>
                <Ionicons name="ticket-outline" size={12} color={C.green} />
                <Text style={styles.heroPriceTxt}>{priceTxt}</Text>
              </View>
            </View>

            {/* Titre principal */}
            <Text style={styles.heroTitle}>{fullEvent.title}</Text>

            {/* Lieu cliquable */}
            <TouchableOpacity
              style={styles.heroLocation}
              onPress={() => openGoogleMaps(fullEvent.location_address)}
              activeOpacity={0.75}
            >
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.heroLocationTxt} numberOfLines={1}>
                {fullEvent.location_address}
              </Text>
              <Ionicons name="open-outline" size={12} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            {/* Stats rapides */}
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Ionicons name="eye-outline" size={13} color="rgba(255,255,255,0.75)" />
                <Text style={styles.heroStatTxt}>{fullEvent.view_count} vues</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.75)" />
                <Text style={styles.heroStatTxt}>
                  {fullEvent.confirmed_count} confirmé{fullEvent.confirmed_count > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* J'aime et partage (événements publics publiés) */}
            {fullEvent.share_url ? (
              <View style={styles.heroEngage}>
                <LikeButton event={fullEvent} light isAuthenticated={isAuthenticated}
                  onRequireLogin={() => navigation.navigate('Login', { mode: 'login' })} />
                <Pressable onPress={() => setSharing(true)} style={styles.heroShare} accessibilityRole="button"
                  accessibilityLabel={`Partager « ${fullEvent.title} »`}>
                  <Ionicons name="paper-plane-outline" size={18} color={C.white} />
                  <Text style={styles.heroShareTxt}>Partager</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── CONTENU ─────────────────────────────────────── */}
        <Animated.View style={[
          styles.contentBox,
          {
            opacity:   fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}>

          {/* ── Informations clés ──────────────────────────── */}
          <View style={styles.infoCard}>
            <Text style={styles.cardSectionTitle}>Informations</Text>

            {/* Date complète */}
            <InfoRow
              icon="calendar-outline"
              label="Date"
              value={(() => { const t = eventTime(fullEvent.start_date, fullEvent.timezone); return t ? t.date.charAt(0).toUpperCase() + t.date.slice(1) : formatDateComplete(fullEvent.start_date); })()}
            />
            <View style={styles.divider} />

            {/* Horaires */}
            <InfoRow
              icon="time-outline"
              label="Horaires"
              value={(() => {
                const a = eventTime(fullEvent.start_date, fullEvent.timezone);
                const b = eventTime(fullEvent.end_date, fullEvent.timezone);
                if (!a) return `${formatHeure(fullEvent.start_date)} — ${formatHeure(fullEvent.end_date)}`;
                // « 12h00 — 18h00 (heure de Paris) · 11h00 chez vous »
                return `${a.time}${b ? ` — ${b.time}` : ''}${a.zone ? ` (${a.zone})` : ''}${a.local ? `\n${a.local}` : ''}`;
              })()}
            />
            <View style={styles.divider} />

            {/* Lieu : carte détaillée juste en dessous */}
            <InfoRow
              icon={fullEvent.is_online ? 'videocam-outline' : 'location-outline'}
              label="Lieu"
              value={fullEvent.is_online ? (fullEvent.online_link ? 'En ligne · rejoindre' : `En ligne (lien donné avec ${pw.the})`) : fullEvent.location_address}
              onPress={fullEvent.is_online
                ? (fullEvent.online_link ? () => Linking.openURL(fullEvent.online_link).catch(() => {}) : undefined)
                : () => openInMaps(fullEvent.map, fullEvent.location_address)}
            />

            {/* Prix du ticket + places restantes (M24) */}
            <View style={styles.divider} />
            <InfoRow
              icon="ticket-outline"
              label={`Prix ${pw.kind === 'invitation' ? "de l'invitation" : 'du billet'}`}
              extra={isPaid ? <Price amount={fullEvent.price} currency={fullEvent.currency || 'EUR'} text={null} /> : null}
              value={`${isPaid ? priceTxt : '0,00 € · gratuit'}${fullEvent.spots_left != null ? ` · ${fullEvent.spots_left} place${fullEvent.spots_left > 1 ? 's' : ''} restante${fullEvent.spots_left > 1 ? 's' : ''}` : ''}`}
            />
            {giftable ? (
              <>
                <View style={styles.divider} />
                <InfoRow icon="gift-outline" label="Faire plaisir" value={`Offrir ${pw.a} à un proche`} onPress={openGift} />
              </>
            ) : null}
            {fullEvent.dress_code ? (
              <>
                <View style={styles.divider} />
                <InfoRow icon="shirt-outline" label="Dress code" value={fullEvent.dress_code} />
              </>
            ) : null}

            {/* Ambiance si renseignée */}
            {fullEvent.ambiance ? (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="color-palette-outline"
                  label="Ambiance"
                  value={fullEvent.ambiance === 'autre' && fullEvent.ambiance_label
                    ? fullEvent.ambiance_label
                    : fullEvent.ambiance.charAt(0).toUpperCase() + fullEvent.ambiance.slice(1)}
                />
              </>
            ) : null}
          </View>

          {/* ── Mini-site de l'événement (dans l'application) ─── */}
          {fullEvent.has_minisite ? (
            <Pressable style={styles.minisiteBtn} onPress={() => navigation.navigate('MiniSiteView', { eventId: fullEvent.id })}
              accessibilityRole="button" accessibilityLabel="Voir le mini-site de l'événement">
              <View style={styles.minisiteIcon}><Ionicons name="sparkles" size={20} color={C.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.minisiteTitle}>Voir le mini-site</Text>
                <Text style={styles.minisiteSub}>Toutes les infos de l'événement, mises en page par l'organisateur</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.green} />
            </Pressable>
          ) : null}

          {/* ── Vidéo de présentation (entière, légende dessous) ── */}
          {fullEvent.video ? (
            <View style={styles.descCard}>
              <Text style={styles.cardSectionTitle}>En vidéo</Text>
              <EventVideo video={fullEvent.video} />
            </View>
          ) : null}

          {/* ── Lieu sur la carte + itinéraire ─────────────── */}
          {!fullEvent.is_online && fullEvent.location_address ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.cardSectionTitle}>Comment y aller</Text>
              <EventMap map={fullEvent.map} address={fullEvent.location_address} />
            </View>
          ) : null}

          {/* ── Galerie : photos en plein écran au toucher ─────── */}
          {fullEvent.gallery?.length ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.cardSectionTitle}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {fullEvent.gallery.map((uri, i) => (
                  <Pressable key={uri} onPress={() => setViewer(uri)} accessibilityRole="imagebutton"
                    accessibilityLabel={`Photo ${i + 1} sur ${fullEvent.gallery.length}, agrandir`}>
                    <SafeImage uri={uri} style={styles.galleryImg} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* ── Description ────────────────────────────────── */}
          {fullEvent.description ? (
            <View style={styles.descCard}>
              <Text style={styles.cardSectionTitle}>À propos</Text>
              <Text style={styles.descText}>{fullEvent.description}</Text>
            </View>
          ) : null}

          {/* ── Organisateur (connecté) ─────────────────────── */}
          {isAuthenticated && fullEvent.organizer ? (
            <View style={styles.orgCard}>
              <View style={styles.orgAvatar}>
                <Text style={styles.orgAvatarTxt}>
                  {(fullEvent.organizer.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orgLabel}>Organisé par</Text>
                <Text style={styles.orgName} numberOfLines={1}>{fullEvent.organizer.name}</Text>
              </View>
              {!isOrganizer && (
                <TouchableOpacity style={styles.orgContact} onPress={contactOrganizer} accessibilityRole="button"
                  accessibilityLabel={`Contacter ${fullEvent.organizer.name}`}>
                  <Ionicons name="chatbubble-outline" size={15} color={C.text} />
                  <Text style={styles.orgContactTxt}>Contacter</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {!isAuthenticated && (<>
          {/* ── Bannière participation ──────────────────────── */}
          <View style={styles.participateBanner}>
            <View style={styles.participateBannerLeft}>
              <Text style={styles.participateBannerTitle}>
                Participer à cet événement
              </Text>
              <Text style={styles.participateBannerSub}>
                Télécharge l'application Easevent pour confirmer ta présence,
                recevoir les mises à jour et rejoindre la communauté.
              </Text>
            </View>
            {/* Icône ticket */}
            <View style={styles.participateIconBox}>
              <Ionicons name="ticket-outline" size={28} color={C.green} />
            </View>
          </View>

          {/* ── Bouton CTA principal ────────────────────────── */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleParticipate}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={18} color={C.white} />
            <Text style={styles.ctaBtnTxt}>Télécharger Easevent</Text>
          </TouchableOpacity>

          {/* ── Boutons stores ──────────────────────────────── */}
          <View style={styles.storesRow}>

            {/* App Store */}
            <TouchableOpacity
              style={styles.storeBtn}
              onPress={() => Linking.openURL('https://apps.apple.com/app/easevent')}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-apple" size={22} color={C.text} />
              <View>
                <Text style={styles.storeSmall}>Disponible sur</Text>
                <Text style={styles.storeName}>App Store</Text>
              </View>
            </TouchableOpacity>

            {/* Google Play */}
            <TouchableOpacity
              style={styles.storeBtn}
              onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.easevent')}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google-playstore" size={22} color={C.text} />
              <View>
                <Text style={styles.storeSmall}>Disponible sur</Text>
                <Text style={styles.storeName}>Google Play</Text>
              </View>
            </TouchableOpacity>
          </View>
          </>)}

          <View style={{ height: isAuthenticated ? 130 : 40 }} />
        </Animated.View>
      </Animated.ScrollView>

      {/* ══ Pour moi / pour un proche ══════════════════════════ */}
      <Modal visible={chooser} transparent animationType="slide" onRequestClose={() => setChooser(false)} statusBarTranslucent>
        <Pressable style={styles.chooserBackdrop} onPress={() => setChooser(false)} accessibilityRole="button" accessibilityLabel="Fermer" />
        <View style={styles.chooser} accessibilityViewIsModal>
          <View style={styles.chooserHandle} />
          <Text style={styles.chooserTitle} accessibilityRole="header">{`${isPaid ? 'Payer' : 'Réserver'} pour qui ?`}</Text>
          {[
            ['person-outline', 'Pour moi', `${pw.My} à mon nom`, () => ticketAction(true)],
            ['gift-outline', 'Pour un proche', 'Un ami, un membre, ou quelqu’un à inviter', openGift],
          ].map(([icon, label, sub, onPress]) => (
            <Pressable key={label} onPress={onPress} style={styles.chooserRow} accessibilityRole="button" accessibilityLabel={`${label} : ${sub}`}>
              <View style={styles.chooserIcon}><Ionicons name={icon} size={22} color={C.green} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chooserLabel}>{label}</Text>
                <Text style={styles.chooserSub}>{sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textMut} />
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* ══ BARRE FIXE (connecté, M24) ══════════════════════════ */}
      {isAuthenticated && (
        <View style={[styles.ticketBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View>
            <Text style={styles.ticketBarLabel}>{pw.One}</Text>
            <Text style={styles.ticketBarPrice}>{isPaid ? priceTxt : '0,00 €'}</Text>
            {isPaid ? <Price amount={fullEvent.price} currency={fullEvent.currency || 'EUR'} text={null} compact /> : null}
          </View>
          <TouchableOpacity
            style={[styles.ticketBarBtn, soldOut && !isOrganizer && styles.ticketBarBtnOff]}
            onPress={() => ticketAction()}
            disabled={ticketBusy || (soldOut && !isOrganizer)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: soldOut && !isOrganizer, busy: ticketBusy }} aria-disabled={soldOut && !isOrganizer} aria-busy={ticketBusy}
          >
            {ticketBusy ? <ActivityIndicator color={C.white} /> : (
              <>
                <Ionicons name={myTicket?.status === 'generated' ? 'qr-code-outline' : 'ticket-outline'} size={18} color={C.white} />
                <Text style={styles.ticketBarBtnTxt}>{ticketLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  chooserBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  chooser: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 34, gap: 10, maxWidth: 560, alignSelf: 'center', width: '100%' },
  chooserHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 6 },
  chooserTitle: { fontSize: 19, fontWeight: '900', color: C.text, marginBottom: 6 },
  chooserRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, minHeight: 64 },
  chooserIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  chooserLabel: { fontSize: 16, fontWeight: '800', color: C.text },
  chooserSub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  galleryImg: { width: 150, height: 110, borderRadius: 14, backgroundColor: '#EEE' },
  // ── M24 : badges, organisateur, barre fixe
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroPriceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10,
  },
  heroPriceTxt: { fontSize: 12, fontWeight: '800', color: C.green },
  orgCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: C.border, marginBottom: 14,
  },
  orgAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  orgAvatarTxt: { color: C.white, fontSize: 15, fontWeight: '800' },
  orgLabel: { fontSize: 11, color: C.textMut, fontWeight: '600' },
  orgName: { fontSize: 14, fontWeight: '700', color: C.text },
  orgContact: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
  },
  orgContactTxt: { fontSize: 13, fontWeight: '700', color: C.text },
  ticketBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 20, paddingTop: 14,
  },
  ticketBarLabel: { fontSize: 12, color: C.textMut, fontWeight: '600' },
  ticketBarPrice: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  ticketBarBtn: {
    flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.green, borderRadius: 16, paddingHorizontal: 12,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  ticketBarBtnOff: { backgroundColor: '#8DB5A3', shadowOpacity: 0, elevation: 0 },
  ticketBarBtnTxt: { color: C.white, fontSize: 15, fontWeight: '800' },

  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  // ── Header flottant
  floatingHeader: {
    position:   'absolute',
    top:        0, left: 0, right: 0,
    zIndex:     100,
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent:'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  floatingHeaderBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtnWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  typeBadge: {
    backgroundColor: C.orange,
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  typeBadgeTxt: { color: C.white, fontSize: 12, fontWeight: '800' },

  // ── Hero
  heroBox: {
    height: H * 0.50,
    position: 'relative',
  },
  heroImage:   { width: '100%', height: '100%' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0, left: 20, right: 20,
  },
  heroDateBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap: 5,
    alignSelf:      'flex-start',
    backgroundColor:'rgba(255,255,255,0.15)',
    borderRadius:   10,
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.3)',
    paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 10,
  },
  heroDateTxt: { color: C.white, fontSize: 12, fontWeight: '600' },

  heroTitle: {
    fontSize: 24, fontWeight: '900',
    color: C.white, letterSpacing: -0.5,
    lineHeight: 30, marginBottom: 10,
  },
  heroLocation: {
    flexDirection: 'row', alignItems: 'center',
    gap: 5, marginBottom: 12,
  },
  heroLocationTxt: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13, fontWeight: '500', flex: 1,
  },
  heroStats:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroStat:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroStatTxt:     { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
  heroStatDivider: {
    width: 1, height: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // ── Contenu principal
  contentBox: {
    backgroundColor: C.bg,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 24,
    paddingHorizontal: 20,
  },

  // ── Titre de section
  cardSectionTitle: {
    fontSize: 16, fontWeight: '800',
    color: C.text, marginBottom: 14,
    letterSpacing: -0.2,
  },

  // ── Card infos
  infoCard: {
    backgroundColor: C.white,
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 12,
  },
  infoIconBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: C.greenLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  infoTextBox: { flex: 1 },
  infoLabel:   { fontSize: 11, color: C.textMut, fontWeight: '600', marginBottom: 2 },
  infoValue:   { fontSize: 14, color: C.text, fontWeight: '600', lineHeight: 20 },
  divider: {
    height: 1, backgroundColor: C.border,
    marginVertical: 12, marginLeft: 50,
  },

  // ── Card description
  heroEngage: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  heroShare: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.32)' },
  heroShareTxt: { color: C.white, fontWeight: '700', fontSize: 14 },
  minisiteBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.greenLight, borderRadius: 16, padding: 14, marginBottom: 14 },
  minisiteIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  minisiteTitle: { fontSize: 16, fontWeight: '800', color: C.green },
  minisiteSub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  descCard: {
    backgroundColor: C.white,
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8,
    elevation: 2,
  },
  descText: {
    fontSize: 14.5, color: C.textSub,
    lineHeight: 23, textAlign: 'justify',
  },

  // ── Bannière participation
  participateBanner: {
    backgroundColor: C.greenLight,
    borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center',
    gap: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#C5E8D3',
  },
  participateBannerLeft:  { flex: 1 },
  participateBannerTitle: {
    fontSize: 15, fontWeight: '800',
    color: C.greenDark, marginBottom: 5,
  },
  participateBannerSub: {
    fontSize: 12.5, color: C.green,
    lineHeight: 18,
  },
  participateIconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#C5E8D3',
  },

  // ── Bouton CTA
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    backgroundColor: C.orange,
    borderRadius: 16, paddingVertical: 16,
    marginBottom: 12,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14,
    elevation: 6,
  },
  ctaBtnTxt: {
    color: C.white, fontSize: 16,
    fontWeight: '800', letterSpacing: 0.2,
  },

  // ── Boutons stores
  storesRow: { flexDirection: 'row', gap: 12 },
  storeBtn: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', gap: 10,
    backgroundColor: C.white,
    borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: C.border,
  },
  storeSmall: { fontSize: 10, color: C.textMut, fontWeight: '500' },
  storeName:  { fontSize: 14, color: C.text, fontWeight: '700' },

  // ── Erreur fullscreen
  errorFull: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, gap: 12,
  },
  errorFullTitle: { fontSize: 17, fontWeight: '700', color: C.textSub },
  errorBackBtn: {
    backgroundColor: C.green, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  errorBackTxt: { color: C.white, fontSize: 15, fontWeight: '700' },
});