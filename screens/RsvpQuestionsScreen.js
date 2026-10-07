/**
 * RsvpQuestionsScreen.js — Easevent (M14 · Questions RSVP)
 * ════════════════════════════════════════════════════════════════
 * L'organisateur pose jusqu'à 5 questions (texte libre, choix unique,
 * choix multiple, oui / non), obligatoires ou non. Les invités y
 * répondent en confirmant leur venue (M19). Onglet « Réponses » :
 * synthèse par question.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { C, TOUCH } from '../constants/theme';
import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import { Bone, SkeletonGroup } from '../components/ui/Skeleton';
import rsvpService from '../services/rsvpService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';

const KINDS = [
  { value: 'yesno',    label: 'Oui / Non',      icon: 'toggle-outline' },
  { value: 'single',   label: 'Choix unique',   icon: 'radio-button-on-outline' },
  { value: 'multiple', label: 'Choix multiple', icon: 'checkbox-outline' },
  { value: 'text',     label: 'Texte libre',    icon: 'create-outline' },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.value, k]));
const MAX_OPTIONS = 8;
const TYPE_NAMES = {
  mariage: 'un mariage', anniversaire: 'un anniversaire', soiree: 'une soirée', gala: 'un gala', conference: 'une conférence',
  seminaire: 'un séminaire', atelier: 'un atelier', concert: 'un concert', festival: 'un festival', exposition: 'une exposition',
};

// ─────────────────────────────────────────────────────────────
// Éditeur d'une question (fenêtre du bas)
// ─────────────────────────────────────────────────────────────
function QuestionEditor({ draft, onClose, onSave, saving }) {
  const [kind, setKind] = useState(draft.kind || 'yesno');
  const [label, setLabel] = useState(draft.label || '');
  const [options, setOptions] = useState(draft.options?.length ? draft.options : ['', '']);
  const [required, setRequired] = useState(!!draft.required);
  const [error, setError] = useState('');
  const withChoices = kind === 'single' || kind === 'multiple';

  const save = () => {
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!label.trim()) { setError('Écrivez la question.'); return; }
    if (withChoices && clean.length < 2) { setError('Proposez au moins 2 choix.'); return; }
    const go = () => onSave({ kind, label: label.trim(), required, options: withChoices ? clean : [] });
    if (draft.id && draft.answers_count && kind !== draft.kind) {
      showAlert('Changer le type ?', `Les ${draft.answers_count} réponse(s) déjà reçues à cette question seront effacées.`,
        [{ text: 'Annuler', style: 'cancel' }, { text: 'Changer', style: 'destructive', onPress: go }]);
      return;
    }
    go();
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} accessibilityRole="header">{draft.id ? 'Modifier la question' : 'Nouvelle question'}</Text>
              <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Fermer">
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.scrollArea} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Type de réponse</Text>
              <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel="Type de réponse">
                {KINDS.map((k) => {
                  const on = kind === k.value;
                  return (
                    <Pressable key={k.value} onPress={() => { setKind(k.value); setError(''); }} style={[styles.kind, on && styles.kindOn]}
                      accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={k.label}>
                      <Ionicons name={k.icon} size={18} color={on ? C.white : C.green} />
                      <Text style={[styles.kindTxt, on && { color: C.white }]}>{k.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Question</Text>
              <TextInput style={styles.input} value={label} onChangeText={(t) => { setLabel(t); setError(''); }}
                placeholder="Ex. Avez-vous un régime alimentaire particulier ?" placeholderTextColor={C.textFaint}
                maxLength={200} multiline accessibilityLabel="Texte de la question" />

              {withChoices && (
                <>
                  <Text style={styles.label}>Choix proposés</Text>
                  {options.map((o, i) => (
                    <View key={i} style={styles.optRow}>
                      <Ionicons name={kind === 'single' ? 'radio-button-off' : 'square-outline'} size={18} color={C.textMut} />
                      <TextInput style={[styles.input, styles.optInput]} value={o} maxLength={80}
                        onChangeText={(t) => { setOptions(options.map((x, j) => (j === i ? t : x))); setError(''); }}
                        placeholder={`Choix ${i + 1}`} placeholderTextColor={C.textFaint} accessibilityLabel={`Choix ${i + 1}`} />
                      {options.length > 2 && (
                        <Pressable onPress={() => setOptions(options.filter((_, j) => j !== i))} style={styles.iconBtn}
                          accessibilityRole="button" accessibilityLabel={`Retirer le choix ${i + 1}`}>
                          <Ionicons name="close-circle" size={22} color={C.textMut} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                  {options.length < MAX_OPTIONS && (
                    <Pressable onPress={() => setOptions([...options, ''])} style={styles.addOpt} accessibilityRole="button">
                      <Ionicons name="add" size={18} color={C.green} />
                      <Text style={styles.addOptTxt}>Ajouter un choix</Text>
                    </Pressable>
                  )}
                </>
              )}

              <View style={styles.reqRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqTitle}>Réponse obligatoire</Text>
                  <Text style={styles.reqSub}>L'invité ne peut pas confirmer sans répondre.</Text>
                </View>
                <Switch value={required} onValueChange={setRequired} trackColor={{ true: C.green, false: C.border }}
                  thumbColor={C.white} accessibilityLabel="Réponse obligatoire" />
              </View>
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            </ScrollView>
            <View style={styles.sheetFooter}>
              <PrimaryButton label="Enregistrer la question" icon="checkmark-outline" onPress={save} loading={saving} />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Synthèse des réponses
// ─────────────────────────────────────────────────────────────
function Summary({ questions }) {
  if (!questions.length) {
    return <Text style={styles.empty}>Ajoutez des questions : les réponses de vos invités apparaîtront ici.</Text>;
  }
  return questions.map((q) => {
    const total = Math.max(1, ...(q.counts || []).map((c) => c.count));
    return (
      <View key={q.id} style={styles.card}>
        <Text style={styles.qTitle}>{q.label}</Text>
        <Text style={styles.qMeta}>{q.answers_count} réponse{q.answers_count > 1 ? 's' : ''}</Text>
        {q.counts && q.counts.map((c) => (
          <View key={c.label} style={styles.barRow} accessible accessibilityLabel={`${c.label} : ${c.count}`}>
            <Text style={styles.barLabel} numberOfLines={1}>{c.label}</Text>
            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${(c.count / total) * 100}%` }]} /></View>
            <Text style={styles.barCount}>{c.count}</Text>
          </View>
        ))}
        {q.texts && (q.texts.length ? q.texts.map((t, i) => (
          <View key={i} style={styles.textAnswer}>
            <Text style={styles.textAnswerName}>{t.name}</Text>
            <Text style={styles.textAnswerBody}>{t.text}</Text>
          </View>
        )) : <Text style={styles.qMeta}>Pas encore de réponse.</Text>)}
      </View>
    );
  });
}

// ─────────────────────────────────────────────────────────────
// Écran
// ─────────────────────────────────────────────────────────────
export default function RsvpQuestionsScreen({ navigation, route }) {
  const event = route?.params?.event || {};
  const [tab, setTab] = useState('questions');
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState([]);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([rsvpService.list(event.id), rsvpService.summary(event.id)]);
      setData(list);
      setSummary(sum.questions);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Les questions sont indisponibles.'));
    } finally {
      setRefreshing(false);
    }
  }, [event.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (action) => {
    try {
      setData(await action());
      rsvpService.summary(event.id).then((s) => setSummary(s.questions)).catch(() => {});
      return true;
    } catch (err) {
      showAlert('Action impossible', apiErrorMessage(err));
      return false;
    }
  };

  const save = async (values) => {
    setSaving(true);
    const ok = await run(() => (draft.id ? rsvpService.update(event.id, draft.id, values) : rsvpService.create(event.id, values)));
    setSaving(false);
    if (ok) setDraft(null);
  };

  const remove = (q) => showAlert('Supprimer la question ?',
    q.answers_count ? `Les ${q.answers_count} réponse(s) reçues seront aussi supprimées.` : `« ${q.label} »`,
    [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => run(() => rsvpService.remove(event.id, q.id)) }]);

  const move = (index, delta) => {
    const ids = data.questions.map((q) => q.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    run(() => rsvpService.reorder(event.id, ids));
  };

  const questions = data?.questions || [];
  const full = data && questions.length >= data.max;
  const answers = summary.reduce((n, q) => Math.max(n, q.answers_count), 0);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={() => navigation.goBack()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle} accessibilityRole="header">Questions RSVP</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{event.title}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {[['questions', `Questions (${questions.length})`], ['answers', 'Réponses']].map(([id, label]) => (
            <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]}
              accessibilityRole="tab" accessibilityState={{ selected: tab === id }}>
              <Text style={[styles.tabTxt, tab === id && styles.tabTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.green} />}>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {!data && !error ? (
            <SkeletonGroup label="Chargement des questions">
              {[0, 1, 2].map((i) => <Bone key={i} height={86} radius={16} style={{ marginBottom: 12 }} />)}
            </SkeletonGroup>
          ) : tab === 'answers' ? (
            <Summary questions={summary} />
          ) : data ? (
            <>
              <View style={styles.intro}>
                <Ionicons name="help-circle-outline" size={20} color={C.green} />
                <Text style={styles.introTxt}>
                  Posez jusqu'à {data.max} questions. Vos invités y répondent en confirmant leur venue ; les réponses
                  apparaissent dans la liste des invités et dans l'export.
                </Text>
              </View>

              {questions.map((q, i) => (
                <View key={q.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.kindBadge}><Ionicons name={KIND[q.kind]?.icon} size={16} color={C.green} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qTitle}>{q.label}</Text>
                      <Text style={styles.qMeta}>
                        {KIND[q.kind]?.label}{q.required ? ' · Obligatoire' : ''} · {q.answers_count} réponse{q.answers_count > 1 ? 's' : ''}
                      </Text>
                      {q.options?.length ? <Text style={styles.qOpts} numberOfLines={2}>{q.options.join(' · ')}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable onPress={() => move(i, -1)} disabled={i === 0} style={[styles.iconBtn, i === 0 && { opacity: 0.3 }]}
                      accessibilityRole="button" accessibilityLabel={`Monter « ${q.label} »`} accessibilityState={{ disabled: i === 0 }}>
                      <Ionicons name="arrow-up" size={18} color={C.textSub} />
                    </Pressable>
                    <Pressable onPress={() => move(i, 1)} disabled={i === questions.length - 1}
                      style={[styles.iconBtn, i === questions.length - 1 && { opacity: 0.3 }]}
                      accessibilityRole="button" accessibilityLabel={`Descendre « ${q.label} »`} accessibilityState={{ disabled: i === questions.length - 1 }}>
                      <Ionicons name="arrow-down" size={18} color={C.textSub} />
                    </Pressable>
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => setDraft(q)} style={styles.textBtn} accessibilityRole="button" accessibilityLabel={`Modifier « ${q.label} »`}>
                      <Ionicons name="create-outline" size={16} color={C.green} />
                      <Text style={styles.textBtnTxt}>Modifier</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(q)} style={styles.textBtn} accessibilityRole="button" accessibilityLabel={`Supprimer « ${q.label} »`}>
                      <Ionicons name="trash-outline" size={16} color={C.errorText} />
                      <Text style={[styles.textBtnTxt, { color: C.errorText }]}>Supprimer</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              {full ? (
                <Text style={styles.fullTxt}>Vous avez atteint {data.max} questions. Supprimez-en une pour en ajouter une autre.</Text>
              ) : (
                <PrimaryButton label="Ajouter une question" icon="add" onPress={() => setDraft({ kind: 'yesno' })} />
              )}

              {!full && data.suggestions?.length > 0 && (
                <View style={{ marginTop: 22 }}>
                  <Text style={styles.sectionTitle}>Suggestions{TYPE_NAMES[event.event_type] ? ` pour ${TYPE_NAMES[event.event_type]}` : ''}</Text>
                  {data.suggestions.map((s) => (
                    <Pressable key={s.label} onPress={() => setDraft(s)} style={styles.suggestion} accessibilityRole="button"
                      accessibilityLabel={`Ajouter la suggestion : ${s.label}`}>
                      <Ionicons name={KIND[s.kind]?.icon} size={18} color={C.green} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTxt}>{s.label}</Text>
                        <Text style={styles.qMeta}>{KIND[s.kind]?.label}{s.options?.length ? ` · ${s.options.length} choix` : ''}</Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color={C.green} />
                    </Pressable>
                  ))}
                </View>
              )}
              {answers > 0 && (
                <Text style={styles.note}>Modifier une question déjà répondue garde les réponses compatibles ; changer son type les efface.</Text>
              )}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      {draft && <QuestionEditor key={draft.id || draft.label || 'new'} draft={draft} saving={saving} onClose={() => setDraft(null)} onSave={save} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  headerSub: { fontSize: 12, color: C.textMut },
  tabs: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: C.green },
  tabTxt: { fontSize: 14, fontWeight: '700', color: C.textMut },
  tabTxtOn: { color: C.green },
  scroll: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  intro: { flexDirection: 'row', gap: 10, backgroundColor: C.greenLight, borderRadius: 14, padding: 14, marginBottom: 14 },
  introTxt: { flex: 1, fontSize: 13, color: C.greenDark, lineHeight: 19 },
  card: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardHead: { flexDirection: 'row', gap: 12 },
  kindBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  qTitle: { fontSize: 15, fontWeight: '800', color: C.text, lineHeight: 21 },
  qMeta: { fontSize: 12, color: C.textMut, marginTop: 2 },
  qOpts: { fontSize: 12, color: C.textSub, marginTop: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
  iconBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: TOUCH, paddingHorizontal: 8 },
  textBtnTxt: { fontSize: 13, fontWeight: '700', color: C.green },
  fullTxt: { fontSize: 13, color: C.textSub, textAlign: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  suggestionTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  note: { fontSize: 12, color: C.textMut, marginTop: 16, textAlign: 'center' },
  empty: { fontSize: 14, color: C.textSub, textAlign: 'center', marginTop: 30, lineHeight: 20 },
  error: { fontSize: 13, color: C.errorText, marginBottom: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  barLabel: { width: 110, fontSize: 13, color: C.text },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.bg, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: C.green },
  barCount: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '800', color: C.text },
  textAnswer: { marginTop: 10, backgroundColor: C.bg, borderRadius: 12, padding: 10 },
  textAnswerName: { fontSize: 12, fontWeight: '800', color: C.textSub },
  textAnswerBody: { fontSize: 14, color: C.text, marginTop: 2 },
  // Éditeur
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetWrap: { maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center', flexShrink: 1 },
  // Le contenu défile, le bouton reste visible en bas
  scrollArea: { flexGrow: 0, flexShrink: 1 },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexShrink: 1, maxHeight: '100%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: C.text },
  close: { width: TOUCH, height: TOUCH, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  sheetBody: { padding: 20, gap: 10 },
  sheetFooter: { paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  label: { fontSize: 12, fontWeight: '800', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TOUCH, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, flexGrow: 1, flexBasis: '45%' },
  kindOn: { backgroundColor: C.green, borderColor: C.green },
  kindTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optInput: { flex: 1 },
  addOpt: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TOUCH },
  addOptTxt: { fontSize: 14, fontWeight: '700', color: C.green },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, backgroundColor: C.bg, borderRadius: 14, padding: 12 },
  reqTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  reqSub: { fontSize: 12, color: C.textMut, marginTop: 2 },
});
