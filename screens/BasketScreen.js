/**
 * screens/BasketScreen.js — le panier de l'événement (cagnotte réinventée)
 * ════════════════════════════════════════════════════════════════
 * Chacun y ajoute ce qu'il apporte : un objet (« 2 bouteilles de jus ») ou une
 * participation en argent, payée par carte ou Orange Money / MTN MoMo et versée
 * à l'organisateur (sans commission Easevent). Le bilan montre qui a ajouté quoi.
 * Organisateurs : lancer le panier (annoncé à tous les invités), le fermer.
 * params : { event } (ou { eventId })
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';

import { BackButton, PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { C, TOUCH } from '../constants/theme';
import basketService from '../services/basketService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';

const POLL_EVERY = 2500;
const POLL_FOR = 120000;
const QUICK = { XAF: [1000, 2000, 5000], XOF: [1000, 2000, 5000] };
const symbol = (cur) => (cur === 'EUR' ? '€' : cur === 'XAF' || cur === 'XOF' ? 'FCFA' : cur);

export default function BasketScreen({ route, navigation }) {
  const event = route?.params?.event || { id: route?.params?.eventId };
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null);                 // null | 'item' | 'money'
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // Lancer
  const [launchForm, setLaunchForm] = useState({ title: '', description: '', goal: '', items: true, money: true });
  // Objet
  const [item, setItem] = useState({ label: '', quantity: 1, message: '' });
  // Argent
  const [money, setMoney] = useState({ amount: '', message: '', anonymous: false, method: 'card' });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    try { setData(await basketService.ofEvent(event.id)); setError(''); }
    catch (err) { setError(apiErrorMessage(err, "Le panier n'est pas accessible.")); }
  }, [event.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const b = data?.basket;
  const open = b?.status === 'open';

  useEffect(() => {
    if (!b) return;
    // Moyen de paiement par défaut : celui qui est disponible
    if (!b.payment.card && b.payment.mobile_money) setMoney((m) => ({ ...m, method: 'mobile_money' }));
  }, [b?.id]);

  const launch = async () => {
    setBusy(true);
    try {
      const r = await basketService.launch(event.id, {
        title: launchForm.title.trim(), description: launchForm.description.trim(),
        goal_amount: launchForm.money && launchForm.goal ? launchForm.goal : null,
        allow_items: launchForm.items, allow_money: launchForm.money,
      });
      setData({ basket: r.basket, can_launch: false });
      showAlert('Panier lancé', r.announced_to
        ? `${r.announced_to} invité${r.announced_to > 1 ? 's' : ''} ${r.announced_to > 1 ? 'sont prévenus' : 'est prévenu'} dans leur messagerie.`
        : 'Vos invités le verront en ouvrant l’événement.');
    } catch (err) { showAlert('Lancement impossible', apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const addItem = async () => {
    setBusy(true);
    try {
      const s = await basketService.addItem(b.id, { label: item.label.trim(), quantity: item.quantity, message: item.message.trim() });
      setData((d) => ({ ...d, basket: s }));
      setItem({ label: '', quantity: 1, message: '' });
      setMode(null);
    } catch (err) { showAlert('Ajout impossible', apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const waitForPayment = async (id) => {
    setWaiting(true);
    const until = Date.now() + POLL_FOR;
    while (alive.current && Date.now() < until) {
      try {
        const c = await basketService.contribution(id);
        if (c.status === 'paid') { setWaiting(false); setMode(null); await load(); showAlert('Merci !', `${c.amount_text} ajoutés au panier.`); return; }
        if (c.status === 'failed') { setWaiting(false); showAlert('Paiement non abouti', 'Aucun montant n’a été prélevé. Vous pouvez réessayer.'); load(); return; }
      } catch { /* coupure passagère */ }
      await new Promise((r) => setTimeout(r, POLL_EVERY));
    }
    if (alive.current) { setWaiting(false); load(); showAlert('Paiement en attente', 'Votre participation apparaîtra dans le panier dès la confirmation.'); }
  };

  const pay = async (contributionId) => {
    const url = money.method === 'mobile_money'
      ? (await basketService.mobileMoney(contributionId)).url
      : (await basketService.checkout(contributionId)).checkout_url;
    await WebBrowser.openAuthSessionAsync(url, 'easevent://invitations');
    await waitForPayment(contributionId);
  };

  const addMoney = async () => {
    setBusy(true);
    try {
      const c = await basketService.addMoney(b.id, { amount: money.amount, message: money.message.trim(), anonymous: money.anonymous });
      await pay(c.id);
    } catch (err) { showAlert('Paiement impossible', apiErrorMessage(err)); load(); }
    finally { if (alive.current) setBusy(false); }
  };

  const resume = async (c) => {
    setBusy(true);
    try { await pay(c.id); }
    catch (err) { showAlert('Paiement impossible', apiErrorMessage(err)); }
    finally { if (alive.current) setBusy(false); }
  };

  const remove = (c) => showAlert('Retirer du panier ?', c.label, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Retirer', style: 'destructive', onPress: async () => {
      try { await basketService.remove(c.id); load(); }
      catch (err) { showAlert('Action impossible', apiErrorMessage(err)); }
    } },
  ]);

  const closeBasket = () => showAlert('Fermer le panier ?', 'Plus personne ne pourra y ajouter quelque chose. Le bilan reste visible.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Fermer', style: 'destructive', onPress: async () => {
      try { const s = await basketService.close(b.id); setData((d) => ({ ...d, basket: s, can_launch: true })); }
      catch (err) { showAlert('Action impossible', apiErrorMessage(err)); }
    } },
  ]);

  const cur = b?.currency || 'EUR';
  const quick = QUICK[cur] || [5, 10, 20];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} accessibilityRole="header">Le panier</Text>
          <Text style={s.sub} numberOfLines={1}>{b?.event_title || event.title || ''}</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
          {error ? <Text style={s.error}>{error}</Text> : null}
          {!data && !error ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : null}

          {/* ── Pas encore de panier ─────────────────────── */}
          {data && !open && data.can_launch ? (
            <View style={s.card}>
              <View style={s.launchHead}>
                <Text style={s.emoji}>🧺</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{b ? 'Lancer un nouveau panier' : 'Lancer un panier'}</Text>
                  <Text style={s.hint}>Chacun y ajoute ce qu'il apporte ou une participation. Tous vos invités sont prévenus.</Text>
                </View>
              </View>
              <TextInput style={s.input} value={launchForm.title} onChangeText={(v) => setLaunchForm((f) => ({ ...f, title: v }))}
                placeholder="Ex. : Cadeau commun pour Noé" placeholderTextColor={C.textMut} maxLength={80} accessibilityLabel="Nom du panier" />
              <TextInput style={[s.input, { minHeight: 70 }]} value={launchForm.description} multiline maxLength={300}
                onChangeText={(v) => setLaunchForm((f) => ({ ...f, description: v }))}
                placeholder="Ex. : On lui offre un vélo ; pour le goûter, apportez boissons et gâteaux !" placeholderTextColor={C.textMut}
                accessibilityLabel="Description du panier" />
              <View style={s.switchRow}>
                <Text style={s.switchTxt}>Objets (repas, boissons, cadeaux…)</Text>
                <Switch value={launchForm.items} onValueChange={(v) => setLaunchForm((f) => ({ ...f, items: v }))}
                  trackColor={{ true: C.green }} accessibilityLabel="Accepter des objets" />
              </View>
              <View style={s.switchRow}>
                <Text style={s.switchTxt}>Participations en argent (sans commission)</Text>
                <Switch value={launchForm.money} onValueChange={(v) => setLaunchForm((f) => ({ ...f, money: v }))}
                  trackColor={{ true: C.green }} accessibilityLabel="Accepter de l'argent" />
              </View>
              {launchForm.money ? (
                <TextInput style={s.input} value={launchForm.goal} onChangeText={(v) => setLaunchForm((f) => ({ ...f, goal: v.replace(/[^0-9.,]/g, '') }))}
                  placeholder="Objectif (facultatif), ex. 150" placeholderTextColor={C.textMut} keyboardType="decimal-pad"
                  accessibilityLabel="Objectif en argent (facultatif)" />
              ) : null}
              <PrimaryButton label="Lancer le panier" icon="basket-outline" onPress={launch} loading={busy}
                disabled={!launchForm.items && !launchForm.money} />
            </View>
          ) : null}
          {data && !b && !data.can_launch ? (
            <View style={s.empty}>
              <Text style={s.emoji}>🧺</Text>
              <Text style={s.emptyTxt}>Pas de panier pour cet événement pour le moment.</Text>
            </View>
          ) : null}

          {/* ── Le panier ──────────────────────────────── */}
          {b && (open || !data.can_launch || b.contributions.length) ? (
            <>
              <View style={s.hero}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.heroEmoji}>🧺</Text>
                  <Text style={s.heroTitle} numberOfLines={2}>{b.title}</Text>
                  {!open ? <View style={s.closed}><Text style={s.closedTxt}>Fermé</Text></View> : null}
                </View>
                {b.description ? <Text style={s.heroDesc}>{b.description}</Text> : null}
                <View style={s.heroStats}>
                  {b.allow_money ? (
                    <View style={{ flex: 1 }}>
                      <Text style={s.heroValue}>{b.total_money_text}</Text>
                      <Text style={s.heroLabel}>{b.goal_amount ? `sur ${b.goal_text}` : 'collectés'}</Text>
                    </View>
                  ) : null}
                  {b.allow_items ? (
                    <View style={{ flex: 1 }}>
                      <Text style={s.heroValue}>{b.items_count}</Text>
                      <Text style={s.heroLabel}>objet{b.items_count > 1 ? 's' : ''}</Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroValue}>{b.contributors}</Text>
                    <Text style={s.heroLabel}>participant{b.contributors > 1 ? 's' : ''}</Text>
                  </View>
                </View>
                {b.goal_amount ? (
                  <View style={s.track} accessible accessibilityLabel={`Objectif atteint à ${b.progress} %`}>
                    <View style={[s.bar, { width: `${b.progress}%` }]} />
                  </View>
                ) : null}
              </View>

              {/* Paiements commencés et pas finis */}
              {b.my_pending.map((p) => (
                <View key={p.id} style={s.pending}>
                  <Ionicons name="time-outline" size={18} color={C.orange} />
                  <Text style={s.pendingTxt}>{p.status === 'failed' ? 'Paiement non abouti' : 'Paiement en attente'} : {p.amount_text}</Text>
                  {open ? <Pressable onPress={() => resume(p)} style={s.pendingBtn} accessibilityRole="button" accessibilityLabel={`Reprendre le paiement de ${p.amount_text}`}>
                    <Text style={s.pendingBtnTxt}>Reprendre</Text>
                  </Pressable> : null}
                </View>
              ))}

              {/* ── Ajouter ───────────────────────────── */}
              {open && !mode ? (
                <View style={s.addRow}>
                  {b.allow_items ? <PrimaryButton label="J'apporte quelque chose" icon="gift-outline" onPress={() => setMode('item')} /> : null}
                  {b.allow_money ? <SecondaryButton label="Je participe" icon="wallet-outline" onPress={() => setMode('money')} /> : null}
                </View>
              ) : null}

              {open && mode === 'item' ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>J'apporte…</Text>
                  <TextInput style={s.input} value={item.label} onChangeText={(v) => setItem((i) => ({ ...i, label: v }))} maxLength={120}
                    placeholder="Ex. : bouteilles de jus, gâteau, ballons…" placeholderTextColor={C.textMut} autoFocus accessibilityLabel="Ce que vous apportez" />
                  <View style={s.qtyRow}>
                    <Text style={s.switchTxt}>Quantité</Text>
                    <Pressable style={s.step} onPress={() => setItem((i) => ({ ...i, quantity: Math.max(1, i.quantity - 1) }))}
                      accessibilityRole="button" accessibilityLabel="Un de moins"><Ionicons name="remove" size={18} color={C.green} /></Pressable>
                    <Text style={s.qty} accessibilityLabel={`Quantité ${item.quantity}`}>{item.quantity}</Text>
                    <Pressable style={s.step} onPress={() => setItem((i) => ({ ...i, quantity: Math.min(999, i.quantity + 1) }))}
                      accessibilityRole="button" accessibilityLabel="Un de plus"><Ionicons name="add" size={18} color={C.green} /></Pressable>
                  </View>
                  <TextInput style={s.input} value={item.message} onChangeText={(v) => setItem((i) => ({ ...i, message: v }))} maxLength={200}
                    placeholder="Un mot (facultatif)" placeholderTextColor={C.textMut} accessibilityLabel="Un mot (facultatif)" />
                  <PrimaryButton label="Ajouter au panier" onPress={addItem} loading={busy} disabled={!item.label.trim()} />
                  <SecondaryButton label="Annuler" onPress={() => setMode(null)} style={{ marginTop: 8 }} />
                </View>
              ) : null}

              {open && mode === 'money' ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Ma participation</Text>
                  <View style={s.amountRow}>
                    <TextInput style={s.amount} value={money.amount} onChangeText={(v) => setMoney((m) => ({ ...m, amount: v.replace(/[^0-9.,]/g, '') }))}
                      placeholder="0" placeholderTextColor={C.textMut} keyboardType="decimal-pad" autoFocus accessibilityLabel={`Montant en ${symbol(cur)}`} />
                    <Text style={s.cur}>{symbol(cur)}</Text>
                  </View>
                  <View style={s.chips}>
                    {quick.map((q) => (
                      <Pressable key={q} style={[s.chip, money.amount === String(q) && s.chipOn]} onPress={() => setMoney((m) => ({ ...m, amount: String(q) }))}
                        accessibilityRole="button" accessibilityLabel={`${q} ${symbol(cur)}`}>
                        <Text style={[s.chipTxt, money.amount === String(q) && { color: C.white }]}>{q} {symbol(cur)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput style={s.input} value={money.message} onChangeText={(v) => setMoney((m) => ({ ...m, message: v }))} maxLength={200}
                    placeholder="Un mot (facultatif)" placeholderTextColor={C.textMut} accessibilityLabel="Un mot (facultatif)" />
                  <View style={s.switchRow}>
                    <Text style={s.switchTxt}>Masquer le montant aux autres invités</Text>
                    <Switch value={money.anonymous} onValueChange={(v) => setMoney((m) => ({ ...m, anonymous: v }))}
                      trackColor={{ true: C.green }} accessibilityLabel="Masquer le montant aux autres invités" />
                  </View>
                  <Text style={s.small}>Payer par</Text>
                  <View style={s.methods} accessibilityRole="radiogroup">
                    {[['card', 'Carte bancaire', 'card-outline', b.payment.card], ['mobile_money', 'Orange Money / MTN MoMo', 'phone-portrait-outline', b.payment.mobile_money]].map(([id, label, icon, ok]) => (
                      <Pressable key={id} disabled={!ok} onPress={() => setMoney((m) => ({ ...m, method: id }))}
                        style={[s.method, money.method === id && s.methodOn, !ok && { opacity: 0.45 }]}
                        accessibilityRole="radio" accessibilityState={{ checked: money.method === id, disabled: !ok }} aria-checked={money.method === id}
                        accessibilityLabel={ok ? label : `${label} (indisponible)`}>
                        <Ionicons name={icon} size={18} color={money.method === id ? C.white : C.green} />
                        <Text style={[s.methodTxt, money.method === id && { color: C.white }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={s.small}>L'argent va à l'organisateur, sans commission Easevent.</Text>
                  <PrimaryButton label={waiting ? 'En attente du paiement…' : 'Payer et ajouter au panier'} onPress={addMoney}
                    loading={busy} disabled={!money.amount || !(b.payment.card || b.payment.mobile_money)} />
                  <SecondaryButton label="Annuler" onPress={() => setMode(null)} style={{ marginTop: 8 }} />
                </View>
              ) : null}

              {/* ── Bilan ─────────────────────────────── */}
              <Text style={s.section}>Dans le panier</Text>
              {!b.contributions.length ? <Text style={s.hint}>Rien pour l'instant : soyez le premier !</Text> : null}
              {b.contributions.map((c) => (
                <View key={c.id} style={s.row}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{c.user.initials}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{c.user.name}{c.mine ? ' (vous)' : ''}</Text>
                    <Text style={s.what}>
                      {c.kind === 'item' ? `${c.quantity > 1 ? `${c.quantity} × ` : ''}${c.label}` : c.amount_text}
                    </Text>
                    {c.message ? <Text style={s.msg}>« {c.message} »</Text> : null}
                  </View>
                  <Ionicons name={c.kind === 'item' ? 'gift-outline' : 'wallet-outline'} size={18} color={C.textMut} />
                  {c.can_remove && open ? (
                    <Pressable style={s.iconBtn} onPress={() => remove(c)} accessibilityRole="button" accessibilityLabel={`Retirer ${c.label}`}>
                      <Ionicons name="close" size={16} color={C.textMut} />
                    </Pressable>
                  ) : null}
                </View>
              ))}

              {b.can_manage && open ? (
                <SecondaryButton label="Fermer le panier" icon="lock-closed-outline" onPress={closeBasket} style={{ marginTop: 16 }} />
              ) : null}
              {b.can_manage && b.allow_money ? (
                <Text style={[s.small, { marginTop: 10 }]}>
                  Carte : versé automatiquement sur votre compte (Paiements & virements). Mobile Money : reversé par Easevent.
                </Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.textMut },
  pad: { padding: 16, paddingBottom: 48 },
  error: { color: C.errorText, marginBottom: 12 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  hint: { fontSize: 13, color: C.textSub, lineHeight: 19 },
  launchHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  emoji: { fontSize: 30 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: TOUCH, backgroundColor: C.inputBg, color: C.text, fontSize: 15, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH },
  switchTxt: { flex: 1, fontSize: 14, color: C.text },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTxt: { fontSize: 14, color: C.textSub, textAlign: 'center' },
  hero: { backgroundColor: C.green, borderRadius: 20, padding: 18, marginBottom: 14, gap: 8 },
  heroEmoji: { fontSize: 26 },
  heroTitle: { flex: 1, color: C.white, fontSize: 20, fontWeight: '900' },
  heroDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 6 },
  heroValue: { color: C.white, fontSize: 20, fontWeight: '900' },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  track: { height: 10, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 5, overflow: 'hidden', marginTop: 4 },
  bar: { height: 10, backgroundColor: C.white, borderRadius: 5 },
  closed: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  closedTxt: { color: C.white, fontWeight: '800', fontSize: 12 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.orangeL, borderRadius: 12, padding: 10, marginBottom: 10 },
  pendingTxt: { flex: 1, fontSize: 13, color: C.text },
  pendingBtn: { paddingHorizontal: 12, minHeight: 36, borderRadius: 10, backgroundColor: C.orange, justifyContent: 'center' },
  pendingBtnTxt: { color: C.white, fontWeight: '800' },
  addRow: { gap: 10, marginBottom: 16 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { width: TOUCH, height: TOUCH, borderRadius: 12, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 18, fontWeight: '900', color: C.text },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { flex: 1, minWidth: 0, width: 0, fontSize: 30, fontWeight: '900', color: C.text, borderBottomWidth: 2, borderBottomColor: C.green, paddingVertical: 4 },
  cur: { fontSize: 20, fontWeight: '800', color: C.textSub },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, minHeight: 38, borderRadius: 19, borderWidth: 1.5, borderColor: C.green, justifyContent: 'center' },
  chipOn: { backgroundColor: C.green },
  chipTxt: { fontWeight: '800', color: C.green },
  small: { fontSize: 12, color: C.textMut },
  methods: { gap: 8 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 12 },
  methodOn: { backgroundColor: C.green, borderColor: C.green },
  methodTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  section: { fontSize: 12, fontWeight: '800', color: C.textMut, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: C.green, fontSize: 13 },
  name: { fontSize: 13, fontWeight: '800', color: C.text },
  what: { fontSize: 15, color: C.text, marginTop: 2 },
  msg: { fontSize: 12, color: C.textSub, fontStyle: 'italic', marginTop: 2 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
