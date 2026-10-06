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
 *                Étape 1 : email + mot de passe (E05)
 *                Étape 2 : prénom + nom + consentement RGPD (M01)
 *                connecté à POST /api/auth/register/
 *
 * Paramètres de navigation acceptés :
 *   mode            : 'login' | 'register' (ouvre directement le formulaire)
 *   prefillEmail    : email pré-rempli (lien d'invitation, M03 « Modifier »)
 *   invitationToken : token d'invitation transmis à l'inscription (parcours G)
 *
 * Après inscription → M03 « Vérifiez votre email ».
 * Après connexion réussie → espace connecté (AuthContext).
 * ════════════════════════════════════════════════════════════════
 */
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
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

import Checkbox from '../components/ui/Checkbox';
import { LogoMark } from '../components/illustrations';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';

const { height: H } = Dimensions.get('window');

// Le pilote natif d'Animated n'existe pas sur le web
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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
  textMut:    '#757575',
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

const InputField = ({
  icon,
  placeholder,
  value,
  onChangeText,
  secureEntry = false,
  error,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  onSubmitEditing,
  returnKeyType,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputWrap}>
      <View style={[
        styles.inputBox,
        focused && styles.inputBoxFocused,
        error  && styles.inputBoxError,
      ]}>
        <Ionicons
          name={icon}
          size={18}
          color={focused ? C.green : C.textMut}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={C.textMut}
          accessibilityLabel={placeholder}
          aria-invalid={!!error}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureEntry && (
          <TouchableOpacity
          accessibilityRole="button"
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={C.textMut}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <View style={styles.fieldError}>
          <Ionicons name="alert-circle-outline" size={12} color={C.error} />
          <Text style={styles.fieldErrorTxt}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const ProgressBar = ({ step, total }) => (
  <View style={styles.progressRow}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.progressSegment,
          i < step && styles.progressSegmentActive,
          i === total - 1 && { marginRight: 0 },
        ]}
      />
    ))}
  </View>
);

export default function LoginScreen({ navigation, route }) {
  const { login } = useAuth();
  const params = route?.params || {};
  const [screen, setScreen] = useState(
    params.mode === 'login' ? SCREEN.LOGIN : params.mode === 'register' ? SCREEN.REGISTER : SCREEN.LANDING
  );
  const [registerStep, setRegisterStep] = useState(1);
  const [email, setEmail] = useState(params.prefillEmail || '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const invitationToken = params.invitationToken;

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(logoScale, {
      toValue:  1,
      friction: 6,
      tension:  80,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, []);

  // Navigation vers Login avec de nouveaux paramètres (ex. depuis M03 « Modifier »)
  useEffect(() => {
    if (params.prefillEmail) setEmail(params.prefillEmail);
    if (params.mode === 'login') setScreen(SCREEN.LOGIN);
    if (params.mode === 'register') { setScreen(SCREEN.REGISTER); setRegisterStep(1); }
  }, [params.mode, params.prefillEmail]);

  const goToPrivacy = () => navigation?.navigate('PrivacyPolicy');
  const goToForgotPassword = () => navigation?.navigate('ForgotPassword', { email: email.trim() });
  const showOAuthSoon = (provider) => showAlert(
    `Connexion avec ${provider}`,
    'Bientôt disponible. En attendant, utilisez votre adresse email.',
  );

  const transitionTo = (newScreen) => {
    setError('');
    setFieldErrors({});
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 150, useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      setScreen(newScreen);
      setRegisterStep(1);
    });
  };

  // Fondu d'entrée lancé APRÈS le rendu du nouveau formulaire : sur le web,
  // l'animation démarrée avant le montage laissait l'opacité bloquée à 0.
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 200, useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [screen]);

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

  const handleLogin = async () => {
    if (!validateLoginFields()) return;
    setLoading(true);
    setError('');
    try {
      const data = await authService.login(email, password);
      await login({
        userData: data.user,
        access:   data.access,
        refresh:  data.refresh,
      });
    } catch (err) {
      // Compte non vérifié → écran M03 avec renvoi immédiat possible
      if (err.response?.data?.code === 'email_not_verified') {
        navigation?.navigate('VerifyEmail', { email: err.response.data.email || email.trim(), canResendNow: true });
        return;
      }
      setError(apiErrorMessage(err, 'Email ou mot de passe incorrect.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStep1 = () => {
    if (!validateRegisterStep1()) return;
    setRegisterStep(2);
  };

  const handleRegisterStep2 = async () => {
    if (!validateRegisterStep2() || !acceptedPrivacy) return;
    setLoading(true);
    setError('');
    try {
      const data = await authService.register({
        email:            email.trim(),
        password,
        first_name:       firstName.trim(),
        last_name:        lastName.trim(),
        accepted_privacy: true,
        marketing_opt_in: marketingOptIn,
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
      });
      if (data.access) {
        // Compte déjà vérifié (ex. invitation reçue sur cette adresse)
        await login({ userData: data.user, access: data.access, refresh: data.refresh });
      } else {
        navigation?.navigate('VerifyEmail', { email: data.email || email.trim() });
      }
    } catch (err) {
      const body = err.response?.data || {};
      // Erreur sur l'email ou le mot de passe → retour à l'étape 1
      if (body.email || body.password) {
        setRegisterStep(1);
        setFieldErrors({ email: body.email || '', password: body.password || '' });
      }
      setError(apiErrorMessage(err, 'Une erreur est survenue lors de l\'inscription.'));
    } finally {
      setLoading(false);
    }
  };

  const renderLanding = () => (
    <Animated.View style={[styles.landingContent, { opacity: fadeAnim }]}>
      <Animated.View style={[
        styles.logoContainer,
        { transform: [{ scale: logoScale }] }
      ]}>
        <View style={styles.logoIconBox}>
          <LogoMark size={80} />
        </View>
        <Text style={styles.landingAppName} accessibilityRole="header" accessibilityLabel="Easevent">
          <Text style={styles.landingEas}>Eas</Text>
          <Text style={styles.landingEven}>event</Text>
        </Text>
        <Text style={styles.landingTagline}>Créez l'exceptionnel</Text>
        <View style={styles.landingDivider} />
      </Animated.View>

      <View style={styles.landingButtons}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.btnPrimary}
          onPress={() => transitionTo(SCREEN.REGISTER)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryTxt}>Démarrer l'aventure</Text>
          <Ionicons name="arrow-forward-outline" size={18} color={C.white} />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.btnSecondary}
          onPress={() => transitionTo(SCREEN.LOGIN)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryTxt}>Se connecter</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerTxt}>OU CONTINUER AVEC</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.oauthRow}>
          <TouchableOpacity
          accessibilityRole="button"
            style={styles.oauthBtn}
            activeOpacity={0.8}
            onPress={() => showOAuthSoon('Google')}
            accessibilityRole="button"
            accessibilityLabel="Continuer avec Google"
          >
            <Ionicons name="logo-google" size={22} color="#4285F4" />
          </TouchableOpacity>
          <TouchableOpacity
          accessibilityRole="button"
            style={styles.oauthBtn}
            activeOpacity={0.8}
            onPress={() => showOAuthSoon('Apple')}
            accessibilityRole="button"
            accessibilityLabel="Continuer avec Apple"
          >
            <Ionicons name="logo-apple" size={22} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerBtn}
          accessibilityRole="link"
          onPress={() => navigation?.navigate('Terms')}
        >
          <Text style={styles.footerLink}>Conditions</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>·</Text>
        <TouchableOpacity style={styles.footerBtn} accessibilityRole="link" onPress={goToPrivacy}>
          <Text style={styles.footerLink}>Confidentialité</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>·</Text>
        <TouchableOpacity
          style={styles.footerBtn}
          accessibilityRole="link"
          onPress={() => navigation?.navigate('Help')}
        >
          <Text style={styles.footerLink}>Aide</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footerCopy}>© 2026 Easevent Inc.</Text>
    </Animated.View>
  );

  const renderLogin = () => (
    <Animated.View style={[styles.formContent, { opacity: fadeAnim }]}>
      <View style={styles.formHeader}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backBtn}
          onPress={() => transitionTo(SCREEN.LANDING)}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back-outline" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.formTitle}>Se connecter</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.formSubtitle}>
        Bon retour parmi nous.{"\n"}
        Entrez vos identifiants pour continuer.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={C.error} />
          <Text style={styles.errorBannerTxt}>{error}</Text>
        </View>
      ) : null}

      <InputField
        icon="mail-outline"
        placeholder="Adresse email"
        value={email}
        onChangeText={(t) => { setEmail(t); setFieldErrors(p => ({ ...p, email: '' })); }}
        keyboardType="email-address"
        autoComplete="email"
        error={fieldErrors.email}
      />

      <InputField
        icon="lock-closed-outline"
        placeholder="Mot de passe"
        value={password}
        onChangeText={(t) => { setPassword(t); setFieldErrors(p => ({ ...p, password: '' })); }}
        secureEntry
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        error={fieldErrors.password}
      />

      <TouchableOpacity
        style={styles.forgotBtn}
        onPress={goToForgotPassword}
        accessibilityRole="link"
      >
        <Text style={styles.forgotTxt}>Mot de passe oublié ?</Text>
      </TouchableOpacity>

      <TouchableOpacity
          accessibilityRole="button"
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

      <View style={styles.switchRow}>
        <Text style={styles.switchTxt}>Pas encore de compte ?</Text>
        <TouchableOpacity
          accessibilityRole="button" onPress={() => transitionTo(SCREEN.REGISTER)}>
          <Text style={styles.switchLink}> S'inscrire</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderRegister = () => (
    <Animated.View style={[styles.formContent, { opacity: fadeAnim }]}>
      <View style={styles.formHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => {
            if (registerStep === 2) {
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

      <ProgressBar step={registerStep} total={2} />

      <Text style={styles.formSubtitle}>
        {registerStep === 1
          ? 'Étape 1 sur 2 — Vos identifiants de connexion'
          : 'Étape 2 sur 2 — Comment vous appelle-t-on ?'
        }
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={C.error} />
          <Text style={styles.errorBannerTxt}>{error}</Text>
        </View>
      ) : null}

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
            autoComplete="new-password"
            returnKeyType="next"
            onSubmitEditing={handleRegisterStep1}
            error={fieldErrors.password}
          />
          <TouchableOpacity
          accessibilityRole="button"
            style={styles.btnPrimary}
            onPress={handleRegisterStep1}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryTxt}>Suivant</Text>
            <Ionicons name="arrow-forward-outline" size={18} color={C.white} />
          </TouchableOpacity>
        </>
      )}

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

          {/* ── Consentement RGPD (M01) ─────────────────────── */}
          <View style={styles.consentBox}>
            <Checkbox
              checked={acceptedPrivacy}
              onChange={setAcceptedPrivacy}
              required
              accessibilityLabel="J'ai lu et j'accepte la politique de confidentialité et les conditions d'utilisation. Obligatoire."
            >
              <Text style={styles.consentTxt}>
                J'ai lu et j'accepte la{' '}
                <Text style={styles.consentLink} onPress={goToPrivacy} accessibilityRole="link">politique de confidentialité</Text>
                {' '}et les{' '}
                <Text style={styles.consentLink} onPress={() => navigation?.navigate('Terms')} accessibilityRole="link">conditions d'utilisation</Text>.{' '}
                <Text style={styles.consentRequired}>*</Text>
              </Text>
            </Checkbox>
            <View style={styles.consentDivider} />
            <Checkbox
              checked={marketingOptIn}
              onChange={setMarketingOptIn}
              accessibilityLabel="Recevoir les nouveautés Easevent par email, facultatif"
            >
              <Text style={styles.consentTxtSub}>
                Recevoir les nouveautés Easevent par email <Text style={{ color: C.textMut }}>(facultatif)</Text>
              </Text>
            </Checkbox>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, (loading || !acceptedPrivacy) && styles.btnInactive]}
            onPress={handleRegisterStep2}
            disabled={loading || !acceptedPrivacy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading || !acceptedPrivacy, busy: loading }}
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
          {!acceptedPrivacy && (
            <View style={styles.consentHint}>
              <Ionicons name="shield-outline" size={14} color={C.textMut} />
              <Text style={styles.consentHintTxt}>Le bouton s'active une fois la case cochée.</Text>
            </View>
          )}
        </>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchTxt}>Déjà un compte ?</Text>
        <TouchableOpacity
          accessibilityRole="button" onPress={() => transitionTo(SCREEN.LOGIN)}>
          <Text style={styles.switchLink}> Se connecter</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

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
    backgroundColor: C.green, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16,
    elevation: 8,
  },
  landingAppName: { fontSize: 36, letterSpacing: -1, marginBottom: 8 },
  landingEas:     { color: C.green,  fontWeight: '900' },
  landingEven:    { color: C.orange, fontWeight: '900' },
  landingTagline: {
    fontSize: 18, color: C.textSub,
    fontStyle: 'italic', marginBottom: 14,
  },
  landingDivider: {
    width: 40, height: 3,
    backgroundColor: C.orange, borderRadius: 2,
  },
  landingButtons: { gap: 12 },
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
  btnInactive: { backgroundColor: '#8DB5A3', shadowOpacity: 0, elevation: 0 },
  consentBox: {
    gap: 14, backgroundColor: C.bg, borderRadius: 16, padding: 16, marginBottom: 24,
  },
  consentDivider: { height: 1, backgroundColor: C.border },
  consentTxt: { fontSize: 14, lineHeight: 20, color: C.text },
  consentTxtSub: { fontSize: 14, lineHeight: 20, color: C.textSub },
  consentLink: { color: C.green, fontWeight: '700' },
  consentRequired: { color: '#C0392B' },
  consentHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14,
  },
  consentHintTxt: { fontSize: 12, color: C.textMut },
  footerBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
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
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerTxt: {
    fontSize: 11, color: C.textMut,
    fontWeight: '600', letterSpacing: 0.5,
  },
  oauthRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  oauthBtn: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  footer: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 8, marginTop: 24,
  },
  footerLink: { color: C.textMut, fontSize: 12 },
  footerDot: { color: C.textMut, fontSize: 12 },
  footerCopy: {
    color: C.textMut, fontSize: 11,
    textAlign: 'center', marginTop: 12, marginBottom: 8,
  },
  formContent: { flex: 1, paddingTop: 20 },
  formHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 32,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
  },
  formTitle: { fontSize: 24, fontWeight: '900', color: C.text },
  formSubtitle: {
    fontSize: 16, color: C.textSub,
    lineHeight: 24, marginBottom: 32,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.errorBg, padding: 12,
    borderRadius: 12, marginBottom: 20,
    borderWidth: 1, borderColor: C.error + '20',
  },
  errorBannerTxt: { color: C.error, fontSize: 13, fontWeight: '500' },
  inputWrap: { marginBottom: 20 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.inputBg,
    paddingHorizontal: 16, height: 60,
  },
  inputBoxFocused: { borderColor: C.green, backgroundColor: C.white },
  inputBoxError: { borderColor: C.error, backgroundColor: C.errorBg },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1, color: C.text, fontSize: 16,
    fontWeight: '500', height: '100%', outlineStyle: 'none',
  },
  eyeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  fieldError: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginTop: 6, paddingLeft: 4,
  },
  fieldErrorTxt: { color: C.error, fontSize: 12 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 32, minHeight: 44, justifyContent: 'center' },
  forgotTxt: { color: C.green, fontSize: 14, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 32,
  },
  switchTxt: { color: C.textMut, fontSize: 14 },
  switchLink: { color: C.green, fontSize: 14, fontWeight: '700' },
  progressRow: {
    flexDirection: 'row', gap: 8, marginBottom: 24,
  },
  progressSegment: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: C.border,
  },
  progressSegmentActive: { backgroundColor: C.green },
});