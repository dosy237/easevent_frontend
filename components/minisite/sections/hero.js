/**
 * Accueil — 7 mises en page : fullbleed, split, framed, typographic, stacked, arch, poster
 * Plein cadre : la photo (celle choisie pour la bannière, sinon la couverture) reçoit un filtre :
 *   veil  — dégradé sombre sous le texte
 *   glass — texte posé sur un panneau de verre dépoli
 *   tint  — la photo prend une couleur (thème, bleu, rose, or, sauge, nuit)
 * Toucher la photo l'ouvre en grand.
 */
import React from 'react';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import SafeImage from '../../ui/SafeImage';
import Ornament from '../Ornament';
import { Body, Button, Kicker, Title } from '../atoms';
import { images, when } from '../theme';

export const TINTS = { blue: '#1D3FAF', rose: '#A3204F', gold: '#8A5A12', sage: '#3C6247', night: '#0B1020' };

export default function Hero({ s, copy = {}, event, theme, t, actions }) {
  const { c, radius, width } = theme;
  const cover = s.image || images(event)[0];
  const w = when(event.start_date, event.timezone);
  const align = s.align === 'left' ? 'left' : 'center';
  const items = align === 'center' ? 'center' : 'flex-start';
  const title = event.title;
  const pad = 26;
  const openCover = cover ? () => actions.viewImage(cover) : undefined;
  // Date et heure : toujours issues de l'événement (fuseau du téléphone), jamais de l'IA
  const dateLine = w ? `${w.long.charAt(0).toUpperCase()}${w.long.slice(1)} · ${w.time}${w.local ? ` (${w.zone}) · ${w.local}` : ''}` : '';
  const DateLine = ({ tt, a = align, style }) => (dateLine ? (
    <Text style={[{ fontFamily: theme.fonts.bold, color: tt.text, fontSize: 14, letterSpacing: 0.4, textAlign: a, marginTop: 10 }, style]}>{dateLine}</Text>
  ) : null);

  if (s.variant === 'fullbleed') {
    const filter = cover ? (s.filter || 'veil') : 'veil';
    const white = { text: '#FFFFFF', accent: '#FFFFFF' };
    const texts = (
      <View style={{ alignItems: items }}>
        <Kicker theme={theme} t={white} align={align}>{copy.kicker}</Kicker>
        <Title theme={theme} t={white} size={42} align={align}>{title}</Title>
        <Body theme={theme} t={white} align={align} style={{ marginTop: 12, opacity: 0.94 }}>{copy.subtitle}</Body>
        <DateLine tt={white} />
        <Ornament kind={theme.ornament} color="#FFFFFF" width={180} style={{ marginTop: 18 }} />
      </View>
    );
    let inner;
    if (filter === 'glass') {
      // Verre dépoli : flou de l'arrière-plan + voile sombre léger, texte blanc lisible sur toute photo
      inner = (
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 28, backgroundColor: 'rgba(0,0,0,0.12)' }}>
          <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
            <BlurView intensity={42} tint="dark" style={{ padding: 22, backgroundColor: 'rgba(12,12,18,0.38)' }}>{texts}</BlurView>
          </View>
        </View>
      );
    } else if (filter === 'tint') {
      const tint = TINTS[s.tint] || c.primary;
      inner = (
        <View style={{ flex: 1 }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tint, opacity: 0.55 }} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)']} style={{ flex: 1, justifyContent: 'flex-end', padding: pad, paddingBottom: 40 }}>
            {texts}
          </LinearGradient>
        </View>
      );
    } else {
      inner = (
        <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.82)']} style={{ flex: 1, justifyContent: 'flex-end', padding: pad, paddingBottom: 40 }}>
          {texts}
        </LinearGradient>
      );
    }
    return cover ? (
      <Pressable onPress={openCover} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
        <ImageBackground source={{ uri: cover }} style={{ height: Math.min(620, width * 1.45) }} resizeMode="cover">{inner}</ImageBackground>
      </Pressable>
    ) : (
      <LinearGradient colors={[c.primary, c.inverseBg]} style={{ height: Math.min(560, width * 1.3) }}>{inner}</LinearGradient>
    );
  }

  if (s.variant === 'split') {
    const row = theme.wide;
    return (
      <View style={{ flexDirection: row ? 'row' : 'column', backgroundColor: t.bg }}>
        <Pressable onPress={openCover} disabled={!cover} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo"
          style={{ width: row ? '50%' : '100%' }}>
          <SafeImage uri={cover} style={{ width: '100%', height: row ? 520 : Math.min(360, width * 0.85),
            borderBottomRightRadius: row ? 0 : radius.img * 2.5 }} />
        </Pressable>
        <View style={{ flex: 1, padding: pad, paddingVertical: 40, justifyContent: 'center', alignItems: items }}>
          <Kicker theme={theme} t={t} align={align}>{copy.kicker}</Kicker>
          <Title theme={theme} t={t} size={38} align={align}>{title}</Title>
          <View style={{ height: 3, width: 54, backgroundColor: t.accent, marginVertical: 18, borderRadius: 2 }} />
          <Body theme={theme} t={t} muted align={align}>{copy.subtitle}</Body>
          <DateLine tt={t} />
        </View>
      </View>
    );
  }

  if (s.variant === 'framed') {
    return (
      <View style={{ backgroundColor: t.bg, padding: 18, paddingVertical: 34 }}>
        <View style={{ borderWidth: 1, borderColor: t.accent, padding: 6, borderRadius: radius.card }}>
          <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: Math.max(0, radius.card - 4), padding: pad, paddingVertical: 44, alignItems: 'center' }}>
            {cover ? (
              <Pressable onPress={openCover} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
                <SafeImage uri={cover} style={{ width: 132, height: 132, borderRadius: 66, marginBottom: 22, borderWidth: 3, borderColor: t.card }} />
              </Pressable>
            ) : null}
            <Kicker theme={theme} t={t} align="center">{copy.kicker}</Kicker>
            <Title theme={theme} t={t} size={36} align="center">{title}</Title>
            <Ornament kind={theme.ornament === 'none' ? 'lines' : theme.ornament} color={t.accent} width={200} style={{ marginVertical: 18 }} />
            <Body theme={theme} t={t} muted align="center">{copy.subtitle}</Body>
            <DateLine tt={t} a="center" />
          </View>
        </View>
      </View>
    );
  }

  if (s.variant === 'typographic') {
    return (
      <View style={{ backgroundColor: t.bg, paddingHorizontal: pad, paddingTop: 70, paddingBottom: 46, alignItems: items }}>
        <Kicker theme={theme} t={t} align={align}>{copy.kicker}</Kicker>
        <Title theme={theme} t={t} size={56} align={align}>{title}</Title>
        {w ? (
          <Text style={{ fontFamily: theme.fonts.display, color: t.accent, fontSize: theme.size(30), marginTop: 22, textAlign: align, letterSpacing: 2 }}>
            {`${String(w.day).padStart(2, '0')} · ${String(w.date.getMonth() + 1).padStart(2, '0')} · ${w.year}`}
          </Text>
        ) : null}
        <Body theme={theme} t={t} muted align={align} style={{ marginTop: 14, maxWidth: 520 }}>{copy.subtitle}</Body>
        {w ? <DateLine tt={t} style={{ marginTop: 4 }} /> : null}
        {cover ? (
          <Pressable onPress={openCover} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo" style={{ marginTop: 30, alignSelf: 'stretch' }}>
            <SafeImage uri={cover} style={{ height: 190, borderRadius: radius.img }} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (s.variant === 'stacked') {
    return (
      <View style={{ backgroundColor: t.bg, paddingTop: 54, paddingBottom: 30 }}>
        <View style={{ paddingHorizontal: pad, alignItems: items }}>
          <Kicker theme={theme} t={t} align={align}>{copy.kicker}</Kicker>
          <Title theme={theme} t={t} size={40} align={align}>{title}</Title>
        </View>
        <Pressable onPress={openCover} disabled={!cover} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
          <SafeImage uri={cover} style={{ height: Math.min(420, width), marginHorizontal: 14, marginTop: 26, borderRadius: radius.img }} />
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, paddingHorizontal: pad, gap: 12, flexWrap: 'wrap' }}>
          <Body theme={theme} t={t} muted align="center">{copy.subtitle}</Body>
        </View>
        <DateLine tt={t} a="center" style={{ paddingHorizontal: pad }} />
      </View>
    );
  }

  if (s.variant === 'arch') {
    const archW = Math.min(width - 60, 340);
    return (
      <View style={{ backgroundColor: t.bg, alignItems: 'center', paddingTop: 44, paddingBottom: 38, paddingHorizontal: pad }}>
        <View style={{ padding: 8, borderWidth: 1, borderColor: t.accent, borderTopLeftRadius: archW / 2 + 8, borderTopRightRadius: archW / 2 + 8 }}>
          <Pressable onPress={openCover} disabled={!cover} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
            <SafeImage uri={cover} style={{ width: archW, height: archW * 1.25, borderTopLeftRadius: archW / 2, borderTopRightRadius: archW / 2 }} />
          </Pressable>
        </View>
        <Kicker theme={theme} t={t} align="center" style={{ marginTop: 26 }}>{copy.kicker}</Kicker>
        <Title theme={theme} t={t} size={38} align="center">{title}</Title>
        <Ornament kind={theme.ornament} color={t.accent} width={200} style={{ marginVertical: 14 }} />
        <Body theme={theme} t={t} muted align="center">{copy.subtitle}</Body>
        <DateLine tt={t} a="center" />
      </View>
    );
  }

  // poster
  const inv = { ...t, text: c.inverseText, muted: c.inverseMuted, accent: c.inverseText, btn: c.inverseText, onBtn: c.inverseBg };
  return (
    <View style={{ backgroundColor: c.inverseBg, paddingHorizontal: pad, paddingTop: 50, paddingBottom: 40, overflow: 'hidden' }}>
      {cover ? (
        <Pressable onPress={openCover} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
          <SafeImage uri={cover} style={{ height: 230, borderRadius: radius.img, marginBottom: 26 }} />
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
        {w ? (
          <View>
            <Text style={{ fontFamily: theme.fonts.display, color: c.inverseText, fontSize: theme.size(84), lineHeight: theme.size(84) }}>
              {String(w.day).padStart(2, '0')}
            </Text>
            <Text style={{ fontFamily: theme.fonts.bold, color: c.inverseMuted, fontSize: 14, letterSpacing: 3, textTransform: 'uppercase' }}>{w.month}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, paddingBottom: 6 }}>
          <Kicker theme={theme} t={inv}>{copy.kicker}</Kicker>
          <Title theme={theme} t={inv} size={32}>{title}</Title>
        </View>
      </View>
      <Body theme={theme} t={inv} muted style={{ marginTop: 18 }}>{copy.subtitle}</Body>
      <DateLine tt={inv} a="left" />
      <Button theme={theme} t={inv} label={actions.ctaLabel} onPress={actions.participate} style={{ marginTop: 24, alignSelf: 'flex-start' }} />
    </View>
  );
}
