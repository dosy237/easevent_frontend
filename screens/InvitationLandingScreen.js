/**
 * InvitationLandingScreen.js — Easevent (M31 « Lien d'invitation »)
 * ════════════════════════════════════════════════════════════════
 * Ouvert par le lien easevent://i/:token (email M30, SMS, page web /i/).
 *
 * Visiteur :
 *  - « Créer mon compte »   → E05 avec l'email pré-rempli + jeton
 *  - « J'ai déjà un compte » → E04 avec le jeton
 *    Le jeton est gardé en mémoire : après la connexion (ou la
 *    vérification de l'email), l'invitation est rattachée au compte
 *    puis l'application ouvre Mes tickets.
 *  - « Décliner l'invitation » → sans compte.
 * Connecté :
 *  - « Accepter l'invitation » → rattachement + acceptation → ticket
 *    en attente dans Mes tickets (M25).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { C, TOUCH } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTicketBadge } from '../context/TicketBadgeContext';
import LoadingMessages, { MESSAGES } from '../components/ui/LoadingMessages';
import { LogoMark } from '../components/illustrations';
import invitationService from '../services/invitationService';
import eventService from '../services/eventService';
import { apiErrorMessage } from '../services/authService';
import { KEYS, setItem } from '../services/storage';
import { showAlert } from '../utils/dialog';
import { formatPrice } from '../utils/format';
import { isRsvpCancel } from '../utils/rsvp';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const chipDate = (iso) => {
  const d = new Date(iso);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function InvitationLandingScreen({ navigation, route }) {
  const token = route.params?.token;
  const { isAuthenticated } = useAuth();
  const badge = useTicketBadge();
  const [inv, setInv] = useState(null);
  const [error, setError] = useState(null);   // { title, detail }
  const [busy, setBusy] = useState('');
  const [declined, setDeclined] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setError({ title: 'Lien invalide', detail: "Ce lien d'invitation est incomplet." }); return; }
    try {
      const data = await invitationService.byToken(token);
      setInv(data);
      setDeclined(data.status === 'declined');
    } catch (err) {
      const d = err.response?.data || {};
      setError({ title: d.title || 'Invitation indisponible', detail: d.detail || apiErrorMessage(err) });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const goAccount = async (mode) => {
    await setItem(KEYS.PENDING_INVITE, token);
    navigation.navigate('Login', { mode, prefillEmail: inv?.invited?.email || '', invitationToken: token });
  };

  const openTickets = () => navigation.navigate('TabTickets', { screen: 'Tickets', params: { tab: 'pending' } });

  const accept = async () => {
    setBusy('accept');
    try {
      const { invitation_id: id } = await invitationService.claim(token);
      await eventService.respondToInvitation(id, 'confirmed');
      badge?.refresh?.({ force: true });
      showAlert('Invitation acceptée', 'Votre ticket vous attend dans Mes tickets : validez-le pour le générer.',
        [{ text: 'Voir mon ticket', onPress: openTickets }]);
    } catch (err) {
      if (isRsvpCancel(err)) return;
      showAlert('Action impossible', apiErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const decline = () => {
    showAlert("Décliner l'invitation", `${inv.organizer.first_name} sera informé·e que vous ne viendrez pas.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Décliner', style: 'destructive', onPress: async () => {
          setBusy('decline');
          try {
            await invitationService.declineByToken(token);
            setDeclined(true);
            if (isAuthenticated) badge?.refresh?.({ force: true });
          } catch (err) {
            showAlert('Action impossible', apiErrorMessage(err));
          } finally {
            setBusy('');
          }
        },
      },
    ]);
  };

  const leave = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else if (isAuthenticated) openTickets();
    else navigation.navigate('Home');
  };

  const e = inv?.event;
  const hasAccount = inv?.invited?.has_account;

  return (
    <View style={styles.root}>
      {e?.cover_image ? <Image source={{ uri: e.cover_image }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      <View style={styles.shade} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.brandRow}>
            <View style={styles.brand}>
              <LogoMark size={34} simplified />
              <Text style={styles.brandTxt}>Easevent</Text>
            </View>
            <Pressable onPress={leave} style={styles.close} accessibilityRole="button" accessibilityLabel="Fermer">
              <Ionicons name="close" size={22} color={C.white} />
            </Pressable>
          </View>
          <View style={{ flex: 1, minHeight: 40 }} />

          {!inv && !error && (
            <View style={styles.card} accessibilityLiveRegion="polite">
              <ActivityIndicator color={C.white} />
              <LoadingMessages messages={MESSAGES.invitation} style={{ marginTop: 10 }} />
            </View>
          )}

          {error && (
            <View style={styles.card} accessibilityRole="alert">
              <Text style={styles.title}>{error.title}</Text>
              <Text style={styles.body}>{error.detail}</Text>
              <Pressable onPress={leave} style={[styles.btn, styles.btnWhite]} accessibilityRole="button">
                <Text style={styles.btnWhiteTxt}>{isAuthenticated ? 'Voir mes tickets' : 'Découvrir Easevent'}</Text>
              </Pressable>
            </View>
          )}

          {inv && declined && (
            <View style={styles.card} accessibilityRole="alert">
              <Text style={styles.title}>Invitation déclinée</Text>
              <Text style={styles.body}>
                {inv.organizer.first_name} sait que vous ne pourrez pas venir à « {e.title} ». Merci d'avoir répondu.
              </Text>
              <Pressable onPress={leave} style={[styles.btn, styles.btnGhost]} accessibilityRole="button">
                <Text style={styles.btnGhostTxt}>Fermer</Text>
              </Pressable>
            </View>
          )}

          {inv && !declined && (
            <>
              <View style={styles.card}>
                <View style={styles.who}>
                  <View style={styles.avatar}><Text style={styles.avatarTxt}>{inv.organizer.initials}</Text></View>
                  <Text style={styles.whoTxt}>
                    <Text style={{ fontWeight: '800', color: C.white }}>{inv.organizer.first_name} {inv.organizer.last_name}</Text> vous invite
                  </Text>
                </View>
                <Text style={styles.title} accessibilityRole="header">{e.title}</Text>
                <View style={styles.chips}>
                  <Text style={styles.chip}>{chipDate(e.start_date)}</Text>
                  <Text style={styles.chip}>{e.is_online ? 'En ligne' : e.location_address}</Text>
                  <Text style={[styles.chip, styles.chipPrice]}>{formatPrice(e.is_paid ? e.price : 0, e.currency)}</Text>
                  {e.dress_code ? <Text style={styles.chip}>Dress code : {e.dress_code}</Text> : null}
                </View>
                {inv.message ? <Text style={styles.quote}>« {inv.message} »</Text> : null}

                <View style={styles.steps} accessibilityLabel="Étapes : compte, accepter, mon ticket">
                  {[isAuthenticated ? 'Connecté' : (hasAccount ? 'Se connecter' : 'Créer un compte'), 'Accepter', 'Mon ticket'].map((s, i) => (
                    <View key={s} style={styles.step}>
                      <View style={[styles.stepN, (i === 0 || (isAuthenticated && i === 1)) && styles.stepNOn]}>
                        {isAuthenticated && i === 0
                          ? <Ionicons name="checkmark" size={12} color={C.green} />
                          : <Text style={[styles.stepNTxt, (i === 0 || (isAuthenticated && i === 1)) && { color: C.green }]}>{i + 1}</Text>}
                      </View>
                      <Text style={styles.stepTxt}>{s}</Text>
                    </View>
                  ))}
                </View>

                {isAuthenticated ? (
                  <Pressable onPress={accept} disabled={!!busy} style={[styles.btn, styles.btnWhite]} accessibilityRole="button" accessibilityState={{ busy: busy === 'accept' }} aria-busy={busy === 'accept'}>
                    {busy === 'accept' ? <ActivityIndicator color={C.green} /> : <Text style={styles.btnWhiteTxt}>Accepter l'invitation</Text>}
                    {busy !== 'accept' && <Ionicons name="arrow-forward" size={18} color={C.green} />}
                  </Pressable>
                ) : (
                  <>
                    <Pressable onPress={() => goAccount(hasAccount ? 'login' : 'register')} style={[styles.btn, styles.btnWhite]} accessibilityRole="button">
                      <Text style={styles.btnWhiteTxt}>{hasAccount ? 'Me connecter' : 'Créer mon compte'}</Text>
                      <Ionicons name="arrow-forward" size={18} color={C.green} />
                    </Pressable>
                    {inv.invited.email && !hasAccount ? (
                      <Text style={styles.note}>Email pré-rempli : {inv.invited.email}</Text>
                    ) : null}
                    <Pressable onPress={() => goAccount(hasAccount ? 'register' : 'login')} style={[styles.btn, styles.btnGhost]} accessibilityRole="button">
                      <Text style={styles.btnGhostTxt}>{hasAccount ? 'Créer un autre compte' : "J'ai déjà un compte"}</Text>
                    </Pressable>
                  </>
                )}
              </View>
              <Pressable onPress={decline} disabled={!!busy} style={styles.decline} accessibilityRole="button">
                {busy === 'decline' ? <ActivityIndicator color={C.white} /> : <Text style={styles.declineTxt}>Décliner l'invitation</Text>}
              </Pressable>
            </>
          )}
          <Text style={styles.legal}>Lien personnel et non transférable.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F2A1F' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,32,24,0.64)' },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 28, width: '100%', maxWidth: 480, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  brandTxt: { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: -0.4 },
  close: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: 24, padding: 20, backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: C.white },
  whoTxt: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.92)' },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '900', color: C.white, letterSpacing: -0.5, marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.92)', marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { fontSize: 12, fontWeight: '600', color: C.white, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  chipPrice: { backgroundColor: C.white, color: C.green, fontWeight: '800' },
  quote: { fontSize: 14, lineHeight: 20, color: C.white, borderLeftWidth: 3, borderLeftColor: C.white, paddingLeft: 10, marginBottom: 14 },
  steps: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 18 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  stepN: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  stepNOn: { backgroundColor: C.white },
  stepNTxt: { fontSize: 11, fontWeight: '800', color: C.white },
  stepTxt: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.92)', flexShrink: 1 },
  btn: { minHeight: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnWhite: { backgroundColor: C.white },
  btnWhiteTxt: { fontSize: 16, fontWeight: '800', color: C.green },
  btnGhost: { marginTop: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  btnGhostTxt: { fontSize: 15, fontWeight: '700', color: C.white },
  note: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  decline: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  declineTxt: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', textDecorationLine: 'underline' },
  legal: { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 12 },
});
