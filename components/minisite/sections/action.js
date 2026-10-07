/**
 * Participation (CTA) et pied de page
 */
import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Ornament from '../Ornament';
import { Body, Button, Card, Kicker, Title } from '../atoms';
import { priceText, when } from '../theme';

const pad = 26;

export function Cta({ s, copy = {}, event, theme, t, actions }) {
  const label = actions.ctaLabel || copy.label;
  const align = s.align === 'left' ? 'left' : 'center';
  const price = priceText(event);
  const btn = <Button theme={theme} t={t} label={label} onPress={actions.participate} disabled={actions.ctaDisabled}
    style={{ marginTop: 20, alignSelf: align === 'center' ? 'center' : 'flex-start', minWidth: 220 }} />;

  if (s.variant === 'banner') {
    return (
      <LinearGradient colors={[theme.c.primary, theme.c.inverseBg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ marginHorizontal: pad, borderRadius: theme.radius.card, padding: 30, alignItems: 'center' }}>
        <Title theme={theme} t={{ text: '#FFFFFF' }} size={28} align="center">{copy.title}</Title>
        <Body theme={theme} t={{ text: '#FFFFFF' }} align="center" style={{ marginTop: 8, opacity: 0.92 }}>{copy.body}</Body>
        <Button theme={theme} t={{ btn: '#FFFFFF', onBtn: '#141414' }} label={label} onPress={actions.participate} style={{ marginTop: 20, minWidth: 220 }} />
      </LinearGradient>
    );
  }
  if (s.variant === 'split') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        <Card theme={theme} t={t} style={{ flexDirection: theme.wide ? 'row' : 'column', alignItems: theme.wide ? 'center' : 'stretch', gap: 18, padding: 24 }}>
          <View style={{ flex: 1 }}>
            <Title theme={theme} t={t} size={26}>{copy.title}</Title>
            <Body theme={theme} t={t} muted style={{ marginTop: 6 }}>{copy.body}</Body>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: theme.fonts.display, color: t.accent, fontSize: theme.size(30) }}>{price}</Text>
            <Button theme={theme} t={t} label={label} onPress={actions.participate} style={{ marginTop: 10, minWidth: 200 }} />
          </View>
        </Card>
      </View>
    );
  }
  if (s.variant === 'minimal') {
    return (
      <View style={{ paddingHorizontal: pad, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        <Kicker theme={theme} t={t} align={align}>{price}</Kicker>
        <Title theme={theme} t={t} size={30} align={align}>{copy.title}</Title>
        {btn}
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }}>
      <Card theme={theme} t={t} style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Ornament kind={theme.ornament} color={t.accent} width={160} style={{ marginBottom: 14 }} />
        <Title theme={theme} t={t} size={28} align="center">{copy.title}</Title>
        <Body theme={theme} t={t} muted align="center" style={{ marginTop: 8 }}>{copy.body}</Body>
        <Button theme={theme} t={t} label={label} onPress={actions.participate} style={{ marginTop: 20, minWidth: 220 }} />
      </Card>
    </View>
  );
}

export function Footer({ s, copy = {}, event, theme, t }) {
  const a = when(event.start_date, event.timezone);
  if (s.variant === 'signature') {
    return (
      <View style={{ paddingHorizontal: pad, alignItems: 'center' }}>
        <Ornament kind={theme.ornament === 'none' ? 'lines' : theme.ornament} color={t.accent} width={180} />
        <Text style={{ fontFamily: theme.fonts.display, color: t.text, fontSize: theme.size(28), textAlign: 'center', marginTop: 14 }}>{event.title}</Text>
        <Body theme={theme} t={t} muted align="center" style={{ marginTop: 6 }}>{copy.text}</Body>
      </View>
    );
  }
  if (s.variant === 'centered') {
    return (
      <View style={{ paddingHorizontal: pad, alignItems: 'center' }}>
        <Body theme={theme} t={t} align="center">{copy.text}</Body>
        {a ? <Kicker theme={theme} t={t} align="center" style={{ marginTop: 12 }}>{a.long}</Kicker> : null}
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Body theme={theme} t={t} muted size={14} style={{ flex: 1 }}>{copy.text}</Body>
      {a ? <Body theme={theme} t={t} size={14}>{a.short}</Body> : null}
    </View>
  );
}
