/**
 * Sections de contenu : présentation, galerie, tenue, citation, questions, organisateur
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SafeImage from '../../ui/SafeImage';
import Ornament from '../Ornament';
import { Body, Button, Card, Kicker, Strong, Title } from '../atoms';
import { images, when } from '../theme';

// Réponses calculées sur le téléphone (fuseau horaire de l'invité)
function localAnswer(item, event) {
  if (item.key !== 'when') return item.a;
  const a = when(event.start_date);
  const b = when(event.end_date);
  if (!a) return item.a;
  const same = b && a.date.toDateString() === b.date.toDateString();
  return `Le ${a.long} à ${a.time}${b ? (same ? `, jusqu’à ${b.time}` : `, jusqu’au ${b.long}`) : ''}.`;
}

const pad = 26;
const alignOf = (s) => (s.align === 'left' ? 'left' : 'center');

// ── Présentation ─────────────────────────────────────────────────
export function Intro({ s, copy = {}, theme, t }) {
  const align = alignOf(s);
  const paragraphs = String(copy.body || '').split(/\n+/).filter(Boolean);
  if (s.variant === 'quote') {
    return (
      <View style={{ paddingHorizontal: pad + 6 }}>
        <Text style={{ fontFamily: theme.fonts.display, color: t.accent, fontSize: theme.size(80), lineHeight: theme.size(70), textAlign: align }}>“</Text>
        <Text style={{ fontFamily: theme.fonts.display, color: t.text, fontSize: theme.size(22), lineHeight: theme.size(34), textAlign: align }}>{copy.body}</Text>
        <Kicker theme={theme} t={t} align={align} style={{ marginTop: 18 }}>{copy.title}</Kicker>
      </View>
    );
  }
  if (s.variant === 'columns') {
    return (
      <View style={{ paddingHorizontal: pad, flexDirection: theme.wide ? 'row' : 'column', gap: 18 }}>
        <View style={{ flex: theme.wide ? 0.8 : undefined }}>
          <View style={{ width: 40, height: 3, backgroundColor: t.accent, marginBottom: 14 }} />
          <Title theme={theme} t={t} size={32}>{copy.title}</Title>
        </View>
        <View style={{ flex: 1, gap: 12 }}>
          {paragraphs.map((p, i) => <Body key={i} theme={theme} t={t}>{p}</Body>)}
        </View>
      </View>
    );
  }
  if (s.variant === 'letter') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        <Card theme={theme} t={t} style={{ padding: 28, transform: [{ rotate: '-0.6deg' }] }}>
          <Title theme={theme} t={t} size={26} style={{ marginBottom: 14 }}>{copy.title}</Title>
          {paragraphs.map((p, i) => <Body key={i} theme={theme} t={t} style={{ marginBottom: 10 }}>{p}</Body>)}
          <Ornament kind={theme.ornament === 'none' ? 'lines' : theme.ornament} color={t.accent} width={140} style={{ alignItems: 'flex-end', marginTop: 6 }} />
        </Card>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Title theme={theme} t={t} size={30} align={align}>{copy.title}</Title>
      <Ornament kind={theme.ornament} color={t.accent} width={160} style={{ marginVertical: 14 }} />
      {paragraphs.map((p, i) => <Body key={i} theme={theme} t={t} align={align} style={{ maxWidth: 620, marginBottom: 8 }}>{p}</Body>)}
    </View>
  );
}

// ── Galerie (toucher une photo l'affiche en plein écran) ─────────
export function Gallery({ s, copy = {}, event, theme, t, actions }) {
  const pics = images(event);
  if (pics.length < 2) return null;
  const r = theme.radius.img;
  const tile = (uri, i, style) => (
    <Pressable key={`${uri}-${i}`} onPress={() => actions.viewImage(uri)} accessibilityRole="imagebutton"
      accessibilityLabel={`Agrandir la photo ${i + 1} sur ${pics.length}`} style={style}>
      <SafeImage uri={uri} style={{ width: '100%', height: '100%', borderRadius: r }} />
    </Pressable>
  );
  const head = <Title theme={theme} t={t} size={28} align={alignOf(s)} style={{ marginBottom: 16, paddingHorizontal: pad }}>{copy.title}</Title>;
  const W = theme.width - pad * 2;

  if (s.variant === 'mosaic') {
    const [a, b, c] = pics;
    return (
      <View>
        {head}
        <View style={{ paddingHorizontal: pad, flexDirection: 'row', gap: 8, height: W * 0.75 }}>
          {tile(a, 0, { flex: 1.4 })}
          <View style={{ flex: 1, gap: 8 }}>
            {tile(b, 1, { flex: 1 })}
            {c ? tile(c, 2, { flex: 1 }) : null}
          </View>
        </View>
      </View>
    );
  }
  if (s.variant === 'carousel' || s.variant === 'filmstrip') {
    const film = s.variant === 'filmstrip';
    const w = film ? 150 : W * 0.82;
    return (
      <View>
        {head}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: film ? 6 : 12 }}
          style={film ? { backgroundColor: t.text, paddingVertical: 14 } : undefined}>
          {pics.map((u, i) => tile(u, i, { width: w, height: film ? 110 : w * 0.7 }))}
        </ScrollView>
      </View>
    );
  }
  if (s.variant === 'polaroid') {
    return (
      <View>
        {head}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, paddingHorizontal: pad }}>
          {pics.slice(0, 4).map((u, i) => (
            <View key={`${u}-${i}`} style={{ backgroundColor: '#FFFFFF', padding: 8, paddingBottom: 28, width: W / 2 - 10,
              transform: [{ rotate: `${[-3, 2, 3, -2][i]}deg` }], shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 }}>
              {tile(u, i, { width: '100%', aspectRatio: 1 })}
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View>
      {head}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: pad }}>
        {pics.slice(0, 6).map((u, i) => tile(u, i, { width: (W - 8) / 2, aspectRatio: 1 }))}
      </View>
    </View>
  );
}

// ── Tenue ────────────────────────────────────────────────────────
export function DressCode({ s, copy = {}, event, theme, t }) {
  if (!event.dress_code) return null;
  const align = alignOf(s);
  const c = theme.c;
  if (s.variant === 'swatches') {
    return (
      <View style={{ paddingHorizontal: pad, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        <Title theme={theme} t={t} size={26} align={align}>{copy.title}</Title>
        <Strong theme={theme} t={t} size={20} align={align} style={{ marginTop: 10, color: t.accent }}>{event.dress_code}</Strong>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[c.primary, c.accent, c.text, c.tint].map((col, i) => (
            <View key={i} style={{ width: 34, height: 34, borderRadius: theme.radius.chip, backgroundColor: col, borderWidth: 1, borderColor: t.line }} />
          ))}
        </View>
        <Body theme={theme} t={t} muted size={14} align={align} style={{ marginTop: 12 }}>{copy.note}</Body>
      </View>
    );
  }
  if (s.variant === 'banner') {
    return (
      <View style={{ marginHorizontal: pad, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.accent, paddingVertical: 20, alignItems: 'center' }}>
        <Kicker theme={theme} t={t} align="center">{copy.title}</Kicker>
        <Title theme={theme} t={t} size={30} align="center">{event.dress_code}</Title>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }}>
      <Card theme={theme} t={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shirt-outline" size={26} color={t.onBtn} />
        </View>
        <View style={{ flex: 1 }}>
          <Body theme={theme} t={t} muted size={13}>{copy.title}</Body>
          <Strong theme={theme} t={t} size={18}>{event.dress_code}</Strong>
        </View>
      </Card>
    </View>
  );
}

// ── Citation / respiration ───────────────────────────────────────
export function Divider({ s, copy = {}, theme, t }) {
  if (s.variant === 'marquee') {
    const word = copy.text || '';
    return (
      <View style={{ overflow: 'hidden', paddingVertical: 6 }} accessible accessibilityLabel={word}>
        <Text numberOfLines={1} ellipsizeMode="clip" style={{ fontFamily: theme.fonts.display, color: t.accent, fontSize: theme.size(34), opacity: 0.9, width: theme.width * 3 }}>
          {`${word}  ✦  ${word}  ✦  ${word}`}
        </Text>
      </View>
    );
  }
  if (s.variant === 'quote') {
    return (
      <View style={{ paddingHorizontal: pad + 10, alignItems: 'center' }}>
        <Text style={{ fontFamily: theme.fonts.display, color: t.text, fontSize: theme.size(24), textAlign: 'center', lineHeight: theme.size(34) }}>{`« ${copy.text || ''} »`}</Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad, alignItems: 'center', gap: 12 }}>
      <Ornament kind={theme.ornament === 'none' ? 'lines' : theme.ornament} color={t.accent} width={220} />
      <Body theme={theme} t={t} muted align="center" style={{ fontStyle: 'italic' }}>{copy.text}</Body>
    </View>
  );
}

// ── Questions fréquentes (réponses issues des données de l'événement) ──
function QA({ item, theme, t, open, onToggle }) {
  return (
    <View style={{ borderBottomWidth: 1, borderColor: t.line }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 }}>
        <Strong theme={theme} t={t} style={{ flex: 1 }}>{item.q}</Strong>
        <Ionicons name={open ? 'remove' : 'add'} size={20} color={t.accent} />
      </Pressable>
      {open ? <Body theme={theme} t={t} muted style={{ paddingBottom: 16 }}>{item.a}</Body> : null}
    </View>
  );
}

export function Faq({ s, copy = {}, event, theme, t }) {
  const items = (copy.items || []).map((it) => ({ ...it, a: localAnswer(it, event) }));
  const [open, setOpen] = useState(0);
  if (!items.length) return null;
  const head = <Title theme={theme} t={t} size={28} align={alignOf(s)} style={{ marginBottom: 14 }}>{copy.title}</Title>;
  if (s.variant === 'twocol' && !theme.wide) {
    return (
      <View style={{ paddingHorizontal: pad }}>
        {head}
        {items.map((it, i) => (
          <View key={it.q} style={{ flexDirection: 'row', gap: 14, marginBottom: 18 }}>
            <Text style={{ fontFamily: theme.fonts.display, color: t.accent, fontSize: theme.size(26), width: 34 }}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={{ flex: 1 }}>
              <Strong theme={theme} t={t}>{it.q}</Strong>
              <Body theme={theme} t={t} muted size={15} style={{ marginTop: 4 }}>{it.a}</Body>
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (s.variant === 'cards') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        {head}
        <View style={{ gap: 10 }}>
          {items.map((it) => (
            <Card key={it.q} theme={theme} t={t} style={{ padding: 18 }}>
              <Strong theme={theme} t={t}>{it.q}</Strong>
              <Body theme={theme} t={t} muted size={15} style={{ marginTop: 6 }}>{it.a}</Body>
            </Card>
          ))}
        </View>
      </View>
    );
  }
  if (s.variant === 'twocol') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        {head}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          {items.map((it) => (
            <View key={it.q} style={{ width: '46%' }}>
              <Strong theme={theme} t={t}>{it.q}</Strong>
              <Body theme={theme} t={t} muted size={15} style={{ marginTop: 6 }}>{it.a}</Body>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }}>
      {head}
      {items.map((it, i) => <QA key={it.q} item={it} theme={theme} t={t} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />)}
    </View>
  );
}

// ── Organisateur ─────────────────────────────────────────────────
export function Host({ s, copy = {}, event, theme, t, actions }) {
  const name = event.organizer?.name || '';
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const avatar = (
    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {event.organizer?.avatar ? <SafeImage uri={event.organizer.avatar} style={{ width: 64, height: 64 }} />
        : <Text style={{ fontFamily: theme.fonts.display, color: t.onBtn, fontSize: 24 }}>{initials || '•'}</Text>}
    </View>
  );
  const contact = actions.contact ? <Button theme={theme} t={t} ghost label="Écrire à l’organisateur" onPress={actions.contact} style={{ marginTop: 14 }} /> : null;
  if (s.variant === 'signature') {
    return (
      <View style={{ paddingHorizontal: pad, alignItems: 'center' }}>
        <Body theme={theme} t={t} muted align="center">{copy.note}</Body>
        <Text style={{ fontFamily: theme.fonts.display, color: t.accent, fontSize: theme.size(30), marginTop: 12 }}>{name}</Text>
        {contact}
      </View>
    );
  }
  if (s.variant === 'inline') {
    return (
      <View style={{ paddingHorizontal: pad, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {avatar}
        <View style={{ flex: 1 }}>
          <Kicker theme={theme} t={t} style={{ marginBottom: 2 }}>{copy.title}</Kicker>
          <Strong theme={theme} t={t} size={18}>{name}</Strong>
        </View>
        {actions.contact ? (
          <Pressable onPress={actions.contact} accessibilityRole="button" accessibilityLabel="Écrire à l’organisateur"
            style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: t.btn, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={t.btn} />
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }}>
      <Card theme={theme} t={t} style={{ alignItems: 'center', paddingVertical: 26 }}>
        {avatar}
        <Title theme={theme} t={t} size={22} align="center" style={{ marginTop: 12 }}>{copy.title}</Title>
        <Body theme={theme} t={t} muted align="center" style={{ marginTop: 6 }}>{copy.note}</Body>
        {contact}
      </Card>
    </View>
  );
}
