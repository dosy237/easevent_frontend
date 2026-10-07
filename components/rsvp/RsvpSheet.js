/**
 * components/rsvp/RsvpSheet.js — Réponse RSVP (M19)
 * ════════════════════════════════════════════════════════════════
 * Fenêtre du bas, montée une fois dans App.js. Elle s'ouvre via
 * askRsvp() (utils/rsvp.js) avant d'accepter une invitation ou de
 * prendre un ticket : questions de l'organisateur en 2 étapes au plus.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { C, TOUCH } from '../../constants/theme';
import { registerRsvpHost } from '../../utils/rsvp';
import { PrimaryButton } from '../ui/Buttons';

const TEXT_MAX = 500;
const PER_STEP = 3;

// Valeur vide (non répondue) selon le type
const isEmpty = (q, v) => v === undefined || v === null || v === ''
  || (q.kind === 'multiple' && (!Array.isArray(v) || v.length === 0))
  || (q.kind === 'text' && !String(v).trim());

export function RsvpQuestion({ question: q, value, onChange, error }) {
  const labelId = `rsvp-${q.id}`;
  const choice = (label, selected, onPress, multiple) => (
    <Pressable key={label} onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}
      accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={label}>
      <Ionicons name={multiple ? (selected ? 'checkbox' : 'square-outline') : (selected ? 'radio-button-on' : 'radio-button-off')}
        size={20} color={selected ? C.green : C.textMut} />
      <Text style={[styles.choiceTxt, selected && styles.choiceTxtOn]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.question}>
      <Text style={styles.qLabel} nativeID={labelId}>
        {q.label}{q.required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      {q.required ? <Text style={styles.qHint}>Obligatoire</Text> : <Text style={styles.qHint}>Facultatif</Text>}
      {q.kind === 'text' && (
        <TextInput style={[styles.input, error && styles.inputErr]} value={value || ''} onChangeText={onChange}
          placeholder="Votre réponse" placeholderTextColor={C.textFaint} multiline maxLength={TEXT_MAX}
          accessibilityLabel={q.label} />
      )}
      {q.kind === 'yesno' && (
        <View style={styles.yesno} accessibilityRole="radiogroup" accessibilityLabel={q.label}>
          {[['Oui', true], ['Non', false]].map(([label, v]) => (
            <Pressable key={label} onPress={() => onChange(value === v ? null : v)}
              style={[styles.pill, value === v && styles.pillOn]} accessibilityRole="radio"
              accessibilityState={{ checked: value === v, checked: value === v }} accessibilityLabel={label}>
              <Text style={[styles.pillTxt, value === v && { color: C.white }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {q.kind === 'single' && (
        <View accessibilityRole="radiogroup" accessibilityLabel={q.label}>
          {q.options.map((o) => choice(o, value === o, () => onChange(value === o ? null : o), false))}
        </View>
      )}
      {q.kind === 'multiple' && (
        <View accessibilityLabel={q.label}>
          {q.options.map((o) => {
            const list = Array.isArray(value) ? value : [];
            const on = list.includes(o);
            return choice(o, on, () => onChange(on ? list.filter((x) => x !== o) : [...list, o]), true);
          })}
        </View>
      )}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

export default function RsvpSheet() {
  const [state, setState] = useState(null);       // { questions, answers, event, resolve, submitLabel }
  const [values, setValues] = useState({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const scrollRef = useRef(null);

  useEffect(() => {
    registerRsvpHost({
      open: (data) => {
        setValues({ ...(data.answers || {}) });
        setErrors({});
        setStep(0);
        setState(data);
      },
    });
    return () => registerRsvpHost(null);
  }, []);

  // 2 étapes au plus : au-delà de 3 questions, on coupe en deux
  const steps = useMemo(() => {
    const qs = state?.questions || [];
    if (qs.length <= PER_STEP) return [qs];
    const half = Math.ceil(qs.length / 2);
    return [qs.slice(0, half), qs.slice(half)];
  }, [state]);

  if (!state) return null;
  const current = steps[step] || [];
  const last = step === steps.length - 1;

  const finish = (result) => {
    const { resolve } = state;
    setState(null);
    resolve?.(result);
  };

  const next = () => {
    const missing = {};
    current.forEach((q) => { if (q.required && isEmpty(q, values[q.id])) missing[q.id] = 'Merci de répondre à cette question.'; });
    setErrors(missing);
    if (Object.keys(missing).length) return;
    if (!last) {
      setStep(step + 1);
      scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      return;
    }
    // Réponses envoyées pour toutes les questions (null = pas de réponse)
    const out = {};
    state.questions.forEach((q) => { out[q.id] = isEmpty(q, values[q.id]) ? null : values[q.id]; });
    finish(out);
  };

  const setValue = (id, v) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    setErrors((prev) => ({ ...prev, [id]: undefined }));
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={() => finish(null)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => finish(null)} accessibilityLabel="Fermer" accessibilityRole="button" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap}>
          <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal role="dialog" aria-modal="true">
            <View style={styles.handle} />
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} accessibilityRole="header">
                  {state.submitLabel ? 'Mes réponses' : "Quelques questions de l'organisateur"}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {state.event?.title}{steps.length > 1 ? ` · Étape ${step + 1} sur ${steps.length}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => finish(null)} style={styles.close} accessibilityRole="button" accessibilityLabel="Fermer sans répondre">
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
            </View>
            {steps.length > 1 && (
              <View style={styles.progress}>
                {steps.map((_, i) => <View key={i} style={[styles.bar, i <= step && styles.barOn]} />)}
              </View>
            )}
            <ScrollView ref={scrollRef} style={styles.scrollArea} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {current.map((q) => (
                <RsvpQuestion key={q.id} question={q} value={values[q.id]} error={errors[q.id]}
                  onChange={(v) => setValue(q.id, v)} />
              ))}
            </ScrollView>
            <View style={styles.footer}>
              {step > 0 && (
                <Pressable onPress={() => setStep(step - 1)} style={styles.backBtn} accessibilityRole="button">
                  <Text style={styles.backTxt}>Retour</Text>
                </Pressable>
              )}
              <View style={{ flex: 1 }}>
                <PrimaryButton label={last ? (state.submitLabel || 'Confirmer ma venue') : 'Continuer'}
                  icon={last ? 'checkmark-outline' : 'arrow-forward-outline'} onPress={next} />
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetWrap: { maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center', flexShrink: 1 },
  // Le contenu défile, le bouton reste visible en bas
  scrollArea: { flexGrow: 0, flexShrink: 1 },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 8, flexShrink: 1, maxHeight: '100%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  title: { fontSize: 18, fontWeight: '900', color: C.text },
  sub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  close: { width: TOUCH, height: TOUCH, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginTop: 12 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  barOn: { backgroundColor: C.green },
  body: { padding: 20, gap: 22 },
  question: { gap: 8 },
  qLabel: { fontSize: 16, fontWeight: '800', color: C.text, lineHeight: 22 },
  req: { color: C.orange },
  qHint: { fontSize: 12, color: C.textMut, marginTop: -4 },
  input: { minHeight: 80, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg, padding: 14, fontSize: 15, color: C.text, textAlignVertical: 'top' },
  inputErr: { borderColor: C.error },
  yesno: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: C.green, borderColor: C.green },
  pillTxt: { fontSize: 15, fontWeight: '800', color: C.text },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, marginBottom: 8 },
  choiceOn: { borderColor: C.green, backgroundColor: C.greenLight },
  choiceTxt: { flex: 1, fontSize: 15, color: C.text },
  choiceTxtOn: { fontWeight: '700', color: C.greenDark },
  error: { fontSize: 13, color: C.errorText },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  backBtn: { minHeight: TOUCH, paddingHorizontal: 12, justifyContent: 'center' },
  backTxt: { fontSize: 15, fontWeight: '700', color: C.textSub },
});
