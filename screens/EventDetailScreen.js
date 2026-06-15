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
  StatusBar,
  Animated,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';

// SafeAreaView de react-native-safe-area-context est plus fiable
// que celui de React Native natif — évite le warning de dépréciation
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

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
  textMut:    '#9E9E9E',
  border:     '#E8E8E8',
  overlay:    'rgba(15, 30, 20, 0.52)',
};

// ─────────────────────────────────────────────────────────────────
// LIEN APP STORE / PLAY STORE
// À remplacer par les vrais liens quand l'app sera publiée
// ─────────────────────────────────────────────────────────────────
const STORE_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/app/easevent'
  : 'https://play.google.com/store/apps/details?id=com.easevent';

// ─────────────────────────────────────────────────────────────────
// FONCTION : ouvrir Google Maps
// Même logique que dans HomeScreen — réutilisable
// ─────────────────────────────────────────────────────────────────
const openGoogleMaps = async (address) => {
  if (!address) return;
  const query = encodeURIComponent(address);
  const appUrl = `comgooglemaps://?q=${query}`;
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  try {
    const canOpen = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpen ? appUrl : webUrl);
  } catch {
    await Linking.openURL(webUrl);
  }
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
const InfoRow = ({ icon, label, value, onPress }) => {
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

  // On récupère l'événement passé depuis HomeScreen
  const { event } = route?.params || {};

  // insets : zones non sûres de l'écran (encoche, barre de statut)
  // useSafeAreaInsets() nous donne les valeurs exactes pour chaque bord
  const insets = useSafeAreaInsets();

  const [fullEvent, setFullEvent] = useState(event);
  const [loading, setLoading]   = useState(!event?.description);
  const [error, setError]       = useState(null);

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
      setFullEvent(response.data);
      setError(null);
    } catch (err) {
      console.error("Erreur chargement détail événement:", err);
      // If we already have some data, don't show a hard error
      if (!fullEvent) {
          setError("Impossible de charger l'événement.");
      }
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

  // Fallback si pas d'événement passé
  if (!event) {
    return (
      <View style={styles.errorFull}>
        <Ionicons name="alert-circle-outline" size={48} color={C.textMut} />
        <Text style={styles.errorFullTitle}>Événement introuvable</Text>
        <TouchableOpacity
          style={styles.errorBackBtn}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.errorBackTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleParticipate = async () => {
    // Ouvre le store pour télécharger l'app
    // En production : si l'utilisateur est connecté, on l'amène
    // directement à la page de confirmation RSVP
    try {
      await Linking.openURL(STORE_URL);
    } catch {
      // Fallback si le store n'est pas accessible
      await Linking.openURL('https://easevent.app');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

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
          <Text style={styles.typeBadgeTxt}>{typeLabel(fullEvent.event_type)}</Text>
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
          <Image
            source={{ uri: fullEvent.cover_image }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          {/* Overlay sombre pour lisibilité du texte */}
          <View style={styles.heroOverlay} />

          {/* Texte sur l'image */}
          <View style={[styles.heroContent, { paddingBottom: insets.bottom + 24 }]}>

            {/* Date en badge orange */}
            <View style={styles.heroDateBadge}>
              <Ionicons name="calendar-outline" size={12} color={C.white} />
              <Text style={styles.heroDateTxt}>{fullEvent.date_formatted}</Text>
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
              value={formatDateComplete(fullEvent.start_date)}
            />
            <View style={styles.divider} />

            {/* Horaires */}
            <InfoRow
              icon="time-outline"
              label="Horaires"
              value={`${formatHeure(fullEvent.start_date)} — ${formatHeure(fullEvent.end_date)}`}
            />
            <View style={styles.divider} />

            {/* Lieu — cliquable */}
            <InfoRow
              icon="location-outline"
              label="Lieu"
              value={fullEvent.location_address}
              onPress={() => openGoogleMaps(fullEvent.location_address)}
            />

            {/* Ambiance si renseignée */}
            {fullEvent.ambiance ? (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="color-palette-outline"
                  label="Ambiance"
                  value={fullEvent.ambiance.charAt(0).toUpperCase() + fullEvent.ambiance.slice(1)}
                />
              </>
            ) : null}
          </View>

          {/* ── Description ────────────────────────────────── */}
          {fullEvent.description ? (
            <View style={styles.descCard}>
              <Text style={styles.cardSectionTitle}>À propos</Text>
              <Text style={styles.descText}>{fullEvent.description}</Text>
            </View>
          ) : null}

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

          <View style={{ height: 40 }} />
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

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