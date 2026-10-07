/**
 * screens/MiniSiteEditorScreen.js — M08 · Retoucher son mini-site
 * ════════════════════════════════════════════════════════════════
 * Aperçu en direct + 4 onglets : Couleurs (harmonies toutes lisibles), Polices,
 * Sections (ordre, masquer), Textes. Le serveur revalide tout à l'enregistrement.
 * params : { eventId }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import MiniSite from '../components/minisite/MiniSite';
import { FONT_LABELS, HARMONY_LABELS, LOCKED, SECTION_LABELS } from '../components/minisite/catalog';
import { FONT_PAIRS, useMiniSiteFonts } from '../components/minisite/fonts';
import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import { C } from '../constants/theme';
import minisiteService from '../services/minisiteService';
import { showAlert } from '../utils/dialog';

const BASE_W = 390;
const TABS = [['colors', 'Couleurs'], ['fonts', 'Polices'], ['sections', 'Sections'], ['texts', 'Textes']];
const FIELD_LABELS = { kicker: 'Accroche', subtitle: 'Sous-titre', title: 'Titre', body: 'Texte', note: 'Précision', label: 'Bouton', text: 'Texte' };
const LIMITS = {
  hero: { kicker: 40, subtitle: 140 }, countdown: { title: 60 }, intro: { title: 60, body: 600 }, details: { title: 60 },
  location: { title: 60, note: 160 }, online: { title: 60, note: 160 }, gallery: { title: 60 }, dresscode: { title: 60, note: 180 },
  capacity: { title: 60 }, cta: { title: 70, body: 180, label: 28 }, host: { title: 60, note: 220 }, faq: { title: 60 },
  divider: { text: 90 }, calendar: { label: 40 }, footer: { text: 140 },
};

export default function MiniSiteEditorScreen({ route, navigation }) {
  const { eventId } = route?.params || {};
  const { width, height } = useWindowDimensions();
  const [saved, setSaved] = useState(null);       // { spec, event }
  const [spec, setSpec] = useState(null);
  const [tab, setTab] = useState('colors');
  const [saving, setSaving] = useState(false);
  const fontsReady = useMiniSiteFonts(Object.keys(FONT_PAIRS));

  useEffect(() => {
    minisiteService.get(eventId).then((d) => { setSaved(d); setSpec(d.spec); })
      .catch(() => showAlert('Mini-site indisponible', "Choisissez d'abord un modèle.", [{ text: 'OK', onPress: () => navigation.goBack() }]));
  }, [eventId]);

  const dirty = useMemo(() => saved && JSON.stringify(saved.spec) !== JSON.stringify(spec), [saved, spec]);
  const goBack = () => {
    if (!dirty) { navigation.goBack(); return; }
    showAlert('Quitter sans enregistrer ?', 'Vos retouches seront perdues.', [
      { text: 'Rester', style: 'cancel' }, { text: 'Quitter', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  if (!spec || !fontsReady) {
    return <SafeAreaView style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={C.green} /></SafeAreaView>;
  }

  const theme = spec.theme;
  const sections = spec.sections;
  const hidden = new Set(spec.hidden || []);
  const set = (fn) => setSpec((s) => fn(JSON.parse(JSON.stringify(s))));

  const pickHarmony = (h) => set((s) => {
    if (h === s.theme.harmony) return s;
    s.theme.alternatives[s.theme.harmony] = s.theme.colors;
    s.theme.colors = s.theme.alternatives[h];
    delete s.theme.alternatives[h];
    s.theme.harmony = h;
    return s;
  });
  const move = (i, d) => set((s) => {
    const j = i + d;
    if (j < 1 || j > s.sections.length - 2) return s;
    [s.sections[i], s.sections[j]] = [s.sections[j], s.sections[i]];
    return s;
  });
  const toggle = (kind) => set((s) => {
    const h = new Set(s.hidden || []);
    if (h.has(kind)) h.delete(kind); else h.add(kind);
    s.hidden = [...h];
    return s;
  });
  const setText = (kind, field, value) => set((s) => { s.copy[kind] = { ...(s.copy[kind] || {}), [field]: value }; return s; });

  const save = async () => {
    const before = saved.spec;
    const changes = {};
    if (theme.harmony !== before.theme.harmony) changes.harmony = theme.harmony;
    if (theme.fonts !== before.theme.fonts) changes.fonts = theme.fonts;
    const order = sections.map((s) => s.kind);
    if (order.join() !== before.sections.map((s) => s.kind).join()) changes.order = order;
    if ((spec.hidden || []).slice().sort().join() !== (before.hidden || []).slice().sort().join()) changes.hidden = spec.hidden || [];
    const copy = {};
    Object.entries(LIMITS).forEach(([kind, fields]) => Object.keys(fields).forEach((f) => {
      const a = spec.copy?.[kind]?.[f];
      if (a !== undefined && a !== before.copy?.[kind]?.[f]) copy[kind] = { ...(copy[kind] || {}), [f]: a };
    }));
    if (Object.keys(copy).length) changes.copy = copy;
    setSaving(true);
    try {
      const res = await minisiteService.edit(eventId, changes);
      setSaved({ ...saved, spec: res.spec });
      setSpec(res.spec);
      showAlert('Retouches enregistrées', 'Vos invités voient maintenant la nouvelle version.');
    } catch (err) {
      showAlert('Enregistrement impossible', err.response?.data?.detail || 'Vérifiez votre connexion puis réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const previewW = Math.min(width, 520) - 32;
  const scale = previewW / BASE_W;
  const harmonies = [theme.harmony, ...Object.keys(theme.alternatives || {})];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton variant="square" onPress={goBack} />
        <Text style={styles.title} accessibilityRole="header">Retoucher le mini-site</Text>
        <Pressable onPress={() => navigation.navigate('MiniSiteView', { eventId, spec, event: saved.event })} style={styles.iconBtn}
          accessibilityRole="button" accessibilityLabel="Aperçu en plein écran">
          <Ionicons name="expand-outline" size={20} color={C.green} />
        </Pressable>
      </View>

      <View style={[styles.preview, { height: Math.min(height * 0.34, 320), width: previewW }]}>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={{ width: BASE_W, transform: [{ scale }], transformOrigin: 'top left' }} pointerEvents="none">
            <MiniSite spec={spec} event={saved.event} width={BASE_W} preview />
          </View>
        </ScrollView>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]}
            accessibilityRole="tab" accessibilityState={{ selected: tab === id }} aria-selected={tab === id}>
            <Text style={[styles.tabTxt, tab === id && styles.tabTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.panel} keyboardShouldPersistTaps="handled">
          {tab === 'colors' ? (
            <View style={styles.wrap}>
              {harmonies.map((h) => {
                const cols = h === theme.harmony ? theme.colors : theme.alternatives[h];
                const on = h === theme.harmony;
                return (
                  <Pressable key={h} onPress={() => pickHarmony(h)} style={[styles.choice, on && styles.choiceOn]}
                    accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`Palette ${HARMONY_LABELS[h] || h}`}>
                    <View style={{ flexDirection: 'row' }}>
                      {[cols.bg, cols.primary, cols.accent, cols.text].map((c, i) => (
                        <View key={i} style={[styles.swatch, { backgroundColor: c, marginLeft: i ? -8 : 0 }]} />
                      ))}
                    </View>
                    <Text style={styles.choiceTxt}>{HARMONY_LABELS[h] || h}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {tab === 'fonts' ? (
            <View style={styles.wrap}>
              {Object.keys(FONT_PAIRS).map((id) => {
                const on = id === theme.fonts;
                return (
                  <Pressable key={id} onPress={() => set((s) => { s.theme.fonts = id; return s; })} style={[styles.choice, on && styles.choiceOn]}
                    accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`Police ${FONT_LABELS[id]}`}>
                    <Text style={{ fontFamily: FONT_PAIRS[id].display, fontSize: 22, color: C.text }}>Aa</Text>
                    <Text style={styles.choiceTxt}>{FONT_LABELS[id]}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {tab === 'sections' ? (
            <View style={{ gap: 8 }}>
              {sections.map((s, i) => {
                const locked = LOCKED.includes(s.kind);
                const fixed = i === 0 || i === sections.length - 1;
                const label = SECTION_LABELS[s.kind] || s.kind;
                return (
                  <View key={s.kind} style={styles.row}>
                    <Text style={[styles.rowTxt, hidden.has(s.kind) && { color: C.textMut, textDecorationLine: 'line-through' }]}>{label}</Text>
                    {!fixed ? (
                      <>
                        <Pressable onPress={() => move(i, -1)} disabled={i <= 1} style={[styles.small, i <= 1 && { opacity: 0.3 }]}
                          accessibilityRole="button" accessibilityLabel={`Monter « ${label} »`}>
                          <Ionicons name="arrow-up" size={18} color={C.text} />
                        </Pressable>
                        <Pressable onPress={() => move(i, 1)} disabled={i >= sections.length - 2} style={[styles.small, i >= sections.length - 2 && { opacity: 0.3 }]}
                          accessibilityRole="button" accessibilityLabel={`Descendre « ${label} »`}>
                          <Ionicons name="arrow-down" size={18} color={C.text} />
                        </Pressable>
                      </>
                    ) : <Text style={styles.fixed}>{i === 0 ? 'En haut' : 'En bas'}</Text>}
                    <Switch value={!hidden.has(s.kind)} disabled={locked} onValueChange={() => toggle(s.kind)}
                      accessibilityLabel={`Afficher « ${label} »`} trackColor={{ true: C.green }} />
                  </View>
                );
              })}
            </View>
          ) : null}

          {tab === 'texts' ? (
            <View style={{ gap: 18 }}>
              {sections.filter((s) => LIMITS[s.kind] && !hidden.has(s.kind)).map((s) => (
                <View key={s.kind}>
                  <Text style={styles.group}>{SECTION_LABELS[s.kind]}</Text>
                  {Object.entries(LIMITS[s.kind]).map(([field, max]) => {
                    const value = spec.copy?.[s.kind]?.[field] ?? '';
                    return (
                      <View key={field} style={{ marginTop: 8 }}>
                        <Text style={styles.fieldLabel}>{`${FIELD_LABELS[field]} · ${value.length}/${max}`}</Text>
                        <TextInput value={value} onChangeText={(v) => setText(s.kind, field, v.slice(0, max))} multiline={max > 80}
                          style={[styles.input, max > 80 && { minHeight: 80, textAlignVertical: 'top' }]}
                          accessibilityLabel={`${FIELD_LABELS[field]} — ${SECTION_LABELS[s.kind]}`} />
                      </View>
                    );
                  })}
                </View>
              ))}
              <Text style={styles.note}>Les informations pratiques (date, lieu, prix, questions fréquentes) viennent de votre événement : modifiez-les depuis « Modifier l'événement ».</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <PrimaryButton label={dirty ? 'Enregistrer' : 'Aucune modification'} disabled={!dirty} loading={saving} onPress={save} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  preview: { alignSelf: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: C.white, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: C.green },
  tabTxt: { fontSize: 14, fontWeight: '700', color: C.textSub },
  tabTxtOn: { color: C.white },
  panel: { padding: 16, paddingBottom: 40 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: { width: '30%', minWidth: 100, flexGrow: 1, alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: C.white, borderWidth: 2, borderColor: C.border },
  choiceOn: { borderColor: C.green },
  choiceTxt: { fontSize: 13, fontWeight: '600', color: C.text, textAlign: 'center' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 12, padding: 10, paddingLeft: 14, borderWidth: 1, borderColor: C.border },
  rowTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  small: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  fixed: { fontSize: 12, color: C.textSub, width: 88, textAlign: 'center' },
  group: { fontSize: 15, fontWeight: '800', color: C.text },
  fieldLabel: { fontSize: 12, color: C.textSub, marginBottom: 4 },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 15, color: C.text },
  note: { fontSize: 13, color: C.textSub, lineHeight: 19 },
  footer: { padding: 16, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.white },
});
