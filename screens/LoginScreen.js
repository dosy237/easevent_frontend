/**
 * LoginScreen.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Page d'authentification — 3 états :
 *
 * 1. LANDING   : page d'accueil avec logo + deux boutons
 *                "Démarrer l'aventure" et "Se connecter"
 *                + boutons OAuth Google / Apple
 *
 * 2. LOGIN     : formulaire email + mot de passe
 *                connecté à POST /api/auth/login/
 *
 * 3. REGISTER  : formulaire en 2 étapes
 *                Étape 1 : email + mot de passe
 *                Étape 2 : prénom + nom
 *                connecté à POST /api/auth/register/
 *
 * Après connexion réussie → navigation vers HomeScreen
 * ════════════════════════════════════════════════════════════════
 */
import { useAuth } from '../context/AuthContext';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';

const { height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────
import { API_BASE } from '../config';
// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────
const C = {
  green:      '#1B6B4A',
  greenDark:  '#155C3C',
  greenLight: '#E8F5EE',
  orange:     '#E76F51',
  white:      '#FFFFFF',
  bg:         '#F7F7F7',
  text:       '#1A1A1A',
  textSub:    '#555555',
  textMut:    '#9E9E9E',
  border:     '#E8E8E8',
  inputBg:    '#F9F9F9',
  error:      '#E53E3E',
  errorBg:    '#FFF5F5',
};

// ─────────────────────────────────────────────────────────────────
// ÉTATS POSSIBLES DE L'ÉCRAN
// ─────────────────────────────────────────────────────────────────
const SCREEN = {
  LANDING:  'landing',   // page d'accueil avec logo
  LOGIN:    'login',     // formulaire de connexion
  REGISTER: 'register',  // formulaire d'inscription
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : InputField
// Champ de saisie stylisé avec icône et gestion d'erreur.
//
// Props :
// - icon        : nom d'icône Ionicons
// - placeholder : texte d'indication
// - value       : valeur du champ (state)
// - onChangeText: fonction appelée à chaque frappe
// - secureEntry : true pour les mots de passe
// - error       : message d'erreur à afficher sous le champ
// - keyboardType: type de clavier ('email-address', 'default'...)
// ════════════════════════════════════════════════════════════════
const InputField = ({
  icon,
  placeholder,
  value,
  onChangeText,
  secureEntry = false,
  error,
  keyboardType = 'default',
  autoCapitalize = 'none',
}) => {
  // showPassword : toggle pour afficher/masquer le mot de passe
  const [showPassword, setShowPassword] = useState(false);

  // focused : true quand le champ est actif
  // Permet de changer la couleur de la bordure
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputWrap}>
      {/* Conteneur du champ avec bordure dynamique */}
      <View style={[
        styles.inputBox,
        focused && styles.inputBoxFocused,
        error  && styles.inputBoxError,
      ]}>

        {/* Icône à gauche */}
        <Ionicons
          name={icon}
          size={18}
          color={focused ? C.green : C.textMut}
          style={styles.inputIcon}
        />

        {/* Champ de saisie */}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={C.textMut}
          value={value}
          onChangeText={onChangeText}
          // Si secureEntry et showPassword → affiche le texte
          // Si secureEntry et !showPassword → masque avec des points
          secureTextEntry={secureEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* Bouton œil pour les mots de passe */}
        {secureEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={C.textMut}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Message d'erreur sous le champ */}
      {error ? (
        <View style={styles.fieldError}>
          <Ionicons name="alert-circle-outline" size={12} color={C.error} />
          <Text style={styles.fieldErrorTxt}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : ProgressBar
// Barre de progression pour le formulaire d'inscription en 2 étapes.
// Props : step (1 ou 2), total (2)
// ════════════════════════════════════════════════════════════════
const ProgressBar = ({ step, total }) => (
  <View style={styles.progressRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.progressSegment,
          i < step && styles.progressSegmentActive,
          // Dernier segment sans margin droite
          i === total - 1 && { marginRight: 0 },
        ]}
      />
    ))}
  </View>
);

// ════════════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL : LoginScreen
//
// Props :
// - navigation : objet React Navigation
// ════════════════════════════════════════════════════════════════
export default function LoginScreen({ navigation }) {
  const { login } = useAuth();

  // ── État de l'écran (landing / login / register) ──────────────
  const [screen,      setScreen]      = useState(SCREEN.LANDING);

  // ── Étape du formulaire d'inscription (1 ou 2) ────────────────
  const [registerStep, setRegisterStep] = useState(1);

  // ── Champs du formulaire ──────────────────────────────────────
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');

  // ── États UI ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Erreurs par champ
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Animations ───────────────────────────────────────────────
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  // Animation d'entrée au montage
  useEffect(() => {
    Animated.spring(logoScale, {
      toValue:  1,
      friction: 6,
      tension:  80,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Transition entre les états ────────────────────────────────
  // Fade out → change l'état → Fade in
  const transitionTo = (newScreen) => {
    setError('');
    setFieldErrors({});
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(() => {
      setScreen(newScreen);
      setRegisterStep(1);
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    });
  };

  // ── Validation basique ────────────────────────────────────────
  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const validateLoginFields = () => {
    const errors = {};
    if (!email)                     errors.email    = 'L\'email est requis';
    else if (!validateEmail(email)) errors.email    = 'Format d\'email invalide';
    if (!password)                  errors.password = 'Le mot de passe est requis';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRegisterStep1 = () => {
    const errors = {};
    if (!email)                     errors.email    = 'L\'email est requis';
    else if (!validateEmail(email)) errors.email    = 'Format d\'email invalide';
    if (!password)                  errors.password = 'Le mot de passe est requis';
    else if (password.length < 8)   errors.password = 'Minimum 8 caractères';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRegisterStep2 = () => {
    const errors = {};
    if (!firstName.trim()) errors.firstName = 'Le prénom est requis';
    if (!lastName.trim())  errors.lastName  = 'Le nom est requis';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Connexion ─────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!validateLoginFields()) return;

    setLoading(true);
    setError('');

    try {
      // POST vers notre endpoint Django /api/auth/login/
      // On envoie email + password en JSON
      const res = await fetch(`${API_BASE}/api/auth/login/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Le serveur a retourné une erreur (400, 401...)
        // On affiche le message d'erreur retourné par Django
        const msg = data?.detail
          || data?.non_field_errors?.[0]
          || 'Email ou mot de passe incorrect.';
        setError(msg);
        return;
      }

      // Connexion réussie — data contient { access, refresh, user }
      // TODO : stocker les tokens avec expo-secure-store
      // pour les requêtes authentifiées futures
      // await SecureStore.setItemAsync('access_token', data.access);
      // ← ajouter en haut du composant
      // Navigation vers l'accueil
      await login({
      userData: data.user,
      access:   data.access,
      refresh:  data.refresh,
      });
      navigation?.reset({
      index: 0,
      routes: [{ name: 'TabDashboard' }],
      });

    } catch (err) {
      setError('Impossible de se connecter. Vérifie ta connexion internet.');
      console.error('Erreur login:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Inscription ───────────────────────────────────────────────
  const handleRegisterStep1 = () => {
    if (!validateRegisterStep1()) return;
    // Passe à l'étape 2 — prénom et nom
    setRegisterStep(2);
  };

  const handleRegisterStep2 = async () => {
    if (!validateRegisterStep2()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/register/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email,
          password,
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.email?.[0]
          || data?.detail
          || 'Une erreur est survenue lors de l\'inscription.';
        setError(msg);
        return;
      }

      // Inscription réussie → retour au landing avec message
      // TODO : afficher un message "Vérifiez votre email"
     navigation?.reset({
        index: 0,
       routes: [{ name: 'TabDashboard' }],
     });

    } catch (err) {
      setError('Impossible de s\'inscrire. Vérifie ta connexion internet.');
      console.error('Erreur register:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDU — ÉTAT LANDING
  // Page d'accueil avec logo centré et deux boutons
  // ─────────────────────────────────────────────────────────────
  const renderLanding = () => (
    <Animated.View style={[styles.landingContent, { opacity: fadeAnim }]}>

      {/* Logo centré */}
      <Animated.View style={[
        styles.logoContainer,
        { transform: [{ scale: logoScale }] }
      ]}>
        {/* Icône carrée arrondie verte */}
        <View style={styles.logoIconBox}>
          <Ionicons name="calendar-outline" size={36} color={C.white} />
        </View>

        {/* Nom de l'application */}
        <Text style={styles.landingAppName}>
          <Text style={styles.landingEas}>Eas</Text>
          <Text style={styles.landingEven}>even</Text>
        </Text>

        {/* Tagline en italique */}
        <Text style={styles.landingTagline}>Créez l'exceptionnel</Text>

        {/* Trait orange décoratif — fidèle au Figma */}
        <View style={styles.landingDivider} />
      </Animated.View>

      {/* Boutons d'action */}
      <View style={styles.landingButtons}>

        {/* Bouton principal — Démarrer l'aventure */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => transitionTo(SCREEN.REGISTER)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryTxt}>Démarrer l'aventure</Text>
          <Ionicons name="arrow-forward-outline" size={18} color={C.white} />
        </TouchableOpacity>

        {/* Bouton secondaire — Se connecter */}
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => transitionTo(SCREEN.LOGIN)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryTxt}>Se connecter</Text>
        </TouchableOpacity>

        {/* Séparateur OU CONTINUER AVEC */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerTxt}>OU CONTINUER AVEC</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Boutons OAuth */}
        <View style={styles.oauthRow}>

          {/* Google */}
          <TouchableOpacity style={styles.oauthBtn} activeOpacity={0.8}>
            <Ionicons name="logo-google" size={22} color="#4285F4" />
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity style={styles.oauthBtn} activeOpacity={0.8}>
            <Ionicons name="logo-apple" size={22} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer légal */}
      <View style={styles.footer}>
        <TouchableOpacity>
          <Text style={styles.footerLink}>Conditions</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>·</Text>
        <TouchableOpacity>
          <Text style={styles.footerLink}>Confidentialité</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>·</Text>
        <TouchableOpacity>
          <Text style={styles.footerLink}>Aide</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footerCopy}>© 2026 Easevent Inc.</Text>
    </Animated.View>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDU — ÉTAT LOGIN
  // Formulaire de connexion email + mot de passe
  // ─────────────────────────────────────────────────────────────
  const renderLogin = () => (
    <Animated.View style={[styles.formContent, { opacity: fadeAnim }]}>

      {/* En-tête */}
      <View style={styles.formHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => transitionTo(SCREEN.LANDING)}
        >
          <Ionicons name="arrow-back-outline" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.formTitle}>Se connecter</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Sous-titre */}
      <Text style={styles.formSubtitle}>
        Bon retour parmi nous 👋{'\n'}
        Entrez vos identifiants pour continuer.
      </Text>

      {/* Message d'erreur global */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={C.error} />
          <Text style={styles.errorBannerTxt}>{error}</Text>
        </View>
      ) : null}

      {/* Champs */}
      <InputField
        icon="mail-outline"
        placeholder="Adresse email"
        value={email}
        onChangeText={(t) => { setEmail(t); setFieldErrors(p => ({ ...p, email: '' })); }}
        keyboardType="email-address"
        error={fieldErrors.email}
      />

      <InputField
        icon="lock-closed-outline"
        placeholder="Mot de passe"
        value={password}
        onChangeText={(t) => { setPassword(t); setFieldErrors(p => ({ ...p, password: '' })); }}
        secureEntry
        error={fieldErrors.password}
      />

      {/* Mot de passe oublié */}
      <TouchableOpacity style={styles.forgotBtn}>
        <Text style={styles.forgotTxt}>Mot de passe oublié ?</Text>
      </TouchableOpacity>

      {/* Bouton connexion */}
      <TouchableOpacity
        style={[styles.btnPrimary, loading && styles.btnDisabled]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator size="small" color={C.white} />
        ) : (
          <>
            <Text style={styles.btnPrimaryTxt}>Se connecter</Text>
            <Ionicons name="arrow-forward-outline" size={18} color={C.white} />
          </>
        )}
      </TouchableOpacity>

      {/* Lien inscription */}
      <View style={styles.switchRow}>
        <Text style={styles.switchTxt}>Pas encore de compte ?</Text>
        <TouchableOpacity onPress={() => transitionTo(SCREEN.REGISTER)}>
          <Text style={styles.switchLink}> S'inscrire</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDU — ÉTAT REGISTER
  // Formulaire d'inscription en 2 étapes
  // ─────────────────────────────────────────────────────────────
  const renderRegister = () => (
    <Animated.View style={[styles.formContent, { opacity: fadeAnim }]}>

      {/* En-tête */}
      <View style={styles.formHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (registerStep === 2) {
              // Retour à l'étape 1 sans réinitialiser les données
              setRegisterStep(1);
              setError('');
              setFieldErrors({});
            } else {
              transitionTo(SCREEN.LANDING);
            }
          }}
        >
          <Ionicons name="arrow-back-outline" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.formTitle}>Créer un compte</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Barre de progression — étape 1/2 ou 2/2 */}
      <ProgressBar step={registerStep} total={2} />

      {/* Sous-titre selon l'étape */}
      <Text style={styles.formSubtitle}>
        {registerStep === 1
          ? 'Étape 1 sur 2 — Vos identifiants de connexion'
          : 'Étape 2 sur 2 — Comment vous appelle-t-on ?'
        }
      </Text>

      {/* Message d'erreur global */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={C.error} />
          <Text style={styles.errorBannerTxt}>{error}</Text>
        </View>
      ) : null}

      {/* ÉTAPE 1 : email + mot de passe */}
      {registerStep === 1 && (
        <>
          <InputField
            icon="mail-outline"
            placeholder="Adresse email"
            value={email}
            onChangeText={(t) => { setEmail(t); setFieldErrors(p => ({ ...p, email: '' })); }}
            keyboardType="email-address"
            error={fieldErrors.email}
          />
          <InputField
            icon="lock-closed-outline"
            placeholder="Mot de passe (min. 8 caractères)"
            value={password}
            onChangeText={(t) => { setPassword(t); setFieldErrors(p => ({ ...p, password: '' })); }}
            secureEntry
            error={fieldErrors.password}
          />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleRegisterStep1}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryTxt}>Suivant</Text>
            <Ionicons name="arrow-forward-outline" size={18} color={C.white} />
          </TouchableOpacity>
        </>
      )}

      {/* ÉTAPE 2 : prénom + nom */}
      {registerStep === 2 && (
        <>
          <InputField
            icon="person-outline"
            placeholder="Prénom"
            value={firstName}
            onChangeText={(t) => { setFirstName(t); setFieldErrors(p => ({ ...p, firstName: '' })); }}
            autoCapitalize="words"
            error={fieldErrors.firstName}
          />
          <InputField
            icon="person-outline"
            placeholder="Nom de famille"
            value={lastName}
            onChangeText={(t) => { setLastName(t); setFieldErrors(p => ({ ...p, lastName: '' })); }}
            autoCapitalize="words"
            error={fieldErrors.lastName}
          />
          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleRegisterStep2}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <>
                <Text style={styles.btnPrimaryTxt}>Créer mon compte</Text>
                <Ionicons name="checkmark-outline" size={18} color={C.white} />
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Lien connexion */}
      <View style={styles.switchRow}>
        <Text style={styles.switchTxt}>Déjà un compte ?</Text>
        <TouchableOpacity onPress={() => transitionTo(SCREEN.LOGIN)}>
          <Text style={styles.switchLink}> Se connecter</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // KeyboardAvoidingView : remonte le contenu quand le clavier
  // s'ouvre pour que les champs restent visibles.
  // behavior='padding' sur iOS, 'height' sur Android.
  // ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollPad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {screen === SCREEN.LANDING  && renderLanding()}
            {screen === SCREEN.LOGIN    && renderLogin()}
            {screen === SCREEN.REGISTER && renderRegister()}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root:  { flex: 1, backgroundColor: C.white },
  safe:  { flex: 1 },
  kav:   { flex: 1 },
  scroll:{ flex: 1 },
  scrollPad: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  // ── Landing
  landingContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: H * 0.08,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoIconBox: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16,
    elevation: 8,
  },
  landingAppName: { fontSize: 36, letterSpacing: -1, marginBottom: 8 },
  landingEas:     { color: C.text,   fontWeight: '900' },
  landingEven:    { color: C.green,  fontWeight: '900' },
  landingTagline: {
    fontSize: 18, color: C.textSub,
    fontStyle: 'italic', marginBottom: 14,
  },
  landingDivider: {
    width: 40, height: 3,
    backgroundColor: C.orange, borderRadius: 2,
  },

  landingButtons: { gap: 12 },

  // ── Bouton principal vert
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    backgroundColor: C.green,
    borderRadius: 16, paddingVertical: 16,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10,
    elevation: 4,
  },
  btnPrimaryTxt: {
    color: C.white, fontSize: 16, fontWeight: '800',
  },
  btnDisabled: { opacity: 0.7 },

  // ── Bouton secondaire bordure
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.white,
    borderRadius: 16, paddingVertical: 15,
    borderWidth: 1.5, borderColor: C.border,
  },
  btnSecondaryTxt: {
    color: C.text, fontSize: 16, fontWeight: '700',
  },

  // ── Séparateur OAuth
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerTxt: {
    fontSize: 11, color: C.textMut,
    fontWeight: '600', letterSpacing: 0.5,
  },

  // ── Boutons OAuth
  oauthRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  oauthBtn: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: C.white,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Footer
  footer: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    marginTop: 32,
  },
  footerLink: { fontSize: 12, color: C.textMut, fontWeight: '600' },
  footerDot:  { fontSize: 12, color: C.border },
  footerCopy: {
    textAlign: 'center', fontSize: 11,
    color: C.textMut, marginTop: 6,
  },

  // ── Formulaires (login + register)
  formContent: {
    paddingTop: 16,
  },
  formHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  formTitle: {
    fontSize: 18, fontWeight: '800', color: C.text,
  },
  formSubtitle: {
    fontSize: 14, color: C.textSub,
    lineHeight: 20, marginBottom: 24,
  },

  // ── Barre de progression
  progressRow: {
    flexDirection: 'row', gap: 6,
    marginBottom: 20,
  },
  progressSegment: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: C.border,
  },
  progressSegmentActive: {
    backgroundColor: C.orange,
  },

  // ── InputField
  inputWrap:    { marginBottom: 14 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: C.border,
    minHeight: 52,
  },
  inputBoxFocused: { borderColor: C.green, backgroundColor: C.white },
  inputBoxError:   { borderColor: C.error },
  inputIcon:  { marginRight: 10 },
  input: {
    flex: 1, fontSize: 15,
    color: C.text, padding: 0,
    paddingVertical: 14,
  },
  eyeBtn: { padding: 4, marginLeft: 6 },

  // ── Erreur champ
  fieldError: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginTop: 5, paddingLeft: 4,
  },
  fieldErrorTxt: { fontSize: 12, color: C.error, fontWeight: '500' },

  // ── Erreur globale (bannière)
  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, backgroundColor: C.errorBg,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FECACA',
    marginBottom: 16,
  },
  errorBannerTxt: { fontSize: 13, color: C.error, flex: 1, lineHeight: 18 },

  // ── Mot de passe oublié
  forgotBtn:  { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotTxt:  { fontSize: 13, color: C.green, fontWeight: '600' },

  // ── Lien switch (connexion ↔ inscription)
  switchRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 20,
  },
  switchTxt:  { fontSize: 14, color: C.textSub },
  switchLink: { fontSize: 14, color: C.green, fontWeight: '700' },
});