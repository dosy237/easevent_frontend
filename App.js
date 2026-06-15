/**
 * App.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Point d'entrée de l'application.
 *
 * ARCHITECTURE DE NAVIGATION :
 * ─────────────────────────────
 * L'app a deux univers distincts selon l'état d'authentification.
 *
 * VISITEUR (non connecté) :
 * PublicStack
 * ├── HomeScreen → fil d'événements publics
 * ├── EventDetailScreen → détail d'un événement
 * └── LoginScreen → connexion / inscription
 *
 * UTILISATEUR CONNECTÉ :
 * AppTabs (barre de navigation permanente en bas)
 * ├── Tab "Accueil" → DashboardStack
 * │   ├── DashboardScreen → tableau de bord personnel
 * │   └── EventDashboardScreen → gérer un événement
 * ├── Tab "Découvrir" → DiscoverStack
 * │   ├── HomeScreen → fil public
 * │   └── EventDetailScreen → détail événement
 * ├── Tab "Créer" → CreateEventScreen
 * ├── Tab "Billets" → TicketsScreen (placeholder)
 * └── Tab "Profil" → ProfileScreen
 *
 * AMÉLIORATIONS APPORTÉES :
 * - Ajout de `key` sur les navigateurs pour éviter les flicker
 *   lors du changement d'état d'authentification.
 * - Meilleure stabilité de la barre de navigation.
 * ════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './context/AuthContext';
import HomeScreen from './screens/HomeScreen';
import EventDetailScreen from './screens/EventDetailScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import DashboardScreen from './screens/DashboardScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import EventDashboardScreen from './screens/EventDashboardScreen';

// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────
const C = {
  green:      '#1B6B4A',
  greenLight: '#E8F5EE',
  orange:     '#E76F51',
  white:      '#FFFFFF',
  bg:         '#F7F7F7',
  text:       '#1A1A1A',
  textMut:    '#9E9E9E',
  border:     '#E8E8E8',
};

// ─────────────────────────────────────────────────────────────────
// NAVIGATEURS
// ─────────────────────────────────────────────────────────────────
const PublicStack   = createNativeStackNavigator();
const DashStack     = createNativeStackNavigator();
const DiscoverStack = createNativeStackNavigator();
const Tabs          = createBottomTabNavigator();

// ════════════════════════════════════════════════════════════════
// NAVIGATEUR PUBLIC
// ════════════════════════════════════════════════════════════════
function PublicNavigator() {
  return (
    <PublicStack.Navigator screenOptions={{ headerShown: false }}>
      <PublicStack.Screen name="Home"        component={HomeScreen} />
      <PublicStack.Screen name="EventDetail" component={EventDetailScreen} />
      <PublicStack.Screen name="Login"       component={LoginScreen} />
    </PublicStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// STACK : Tableau de bord
// ════════════════════════════════════════════════════════════════
function DashboardStackNavigator() {
  return (
    <DashStack.Navigator screenOptions={{ headerShown: false }}>
      <DashStack.Screen name="Dashboard"     component={DashboardScreen} />
      <DashStack.Screen name="CreateEvent"   component={CreateEventScreen} />
      <DashStack.Screen name="EventDashboard" component={EventDashboardScreen} />
    </DashStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// STACK : Découverte
// ════════════════════════════════════════════════════════════════
function DiscoverStackNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
      <DiscoverStack.Screen name="DiscoverHome" component={HomeScreen} />
      <DiscoverStack.Screen name="EventDetail"  component={EventDetailScreen} />
    </DiscoverStack.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// ÉCRAN : TicketsScreen (placeholder)
// ════════════════════════════════════════════════════════════════
function TicketsScreen() {
  return (
    <View style={placeholderStyles.root}>
      <Ionicons name="ticket-outline" size={56} color={C.textMut} />
      <Text style={placeholderStyles.title}>Mes Billets</Text>
      <Text style={placeholderStyles.sub}>
        Vos billets d'événements apparaîtront ici.{'\n'}
        Souscrivez à un événement pour commencer.
      </Text>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    marginTop: 16,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: C.textMut,
    textAlign: 'center',
    lineHeight: 21,
  },
});

// ════════════════════════════════════════════════════════════════
// NAVIGATEUR TABS — Utilisateurs connectés
// ════════════════════════════════════════════════════════════════
function AppTabNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            TabDashboard: focused ? 'home' : 'home-outline',
            TabDiscover:  focused ? 'compass' : 'compass-outline',
            TabCreate:    focused ? 'add-circle' : 'add-circle-outline',
            TabTickets:   focused ? 'ticket' : 'ticket-outline',
            TabProfile:   focused ? 'person' : 'person-outline',
          };
          return (
            <Ionicons
              name={icons[route.name] || 'ellipse-outline'}
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
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      })}
    >
      <Tabs.Screen name="TabDashboard" component={DashboardStackNavigator} options={{ tabBarLabel: 'Accueil' }} />
      <Tabs.Screen name="TabDiscover"  component={DiscoverStackNavigator}  options={{ tabBarLabel: 'Découvrir' }} />
      <Tabs.Screen
        name="TabCreate"
        component={CreateEventScreen}
        options={{
          tabBarLabel: 'Créer',
          tabBarActiveTintColor: C.orange,
          tabBarInactiveTintColor: C.orange,
        }}
      />
      <Tabs.Screen name="TabTickets" component={TicketsScreen} options={{ tabBarLabel: 'Billets' }} />
      <Tabs.Screen name="TabProfile" component={ProfileScreen} options={{ tabBarLabel: 'Profil' }} />
    </Tabs.Navigator>
  );
}

// ════════════════════════════════════════════════════════════════
// NAVIGATEUR RACINE (amélioré pour la stabilité)
// ════════════════════════════════════════════════════════════════
function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  // Utilisation de `key` → évite les problèmes de flicker de la barre de navigation
  return isAuthenticated 
    ? <AppTabNavigator key="authenticated" /> 
    : <PublicNavigator key="public" />;
}

// ════════════════════════════════════════════════════════════════
// COMPOSANT RACINE
// ════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}