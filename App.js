/**
 * App.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Point d'entrée de l'application.
 *
 * ARCHITECTURE DE NAVIGATION (EASEVENT_PARCOURS_MVP.md §2) :
 * ─────────────────────────────────────────────────────────────
 * VISITEUR (non connecté) — PublicNavigator
 * ├── Home (E01) · EventDetail (E02) · Login (E03–E06, M01)
 * ├── ForgotPassword (M04) · ResetPassword (lien email)
 * ├── VerifyEmail (M03) · PrivacyPolicy (M02)
 * └── InvitationLanding (M31, lien easevent://i/:token)
 *
 * UTILISATEUR CONNECTÉ — AppTabNavigator
 * ├── Accueil   → DashboardStack (E07, création, mini-site, gestion, invités, messagerie, notifications)
 * ├── Découvrir → DiscoverStack (E01 connecté, E02/M24)
 * ├── Créer     → CreateEventScreen
 * ├── Tickets   → TicketsStack (M25/M28, M26, M27)
 * └── Profil    → ProfileStack (E12, M20–M22, M02)
 *
 * Les écrans des lots suivants pointent vers ComingSoonScreen :
 * chaque bouton mène déjà quelque part.
 * ════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Platform, Text } from 'react-native';
import { NavigationContainer, createNavigationContainerRef, getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { AuthProvider, useAuth } from './context/AuthContext';
import DialogHost from './components/ui/DialogHost';
import RsvpSheet from './components/rsvp/RsvpSheet';
import { C } from './constants/theme';

import HomeScreen from './screens/HomeScreen';
import EventDetailScreen from './screens/EventDetailScreen';
import MiniSiteViewScreen from './screens/MiniSiteViewScreen';
import MiniSiteGeneratingScreen from './screens/MiniSiteGeneratingScreen';
import TemplatePickerScreen from './screens/TemplatePickerScreen';
import MiniSiteEditorScreen from './screens/MiniSiteEditorScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import DashboardScreen from './screens/DashboardScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import EventDashboardScreen from './screens/EventDashboardScreen';
import RsvpQuestionsScreen from './screens/RsvpQuestionsScreen';
import TicketsScreen from './screens/TicketsScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import ComingSoonScreen from './screens/ComingSoonScreen';
import TicketCheckoutScreen from './screens/TicketCheckoutScreen';
import PayoutsScreen from './screens/PayoutsScreen';
import InviteGuestsScreen from './screens/InviteGuestsScreen';
import GuestListScreen from './screens/GuestListScreen';
import InvitationLandingScreen from './screens/InvitationLandingScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ConversationsScreen from './screens/ConversationsScreen';
import ChatScreen from './screens/ChatScreen';
import ContactPickerScreen from './screens/ContactPickerScreen';
import VerifyPhoneScreen from './screens/VerifyPhoneScreen';
import FriendsScreen from './screens/FriendsScreen';
import PlansScreen from './screens/PlansScreen';
import SubscriptionCheckoutScreen from './screens/SubscriptionCheckoutScreen';
import SubscriptionSuccessScreen from './screens/SubscriptionSuccessScreen';
import TermsScreen from './screens/TermsScreen';
import HelpScreen from './screens/HelpScreen';
import AdminScreen from './screens/AdminScreen';
import GiftScreen from './screens/GiftScreen';
import ScanTicketsScreen from './screens/ScanTicketsScreen';
import * as Application from 'expo-application';
import { KEYS, getItem, setItem } from './services/storage';
import { TicketBadgeProvider, useTicketBadge } from './context/TicketBadgeContext';
import realtime from './services/realtime';
import { register as registerPush, onTap as onPushTap, setBadge } from './services/push';
import { openNotification } from './utils/notificationRoutes';

// Écran de démarrage (logo) gardé jusqu'à la lecture de la session : pas d'écran blanc
SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationRef = createNavigationContainerRef();

// ─────────────────────────────────────────────────────────────────
// NAVIGATEURS
// ─────────────────────────────────────────────────────────────────
const PublicStack   = createNativeStackNavigator();
const DashStack     = createNativeStackNavigator();
const DiscoverStack = createNativeStackNavigator();
const TicketsStack  = createNativeStackNavigator();
const ProfileStack  = createNativeStackNavigator();
const Tabs          = createBottomTabNavigator();

const stackOptions = { headerShown: false };

// Écran « à venir » : identifiant de maquette + titre (+ description)
const soon = (screenId, title, description) => ({
  component: ComingSoonScreen,
  initialParams: { screenId, title, description },
  options: { title },
});

// ════════════════════════════════════════════════════════════════
// LIENS PROFONDS (web + mobile)
// ════════════════════════════════════════════════════════════════
// Connecté, le lien d'invitation s'ouvre dans l'onglet Tickets (même écran M31)
let linkingAuthenticated = false;
const INVITE_PATH = /^\/?i\/([^/?#]+)/;
const EVENT_PATH = /^\/?(?:e|evenement)\/([0-9a-fA-F-]{36})\/?(?:\?.*)?$/;

const linking = {
  prefixes: [Linking.createURL('/'), 'https://easevent.nitypulse.com', 'https://easevent.app', 'easevent://'],
  // Premier lancement après installation depuis un lien d'invitation :
  // le Play Store transmet « invite=<jeton> » (referrer) → on ouvre M31.
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url || Platform.OS !== 'android') return url;
    try {
      if (await getItem(KEYS.INSTALL_REFERRER_DONE)) return null;
      await setItem(KEYS.INSTALL_REFERRER_DONE, '1');
      const referrer = decodeURIComponent(await Application.getInstallReferrerAsync() || '');
      const match = referrer.match(/invite=([A-Za-z0-9_-]{20,64})/);
      return match ? `easevent://i/${match[1]}` : null;
    } catch {
      return null;
    }
  },
  getStateFromPath(path, options) {
    // Ancien chemin « tickets » (liens déjà envoyés) : l'onglet s'appelle désormais « Invitations »
    if (/^\/?tickets(?:[/?#]|$)/.test(path)) path = path.replace(/^\/?tickets/, 'invitations');
    // Lien de partage /e/<id> (ou /evenement/<id>) : la page de l'événement, connecté ou non
    const shared = path.match(EVENT_PATH);
    if (shared) {
      const params = { id: shared[1] };
      return linkingAuthenticated
        ? { routes: [{ name: 'TabDiscover', state: { routes: [{ name: 'DiscoverHome' }, { name: 'EventDetail', params }] } }] }
        : { routes: [{ name: 'Home' }, { name: 'EventDetail', params }] };
    }
    const match = path.match(INVITE_PATH);
    if (match && linkingAuthenticated) {
      return {
        routes: [{
          name: 'TabTickets',
          state: { routes: [{ name: 'Tickets' }, { name: 'InvitationLanding', params: { token: decodeURIComponent(match[1]) } }] },
        }],
      };
    }
    return defaultGetStateFromPath(path, options);
  },
  config: {
    screens: {
      // Visiteur
      Home:              '',
      EventDetail:       'evenement/:id?',
      Login:             'connexion',
      ForgotPassword:    'mot-de-passe-oublie',
      ResetPassword:     'reset-password/:uid/:token',
      VerifyEmail:       'verify/:token',
      PrivacyPolicy:     'confidentialite',
      Terms:             'conditions',
      Help:              'aide',
      InvitationLanding: 'i/:token',
      // Connecté
      TabDashboard: {
        screens: {
          Dashboard:     'tableau-de-bord',
          Notifications: 'notifications',
          Conversations: 'messages',
        },
      },
      TabDiscover: { screens: { DiscoverHome: 'decouvrir', EventDetail: 'decouvrir/evenement/:id?' } },
      TabCreate:   'creer',
      TabTickets:  { screens: { Tickets: 'invitations' } },
      TabProfile:  {
        screens: {
          Profile: 'profil', Plans: 'profil/plans', Payouts: 'profil/paiements', Admin: 'profil/admin',
          SubscriptionSuccess: 'profil/abonnement/succes',
        },
      },
    },
  },
};

// ════════════════════════════════════════════════════════════════
// NAVIGATEUR PUBLIC
// ════════════════════════════════════════════════════════════════
function PublicNavigator() {
  return (
    <PublicStack.Navigator screenOptions={stackOptions}>
      <PublicStack.Screen name="Home"           component={HomeScreen}           options={{ title: 'Découvrir' }} />
      <PublicStack.Screen name="EventDetail"    component={EventDetailScreen}    options={{ title: 'Événement' }} />
      <PublicStack.Screen name="MiniSiteView"   component={MiniSiteViewScreen}   options={{ title: 'Mini-site' }} />
      <PublicStack.Screen name="Login"          component={LoginScreen}          options={{ title: 'Bienvenue' }} />
      <PublicStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Mot de passe oublié' }} />
      <PublicStack.Screen name="ResetPassword"  component={ResetPasswordScreen}  options={{ title: 'Nouveau mot de passe' }} />
      <PublicStack.Screen name="VerifyEmail"    component={VerifyEmailScreen}    options={{ title: 'Vérifiez votre email' }} />
      <PublicStack.Screen name="PrivacyPolicy"  component={PrivacyPolicyScreen}  options={{ title: 'Confidentialité' }} />
      <PublicStack.Screen name="Terms"             component={TermsScreen} options={{ title: "Conditions d'utilisation" }} />
      <PublicStack.Screen name="Help"              component={HelpScreen}  options={{ title: 'Aide' }} />
      <PublicStack.Screen name="InvitationLanding" component={InvitationLandingScreen} options={{ title: 'Invitation' }} />
    </PublicStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// STACK : Tableau de bord (création, gestion, invités, messagerie)
// Le retour ramène toujours au tableau de bord.
// ════════════════════════════════════════════════════════════════
function DashboardStackNavigator() {
  return (
    <DashStack.Navigator screenOptions={stackOptions}>
      <DashStack.Screen name="Dashboard"          component={DashboardScreen}      options={{ title: 'Tableau de bord' }} />
      <DashStack.Screen name="CreateEvent"        component={CreateEventScreen}    options={{ title: 'Créer un événement' }} />
      <DashStack.Screen name="EventCreated"       {...soon('M05', 'Événement créé')} />
      <DashStack.Screen name="MiniSiteGenerating" component={MiniSiteGeneratingScreen} options={{ title: 'Génération du mini-site' }} />
      <DashStack.Screen name="TemplatePicker"     component={TemplatePickerScreen}     options={{ title: 'Choisir un mini-site' }} />
      <DashStack.Screen name="MiniSiteEditor"     component={MiniSiteEditorScreen}     options={{ title: 'Retoucher le mini-site' }} />
      <DashStack.Screen name="MiniSiteView"       component={MiniSiteViewScreen}       options={{ title: 'Mini-site' }} />
      <DashStack.Screen name="EventPublished"     {...soon('M10', 'Événement publié')} />
      <DashStack.Screen name="EventDashboard"     component={EventDashboardScreen} options={{ title: 'Gérer un événement' }} />
      <DashStack.Screen name="ScanTickets"        component={ScanTicketsScreen}    options={{ title: 'Contrôle des entrées' }} />
      <DashStack.Screen name="EditEvent"          component={CreateEventScreen}    options={{ title: "Modifier l'événement" }} />
      <DashStack.Screen name="InviteGuests"       component={InviteGuestsScreen}   options={{ title: 'Inviter des participants' }} />
      <DashStack.Screen name="Friends"            component={FriendsScreen}        options={{ title: 'Mes amis' }} />
      <DashStack.Screen name="ContactPicker"      component={ContactPickerScreen}  options={{ title: 'Mes contacts' }} />
      <DashStack.Screen name="GuestList"          component={GuestListScreen}      options={{ title: 'Invités & réponses' }} />
      <DashStack.Screen name="RsvpQuestions"      component={RsvpQuestionsScreen}  options={{ title: 'Questions RSVP' }} />
      <DashStack.Screen name="Conversations"      component={ConversationsScreen}  options={{ title: 'Messages' }} />
      <DashStack.Screen name="Chat"               component={ChatScreen}           options={{ title: 'Conversation' }} />
      <DashStack.Screen name="Notifications"      component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </DashStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// STACK : Découverte
// ════════════════════════════════════════════════════════════════
function DiscoverStackNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={stackOptions}>
      <DiscoverStack.Screen name="DiscoverHome"  component={HomeScreen}        options={{ title: 'Découvrir' }} />
      <DiscoverStack.Screen name="EventDetail"   component={EventDetailScreen} options={{ title: 'Événement' }} />
      <DiscoverStack.Screen name="Gift"          component={GiftScreen}        options={{ title: 'Offrir' }} />
      <DiscoverStack.Screen name="MiniSiteView"  component={MiniSiteViewScreen} options={{ title: 'Mini-site' }} />
      <DiscoverStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <DiscoverStack.Screen name="Chat"          component={ChatScreen} options={{ title: 'Conversation' }} />
      <DiscoverStack.Screen name="TicketCheckout" component={TicketCheckoutScreen} options={{ title: 'Paiement' }} />
    </DiscoverStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// STACK : Tickets
// ════════════════════════════════════════════════════════════════
function TicketsStackNavigator() {
  return (
    <TicketsStack.Navigator screenOptions={stackOptions}>
      <TicketsStack.Screen name="Tickets"        component={TicketsScreen} options={{ title: 'Mes invitations' }} />
      <TicketsStack.Screen name="TicketCheckout" component={TicketCheckoutScreen} options={{ title: 'Paiement' }} />
      <TicketsStack.Screen name="InvitationLanding" component={InvitationLandingScreen} options={{ title: 'Invitation' }} />
      <TicketsStack.Screen name="Chat"           component={ChatScreen} options={{ title: 'Conversation' }} />
      <TicketsStack.Screen name="VerifyPhone"    component={VerifyPhoneScreen} options={{ title: 'Mon numéro' }} />
    </TicketsStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// STACK : Profil
// ════════════════════════════════════════════════════════════════
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={stackOptions}>
      <ProfileStack.Screen name="Profile"              component={ProfileScreen}       options={{ title: 'Mon profil' }} />
      <ProfileStack.Screen name="PrivacyPolicy"        component={PrivacyPolicyScreen} options={{ title: 'Confidentialité' }} />
      <ProfileStack.Screen name="Notifications"        component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <ProfileStack.Screen name="Friends"              component={FriendsScreen} options={{ title: 'Mes amis' }} />
      <ProfileStack.Screen name="VerifyPhone"          component={VerifyPhoneScreen} options={{ title: 'Mon numéro' }} />
      <ProfileStack.Screen name="Chat"                 component={ChatScreen} options={{ title: 'Conversation' }} />
      <ProfileStack.Screen name="Payouts"              component={PayoutsScreen} options={{ title: 'Paiements & virements' }} />
      <ProfileStack.Screen name="Plans"                component={PlansScreen}                options={{ title: 'Choisir un plan' }} />
      <ProfileStack.Screen name="SubscriptionCheckout" component={SubscriptionCheckoutScreen} options={{ title: 'Paiement' }} />
      <ProfileStack.Screen name="SubscriptionSuccess"  component={SubscriptionSuccessScreen}  options={{ title: 'Paiement confirmé' }} />
      <ProfileStack.Screen name="Terms"                component={TermsScreen}                options={{ title: "Conditions d'utilisation" }} />
      <ProfileStack.Screen name="Help"                 component={HelpScreen}                 options={{ title: 'Aide' }} />
      <ProfileStack.Screen name="Admin"                component={AdminScreen}                options={{ title: 'Administration' }} />
    </ProfileStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// NAVIGATEUR TABS — Utilisateurs connectés
// ════════════════════════════════════════════════════════════════
const TAB_ICONS = {
  TabDashboard: ['home', 'home-outline'],
  TabDiscover:  ['compass', 'compass-outline'],
  TabCreate:    ['add-circle', 'add-circle-outline'],
  TabTickets:   ['ticket', 'ticket-outline'],
  TabProfile:   ['person', 'person-outline'],
};

function AppTabNavigator() {
  const { badge, refresh } = useTicketBadge();
  const { landingRoute } = useAuth();
  return (
    <Tabs.Navigator
      // Après une invitation rattachée à la connexion : ouvrir Mes tickets
      initialRouteName={landingRoute || 'TabDashboard'}
      // Badge « Tickets » rafraîchi à la navigation (au plus toutes les 30 s)
      screenListeners={{ state: () => refresh() }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const [active, idle] = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
          return (
            <Ionicons
              name={focused ? active : idle}
              size={route.name === 'TabCreate' ? 30 : size}
              color={route.name === 'TabCreate' ? C.orange : color}
            />
          );
        },
        tabBarActiveTintColor:   C.green,
        tabBarInactiveTintColor: C.textMut,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopWidth: 1,
          borderTopColor: C.border,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 6,
          height: Platform.OS === 'ios' ? 84 : 68,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
      })}
    >
      <Tabs.Screen name="TabDashboard" component={DashboardStackNavigator} options={{ tabBarLabel: 'Accueil', title: 'Accueil' }} />
      <Tabs.Screen name="TabDiscover"  component={DiscoverStackNavigator}  options={{ tabBarLabel: 'Découvrir', title: 'Découvrir' }} />
      <Tabs.Screen
        name="TabCreate"
        component={CreateEventScreen}
        options={{
          // « Créer » en orange : sur son icône et son libellé seulement (une couleur posée ici
          // s'appliquerait à toute la barre quand cet onglet est ouvert)
          tabBarLabel: ({ position }) => (
            <Text style={{ color: C.orange, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3,
              marginTop: position === 'beside-icon' ? 0 : 2, marginLeft: position === 'beside-icon' ? 16 : 0 }}>Créer</Text>
          ),
          title: 'Créer un événement',
        }}
      />
      <Tabs.Screen
        name="TabTickets"
        component={TicketsStackNavigator}
        options={{
          tabBarLabel: 'Invitations',
          title: 'Mes invitations',
          tabBarBadge: badge > 0 ? badge : undefined,
          tabBarBadgeStyle: { backgroundColor: C.orange, color: C.white, fontSize: 10, fontWeight: '800' },
          tabBarAccessibilityLabel: badge > 0 ? `Invitations, ${badge} en attente` : 'Invitations',
        }}
      />
      <Tabs.Screen name="TabProfile" component={ProfileStackNavigator} options={{ tabBarLabel: 'Profil', title: 'Mon profil' }} />
    </Tabs.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// NAVIGATEUR RACINE
// ════════════════════════════════════════════════════════════════
const GateStack = createNativeStackNavigator();

// Numéro de téléphone obligatoire : un compte sans numéro l'ajoute d'abord
function PhoneGateNavigator() {
  return (
    <GateStack.Navigator screenOptions={stackOptions}>
      <GateStack.Screen name="PhoneGate" component={VerifyPhoneScreen} initialParams={{ required: true }}
        options={{ title: 'Votre numéro' }} />
    </GateStack.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, user } = useAuth();
  linkingAuthenticated = isAuthenticated;

  if (isAuthenticated && user && !user.phone) return <PhoneGateNavigator key="phone-gate" />;

  // `key` → évite le scintillement de la barre d'onglets au changement d'état
  return isAuthenticated
    ? <AppTabNavigator key="authenticated" />
    : <PublicNavigator key="public" />;
}

// ════════════════════════════════════════════════════════════════
// SESSION CONNECTÉE : temps réel, notifications push, badges
// ════════════════════════════════════════════════════════════════
function SessionBridge() {
  const { isAuthenticated, user } = useAuth();
  const { refresh, notifications } = useTicketBadge();
  const pendingTap = useRef(null);
  const ready = isAuthenticated && !!user?.phone;

  // Connexion temps réel + badges mis à jour à chaque événement
  useEffect(() => {
    if (!ready) return undefined;
    realtime.start();
    refresh({ force: true });
    let timer = null;
    const unsub = realtime.subscribe((evt) => {
      if (evt.type === 'badge' || evt.type === 'connected' || evt.type === 'message') {
        clearTimeout(timer);
        timer = setTimeout(() => refresh({ force: true }), 400);
      }
    });
    return () => { unsub(); clearTimeout(timer); };
  }, [ready, refresh]);

  // Notifications push : enregistrement du téléphone, tap → écran concerné
  useEffect(() => {
    if (!ready) return undefined;
    registerPush();
    const go = (data, content) => {
      const n = { ...data, data, title: content?.title };
      if (navigationRef.isReady()) openNotification(navigationRef, n);
      else pendingTap.current = n;
    };
    const unsub = onPushTap(go);
    const wait = setInterval(() => {
      if (pendingTap.current && navigationRef.isReady()) {
        openNotification(navigationRef, pendingTap.current);
        pendingTap.current = null;
      }
    }, 300);
    return () => { unsub(); clearInterval(wait); };
  }, [ready]);

  // Pastille de l'icône de l'application = notifications non lues
  useEffect(() => { if (ready) setBadge(notifications); }, [ready, notifications]);

  return null;
}

// La navigation démarre une fois la session lue : un lien profond
// (ex. invitation) est ainsi interprété avec le bon état de connexion.
function NavigationShell() {
  const { isLoading, isAuthenticated } = useAuth();
  linkingAuthenticated = isAuthenticated;

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }}>
        <ActivityIndicator size="large" color={C.green} accessibilityLabel="Chargement" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => SplashScreen.hideAsync().catch(() => {})}
      linking={linking}
      documentTitle={{ formatter: (options) => (options?.title ? `${options.title} · Easevent` : 'Easevent') }}
    >
      <StatusBar style="dark" />
      <SessionBridge />
      <RootNavigator />
    </NavigationContainer>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPOSANT RACINE
// ════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TicketBadgeProvider>
          <NavigationShell />
        </TicketBadgeProvider>
        <RsvpSheet />
        <DialogHost />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
