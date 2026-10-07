/**
 * components/minisite/MiniSite.js — affiche un mini-site à partir de son plan (spec)
 * ════════════════════════════════════════════════════════════════
 * <MiniSite spec event actions width preview />
 *   spec     plan composé par le serveur (sections, thème, textes)
 *   event    données de l'événement (date, lieu, carte, photos, prix…) : toujours à jour
 *   actions  participate, map, directions, calendar, online, contact, viewImage, ctaLabel
 *   preview  aperçu (choix du modèle) : pas de compte à rebours animé, pas de défilement interne
 * Une section inconnue (application plus ancienne que le serveur) est simplement ignorée.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { useMiniSiteFonts } from './fonts';
import Ornament from './Ornament';
import { buildTheme, tone } from './theme';
import Hero from './sections/hero';
import { Calendar, Capacity, Countdown, Details, Location, Online } from './sections/info';
import { DressCode, Divider, Faq, Gallery, Host, Intro } from './sections/content';
import { Cta, Footer } from './sections/action';

const RENDERERS = {
  hero: Hero, countdown: Countdown, intro: Intro, details: Details, location: Location, online: Online,
  gallery: Gallery, dresscode: DressCode, capacity: Capacity, cta: Cta, host: Host, faq: Faq,
  divider: Divider, calendar: Calendar, footer: Footer,
};

export default function MiniSite({ spec, event, actions = {}, width = 390, preview = false, header = null, onScroll }) {
  const ready = useMiniSiteFonts(spec?.theme?.fonts);
  const theme = useMemo(() => buildTheme(spec, width), [spec, width]);
  if (!spec || !event) return null;
  if (!ready) {
    return <View style={{ flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.c.bg }}><ActivityIndicator color={theme.c.primary} /></View>;
  }
  const hidden = new Set(spec.hidden || []);
  const sections = (spec.sections || []).filter((s) => RENDERERS[s.kind] && !hidden.has(s.kind));
  const noop = () => {};
  const acts = {
    participate: noop, map: noop, directions: noop, calendar: noop, online: noop, viewImage: noop,
    ctaLabel: spec.copy?.cta?.label || 'Je participe', ...actions,
  };

  const body = sections.map((s, i) => {
    const Comp = RENDERERS[s.kind];
    const t = tone(theme, s.tone);
    const edge = s.kind === 'hero';
    const pad = edge ? 0 : theme.density.pad;
    const next = sections[i + 1];
    // Un ornement discret entre deux sections de même fond (sinon le changement de fond suffit)
    const sep = next && next.kind !== 'footer' && next.tone === s.tone && s.kind !== 'hero' && theme.ornament !== 'none' && i % 2 === 1;
    return (
      <View key={`${s.kind}-${i}`} style={{ backgroundColor: t.bg, paddingTop: pad, paddingBottom: s.kind === 'footer' ? pad + 24 : pad }}>
        <Comp s={s} copy={spec.copy?.[s.kind]} event={event} theme={theme} t={t} actions={acts} preview={preview} />
        {sep ? <Ornament kind={theme.ornament} color={t.accent} width={120} opacity={0.35} style={{ marginTop: pad }} /> : null}
      </View>
    );
  });

  if (preview) return <View style={{ backgroundColor: theme.c.bg, width }}>{body}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.c.bg }} onScroll={onScroll} scrollEventThrottle={32}>
      {header}
      {body}
    </ScrollView>
  );
}
