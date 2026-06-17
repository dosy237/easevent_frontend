/**
 * DashboardScreen.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Tableau de bord personnel — écran principal après connexion.
 *
 * Cet écran est DIFFÉRENT de HomeScreen (page publique).
 * HomeScreen = vitrine publique pour les visiteurs.
 * DashboardScreen = espace personnel pour les utilisateurs connectés.
 *
 * Ce que l'utilisateur peut faire ici :
 * - Voir ses statistiques (événements créés, invitations, participants)
 * - Voir et répondre à ses invitations reçues
 * - Voir et gérer ses événements créés
 * - Accéder à la découverte publique
 * - Créer un nouvel événement
 * ════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────
// IMPORTS REACT ET REACT NATIVE
// ─────────────────────────────────────────────────────────────────

// React : bibliothèque principale pour créer des composants
// useState  : crée des variables réactives (quand elles changent, l'écran se met à jour)
// useRef    : crée une référence qui persiste entre les rendus sans déclencher de mise à jour
// useEffect : exécute du code après le rendu (chargement initial, animations...)
// useCallback : mémorise une fonction pour éviter de la recréer à chaque rendu
import React, { useState, useRef, useEffect, useCallback } from 'react';

// Composants React Native — les briques de base de l'interface mobile
import {
  View,              // Conteneur de base (comme une <div> en HTML)
  Text,              // Afficher du texte
  StyleSheet,        // Créer des styles optimisés
  ScrollView,        // Zone défilable verticalement
  TouchableOpacity,  // Bouton/zone cliquable avec effet de transparence
  Image,             // Afficher une image depuis une URL ou un fichier local
  StatusBar,         // Contrôler la barre de statut du téléphone (heure, batterie...)
  Animated,          // Créer des animations fluides
  Platform,          // Détecter l'OS (Android ou iOS) pour adapter les styles
  ActivityIndicator, // Spinner de chargement
  RefreshControl,    // Gestion du "pull-to-refresh" (tirer vers le bas pour rafraîchir)
  Alert,             // Afficher une boîte de dialogue native
} from 'react-native';

// SafeAreaView de react-native-safe-area-context (version améliorée)
// Évite que le contenu passe sous l'encoche iPhone ou la barre de statut Android
import { SafeAreaView } from 'react-native-safe-area-context';

// Ionicons : bibliothèque d'icônes vectorielles incluse dans Expo
// Une icône vectorielle ne pixelise jamais — elle s'adapte à toutes les tailles
import { Ionicons } from '@expo/vector-icons';

// useFocusEffect : s'exécute chaque fois que l'écran devient visible
// Contrairement à useEffect qui ne s'exécute qu'au montage,
// useFocusEffect se relance à chaque fois qu'on navigue vers cet écran
import { useFocusEffect } from '@react-navigation/native';

// useAuth : notre hook personnalisé pour accéder aux données d'authentification
// Retourne : user (infos utilisateur), accessToken (JWT), refreshAccessToken (renouveler le token)
import { useAuth } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────────────────────────────

import eventService from '../services/eventService';
// ─────────────────────────────────────────────────────────────────
// PALETTE DE COULEURS — identique aux autres écrans pour la cohérence
// ─────────────────────────────────────────────────────────────────
const C = {
  green:      '#1B6B4A',  // vert émeraude principal
  greenDark:  '#155C3C',  // vert foncé — états pressés
  greenLight: '#E8F5EE',  // vert très clair — fonds de badges
  orange:     '#E76F51',  // orange — badges, bouton Créer
  orangeL:    '#FFF0EB',  // orange très clair — fonds
  white:      '#FFFFFF',
  bg:         '#F7F7F7',  // fond général
  text:       '#1A1A1A',  // texte principal
  textSub:    '#555555',  // texte secondaire
  textMut:    '#9E9E9E',  // texte muet
  border:     '#E8E8E8',  // bordures
};

// ─────────────────────────────────────────────────────────────────
// FONCTION UTILITAIRE : salutation selon l'heure du jour
// new Date().getHours() retourne l'heure actuelle (0-23)
// ─────────────────────────────────────────────────────────────────
const getSalutation = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
};

// ─────────────────────────────────────────────────────────────────
// FONCTION UTILITAIRE : formater une date ISO en texte lisible
// Ex: "2026-06-13T21:00:00+02:00" → "13 Jun 2026"
// ─────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const mois = ['Jan','Fév','Mar','Avr','Mai','Jun',
                  'Jul','Aoû','Sep','Oct','Nov','Déc'];
    const d = new Date(dateStr);
    return `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return ''; }
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : StatCard
// ────────────────────────────────────────────────────────────────
// Petite card affichant une statistique (icône + valeur + label).
// Utilisée dans la bande de statistiques en haut du dashboard.
//
// Props :
// - icon    : nom de l'icône Ionicons (ex: "calendar")
// - value   : valeur à afficher (ex: 3)
// - label   : étiquette sous la valeur (ex: "Événements")
// - color   : couleur de l'icône (défaut: vert)
// - onPress : fonction optionnelle si la card est cliquable
// ════════════════════════════════════════════════════════════════
const StatCard = ({ icon, value, label, color = C.green, onPress }) => (
  <TouchableOpacity
    style={styles.statCard}
    onPress={onPress}
    activeOpacity={onPress ? 0.75 : 1}
  >
    {/* Icône dans un carré arrondi coloré */}
    <View style={[styles.statIconBox, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    {/* Valeur numérique */}
    <Text style={styles.statValue}>{value}</Text>
    {/* Label sous la valeur */}
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

// ════════════════════════════════════════════════════════════════
// COMPOSANT : InvitationCard
// ────────────────────────────────────────────────────────────────
// Card représentant une invitation reçue par l'utilisateur.
// Affiche les infos de l'événement + boutons Accepter/Décliner
// si l'invitation est encore en attente de réponse.
//
// Props :
// - invitation : objet invitation (avec event imbriqué)
// - onRespond  : fonction appelée quand l'utilisateur répond
// - onPress    : navigation vers le détail de l'événement
// ════════════════════════════════════════════════════════════════
const InvitationCard = ({ invitation, onRespond, onPress }) => {
  // L'objet event est imbriqué dans l'invitation
  // grâce au InvitationSerializer qui inclut EventPublicSerializer
  const event = invitation.event;

  // responding : true pendant qu'on attend la réponse du serveur
  // Permet de désactiver les boutons pour éviter les double-clics
  const [responding, setResponding] = useState(false);

  const handleRespond = async (status) => {
    setResponding(true);
    await onRespond(invitation.id, status);
    setResponding(false);
  };

  // Couleurs du badge selon le statut de l'invitation
  const statusStyles = {
    sent:      { bg: C.orangeL,    color: C.orange, label: 'En attente' },
    confirmed: { bg: C.greenLight, color: C.green,  label: 'Confirmé'   },
    declined:  { bg: '#FFF5F5',    color: '#E53E3E', label: 'Décliné'   },
  };
  const s = statusStyles[invitation.status] || statusStyles.sent;

  return (
    <TouchableOpacity
      style={styles.invitCard}
      onPress={() => onPress && onPress(event)}
      activeOpacity={0.92}
    >
      {/* Image de couverture de l'événement */}
      {event?.cover_image ? (
        <Image
          source={{ uri: event.cover_image }}
          style={styles.invitImg}
          resizeMode="cover"
        />
      ) : (
        // Placeholder si pas d'image
        <View style={[styles.invitImg, styles.placeholderImg]}>
          <Ionicons name="calendar-outline" size={28} color={C.textMut} />
        </View>
      )}

      {/* Contenu de la card */}
      <View style={styles.invitBody}>

        {/* Badge statut */}
        <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
          <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
        </View>

        {/* Titre de l'événement */}
        <Text style={styles.invitTitle} numberOfLines={1}>
          {event?.title || 'Événement'}
        </Text>

        {/* Date */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={C.textMut} />
          <Text style={styles.metaTxt}>{event?.date_formatted || ''}</Text>
        </View>

        {/* Lieu */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={C.textMut} />
          <Text style={styles.metaTxt} numberOfLines={1}>
            {event?.location_address || ''}
          </Text>
        </View>

        {/* Boutons répondre — affichés seulement si l'invitation est en attente */}
        {invitation.status === 'sent' && (
          <View style={styles.invitActions}>
            {/* Bouton Décliner */}
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => handleRespond('declined')}
              disabled={responding}
              activeOpacity={0.8}
            >
              <Text style={styles.declineTxt}>Décliner</Text>
            </TouchableOpacity>

            {/* Bouton Accepter */}
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => handleRespond('confirmed')}
              disabled={responding}
              activeOpacity={0.8}
            >
              {responding
                ? <ActivityIndicator size="small" color={C.white} />
                : <Text style={styles.confirmTxt}>Accepter</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : EventCard
// ────────────────────────────────────────────────────────────────
// Card représentant un événement créé par l'utilisateur.
// Affiche l'image, le statut, les stats et les boutons d'action.
//
// Props :
// - event    : objet événement
// - onPress  : naviguer vers le détail / dashboard de l'événement
// - onDelete : supprimer l'événement
// ════════════════════════════════════════════════════════════════
const EventCard = ({ event, onPress, onDelete }) => {

  // Configuration des badges selon le statut de l'événement
  // Chaque statut a une couleur et un label différents
  const statusConfig = {
    draft:     { label: 'Brouillon', color: C.textMut, bg: C.bg },
    published: { label: 'Publié',    color: C.green,   bg: C.greenLight },
    live:      { label: 'En cours',  color: '#D97706', bg: '#FFFBEB' },
    ended:     { label: 'Terminé',   color: C.textMut, bg: C.bg },
    archived:  { label: 'Archivé',   color: C.textMut, bg: C.bg },
  };
  const s = statusConfig[event.status] || statusConfig.draft;

  return (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => onPress && onPress(event)}
      activeOpacity={0.92}
    >
      {/* Zone image */}
      {event.cover_image ? (
        <Image
          source={{ uri: event.cover_image }}
          style={styles.eventImg}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.eventImg, styles.placeholderImg]}>
          <Ionicons name="image-outline" size={32} color={C.textMut} />
        </View>
      )}

      {/* Badge statut en haut à gauche de l'image */}
      <View style={[styles.eventStatusBadge, { backgroundColor: s.bg }]}>
        <Text style={[styles.eventStatusTxt, { color: s.color }]}>{s.label}</Text>
      </View>

      {/* Corps de la card */}
      <View style={styles.eventBody}>
        {/* Titre */}
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>

        {/* Date */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={C.textMut} />
          <Text style={styles.metaTxt}>{event.date_formatted}</Text>
        </View>

        {/* Lieu */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={C.textMut} />
          <Text style={styles.metaTxt} numberOfLines={1}>
            {event.location_address}
          </Text>
        </View>

        {/* Statistiques de l'événement */}
        <View style={styles.eventStats}>
          {/* Nombre d'invités confirmés */}
          <View style={styles.statRow}>
            <Ionicons name="people-outline" size={13} color={C.green} />
            <Text style={styles.statRowTxt}>
              {event.confirmed_count || 0} invité{(event.confirmed_count || 0) > 1 ? 's' : ''}
            </Text>
          </View>
          {/* Nombre de vues */}
          <View style={styles.statRow}>
            <Ionicons name="eye-outline" size={13} color={C.textMut} />
            <Text style={styles.statRowTxt}>{event.view_count || 0} vues</Text>
          </View>
        </View>

        {/* Boutons d'action */}
        <View style={styles.eventActions}>
          {/* Bouton Gérer → ouvre le détail de l'événement */}
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => onPress && onPress(event)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={14} color={C.green} />
            <Text style={styles.manageTxt}>Gérer</Text>
          </TouchableOpacity>

          {/* Bouton Supprimer → alerte de confirmation */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete && onDelete(event)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={14} color={C.orange} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ════════════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL : DashboardScreen
// ────────────────────────────────────────────────────────────────
// Props reçues automatiquement par React Navigation :
// - navigation : objet pour naviguer entre les écrans
// ════════════════════════════════════════════════════════════════
export default function DashboardScreen({ navigation }) {

  // Récupérer les données d'authentification depuis le contexte global
  const { user, accessToken, refreshAccessToken } = useAuth();

  // ── États locaux ──────────────────────────────────────────────
  // invitations : liste des invitations reçues par l'utilisateur
  const [invitations, setInvitations] = useState([]);

  // myEvents : liste des événements créés par l'utilisateur
  const [myEvents,    setMyEvents]    = useState([]);

  // loading : true pendant le premier chargement
  const [loading,     setLoading]     = useState(true);

  // refreshing : true pendant un pull-to-refresh
  const [refreshing,  setRefreshing]  = useState(false);

  // activeTab : onglet actif dans la navigation bas
  const [activeTab,   setActiveTab]   = useState('home');

  // Animation d'entrée — le contenu apparaît en fondu
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── useFocusEffect : s'exécute à chaque fois qu'on revient sur cet écran ──
  // Ceci est différent de useEffect([]) qui ne s'exécute qu'une seule fois.
  // Ici, si l'utilisateur crée un événement puis revient, les données se rechargent.
  useFocusEffect(
    useCallback(() => {
      // Remettre l'onglet "Accueil" actif quand on revient sur cet écran
      setActiveTab('home');
      // Recharger les données
      loadData();
    }, [accessToken])
  );

  // Animation au montage initial
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue:  1,
      duration: 400,
      useNativeDriver: true, // useNativeDriver: true = animation sur le thread natif (plus fluide)
    }).start();
  }, []);

  // ── Charger toutes les données du dashboard ──────────────────
  const loadData = useCallback(async () => {
    try {
      // Promise.all lance les deux requêtes EN PARALLÈLE
      // On fait : invitations ET événements en même temps (deux fois plus rapide)
      const [invitData, eventsData] = await Promise.all([
        eventService.fetchMyInvitations(),
        eventService.fetchMyEvents(),
      ]);

      setInvitations(invitData.invitations || []);
      setMyEvents(eventsData.events || []);

    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
      // NOTE: Le token refresh est potentiellement géré globalement ou via un intercepteur
    } finally {
      // finally s'exécute toujours — on arrête les spinners
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Pull-to-refresh ──────────────────────────────────────────
  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── Répondre à une invitation ────────────────────────────────
  // Quand l'utilisateur accepte ou décline une invitation,
  // on appelle l'API puis on met à jour l'état local
  // sans recharger toute la liste (optimisation UX)
  const handleRespond = async (invitationId, status) => {
    try {
      await eventService.respondToInvitation(invitationId, status);
      // Mettre à jour le statut localement — pas besoin de recharger toute la liste
      setInvitations(prev =>
        prev.map(inv =>
          inv.id === invitationId
            ? { ...inv, status } // copie l'invitation avec le nouveau statut
            : inv                // laisse les autres intactes
        )
      );
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de répondre à cette invitation. Réessayez.');
    }
  };

  // ── Supprimer un événement ───────────────────────────────────
  // Demande confirmation avant de supprimer (irréversible)
  const handleDeleteEvent = (event) => {
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
              // Retirer l'événement de la liste sans recharger
              setMyEvents(prev => prev.filter(e => e.id !== event.id));
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer cet événement.');
            }
          },
        },
      ]
    );
  };

  // ── Créer un événement ───────────────────────────────────────
  // Epic 3 — à implémenter dans le prochain sprint
  const goToCreateEvent = () => {
    navigation?.navigate('CreateEvent');
  };

  // ── Navigations ──────────────────────────────────────────────
const goToEventDetail = (event) => navigation?.navigate('EventDashboard', { event });
const goToDiscover    = ()      => navigation?.getParent()?.navigate('TabDiscover');
const goToProfile     = ()      => navigation?.getParent()?.navigate('TabProfile');

  // Invitations en attente de réponse
  const pendingInvitations = invitations.filter(i => i.status === 'sent');

  // Si pas d'utilisateur connecté, ne rien afficher
  if (!user) return null;

  return (
    <View style={styles.root}>

      {/* StatusBar : barre de statut du téléphone — texte sombre sur fond clair */}
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* SafeAreaView : évite que le contenu passe sous l'encoche ou la barre de statut */}
      <SafeAreaView style={styles.safe}>

        {/* ══ HEADER PERSONNALISÉ ═══════════════════════════════
            Contrairement à HomeScreen qui a un logo,
            ici on affiche une salutation personnalisée avec le prénom.
            ════════════════════════════════════════════════════════ */}
        <View style={styles.header}>
          <View>
            {/* Salutation selon l'heure : "Bonjour", "Bon après-midi", "Bonsoir" */}
            <Text style={styles.salutation}>{getSalutation()},</Text>
            {/* Prénom de l'utilisateur connecté, récupéré depuis le contexte auth */}
            <Text style={styles.userName}>{user.first_name} 👋</Text>
          </View>

          {/* Bouton "Créer" — orange pour se démarquer du reste de l'interface */}
          <TouchableOpacity
            style={styles.createBtn}
            onPress={goToCreateEvent}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={styles.createBtnTxt}>Créer</Text>
          </TouchableOpacity>
        </View>

        {/* ══ SCROLL PRINCIPAL ══════════════════════════════════
            RefreshControl : active le pull-to-refresh.
            keyboardShouldPersistTaps : le clavier reste ouvert si on tape ailleurs.
            ════════════════════════════════════════════════════════ */}
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

          {/* ── Spinner pendant le premier chargement ──────────── */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color={C.green}
              style={{ marginTop: 80 }}
            />
          ) : (

            // Animated.View : enveloppe le contenu dans une animation de fondu
            // opacity: fadeAnim passe de 0 à 1 en 400ms au montage
            <Animated.View style={{ opacity: fadeAnim }}>

              {/* ── BANDE DE STATISTIQUES ──────────────────────────
                  3 statistiques clés affichées horizontalement.
                  Calculées à partir des données chargées depuis l'API.
                  ════════════════════════════════════════════════════ */}
              <View style={styles.statsStrip}>
                {/* Nombre d'événements créés */}
                <StatCard
                  icon="calendar"
                  value={myEvents.length}
                  label="Événements"
                  color={C.green}
                />
                {/* Séparateur vertical */}
                <View style={styles.statsDivider} />

                {/* Nombre d'invitations en attente */}
                <StatCard
                  icon="mail"
                  value={pendingInvitations.length}
                  label="Invitations"
                  color={C.orange}
                />
                <View style={styles.statsDivider} />

                {/* Total des participants sur tous les événements
                    .reduce() : additionne confirmed_count de chaque événement */}
                <StatCard
                  icon="people"
                  value={myEvents.reduce((sum, e) => sum + (e.confirmed_count || 0), 0)}
                  label="Participants"
                  color="#2563EB"
                />
              </View>

              {/* ── SECTION : MES INVITATIONS ──────────────────────
                  Affiche toutes les invitations reçues.
                  Les invitations en attente ont des boutons Accepter/Décliner.
                  ════════════════════════════════════════════════════ */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Mes Invitations</Text>
                  {/* Badge orange si des invitations sont en attente */}
                  {pendingInvitations.length > 0 && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeTxt}>
                        {pendingInvitations.length} en attente
                      </Text>
                    </View>
                  )}
                </View>

                {/* État vide : aucune invitation */}
                {invitations.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="mail-outline" size={36} color={C.textMut} />
                    <Text style={styles.emptyTitle}>Aucune invitation</Text>
                    <Text style={styles.emptySub}>
                      Vos invitations à des événements apparaîtront ici.
                    </Text>
                  </View>
                ) : (
                  // Liste des invitations
                  invitations.map(inv => (
                    <InvitationCard
                      key={inv.id}
                      invitation={inv}
                      onRespond={handleRespond}
                      onPress={goToEventDetail}
                    />
                  ))
                )}
              </View>

              {/* ── SECTION : MES ÉVÉNEMENTS ───────────────────────
                  Affiche les événements créés par l'utilisateur.
                  Si aucun événement, affiche une incitation à créer.
                  ════════════════════════════════════════════════════ */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Mes Événements</Text>
                  <TouchableOpacity onPress={goToCreateEvent}>
                    <Text style={styles.sectionLink}>+ Nouveau</Text>
                  </TouchableOpacity>
                </View>

                {/* État vide : aucun événement créé */}
                {myEvents.length === 0 ? (
                  <TouchableOpacity
                    style={styles.createFirstCard}
                    onPress={goToCreateEvent}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={40} color={C.green} />
                    <Text style={styles.createFirstTitle}>
                      Créez votre premier événement
                    </Text>
                    <Text style={styles.createFirstSub}>
                      Mini-site personnalisé, invitations, analytics — tout en un.
                    </Text>
                    <View style={styles.createFirstBtn}>
                      <Text style={styles.createFirstBtnTxt}>Commencer</Text>
                      <Ionicons name="arrow-forward-outline" size={14} color={C.white} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  // Liste des événements créés
                  myEvents.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onPress={goToEventDetail}
                      onDelete={handleDeleteEvent}
                    />
                  ))
                )}
              </View>

              {/* ── BANNIÈRE : Découvrir des événements ────────────
                  Lien vers HomeScreen (fil public) depuis le dashboard.
                  ════════════════════════════════════════════════════ */}
              <TouchableOpacity
                style={styles.discoverBanner}
                onPress={goToDiscover}
                activeOpacity={0.88}
              >
                <View style={styles.discoverLeft}>
                  <View style={styles.discoverIcon}>
                    <Ionicons name="compass-outline" size={22} color={C.green} />
                  </View>
                  <View>
                    <Text style={styles.discoverTitle}>Découvrir des événements</Text>
                    <Text style={styles.discoverSub}>
                      Explorez les événements publics près de vous
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward-outline" size={18} color={C.green} />
              </TouchableOpacity>

            </Animated.View>
          )}

          {/* Espace en bas pour que le dernier élément ne soit pas caché par la navbar */}
          <View style={{ height: 100 }} />
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// StyleSheet.create valide et optimise les styles au démarrage.
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // Conteneurs racine
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.white },

  // ── Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   16,
    backgroundColor:   C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  salutation: { fontSize: 13, color: C.textMut, fontWeight: '500' },
  userName:   { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  createBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    backgroundColor:  C.orange,
    borderRadius:     12,
    paddingHorizontal:16,
    paddingVertical:  10,
    shadowColor:      C.orange,
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.25,
    shadowRadius:     8,
    elevation:        4,
  },
  createBtnTxt: { color: C.white, fontSize: 14, fontWeight: '800' },

  // ── Scroll
  scroll:    { flex: 1, backgroundColor: C.bg },
  scrollPad: { paddingBottom: 20 },

  // ── Bande de statistiques
  statsStrip: {
    flexDirection:   'row',
    backgroundColor: C.white,
    paddingVertical: 20,
    marginBottom:    16,
    borderTopWidth:  1,
    borderBottomWidth:1,
    borderColor:     C.border,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 6 },
  statIconBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  statValue:    { fontSize: 22, fontWeight: '900', color: C.text },
  statLabel:    { fontSize: 11, color: C.textMut,  fontWeight: '500' },
  statsDivider: { width: 1, backgroundColor: C.border, marginVertical: 8 },

  // ── Sections
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   14,
    marginTop:      8,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  sectionLink:  { fontSize: 14, fontWeight: '700', color: C.green },
  pendingBadge: {
    backgroundColor:  C.orangeL,
    borderRadius:     10,
    paddingHorizontal:10,
    paddingVertical:  3,
    borderWidth:      1,
    borderColor:      C.orange,
  },
  pendingBadgeTxt: { fontSize: 11, color: C.orange, fontWeight: '700' },

  // ── InvitationCard
  invitCard: {
    backgroundColor: C.white,
    borderRadius:    16,
    marginBottom:    12,
    borderWidth:     1,
    borderColor:     C.border,
    flexDirection:   'row',
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    6,
    elevation:       2,
  },
  invitImg:     { width: 100, height: 130 },
  placeholderImg: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  invitBody:    { flex: 1, padding: 12, justifyContent: 'space-between' },
  statusBadge: {
    alignSelf:        'flex-start',
    borderRadius:     6,
    paddingHorizontal:8,
    paddingVertical:  3,
    marginBottom:     6,
  },
  statusTxt:     { fontSize: 10, fontWeight: '700' },
  invitTitle:    { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 4 },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  metaTxt:       { fontSize: 11, color: C.textMut, fontWeight: '500', flex: 1 },
  invitActions:  { flexDirection: 'row', gap: 8, marginTop: 8 },
  declineBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  declineTxt:  { fontSize: 12, color: C.textSub, fontWeight: '600' },
  confirmBtn:  {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    backgroundColor: C.green, alignItems: 'center',
  },
  confirmTxt:  { fontSize: 12, color: C.white, fontWeight: '700' },

  // ── EventCard
  eventCard: {
    backgroundColor: C.white,
    borderRadius:    16,
    marginBottom:    12,
    borderWidth:     1,
    borderColor:     C.border,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    6,
    elevation:       2,
  },
  eventImg: { width: '100%', height: 140 },
  eventStatusBadge: {
    position:         'absolute',
    top:              10,
    left:             10,
    borderRadius:     8,
    paddingHorizontal:10,
    paddingVertical:  4,
  },
  eventStatusTxt: { fontSize: 11, fontWeight: '800' },
  eventBody:      { padding: 14 },
  eventTitle:     { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 6 },
  eventStats: {
    flexDirection: 'row',
    gap:           16,
    marginTop:     8,
    marginBottom:  10,
    paddingTop:    8,
    borderTopWidth:1,
    borderColor:   C.border,
  },
  statRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statRowTxt: { fontSize: 12, color: C.textMut, fontWeight: '500' },
  eventActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manageBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    backgroundColor: C.greenLight,
    borderRadius:    10,
    paddingVertical: 8,
  },
  manageTxt: { fontSize: 13, color: C.green, fontWeight: '700' },
  deleteBtn: {
    width:           36,
    height:          36,
    borderRadius:    10,
    backgroundColor: C.orangeL,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── États vides
  emptyCard: {
    backgroundColor: C.white,
    borderRadius:    16,
    padding:         28,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     C.border,
    borderStyle:     'dashed',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 12, marginBottom: 4 },
  emptySub:   { fontSize: 13, color: C.textMut, textAlign: 'center', lineHeight: 19 },

  // ── Card créer premier événement
  createFirstCard: {
    backgroundColor: C.white,
    borderRadius:    16,
    padding:         28,
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     C.green,
    borderStyle:     'dashed',
  },
  createFirstTitle: {
    fontSize: 17, fontWeight: '800', color: C.text,
    marginTop: 12, marginBottom: 6, textAlign: 'center',
  },
  createFirstSub: {
    fontSize: 13, color: C.textMut,
    textAlign: 'center', lineHeight: 19, marginBottom: 16,
  },
  createFirstBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              8,
    backgroundColor:  C.green,
    borderRadius:     12,
    paddingHorizontal:20,
    paddingVertical:  12,
  },
  createFirstBtnTxt: { color: C.white, fontSize: 14, fontWeight: '800' },

  // ── Bannière Découvrir
  discoverBanner: {
    marginHorizontal: 20,
    marginBottom:     12,
    backgroundColor:  C.white,
    borderRadius:     16,
    padding:          16,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    borderWidth:      1.5,
    borderColor:      C.greenLight,
  },
  discoverLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  discoverIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.greenLight,
    alignItems: 'center', justifyContent: 'center',
  },
  discoverTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  discoverSub:   { fontSize: 12, color: C.textMut, marginTop: 2 },

  
});