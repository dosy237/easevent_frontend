/**
 * screens/EventFinanceScreen.js — finances d'un événement payant (organisateur)
 * ════════════════════════════════════════════════════════════════
 * L'essentiel en haut : « Vous gagnez X ». Puis le détail : recettes, billets
 * vendus, commission Easevent, remboursements, moyens de paiement, ventes par
 * prix et par jour, et où arrive l'argent (virements).
 * params : { event }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { BackButton, SecondaryButton } from '../components/ui/Buttons';
import { C } from '../constants/theme';
import teamService from '../services/teamService';
import { apiErrorMessage } from '../services/authService';
import { formatDayMonth, formatPrice } from '../utils/format';

const pct = (n) => `${String(n).replace('.', ',')} %`;

const Line = ({ label, value, strong, minus, last }) => (
  <View style={[s.line, last && { borderBottomWidth: 0 }]}>
    <Text style={[s.lineLabel, strong && s.strong]}>{label}</Text>
    <Text style={[s.lineValue, strong && s.strong, minus && { color: C.errorText }]}>{minus ? '− ' : ''}{value}</Text>
  </View>
);

export default function EventFinanceScreen({ route, navigation }) {
  const event = route?.params?.event || {};
  const [f, setF] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setF(await teamService.finance(event.id)); setError(''); }
    catch (err) { setError(apiErrorMessage(err, 'Les finances ne sont pas disponibles.')); }
  }, [event.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const money = (v) => formatPrice(v, f?.currency);
  const maxDay = Math.max(1, ...(f?.by_day || []).map((d) => d.count));

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} accessibilityRole="header">Finances</Text>
          <Text style={s.sub} numberOfLines={1}>{event.title}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.pad}>
        {error ? <Text style={s.error}>{error}</Text> : null}
        {!f && !error ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : null}
        {f ? (
          <>
            {/* ── L'essentiel ─────────────────────────────── */}
            <View style={s.hero} accessible accessibilityLabel={`Vous gagnez ${money(f.net)}`}>
              <Text style={s.heroLabel}>Vous gagnez</Text>
              <Text style={s.heroValue}>{money(f.net)}</Text>
              <Text style={s.heroSub}>
                {f.tickets_sold} billet{f.tickets_sold > 1 ? 's' : ''} vendu{f.tickets_sold > 1 ? 's' : ''}
                {f.capacity ? ` sur ${f.capacity} (${f.fill_rate} %)` : ''} · {money(f.price)} le billet
              </Text>
            </View>

            {!f.is_paid ? (
              <Text style={s.hint}>Cet événement est gratuit : aucune recette.</Text>
            ) : null}

            {/* ── Détail ──────────────────────────────────── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Détail</Text>
              <Line label="Recettes des billets" value={money(f.gross)} />
              <Line label={`Commission Easevent (${pct(f.fee_percent)})`} value={money(f.fee)} minus />
              <Line label="Ce que vous recevez" value={money(f.net)} strong last={!f.refunds} />
              {f.refunds ? (
                <Line label={`Remboursés (${f.refunds} billet${f.refunds > 1 ? 's' : ''})`} value={money(f.refunded)} last />
              ) : null}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Ventes</Text>
              <Line label="Par carte" value={`${f.by_method.card}`} />
              <Line label="Par Orange Money / MTN MoMo" value={`${f.by_method.mobile_money}`} />
              <Line label="Offerts par un proche" value={`${f.gifts}`} last={!f.by_price.length} />
              {f.by_price.length > 1 ? f.by_price.map((p, i) => (
                <Line key={p.price} label={`À ${money(p.price)}`} value={`${p.count}`} last={i === f.by_price.length - 1} />
              )) : null}
              {f.by_day.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={s.small}>Billets vendus par jour</Text>
                  {f.by_day.slice(-14).map((d) => (
                    <View key={d.day} style={s.barRow}>
                      <Text style={s.barDay}>{formatDayMonth(d.day)}</Text>
                      <View style={s.barTrack}><View style={[s.bar, { width: `${(d.count * 100) / maxDay}%` }]} /></View>
                      <Text style={s.barN}>{d.count}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* ── Virements ───────────────────────────────── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Virements</Text>
              <View style={s.payRow}>
                <Ionicons name="card-outline" size={18} color={C.green} />
                <Text style={s.payTxt}>
                  {f.payouts.stripe_payouts_enabled
                    ? 'Paiements par carte : Stripe vire automatiquement votre part sur votre compte bancaire.'
                    : f.payouts.stripe_connected
                      ? 'Paiements par carte : terminez la configuration de votre compte pour recevoir les virements.'
                      : 'Activez les paiements pour recevoir l’argent des billets payés par carte.'}
                </Text>
              </View>
              {f.payouts.mobile_money_due ? (
                <View style={s.payRow}>
                  <Ionicons name="phone-portrait-outline" size={18} color={C.orange} />
                  <Text style={s.payTxt}>Mobile Money : Easevent encaisse et vous reverse votre part, commission déduite.</Text>
                </View>
              ) : null}
              <SecondaryButton label="Paiements & virements" icon="open-outline"
                onPress={() => navigation.navigate('TabProfile', { screen: 'Payouts', initial: false })} style={{ marginTop: 8 }} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.textMut },
  pad: { padding: 16, paddingBottom: 40 },
  error: { color: C.errorText, marginBottom: 12 },
  hint: { fontSize: 13, color: C.textSub, marginBottom: 12 },
  hero: { backgroundColor: C.green, borderRadius: 20, padding: 20, marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },
  heroValue: { color: C.white, fontSize: 34, fontWeight: '900', marginVertical: 4 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  lineLabel: { fontSize: 14, color: C.textSub, flex: 1 },
  lineValue: { fontSize: 14, color: C.text, fontWeight: '700' },
  strong: { color: C.text, fontWeight: '900', fontSize: 15 },
  small: { fontSize: 12, fontWeight: '700', color: C.textMut, marginBottom: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  barDay: { width: 52, fontSize: 12, color: C.textSub },
  barTrack: { flex: 1, height: 10, backgroundColor: C.bg, borderRadius: 5, overflow: 'hidden' },
  bar: { height: 10, backgroundColor: C.green, borderRadius: 5 },
  barN: { width: 26, textAlign: 'right', fontSize: 12, fontWeight: '700', color: C.text },
  payRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  payTxt: { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 19 },
});
