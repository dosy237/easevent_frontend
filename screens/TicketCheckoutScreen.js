/**
 * TicketCheckoutScreen.js — Easevent (M26 « Payer et générer mon ticket »)
 * ════════════════════════════════════════════════════════════════
 * Paramètre : ticketId (ticket « en attente », payant).
 *
 * Le paiement se fait sur la page sécurisée Stripe Checkout (carte,
 * Apple Pay, Google Pay, prélèvement IBAN selon le tableau de bord
 * Stripe). Aucune donnée bancaire ne transite par Easevent.
 * Le ticket est généré par le serveur à réception du webhook Stripe :
 * l'écran attend la confirmation puis ouvre le ticket (M27).
 *
 * Si l'utilisateur quitte, le ticket reste dans Mes tickets › En attente.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { C } from '../constants/theme';
import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import LoadingMessages from '../components/ui/LoadingMessages';
import ticketService from '../services/ticketService';
import { apiErrorMessage } from '../services/authService';
import { formatDateLong, formatPrice } from '../utils/format';
import { useTicketBadge } from '../context/TicketBadgeContext';

const POLL_EVERY = 2000;
const POLL_FOR = 30000;

export default function TicketCheckoutScreen({ navigation, route }) {
  const { ticketId } = route.params || {};
  const { refresh: refreshBadge } = useTicketBadge();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | opening | waiting | processing
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const t = await ticketService.fetchOne(ticketId);
      if (alive.current) setTicket(t);
      return t;
    } catch (err) {
      if (alive.current) setError(apiErrorMessage(err, 'Ticket introuvable.'));
      return null;
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const showTicket = (t) => {
    refreshBadge({ force: true });
    navigation.navigate('TabTickets', { screen: 'Tickets', params: { tab: 'generated', openTicketId: t.id, justPaid: true } });
  };

  // Attend la confirmation envoyée par Stripe au serveur (webhook)
  const waitForConfirmation = async () => {
    setPhase('waiting');
    const until = Date.now() + POLL_FOR;
    while (alive.current && Date.now() < until) {
      const t = await load();
      if (t?.status === 'generated') return showTicket(t);
      if (t?.payment_status === 'processing') { setPhase('processing'); return null; }
      await new Promise((r) => setTimeout(r, POLL_EVERY));
    }
    if (alive.current) setPhase('idle');
    return null;
  };

  const pay = async () => {
    setError('');
    setPhase('opening');
    try {
      const { checkout_url: url } = await ticketService.checkout(ticketId);
      await WebBrowser.openAuthSessionAsync(url, 'easevent://tickets');
      await waitForConfirmation();
    } catch (err) {
      setError(apiErrorMessage(err, 'Le paiement est momentanément indisponible.'));
      setPhase('idle');
    }
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabTickets', { screen: 'Tickets' }));

  if (!ticket && !error) {
    return <View style={[styles.root, styles.center]}><ActivityIndicator color={C.green} size="large" accessibilityLabel="Chargement" /></View>;
  }

  const e = ticket?.event || {};
  const price = ticket ? formatPrice(ticket.price, ticket.currency) : '';
  const busy = phase === 'opening' || phase === 'waiting';

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={goBack} />
          <Text style={styles.headerTitle} accessibilityRole="header">Payer mon ticket</Text>
          <View style={styles.secure}>
            <Ionicons name="lock-closed-outline" size={14} color={C.green} />
            <Text style={styles.secureTxt}>Sécurisé</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {ticket && (
            <>
              <View style={styles.hero}>
                {e.cover_image ? <Image source={{ uri: e.cover_image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                <View style={styles.heroShade} />
                <View style={styles.glass}>
                  <View>
                    <Text style={styles.glassTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.glassMeta} numberOfLines={1}>
                      {formatDateLong(e.start_date)}{e.location_address ? ` · ${e.location_address}` : ''}
                    </Text>
                  </View>
                  <View style={styles.glassBottom}>
                    <Text style={styles.glassChip} numberOfLines={1}>1 ticket · {ticket.participant}</Text>
                    <Text style={styles.glassPrice}>{price}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.summary}>
                <View style={[styles.sumRow, styles.sumRowBorder]}>
                  <Text style={styles.sumLabel} numberOfLines={1}>Ticket · {e.title}</Text>
                  <Text style={styles.sumValue}>{price}</Text>
                </View>
                <View style={styles.sumRow}>
                  <Text style={styles.sumTotal}>Total TTC</Text>
                  <Text style={styles.sumTotalValue}>{price}</Text>
                </View>
              </View>

              <View style={styles.methods}>
                {[
                  ['card-outline', 'Carte bancaire'],
                  ['logo-apple', 'Apple Pay'],
                  ['logo-google', 'Google Pay'],
                  ['business-outline', 'Prélèvement IBAN'],
                ].map(([icon, label]) => (
                  <View key={label} style={styles.method}>
                    <Ionicons name={icon} size={16} color={C.text} />
                    <Text style={styles.methodTxt}>{label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.methodsNote}>
                Vous réglez sur la page sécurisée de Stripe, notre prestataire de paiement. Easevent ne voit jamais vos coordonnées bancaires.
              </Text>
            </>
          )}

          {phase === 'waiting' && (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <ActivityIndicator color={C.green} />
              <LoadingMessages messages={['Nous attendons la confirmation de Stripe…', 'Votre ticket est en préparation…', 'Encore un instant…']} />
            </View>
          )}
          {phase === 'processing' && (
            <View style={[styles.notice, styles.noticeInfo]} accessibilityRole="alert">
              <Ionicons name="time-outline" size={18} color={C.green} />
              <Text style={styles.noticeTxt}>
                Paiement enregistré. Pour un prélèvement bancaire, la confirmation peut prendre quelques jours : votre ticket sera généré automatiquement.
              </Text>
            </View>
          )}
          {error ? (
            <View style={[styles.notice, styles.noticeError]} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={18} color={C.errorText} />
              <Text style={[styles.noticeTxt, { color: C.errorText }]}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {phase === 'processing' ? (
            <PrimaryButton label="Voir mes tickets" onPress={() => navigation.navigate('TabTickets', { screen: 'Tickets', params: { tab: 'pending' } })} />
          ) : (
            <PrimaryButton
              label={busy ? 'Paiement en cours…' : `Payer ${price} et générer mon ticket`}
              onPress={pay}
              loading={busy}
              disabled={!ticket || ticket.status !== 'pending'}
            />
          )}
          <View style={styles.footNote}>
            <Ionicons name="information-circle-outline" size={14} color={C.green} />
            <Text style={styles.footNoteTxt}>
              Si vous quittez cet écran, votre ticket reste dans Mes tickets › En attente. Vous pourrez payer plus tard ou l'annuler.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: C.white, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secureTxt: { fontSize: 12, fontWeight: '700', color: C.green },
  scroll: { padding: 16, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  hero: { height: 150, borderRadius: 22, overflow: 'hidden', backgroundColor: C.green },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,30,20,0.4)' },
  glass: {
    position: 'absolute', top: 14, left: 14, right: 14, bottom: 14, borderRadius: 18, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'space-between',
  },
  glassTitle: { fontSize: 17, fontWeight: '900', color: C.white },
  glassMeta: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  glassBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 },
  glassChip: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: C.white, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  glassPrice: { fontSize: 26, fontWeight: '900', color: C.white },
  summary: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 4 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  sumRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  sumLabel: { flex: 1, fontSize: 13, color: C.textMut },
  sumValue: { fontSize: 13, fontWeight: '600', color: C.text },
  sumTotal: { fontSize: 15, fontWeight: '800', color: C.text },
  sumTotalValue: { fontSize: 15, fontWeight: '900', color: C.text },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 8 },
  methodTxt: { fontSize: 12, fontWeight: '600', color: C.text },
  methodsNote: { fontSize: 12, color: C.textSub, lineHeight: 17 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12 },
  noticeInfo: { backgroundColor: C.greenLight, borderColor: C.greenSoft },
  noticeError: { backgroundColor: C.errorBg, borderColor: '#FED7D7' },
  noticeTxt: { flex: 1, fontSize: 13, color: C.greenDark, lineHeight: 19 },
  footer: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 24, gap: 10 },
  footNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  footNoteTxt: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 17 },
});
