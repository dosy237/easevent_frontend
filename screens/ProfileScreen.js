/**
 * ProfileScreen.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Page profil complète.
 *
 * Fonctionnalités connectées au backend :
 * - Affichage des infos (GET /api/auth/me/)
 * - Modification inline prénom, nom, bio (PATCH /api/auth/me/update/)
 * - Changement de mot de passe (POST /api/auth/change-password/)
 * - Suppression de compte RGPD (POST /api/auth/delete-account/)
 * - Déconnexion (AuthContext.logout)
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Animated, Platform, Alert,
  ActivityIndicator, Modal,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useAuth }      from '../context/AuthContext';

import { API_BASE } from '../config';
import { apiClient } from '../services/apiClient';
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

const PLAN_CONFIG = {
  free:     { label: 'Gratuit',  color: C.textMut,  bg: C.bg },
  standard: { label: 'Standard', color: '#2563EB',  bg: '#EFF6FF' },
  pro:      { label: 'Pro',      color: '#D97706',  bg: '#FFFBEB' },
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : AvatarPlaceholder
// Affiche les initiales si pas de photo de profil
// ════════════════════════════════════════════════════════════════
const AvatarPlaceholder = ({ firstName, lastName, size = 80 }) => {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : StatCard
// ════════════════════════════════════════════════════════════════
const StatCard = ({ icon, value, label }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={20} color={C.green} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ════════════════════════════════════════════════════════════════
// COMPOSANT : EditableField
// Champ modifiable inline avec sauvegarde vers le backend
// ════════════════════════════════════════════════════════════════
const EditableField = ({ label, value, onSave, multiline = false, maxLength }) => {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(tempVal);
    setSaving(false);
    setEditing(false);
  };

  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {!editing && (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Ionicons name="pencil-outline" size={16} color={C.green} />
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <View>
          <TextInput
            style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
            value={tempVal}
            onChangeText={setTempVal}
            multiline={multiline}
            maxLength={maxLength}
            autoFocus
            autoCapitalize={multiline ? 'sentences' : 'words'}
          />
          {maxLength && (
            <Text style={styles.charCount}>{tempVal?.length || 0}/{maxLength}</Text>
          )}
          <View style={styles.fieldActions}>
            <TouchableOpacity
              style={styles.cancelFieldBtn}
              onPress={() => { setTempVal(value); setEditing(false); }}
            >
              <Text style={styles.cancelFieldTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveFieldBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={C.white} />
                : <Text style={styles.saveFieldTxt}>Enregistrer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={[styles.fieldValue, !value && styles.fieldValueEmpty]}>
          {value || `Ajouter ${label.toLowerCase()}...`}
        </Text>
      )}
      <View style={styles.fieldDivider} />
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : PasswordModal
// Modal de changement de mot de passe
// ════════════════════════════════════════════════════════════════
const PasswordModal = ({ visible, onClose, onSuccess, accessToken }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [showOld,     setShowOld]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (!oldPassword) return setError('Saisissez votre mot de passe actuel.');
    if (newPassword.length < 8) return setError('Le nouveau mot de passe doit faire au moins 8 caractères.');
    if (newPassword !== confirmPass) return setError('Les mots de passe ne correspondent pas.');

    setLoading(true);
    try {
      await apiClient.post('/api/auth/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du changement de mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPass('');
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Changer le mot de passe</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={C.error} />
              <Text style={styles.errorBannerTxt}>{error}</Text>
            </View>
          ) : null}

          {/* Mot de passe actuel */}
          <Text style={styles.modalFieldLabel}>Mot de passe actuel</Text>
          <View style={styles.modalInputBox}>
            <Ionicons name="lock-closed-outline" size={18} color={C.textMut} />
            <TextInput
              style={styles.modalInput}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry={!showOld}
              placeholder="Votre mot de passe actuel"
              placeholderTextColor={C.textMut}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowOld(!showOld)}>
              <Ionicons name={showOld ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMut} />
            </TouchableOpacity>
          </View>

          {/* Nouveau mot de passe */}
          <Text style={styles.modalFieldLabel}>Nouveau mot de passe</Text>
          <View style={styles.modalInputBox}>
            <Ionicons name="lock-open-outline" size={18} color={C.textMut} />
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              placeholder="Minimum 8 caractères"
              placeholderTextColor={C.textMut}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)}>
              <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMut} />
            </TouchableOpacity>
          </View>

          {/* Confirmation */}
          <Text style={styles.modalFieldLabel}>Confirmer le nouveau mot de passe</Text>
          <View style={styles.modalInputBox}>
            <Ionicons name="checkmark-circle-outline" size={18} color={C.textMut} />
            <TextInput
              style={styles.modalInput}
              value={confirmPass}
              onChangeText={setConfirmPass}
              secureTextEntry
              placeholder="Répétez le nouveau mot de passe"
              placeholderTextColor={C.textMut}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.modalBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={C.white} />
              : <Text style={styles.modalBtnTxt}>Modifier le mot de passe</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : DeleteAccountModal
// Modal de suppression de compte avec confirmation par mot de passe
// ════════════════════════════════════════════════════════════════
const DeleteAccountModal = ({ visible, onClose, onConfirm, accessToken }) => {
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleDelete = async () => {
    if (!password) return setError('Confirmez avec votre mot de passe.');
    setLoading(true);
    setError('');

    try {
      await apiClient.post('/api/auth/delete-account/', { password });
      onConfirm();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la suppression.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: C.error }]}>Supprimer mon compte</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll}>
          {/* Avertissement */}
          <View style={styles.deleteWarning}>
            <Ionicons name="warning-outline" size={24} color={C.error} />
            <Text style={styles.deleteWarningTxt}>
              Cette action est irréversible. Toutes vos données personnelles seront supprimées conformément au RGPD (Art. 17).{'\n\n'}
              Vos événements publics passeront sous le nom "Utilisateur supprimé".
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={C.error} />
              <Text style={styles.errorBannerTxt}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.modalFieldLabel}>Confirmez avec votre mot de passe</Text>
          <View style={styles.modalInputBox}>
            <Ionicons name="lock-closed-outline" size={18} color={C.textMut} />
            <TextInput
              style={styles.modalInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              placeholder="Votre mot de passe"
              placeholderTextColor={C.textMut}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMut} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.deleteConfirmBtn, loading && { opacity: 0.7 }]}
            onPress={handleDelete}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={C.white} />
              : <Text style={styles.deleteConfirmTxt}>Supprimer définitivement mon compte</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelDeleteBtn} onPress={onClose}>
            <Text style={styles.cancelDeleteTxt}>Annuler</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ════════════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL : ProfileScreen
// ════════════════════════════════════════════════════════════════
export default function ProfileScreen({ navigation }) {

  const { user, accessToken, logout, updateUser, refreshAccessToken  } = useAuth();

  const [successMsg,       setSuccessMsg]       = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start();
  }, []);

  // ── Sauvegarder un champ du profil ───────────────────────────
  const saveField = async (field, value) => {
  try {
    const response = await apiClient.patch('/api/auth/me/update/', { [field]: value });
    await updateUser(response.data);
    showSuccess('Profil mis à jour');
  } catch (err) {
    if (err.response?.status === 401) {
       // AuthContext interceptor might handle this, but for safety:
       const token = await refreshAccessToken();
       if (token) {
         return saveField(field, value); // Retry once
       }
    }
    Alert.alert(
      'Erreur',
      'Impossible de sauvegarder vos modifications. Vérifiez votre connexion et réessayez.'
    );
  }
};
  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  // ── Déconnexion ───────────────────────────────────────────────
  const handleLogout = () => {
     Alert.alert(
       'Se déconnecter',
       'Voulez-vous vraiment vous déconnecter ?',
       [
         { text: 'Annuler', style: 'cancel' },
         {
            text:  'Se déconnecter',
            style: 'destructive',
            onPress: async () => {
              await logout();
            },
          },
        ]
   );
};

  // ── Après suppression du compte ───────────────────────────────
  const handleAccountDeleted = async () => {
    setShowDeleteModal(false);
    await logout();
  };

  if (!user) return null;

  const plan = PLAN_CONFIG[user.subscription_plan] || PLAN_CONFIG.free;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <SafeAreaView style={styles.safe}>

        {/* ── Header ──────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
            <Ionicons name="arrow-back-outline" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mon Profil</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Message succès ───────────────────────────────── */}
        {successMsg ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={16} color={C.green} />
            <Text style={styles.successTxt}>{successMsg}</Text>
          </View>
        ) : null}

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ── Avatar + infos principales ───────────────── */}
            <View style={styles.heroSection}>
              <View style={styles.avatarWrap}>
                <AvatarPlaceholder firstName={user.first_name} lastName={user.last_name} size={88} />
                <TouchableOpacity style={styles.avatarEditBtn}>
                  <Ionicons name="camera-outline" size={14} color={C.white} />
                </TouchableOpacity>
              </View>
              <Text style={styles.heroName}>{user.first_name} {user.last_name}</Text>
              <Text style={styles.heroEmail}>{user.email}</Text>
              <View style={[styles.planBadge, { backgroundColor: plan.bg }]}>
                <Ionicons
                  name={user.subscription_plan === 'pro' ? 'star' : 'person-outline'}
                  size={12}
                  color={plan.color}
                />
                <Text style={[styles.planLabel, { color: plan.color }]}>
                  Plan {plan.label}
                </Text>
              </View>
            </View>

            {/* ── Statistiques ─────────────────────────────── */}
            <View style={styles.statsRow}>
              <StatCard icon="calendar-outline"  value="0" label="Événements" />
              <View style={styles.statDivider} />
              <StatCard icon="people-outline"    value="0" label="Participations" />
              <View style={styles.statDivider} />
              <StatCard
                icon="star-outline"
                value={user.subscription_plan === 'pro' ? 'Pro' : user.subscription_plan === 'standard' ? 'Std' : 'Free'}
                label="Abonnement"
              />
            </View>

            {/* ── Infos modifiables ────────────────────────── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Informations personnelles</Text>
              <EditableField
                label="Prénom"
                value={user.first_name}
                onSave={(val) => saveField('first_name', val)}
                maxLength={50}
              />
              <EditableField
                label="Nom"
                value={user.last_name}
                onSave={(val) => saveField('last_name', val)}
                maxLength={50}
              />
              <EditableField
                label="Biographie"
                value={user.bio}
                onSave={(val) => saveField('bio', val)}
                multiline
                maxLength={250}
              />
            </View>

            {/* ── Compte et sécurité ───────────────────────── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Compte et sécurité</Text>

              {/* Changer le mot de passe */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setShowPasswordModal(true)}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#2563EB" />
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>Changer le mot de passe</Text>
                    <Text style={styles.menuItemSub}>Sécurisez votre compte</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={C.textMut} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Notifications */}
              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIconBox, { backgroundColor: C.greenLight }]}>
                    <Ionicons name="notifications-outline" size={18} color={C.green} />
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>Notifications</Text>
                    <Text style={styles.menuItemSub}>Gérer vos préférences</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={C.textMut} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Télécharger mes données */}
              <TouchableOpacity style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIconBox, { backgroundColor: C.orangeL }]}>
                    <Ionicons name="download-outline" size={18} color={C.orange} />
                  </View>
                  <View>
                    <Text style={styles.menuItemTitle}>Mes données</Text>
                    <Text style={styles.menuItemSub}>Télécharger (RGPD Art. 20)</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={C.textMut} />
              </TouchableOpacity>
            </View>

            {/* ── Upgrade Plan ─────────────────────────────── */}
            {user.subscription_plan === 'free' && (
              <TouchableOpacity style={styles.upgradeCard} activeOpacity={0.88}>
                <View style={styles.upgradeLeft}>
                  <Text style={styles.upgradeTitle}>Passer au Plan Standard</Text>
                  <Text style={styles.upgradeSub}>
                    Événements illimités, analytics NLP, export PDF
                  </Text>
                </View>
                <View style={styles.upgradeBtn}>
                  <Text style={styles.upgradeBtnTxt}>9,99€/mois</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ── Déconnexion ──────────────────────────────── */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={18} color={C.error} />
              <Text style={styles.logoutTxt}>Se déconnecter</Text>
            </TouchableOpacity>

            {/* ── Suppression compte ───────────────────────── */}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setShowDeleteModal(true)}
            >
              <Text style={styles.deleteTxt}>Supprimer mon compte</Text>
            </TouchableOpacity>

            <Text style={styles.version}>Easevent v1.0.0 — © 2026</Text>

          </Animated.View>
        </ScrollView>

        {/* ── Modal changement mot de passe ───────────────── */}
        <PasswordModal
          visible={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => showSuccess('Mot de passe modifié avec succès')}
          accessToken={accessToken}
        />

        {/* ── Modal suppression compte ─────────────────────── */}
        <DeleteAccountModal
          visible={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleAccountDeleted}
          accessToken={accessToken}
        />

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.greenLight,
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#C5E8D3',
  },
  successTxt: { fontSize: 13, color: C.green, fontWeight: '600' },

  scroll:    { flex: 1, backgroundColor: C.bg },
  scrollPad: { paddingBottom: 40 },

  heroSection: {
    backgroundColor: C.white, alignItems: 'center',
    paddingVertical: 32, paddingHorizontal: 20,
    marginBottom: 16,
  },
  avatarWrap:    { position: 'relative', marginBottom: 16 },
  avatarPlaceholder: {
    backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: C.white, fontWeight: '800' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.green, borderWidth: 2, borderColor: C.white,
    alignItems: 'center', justifyContent: 'center',
  },
  heroName:  { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  heroEmail: { fontSize: 14, color: C.textMut, marginBottom: 12 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  planLabel: { fontSize: 12, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row', backgroundColor: C.white,
    marginBottom: 16, paddingVertical: 20,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border,
  },
  statCard:    { flex: 1, alignItems: 'center', gap: 4 },
  statValue:   { fontSize: 20, fontWeight: '800', color: C.text },
  statLabel:   { fontSize: 11, color: C.textMut, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 8 },

  card: {
    backgroundColor: C.white, marginHorizontal: 16,
    borderRadius: 18, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 16 },

  fieldWrap:   { marginBottom: 4 },
  fieldHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  fieldLabel:      { fontSize: 11, color: C.textMut, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue:      { fontSize: 15, color: C.text, fontWeight: '500', paddingVertical: 4 },
  fieldValueEmpty: { color: C.textMut, fontStyle: 'italic' },
  fieldInput: {
    fontSize: 15, color: C.text,
    borderWidth: 1.5, borderColor: C.green,
    borderRadius: 10, padding: 10,
    backgroundColor: C.greenLight,
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: C.textMut, textAlign: 'right', marginTop: 4 },
  fieldActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cancelFieldBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  cancelFieldTxt: { fontSize: 13, color: C.textSub, fontWeight: '600' },
  saveFieldBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.green, alignItems: 'center',
  },
  saveFieldTxt:  { fontSize: 13, color: C.white, fontWeight: '700' },
  fieldDivider:  { height: 1, backgroundColor: C.border, marginTop: 14, marginBottom: 14 },

  menuItem:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconBox: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  menuItemTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  menuItemSub:   { fontSize: 12, color: C.textMut, marginTop: 1 },
  menuDivider:   { height: 1, backgroundColor: C.border, marginVertical: 14 },

  upgradeCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.green, borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  upgradeLeft:   { flex: 1 },
  upgradeTitle:  { fontSize: 15, fontWeight: '800', color: C.white, marginBottom: 4 },
  upgradeSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 17 },
  upgradeBtn:    { backgroundColor: C.orange, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  upgradeBtnTxt: { fontSize: 13, fontWeight: '800', color: C.white },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FED7D7',
    backgroundColor: '#FFF5F5',
  },
  logoutTxt: { fontSize: 15, fontWeight: '700', color: C.error },

  deleteBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  deleteTxt: { fontSize: 13, color: C.textMut, fontWeight: '500', textDecorationLine: 'underline' },

  version: { textAlign: 'center', fontSize: 11, color: C.textMut, marginBottom: 8 },

  // ── Modals
  modalRoot: { flex: 1, backgroundColor: C.white },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: C.text },
  modalScroll: { flex: 1, padding: 20 },

  modalFieldLabel: {
    fontSize: 13, fontWeight: '700', color: C.textSub,
    marginBottom: 8, marginTop: 16,
  },
  modalInputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14,
    backgroundColor: '#F9F9F9', minHeight: 52,
  },
  modalInput: { flex: 1, fontSize: 15, color: C.text, padding: 0, paddingVertical: 14 },

  modalBtn: {
    backgroundColor: C.green, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  modalBtnTxt: { color: C.white, fontSize: 16, fontWeight: '800' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF5F5', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 8,
  },
  errorBannerTxt: { fontSize: 13, color: C.error, flex: 1 },

  deleteWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFF5F5', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#FED7D7', marginBottom: 16,
  },
  deleteWarningTxt: { fontSize: 13, color: C.textSub, lineHeight: 20, flex: 1 },

  deleteConfirmBtn: {
    backgroundColor: C.error, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  deleteConfirmTxt: { color: C.white, fontSize: 15, fontWeight: '800' },

  cancelDeleteBtn: {
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  cancelDeleteTxt: { fontSize: 15, color: C.textSub, fontWeight: '600' },
});