/**
 * screens/MiniSiteGeneratingScreen.js — M06 · Génération du mini-site
 * ════════════════════════════════════════════════════════════════
 * Lance (ou reprend) la génération et suit ses étapes réelles :
 * direction artistique → rédaction et relecture → mise en page des 6 propositions.
 * L'organisateur peut quitter l'écran : une notification le prévient quand c'est prêt.
 * params : { event, regenerate }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { C } from '../constants/theme';
import minisiteService from '../services/minisiteService';
import eventService from '../services/eventService';
import { isPlanLimit, planLimitAlert } from '../utils/plans';

const STEPS = [
  { key: 'direction', label: 'Direction artistique et rédaction', sub: 'Couleurs, polices et textes inspirés de votre thème' },
  { key: 'critique', label: 'Revue du directeur de création', sub: 'Un second modèle critique et affine chaque proposition' },
  { key: 'composition', label: 'Mise en page finale', sub: '6 propositions aux dispositions toutes différentes' },
];
const ORDER = { queued: 0, direction: 0, review: 0, critique: 1, composition: 2, done: 3 };

export default function MiniSiteGeneratingScreen({ route, navigation }) {
  const { event, regenerate } = route?.params || {};
  const [step, setStep] = useState('queued');
  const [failed, setFailed] = useState(null);
  const [attempt, setAttempt] = useState(0);
  // Événement créé sans thème : on le demande ici, puis la génération repart
  const [needTheme, setNeedTheme] = useState(false);
  const [theme, setTheme] = useState('');
  const [saving, setSaving] = useState(false);
  const SUBJECT = ['conference', 'seminaire', 'atelier', 'exposition'].includes(event?.event_type);
  const saveTheme = async () => {
    setSaving(true);
    try {
      await eventService.updateEvent(event.id, { theme: theme.trim() });
      setNeedTheme(false);
      setAttempt((a) => a + 1);
    } catch (err) {
      setFailed(err.response?.data?.theme || err.response?.data?.detail || 'Enregistrement impossible. Réessayez.');
      setNeedTheme(false);
    } finally { setSaving(false); }
  };
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  useEffect(() => {
    if (!event?.id) return undefined;
    let alive = true;
    let timer;
    const done = (gen) => navigation.replace('TemplatePicker', { event, generationId: gen.id });
    const poll = async () => {
      try {
        const gen = await minisiteService.generation(event.id);
        if (!alive) return;
        setStep(gen.step || gen.status);
        if (gen.status === 'done') { done(gen); return; }
        if (gen.status === 'failed') { setFailed(gen.error || 'La génération a échoué.'); return; }
      } catch {
        // coupure réseau passagère : on réessaie
      }
      timer = setTimeout(poll, 1500);
    };
    (async () => {
      setFailed(null);
      try {
        const current = await minisiteService.generation(event.id);
        const running = ['pending', 'running'].includes(current.status);
        if (current.status === 'done' && !regenerate && attempt === 0) { done(current); return; }
        if (!running) await minisiteService.generate(event.id);
        poll();
      } catch (err) {
        if (!alive) return;
        if (isPlanLimit(err)) { planLimitAlert(navigation, err, 'Génération impossible'); navigation.goBack(); return; }
        if (err.response?.data?.code === 'theme_required') { setNeedTheme(true); return; }
        setFailed(err.response?.data?.detail || 'Vérifiez votre connexion puis réessayez.');
      }
    })();
    return () => { alive = false; clearTimeout(timer); };
  }, [event?.id, attempt]);

  const current = ORDER[step] ?? 0;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (needTheme) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.body}>
          <View style={styles.halo}><Ionicons name="bulb-outline" size={44} color={C.green} /></View>
          <Text style={styles.title} accessibilityRole="header">Quel est le thème ?</Text>
          <Text style={styles.sub}>
            {SUBJECT
              ? 'Le sujet traité, par exemple « L’impact de l’intelligence artificielle sur les capacités cognitives de l’homme ». Tout le texte du mini-site en présentera l’enjeu.'
              : 'L’univers de votre événement, par exemple « Amour et bohème ». Tout le texte du mini-site s’en inspire.'}
          </Text>
          <TextInput value={theme} onChangeText={(t) => setTheme(t.slice(0, 160))} multiline autoFocus
            placeholder={SUBJECT ? 'Le sujet de votre événement' : 'L’univers de votre événement'} placeholderTextColor={C.textMut}
            style={styles.themeInput} accessibilityLabel="Thème de l'événement" />
          <Text style={styles.count}>{`${theme.length}/160`}</Text>
        </View>
        <View style={styles.footer}>
          <PrimaryButton label="Générer mon mini-site" icon="sparkles" disabled={theme.trim().length < 3} loading={saving} onPress={saveTheme} />
          <SecondaryButton label="Retour" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Animated.View style={[styles.halo, !failed && { transform: [{ rotate }] }]}>
          <Ionicons name={failed ? 'alert-circle-outline' : 'sparkles'} size={44} color={failed ? C.orange : C.green} />
        </Animated.View>
        <Text style={styles.title} accessibilityRole="header">{failed ? 'Génération interrompue' : 'Votre mini-site se crée'}</Text>
        <Text style={styles.sub} accessibilityLiveRegion="polite">
          {failed || `Nos modèles d'IA composent 6 propositions pour « ${event?.title || 'votre événement'} ».`}
        </Text>
        {!failed ? (
          <View style={styles.steps}>
            {STEPS.map((s, i) => {
              const state = i < current ? 'done' : i === current ? 'active' : 'todo';
              return (
                <View key={s.key} style={styles.step} accessible accessibilityLabel={`${s.label} : ${state === 'done' ? 'terminé' : state === 'active' ? 'en cours' : 'à venir'}`}>
                  <View style={[styles.dot, state === 'done' && styles.dotDone, state === 'active' && styles.dotActive]}>
                    {state === 'done' ? <Ionicons name="checkmark" size={14} color={C.white} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepLabel, state === 'todo' && { color: C.textMut }]}>{s.label}</Text>
                    <Text style={styles.stepSub}>{s.sub}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        {failed ? <PrimaryButton label="Réessayer" icon="refresh" onPress={() => setAttempt((a) => a + 1)} /> : null}
        <SecondaryButton label={failed ? 'Retour' : 'Continuer en arrière-plan'} onPress={() => navigation.goBack()} />
        {!failed ? <Text style={styles.hint}>Vous recevrez une notification dès que c'est prêt.</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  halo: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  title: { fontSize: 23, fontWeight: '800', color: C.text, textAlign: 'center' },
  sub: { fontSize: 15, color: C.textSub, textAlign: 'center', marginTop: 8, lineHeight: 22, maxWidth: 380 },
  steps: { marginTop: 30, gap: 18, alignSelf: 'stretch', maxWidth: 420, width: '100%' },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.border || '#DDD', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dotActive: { borderColor: C.green, backgroundColor: C.greenLight },
  dotDone: { borderColor: C.green, backgroundColor: C.green },
  stepLabel: { fontSize: 16, fontWeight: '700', color: C.text },
  stepSub: { fontSize: 13, color: C.textSub, marginTop: 2, lineHeight: 18 },
  footer: { padding: 20, gap: 10 },
  hint: { fontSize: 13, color: C.textSub, textAlign: 'center' },
  themeInput: { alignSelf: 'stretch', maxWidth: 480, width: '100%', minHeight: 96, marginTop: 22, borderWidth: 1.5, borderColor: C.border || '#DDD',
    borderRadius: 14, padding: 14, fontSize: 16, color: C.text, textAlignVertical: 'top', backgroundColor: C.white },
  count: { alignSelf: 'flex-end', fontSize: 12, color: C.textSub, marginTop: 6 },
});
