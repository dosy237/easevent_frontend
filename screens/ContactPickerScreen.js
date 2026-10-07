/**
 * ContactPickerScreen.js — Easevent (M12 « Choisir dans mes contacts »)
 * ════════════════════════════════════════════════════════════════
 * Paramètres : mode ('phone' | 'email'), countryCode, already (valeurs déjà
 * ajoutées), event.
 * Sélection multiple sans limite, recherche, « Tout sélectionner ».
 * Un contact avec plusieurs numéros apparaît une fois par numéro.
 * « Ajouter N contacts » renvoie la sélection à l'écran Inviter
 * (paramètre picked) ; l'envoi se fait ensuite par vagues.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { C, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import LoadingMessages from '../components/ui/LoadingMessages';
import { loadDeviceContacts } from '../utils/deviceContacts';
import { formatPhone, isEmail, toE164 } from '../utils/contacts';

const ROW_HEIGHT = 68;
const initialsOf = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function ContactPickerScreen({ navigation, route }) {
  const { mode = 'phone', countryCode = '33', already = [], event } = route.params || {};
  const [state, setState] = useState({ status: 'loading', rows: [] });
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await loadDeviceContacts();
      if (!alive) return;
      const taken = new Set(already);
      const rows = [];
      res.contacts.forEach((c) => {
        if (mode === 'phone') {
          c.phones.forEach((p, i) => {
            const value = toE164(p.number, countryCode);
            if (value && !rows.some((r) => r.value === value)) {
              rows.push({ key: `${c.id}-${i}`, name: c.name || formatPhone(value), value, display: formatPhone(value), label: p.label, taken: taken.has(value) });
            }
          });
        } else {
          c.emails.forEach((e, i) => {
            const value = e.email.trim().toLowerCase();
            if (isEmail(value) && !rows.some((r) => r.value === value)) {
              rows.push({ key: `${c.id}-${i}`, name: c.name || value, value, display: value, label: e.label, taken: taken.has(value) });
            }
          });
        }
      });
      setState({ status: res.status, canAskAgain: res.canAskAgain, rows });
      // Navigateur : la personne a déjà choisi dans le sélecteur du système
      if (res.preselected) setSelected(new Set(rows.filter((r) => !r.taken).map((r) => r.value)));
    })();
    return () => { alive = false; };
  }, [mode, countryCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return state.rows;
    const digits = needle.replace(/\D/g, '');
    return state.rows.filter((r) => r.name.toLowerCase().includes(needle) || (digits && r.value.includes(digits)) || r.value.includes(needle));
  }, [state.rows, q]);

  const selectable = visible.filter((r) => !r.taken);
  const allOn = selectable.length > 0 && selectable.every((r) => selected.has(r.value));

  const toggle = (value) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  });

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    selectable.forEach((r) => (allOn ? next.delete(r.value) : next.add(r.value)));
    return next;
  });

  const confirm = () => {
    const picked = state.rows.filter((r) => selected.has(r.value)).map((r) => (mode === 'phone'
      ? { phone: r.value, name: r.name === r.display ? '' : r.name.slice(0, 80) }
      : { email: r.value }));
    // Revient à l'écran Inviter existant (React Navigation 7 : popTo, et non navigate)
    navigation.popTo('InviteGuests', { event, mode, picked, pickedAt: Date.now() }, { merge: true });
  };

  const count = selected.size;

  const renderItem = ({ item: r }) => {
    const on = selected.has(r.value);
    return (
      <Pressable
        onPress={() => !r.taken && toggle(r.value)}
        disabled={r.taken}
        style={[styles.row, on && styles.rowOn, r.taken && { opacity: 0.5 }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on, disabled: r.taken }} aria-checked={on} aria-disabled={r.taken}
        accessibilityLabel={`${r.name}, ${r.display}${r.taken ? ', déjà dans la liste' : ''}`}
      >
        <View style={[styles.avatar, on && { backgroundColor: C.green }]}>
          {on ? <Ionicons name="checkmark" size={20} color={C.white} /> : <Text style={styles.avatarTxt}>{initialsOf(r.name)}</Text>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
          <Text style={styles.value} numberOfLines={1}>{r.taken ? 'Déjà ajouté' : `${r.display}${r.label ? ` · ${r.label}` : ''}`}</Text>
        </View>
        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? C.green : C.textMut} />
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <BackButton variant="square" onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} accessibilityRole="header">Mes contacts</Text>
            <Text style={styles.sub}>{count ? `${count} sélectionné${count > 1 ? 's' : ''}` : mode === 'phone' ? 'Invitation par SMS' : 'Invitation par email'}</Text>
          </View>
        </View>

        {state.status === 'loading' && (
          <View style={styles.center}><ActivityIndicator color={C.green} /><LoadingMessages messages={['Nous lisons votre carnet d’adresses…', 'Rien ne quitte votre téléphone sans votre accord…']} /></View>
        )}

        {state.status === 'denied' && (
          <View style={styles.center}>
            <View style={styles.bigIcon}><Ionicons name="lock-closed-outline" size={30} color={C.green} /></View>
            <Text style={styles.emptyTitle}>Accès aux contacts refusé</Text>
            <Text style={styles.emptyTxt}>Autorisez Easevent à lire vos contacts pour choisir vos invités. Seuls ceux que vous cochez sont envoyés.</Text>
            {Platform.OS !== 'web' && (
              <Pressable onPress={() => Linking.openSettings()} style={styles.primary} accessibilityRole="button">
                <Text style={styles.primaryTxt}>Ouvrir les réglages</Text>
              </Pressable>
            )}
          </View>
        )}

        {state.status === 'unavailable' && (
          <View style={styles.center}>
            <View style={styles.bigIcon}><Ionicons name="phone-portrait-outline" size={30} color={C.green} /></View>
            <Text style={styles.emptyTitle}>Contacts indisponibles ici</Text>
            <Text style={styles.emptyTxt}>Le choix dans vos contacts fonctionne dans l'application Easevent sur votre téléphone. Vous pouvez aussi importer un fichier CSV.</Text>
          </View>
        )}

        {state.status === 'ok' && (
          <>
            <View style={styles.tools}>
              <View style={styles.search}>
                <Ionicons name="search-outline" size={18} color={C.textMut} />
                <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Rechercher un nom ou un numéro"
                  placeholderTextColor={C.textFaint} accessibilityLabel="Rechercher un contact" autoCorrect={false} />
              </View>
              {selectable.length > 0 && (
                <Pressable onPress={toggleAll} style={styles.allBtn} accessibilityRole="button">
                  <Ionicons name={allOn ? 'checkbox' : 'square-outline'} size={20} color={C.green} />
                  <Text style={styles.allTxt}>{allOn ? 'Tout désélectionner' : `Tout sélectionner (${selectable.length})`}</Text>
                </Pressable>
              )}
            </View>
            <FlatList
              data={visible}
              keyExtractor={(r) => r.key}
              renderItem={renderItem}
              getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
              initialNumToRender={20}
              windowSize={7}
              ListEmptyComponent={<Text style={styles.none}>{q ? 'Aucun contact ne correspond.' : `Aucun contact avec ${mode === 'phone' ? 'un numéro' : 'un email'}.`}</Text>}
            />
            <View style={styles.footer}>
              <Pressable onPress={confirm} disabled={!count} style={[styles.primary, styles.wide, !count && { opacity: 0.5 }]}
                accessibilityRole="button" accessibilityState={{ disabled: !count }} aria-disabled={!count}>
                <Ionicons name="person-add-outline" size={18} color={C.white} />
                <Text style={styles.primaryTxt}>{count ? `Ajouter ${count} contact${count > 1 ? 's' : ''}` : 'Cochez des contacts'}</Text>
              </Pressable>
              {count > 20 && <Text style={styles.waves}>Les invitations partent automatiquement par vagues : vous pouvez en sélectionner autant que vous voulez.</Text>}
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.textMut, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  bigIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: C.text, textAlign: 'center' },
  emptyTxt: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20 },
  tools: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  search: { minHeight: 44, borderRadius: 12, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 10 },
  allBtn: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8 },
  allTxt: { fontSize: 14, fontWeight: '700', color: C.green },
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  rowOn: { backgroundColor: '#F6FBF8' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '800', color: C.green },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  value: { fontSize: 13, color: C.textSub, marginTop: 2 },
  none: { textAlign: 'center', color: C.textSub, marginTop: 32, fontSize: 14 },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: C.border, gap: 8 },
  primary: { minHeight: 52, borderRadius: 16, backgroundColor: C.green, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  wide: { width: '100%' },
  primaryTxt: { fontSize: 16, fontWeight: '800', color: C.white },
  waves: { fontSize: 12, color: C.textSub, textAlign: 'center' },
});
