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

import React from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer, getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { AuthProvider, useAuth } from './context/AuthContext';
import DialogHost from './components/ui/DialogHost';
import { C } from './constants/theme';

import HomeScreen from './screens/HomeScreen';
import EventDetailScreen from './screens/EventDetailScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import DashboardScreen from './screens/DashboardScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import EventDashboardScreen from './screens/EventDashboardScreen';
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
import { TicketBadgeProvider, useTicketBadge } from './context/TicketBadgeContext';

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

const linking = {
  prefixes: [Linking.createURL('/'), 'https://easevent.app', 'easevent://'],
  getStateFromPath(path, options) {
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
      EventDetail:       'evenement',
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
      TabDiscover: { screens: { DiscoverHome: 'decouvrir' } },
      TabCreate:   'creer',
      TabTickets:  { screens: { Tickets: 'tickets' } },
      TabProfile:  { screens: { Profile: 'profil', Plans: 'profil/plans', Payouts: 'profil/paiements' } },
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
      <PublicStack.Screen name="Login"          component={LoginScreen}          options={{ title: 'Bienvenue' }} />
      <PublicStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Mot de passe oublié' }} />
      <PublicStack.Screen name="ResetPassword"  component={ResetPasswordScreen}  options={{ title: 'Nouveau mot de passe' }} />
      <PublicStack.Screen name="VerifyEmail"    component={VerifyEmailScreen}    options={{ title: 'Vérifiez votre email' }} />
      <PublicStack.Screen name="PrivacyPolicy"  component={PrivacyPolicyScreen}  options={{ title: 'Confidentialité' }} />
      <PublicStack.Screen name="Terms"             {...soon('CGU', "Conditions d'utilisation", 'Les conditions d’utilisation seront publiées ici dès leur validation par le juridique.')} />
      <PublicStack.Screen name="Help"              {...soon('Aide', 'Aide', 'Le centre d’aide arrive bientôt.')} />
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
      <DashStack.Screen name="MiniSiteGenerating" {...soon('M06', 'Génération du mini-site')} />
      <DashStack.Screen name="TemplatePicker"     {...soon('M07', 'Choisir un modèle')} />
      <DashStack.Screen name="MiniSiteEditor"     {...soon('M08', 'Éditeur du mini-site')} />
      <DashStack.Screen name="EventPublished"     {...soon('M10', 'Événement publié')} />
      <DashStack.Screen name="EventDashboard"     component={EventDashboardScreen} options={{ title: 'Gérer un événement' }} />
      <DashStack.Screen name="EditEvent"          {...soon('M11', "Modifier l'événement")} />
      <DashStack.Screen name="InviteGuests"       component={InviteGuestsScreen}   options={{ title: 'Inviter des participants' }} />
      <DashStack.Screen name="GuestList"          component={GuestListScreen}      options={{ title: 'Invités & réponses' }} />
      <DashStack.Screen name="RsvpQuestions"      {...soon('M14', 'Questions RSVP')} />
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
      <DiscoverStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <DiscoverStack.Screen name="Chat"          component={ChatScreen} options={{ title: 'Conversation' }} />
      <DiscoverStack.Screen name="TicketCheckout" component={TicketCheckoutScreen} options={{ title: 'Payer mon ticket' }} />
    </DiscoverStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// STACK : Tickets
// ════════════════════════════════════════════════════════════════
function TicketsStackNavigator() {
  return (
    <TicketsStack.Navigator screenOptions={stackOptions}>
      <TicketsStack.Screen name="Tickets"        component={TicketsScreen} options={{ title: 'Mes tickets' }} />
      <TicketsStack.Screen name="TicketCheckout" component={TicketCheckoutScreen} options={{ title: 'Payer mon ticket' }} />
      <TicketsStack.Screen name="InvitationLanding" component={InvitationLandingScreen} options={{ title: 'Invitation' }} />
      <TicketsStack.Screen name="Chat"           component={ChatScreen} options={{ title: 'Conversation' }} />
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
      <ProfileStack.Screen name="Chat"                 component={ChatScreen} options={{ title: 'Conversation' }} />
      <ProfileStack.Screen name="Payouts"              component={PayoutsScreen} options={{ title: 'Paiements & virements' }} />
      <ProfileStack.Screen name="Plans"                {...soon('M20', 'Choisir un plan')} />
      <ProfileStack.Screen name="SubscriptionCheckout" {...soon('M21', 'Paiement')} />
      <ProfileStack.Screen name="SubscriptionSuccess"  {...soon('M22', 'Paiement confirmé')} />
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
              color={color}
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
          tabBarLabel: 'Créer',
          title: 'Créer un événement',
          tabBarActiveTintColor: C.orange,
          tabBarInactiveTintColor: C.orange,
        }}
      />
      <Tabs.Screen
        name="TabTickets"
        component={TicketsStackNavigator}
        options={{
          tabBarLabel: 'Tickets',
          title: 'Mes tickets',
          tabBarBadge: badge > 0 ? badge : undefined,
          tabBarBadgeStyle: { backgroundColor: C.orange, color: C.white, fontSize: 10, fontWeight: '800' },
          tabBarAccessibilityLabel: badge > 0 ? `Tickets, ${badge} en attente` : 'Tickets',
        }}
      />
      <Tabs.Screen name="TabProfile" component={ProfileStackNavigator} options={{ tabBarLabel: 'Profil', title: 'Mon profil' }} />
    </Tabs.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// NAVIGATEUR RACINE
// ════════════════════════════════════════════════════════════════
function RootNavigator() {
  const { isAuthenticated } = useAuth();
  linkingAuthenticated = isAuthenticated;

  // `key` → évite le scintillement de la barre d'onglets au changement d'état
  return isAuthenticated
    ? <AppTabNavigator key="authenticated" />
    : <PublicNavigator key="public" />;
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
      linking={linking}
      documentTitle={{ formatter: (options) => (options?.title ? `${options.title} · Easevent` : 'Easevent') }}
    >
      <StatusBar style="dark" />
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
        <DialogHost />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
