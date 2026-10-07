/**
 * PlansScreen.js — Easevent (M20 · Choisir un plan)
 * ════════════════════════════════════════════════════════════════
 * Mensuel / Annuel (2 mois offerts), Gratuit / Standard / Pro.
 * - Pas encore abonné : « Choisir » → M21 (récapitulatif + paiement Stripe).
 * - Déjà abonné : changer de plan (au prorata), résilier à la fin de la
 *   période ou reprendre, factures et carte bancaire (portail Stripe).
 * Le plan n'est activé que par la confirmation de Stripe (webhook).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';

import { C, TOUCH } from '../constants/theme';
import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import { Bone, SkeletonGroup } from '../components/ui/Skeleton';
import subscriptionService from '../services/subscriptionService';
import { apiErrorMessage } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/dialog';

export const euros = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
const longDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function PlansScreen({ navigation, route }) {
  const { updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [interval, setInterval_] = useState('monthly');
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const reason = route?.params?.reason;       // ex. « export » : ce qui a mené ici

  const load = useCallback(async () => {
    try {
      const d = await subscriptionService.overview();
      setData(d);
      setError('');
      if (d.subscription?.interval) setInterval_(d.subscription.interval);
      updateUser({ subscription_plan: d.subscription.plan });
    } catch (err) {
      setError(apiErrorMessage(err, 'Les plans sont indisponibles. Vérifiez votre connexion.'));
    } finally {
      setRefreshing(false);
    }
  }, [updateUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sub = data?.subscription;
  const current = sub?.plan || 'free';
  const paid = current !== 'free' && !!sub?.status;

  const choose = (plan) => {
    if (plan.id === 'free') {
      if (paid && !sub.cancel_at) cancel();
      return;
    }
    if (paid) {
      showAlert(`Passer au plan ${plan.name} ?`,
        `${euros(plan[interval])} par ${interval === 'annual' ? 'an' : 'mois'}. La différence est calculée au prorata sur votre prochaine facture.`,
        [{ text: 'Annuler', style: 'cancel' }, { text: 'Confirmer', onPress: () => change(plan) }]);
      return;
    }
    navigation.navigate('SubscriptionCheckout', { plan, interval });
  };

  const change = async (plan) => {
    setBusy(plan.id);
    try {
      const res = await subscriptionService.checkout(plan.id, interval);
      if (res.checkout_url) {
        await WebBrowser.openAuthSessionAsync(res.checkout_url, 'easevent://profil/abonnement/succes');
      }
      navigation.navigate('SubscriptionSuccess', { plan, expectChange: true });
    } catch (err) {
      showAlert('Changement impossible', apiErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const cancel = () => showAlert('Résilier votre abonnement ?',
    `Vous gardez votre plan jusqu'au ${sub?.current_period_end ? longDate(sub.current_period_end) : 'terme de la période payée'}, puis vous passerez au plan Gratuit. Aucun autre prélèvement.`,
    [{ text: 'Garder mon plan', style: 'cancel' }, {
      text: 'Résilier', style: 'destructive', onPress: async () => {
        setBusy('cancel');
        try { await subscriptionService.cancel(); await load(); }
        catch (err) { showAlert('Résiliation impossible', apiErrorMessage(err)); }
        finally { setBusy(''); }
      },
    }]);

  const resume = async () => {
    setBusy('resume');
    try { await subscriptionService.resume(); await load(); showAlert('Abonnement repris', 'Votre plan continue normalement.'); }
    catch (err) { showAlert('Action impossible', apiErrorMessage(err)); }
    finally { setBusy(''); }
  };

  const portal = async () => {
    setBusy('portal');
    try {
      const { url } = await subscriptionService.portal();
      await WebBrowser.openAuthSessionAsync(url, 'easevent://profil/plans');
      load();
    } catch (err) {
      showAlert('Factures indisponibles', apiErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile'))} />
          <Text style={styles.headerTitle} accessibilityRole="header">Choisir un plan</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.green} />}>
          {reason ? (
            <View style={styles.reason}>
              <Ionicons name="sparkles-outline" size={18} color={C.orangeDark} />
              <Text style={styles.reasonTxt}>{reason}</Text>
            </View>
          ) : null}

          <View style={styles.toggle} accessibilityRole="radiogroup" accessibilityLabel="Fréquence de paiement">
            {[['monthly', 'Mensuel'], ['annual', 'Annuel']].map(([id, label]) => {
              const on = interval === id;
              return (
                <Pressable key={id} onPress={() => setInterval_(id)} style={[styles.toggleOpt, on && styles.toggleOn]}
                  accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} aria-selected={on} aria-checked={on}>
                  <Text style={[styles.toggleTxt, on && { color: C.white }]}>{label}</Text>
                  {id === 'annual' ? <Text style={[styles.toggleBadge, on && { color: C.white }]}>2 mois offerts</Text> : null}
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTxt} accessibilityRole="alert">{error}</Text>
              <Pressable onPress={load} style={styles.retry} accessibilityRole="button"><Text style={styles.retryTxt}>Réessayer</Text></Pressable>
            </View>
          ) : null}

          {!data && !error ? (
            <SkeletonGroup label="Chargement des plans">
              {[0, 1, 2].map((i) => <Bone key={i} height={200} radius={20} style={{ marginBottom: 14 }} />)}
            </SkeletonGroup>
          ) : null}

          {data?.plans.map((plan) => {
            const isCurrent = plan.id === current && (plan.id === 'free' || sub?.interval === interval || !sub?.interval);
            const price = plan[interval];
            return (
              <View key={plan.id} style={[styles.card, plan.highlight && styles.cardHighlight, plan.id === current && styles.cardCurrent]}
                accessible={false}>
                {plan.highlight ? <Text style={styles.popular}>Le plus choisi</Text> : null}
                <View style={styles.cardHead}>
                  <Text style={styles.planName} accessibilityRole="header">{plan.name}</Text>
                  {plan.id === current ? <Text style={styles.currentBadge}>Votre plan</Text> : null}
                </View>
                <Text style={styles.price}>
                  {price ? euros(price) : '0 €'}
                  <Text style={styles.per}>{price ? ` / ${interval === 'annual' ? 'an' : 'mois'}` : ' pour toujours'}</Text>
                </Text>
                {interval === 'annual' && price ? <Text style={styles.monthly}>soit {euros(Math.round(price / 12))} par mois</Text> : null}
                <View style={styles.features}>
                  {plan.features.map((f) => (
                    <View key={f} style={styles.feature}>
                      <Ionicons name="checkmark-circle" size={18} color={C.green} />
                      <Text style={styles.featureTxt}>{f}</Text>
                    </View>
                  ))}
                </View>
                {plan.id === 'free' ? (
                  paid && !sub.cancel_at ? (
                    <Pressable onPress={cancel} style={styles.ghostBtn} accessibilityRole="button" disabled={busy === 'cancel'}>
                      {busy === 'cancel' ? <ActivityIndicator color={C.text} /> : <Text style={styles.ghostTxt}>Revenir au plan Gratuit</Text>}
                    </Pressable>
                  ) : null
                ) : isCurrent && paid ? (
                  <View style={styles.activeRow}>
                    <Ionicons name="shield-checkmark" size={18} color={C.green} />
                    <Text style={styles.activeTxt}>
                      {sub.cancel_at ? `Se termine le ${longDate(sub.cancel_at)}` : `Renouvelé le ${longDate(sub.current_period_end)}`}
                    </Text>
                  </View>
                ) : (
                  <PrimaryButton label={paid ? `Passer au ${plan.name}` : `Choisir ${plan.name}`} icon="arrow-forward-outline"
                    loading={busy === plan.id} onPress={() => choose(plan)} />
                )}
              </View>
            );
          })}

          {paid ? (
            <View style={styles.manage}>
              <Text style={styles.manageTitle}>Mon abonnement</Text>
              {sub.status === 'past_due' ? (
                <Text style={styles.warn}>Le dernier paiement a échoué : mettez à jour votre carte pour garder vos avantages.</Text>
              ) : null}
              <Pressable onPress={portal} style={styles.manageRow} accessibilityRole="button" disabled={busy === 'portal'}>
                <Ionicons name="card-outline" size={20} color={C.green} />
                <Text style={styles.manageTxt}>Factures et carte bancaire</Text>
                {busy === 'portal' ? <ActivityIndicator color={C.green} /> : <Ionicons name="open-outline" size={16} color={C.textMut} />}
              </Pressable>
              {sub.cancel_at ? (
                <Pressable onPress={resume} style={styles.manageRow} accessibilityRole="button" disabled={busy === 'resume'}>
                  <Ionicons name="refresh-outline" size={20} color={C.green} />
                  <Text style={styles.manageTxt}>Reprendre mon abonnement</Text>
                  {busy === 'resume' ? <ActivityIndicator color={C.green} /> : null}
                </Pressable>
              ) : (
                <Pressable onPress={cancel} style={styles.manageRow} accessibilityRole="button">
                  <Ionicons name="close-circle-outline" size={20} color={C.errorText} />
                  <Text style={[styles.manageTxt, { color: C.errorText }]}>Résilier</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <View style={styles.footer}>
            <Ionicons name="lock-closed-outline" size={14} color={C.textMut} />
            <Text style={styles.footerTxt}>
              Paiement sécurisé par Stripe (carte, Apple Pay, Google Pay). Sans engagement : résiliable à tout moment
              depuis cet écran. Prix TTC.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  scroll: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  reason: { flexDirection: 'row', gap: 10, backgroundColor: C.orangeL, borderRadius: 14, padding: 14, marginBottom: 14 },
  reasonTxt: { flex: 1, fontSize: 14, color: C.orangeDark, lineHeight: 20, fontWeight: '600' },
  toggle: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 16, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  toggleOpt: { flex: 1, minHeight: TOUCH + 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: C.green },
  toggleTxt: { fontSize: 15, fontWeight: '800', color: C.text },
  toggleBadge: { fontSize: 11, fontWeight: '700', color: C.green, marginTop: 1 },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: C.border },
  cardHighlight: { borderColor: C.green },
  cardCurrent: { backgroundColor: '#FBFEFC' },
  popular: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', color: C.white, backgroundColor: C.orange, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: 20, fontWeight: '900', color: C.text },
  currentBadge: { fontSize: 12, fontWeight: '800', color: C.greenDark, backgroundColor: C.greenLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  price: { fontSize: 28, fontWeight: '900', color: C.text, marginTop: 6 },
  per: { fontSize: 14, fontWeight: '600', color: C.textSub },
  monthly: { fontSize: 13, color: C.textSub, marginTop: 2 },
  features: { marginTop: 12, marginBottom: 14, gap: 8 },
  feature: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureTxt: { flex: 1, fontSize: 14, color: C.text, lineHeight: 20 },
  ghostBtn: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  ghostTxt: { fontSize: 15, fontWeight: '700', color: C.text },
  activeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.greenLight, borderRadius: 14, padding: 12 },
  activeTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: C.greenDark },
  manage: { backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  manageTitle: { fontSize: 13, fontWeight: '800', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  warn: { fontSize: 13, color: C.errorText, marginBottom: 6, lineHeight: 18 },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  manageTxt: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  errorBox: { backgroundColor: C.errorBg, borderRadius: 14, padding: 14, marginBottom: 14, gap: 8 },
  errorTxt: { fontSize: 14, color: C.errorText },
  retry: { alignSelf: 'flex-start', minHeight: TOUCH, justifyContent: 'center' },
  retryTxt: { fontSize: 14, fontWeight: '800', color: C.green },
  footer: { flexDirection: 'row', gap: 8, marginTop: 4 },
  footerTxt: { flex: 1, fontSize: 12, color: C.textMut, lineHeight: 17 },
});
