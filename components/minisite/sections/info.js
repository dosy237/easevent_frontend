/**
 * Sections pratiques : compte à rebours, informations, lieu, en ligne, places, agenda
 * Toutes les informations viennent de l'événement (jamais de l'IA).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import SafeImage from '../../ui/SafeImage';
import { Body, Button, Card, Kicker, Strong, Title } from '../atoms';
import { priceText, when } from '../theme';

const pad = 26;

// ── Compte à rebours ─────────────────────────────────────────────
function useRemaining(iso, live) {
  const target = iso ? new Date(iso).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!live || !target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);   // arrêté hors écran (sobriété)
    return () => clearInterval(id);
  }, [target, live]);
  const ms = Math.max(0, target - now);
  return { d: Math.floor(ms / 86400000), h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60, over: ms === 0 };
}

export function Countdown({ s, copy = {}, event, theme, t, preview }) {
  const r = useRemaining(event.start_date, !preview);
  const align = s.align === 'left' ? 'left' : 'center';
  if (r.over) return null;
  const units = [['jours', r.d], ['heures', r.h], ['minutes', r.m], ['secondes', r.s]];
  const label = `${r.d} jours, ${r.h} heures et ${r.m} minutes avant l'événement`;
  const head = <Title theme={theme} t={t} size={24} align={align} style={{ marginBottom: 18 }}>{copy.title}</Title>;

  if (s.variant === 'inline') {
    return (
      <View style={{ paddingHorizontal: pad, alignItems: align === 'center' ? 'center' : 'flex-start' }} accessible accessibilityLabel={label}>
        <Kicker theme={theme} t={t} align={align}>{copy.title}</Kicker>
        <Text style={{ fontFamily: theme.fonts.display, color: t.text, fontSize: theme.size(40), textAlign: align }}>
          {`J-${r.d}`}<Text style={{ color: t.muted, fontSize: theme.size(20) }}>{`  ${String(r.h).padStart(2, '0')}:${String(r.m).padStart(2, '0')}:${String(r.s).padStart(2, '0')}`}</Text>
        </Text>
      </View>
    );
  }
  if (s.variant === 'ring') {
    const size = 92;
    const max = { jours: Math.max(r.d, 60), heures: 24, minutes: 60, secondes: 60 };
    return (
      <View style={{ paddingHorizontal: pad }} accessible accessibilityLabel={label}>
        {head}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          {units.map(([u, v]) => {
            const p = v / max[u];
            const len = Math.PI * (size - 8);
            return (
              <View key={u} style={{ alignItems: 'center', width: '23%', minWidth: 72 }}>
                <Svg width={size * 0.8} height={size * 0.8} viewBox={`0 0 ${size} ${size}`}>
                  <Circle cx={size / 2} cy={size / 2} r={(size - 8) / 2} stroke={t.line} strokeWidth={4} fill="none" />
                  <Circle cx={size / 2} cy={size / 2} r={(size - 8) / 2} stroke={t.accent} strokeWidth={4} fill="none"
                    strokeDasharray={`${len * p} ${len}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
                </Svg>
                <Text style={{ position: 'absolute', top: size * 0.25, fontFamily: theme.fonts.display, color: t.text, fontSize: theme.size(22) }}>{v}</Text>
                <Body theme={theme} t={t} muted size={12}>{u}</Body>
              </View>
            );
          })}
        </View>
      </View>
    );
  }
  if (s.variant === 'minimal') {
    return (
      <View style={{ paddingHorizontal: pad, flexDirection: 'row', alignItems: 'baseline', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: 12 }}
        accessible accessibilityLabel={label}>
        <Text style={{ fontFamily: theme.fonts.display, color: t.accent, fontSize: theme.size(64) }}>{r.d}</Text>
        <Body theme={theme} t={t}>{`jour${r.d > 1 ? 's' : ''} avant le grand moment`}</Body>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }} accessible accessibilityLabel={label}>
      {head}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {units.map(([u, v]) => (
          <View key={u} style={{ flex: 1, backgroundColor: t.card, borderRadius: theme.radius.card, borderWidth: 1, borderColor: t.line, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ fontFamily: theme.fonts.display, color: t.text, fontSize: theme.size(28) }}>{String(v).padStart(2, '0')}</Text>
            <Body theme={theme} t={t} muted size={12}>{u}</Body>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Informations (date, heure, lieu, prix) ───────────────────────
function facts(event) {
  const a = when(event.start_date);
  const b = when(event.end_date);
  const sameDay = a && b && a.date.toDateString() === b.date.toDateString();
  const out = [];
  if (a) out.push({ icon: 'calendar-outline', label: 'Date', value: a.long + (b && !sameDay ? ` → ${b.long}` : '') });
  if (a) out.push({ icon: 'time-outline', label: 'Heure', value: b && sameDay ? `${a.time} – ${b.time}` : a.time });
  if (event.is_online && !event.location_address) out.push({ icon: 'videocam-outline', label: 'Lieu', value: 'En ligne' });
  else if (event.location_address) out.push({ icon: 'location-outline', label: 'Lieu', value: event.location_address });
  out.push({ icon: 'ticket-outline', label: 'Participation', value: priceText(event) });
  if (event.dress_code) out.push({ icon: 'shirt-outline', label: 'Tenue', value: event.dress_code });
  return out;
}

export function Details({ s, copy = {}, event, theme, t }) {
  const rows = facts(event);
  const align = s.align === 'left' ? 'left' : 'center';
  const head = <Title theme={theme} t={t} size={28} align={align} style={{ marginBottom: 20 }}>{copy.title}</Title>;

  if (s.variant === 'list') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        {head}
        {rows.map((r, i) => (
          <View key={r.label} style={{ flexDirection: 'row', paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderColor: t.line, gap: 14 }}>
            <Ionicons name={r.icon} size={20} color={t.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Body theme={theme} t={t} muted size={13}>{r.label}</Body>
              <Strong theme={theme} t={t}>{r.value}</Strong>
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (s.variant === 'timeline') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        {head}
        {rows.map((r, i) => (
          <View key={r.label} style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ alignItems: 'center', width: 16 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.accent, marginTop: 6 }} />
              {i < rows.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: t.line }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 20 }}>
              <Kicker theme={theme} t={t} style={{ marginBottom: 4 }}>{r.label}</Kicker>
              <Body theme={theme} t={t}>{r.value}</Body>
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (s.variant === 'stub') {
    const a = when(event.start_date);
    return (
      <View style={{ paddingHorizontal: pad }}>
        {head}
        <View style={{ flexDirection: 'row', borderRadius: theme.radius.card, overflow: 'hidden', borderWidth: 1, borderColor: t.line, backgroundColor: t.card }}>
          <View style={{ width: 96, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
            <Text style={{ fontFamily: theme.fonts.display, color: t.onBtn, fontSize: theme.size(40) }}>{a ? a.day : '—'}</Text>
            <Text style={{ fontFamily: theme.fonts.bold, color: t.onBtn, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>{a ? a.month.slice(0, 4) : ''}</Text>
          </View>
          <View style={{ width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: t.line }} />
          <View style={{ flex: 1, padding: 18, gap: 10 }}>
            {rows.filter((r) => r.label !== 'Date').map((r) => (
              <View key={r.label} style={{ flexDirection: 'row', gap: 10 }}>
                <Ionicons name={r.icon} size={17} color={t.accent} style={{ marginTop: 3 }} />
                <Body theme={theme} t={t} size={15} style={{ flex: 1 }}>{r.value}</Body>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }}>
      {head}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {rows.map((r) => (
          <Card key={r.label} theme={theme} t={t} style={{ flexGrow: 1, flexBasis: theme.wide ? '30%' : '45%', padding: 16 }}>
            <Ionicons name={r.icon} size={22} color={t.accent} />
            <Body theme={theme} t={t} muted size={13} style={{ marginTop: 8 }}>{r.label}</Body>
            <Strong theme={theme} t={t} size={15}>{r.value}</Strong>
          </Card>
        ))}
      </View>
    </View>
  );
}

// ── Lieu ─────────────────────────────────────────────────────────
export function Location({ s, copy = {}, event, theme, t, actions }) {
  const map = event.map || {};
  const align = s.align === 'left' ? 'left' : 'center';
  const image = (h, extra) => (
    <Pressable onPress={actions.map} accessibilityRole="button" accessibilityLabel={`Voir ${event.location_address} sur la carte`}>
      <SafeImage uri={map.image} icon="map-outline" style={[{ height: h, borderRadius: theme.radius.img }, extra]} />
    </Pressable>
  );
  const buttons = (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      <Button theme={theme} t={t} label="Itinéraire" onPress={actions.directions} />
      <Button theme={theme} t={t} label="Ouvrir la carte" ghost onPress={actions.map} />
    </View>
  );
  if (s.variant === 'splitmap' && theme.wide) {
    return (
      <View style={{ paddingHorizontal: pad, flexDirection: 'row', gap: 24, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>{image(280)}</View>
        <View style={{ flex: 1 }}>
          <Title theme={theme} t={t} size={28}>{copy.title}</Title>
          <Body theme={theme} t={t} style={{ marginTop: 10 }}>{event.location_address}</Body>
          <Body theme={theme} t={t} muted size={14} style={{ marginTop: 6 }}>{copy.note}</Body>
          {buttons}
        </View>
      </View>
    );
  }
  if (s.variant === 'splitmap') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        <Title theme={theme} t={t} size={26} style={{ marginBottom: 14 }}>{copy.title}</Title>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 124 }}>{image(124)}</View>
          <View style={{ flex: 1 }}>
            <Body theme={theme} t={t}>{event.location_address}</Body>
            <Pressable onPress={actions.directions} accessibilityRole="button" style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="navigate-outline" size={18} color={t.accent} />
              <Strong theme={theme} t={{ ...t, text: t.accent }}>Itinéraire</Strong>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  if (s.variant === 'minimal') {
    return (
      <View style={{ paddingHorizontal: pad, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        <Kicker theme={theme} t={t} align={align}>{copy.title}</Kicker>
        <Title theme={theme} t={t} size={26} align={align}>{event.location_address}</Title>
        {buttons}
      </View>
    );
  }
  if (s.variant === 'illustrated') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        <Card theme={theme} t={t} style={{ padding: 0, overflow: 'hidden' }}>
          {image(200, { borderRadius: 0 })}
          <View style={{ padding: 20, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="navigate" size={22} color={t.onBtn} />
            </View>
            <View style={{ flex: 1 }}>
              <Strong theme={theme} t={t} size={17}>{copy.title}</Strong>
              <Body theme={theme} t={t} muted size={14}>{event.location_address}</Body>
            </View>
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Button theme={theme} t={t} label="Itinéraire" onPress={actions.directions} />
          </View>
        </Card>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }}>
      <Title theme={theme} t={t} size={28} align={align} style={{ marginBottom: 16 }}>{copy.title}</Title>
      {image(230)}
      <Body theme={theme} t={t} align={align} style={{ marginTop: 14 }}>{event.location_address}</Body>
      <Body theme={theme} t={t} muted size={14} align={align}>{copy.note}</Body>
      {buttons}
    </View>
  );
}

// ── En ligne ─────────────────────────────────────────────────────
export function Online({ s, copy = {}, event, theme, t, actions }) {
  const link = event.online_link;
  const note = link ? 'Le lien de connexion est disponible ci-dessous.' : copy.note;
  if (s.variant === 'banner') {
    return (
      <View style={{ marginHorizontal: pad, backgroundColor: t.btn, borderRadius: theme.radius.card, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Ionicons name="videocam" size={26} color={t.onBtn} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: theme.fonts.bold, color: t.onBtn, fontSize: 17 }}>{copy.title}</Text>
          <Text style={{ fontFamily: theme.fonts.body, color: t.onBtn, fontSize: 14, marginTop: 4 }}>{note}</Text>
        </View>
        {link ? <Button theme={theme} t={{ ...t, btn: t.onBtn, onBtn: t.btn }} label="Rejoindre" onPress={actions.online} /> : null}
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }}>
      <Card theme={theme} t={t} style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Ionicons name="videocam-outline" size={34} color={t.accent} />
        <Title theme={theme} t={t} size={24} align="center" style={{ marginTop: 10 }}>{copy.title}</Title>
        <Body theme={theme} t={t} muted align="center" style={{ marginTop: 6 }}>{note}</Body>
        {link ? <Button theme={theme} t={t} label="Rejoindre en ligne" onPress={actions.online} style={{ marginTop: 16 }} /> : null}
      </Card>
    </View>
  );
}

// ── Places ───────────────────────────────────────────────────────
export function Capacity({ s, copy = {}, event, theme, t }) {
  const max = event.max_guests;
  if (!max) return null;
  const left = event.spots_left ?? max;
  const taken = Math.max(0, max - left);
  const text = left === 0 ? 'Complet' : `${left} place${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} sur ${max}`;
  if (s.variant === 'badge') {
    return (
      <View style={{ paddingHorizontal: pad, alignItems: s.align === 'left' ? 'flex-start' : 'center' }}>
        <View style={{ borderWidth: 1.5, borderColor: t.accent, borderRadius: theme.radius.chip, paddingVertical: 10, paddingHorizontal: 18, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Ionicons name="people-outline" size={18} color={t.accent} />
          <Strong theme={theme} t={t}>{text}</Strong>
        </View>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad }} accessible accessibilityLabel={text}>
      <Strong theme={theme} t={t} size={17}>{copy.title}</Strong>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: t.line, marginTop: 12, overflow: 'hidden' }}>
        <View style={{ height: 10, width: `${Math.min(100, (taken / max) * 100)}%`, backgroundColor: t.accent }} />
      </View>
      <Body theme={theme} t={t} muted size={14} style={{ marginTop: 8 }}>{text}</Body>
    </View>
  );
}

// ── Agenda ───────────────────────────────────────────────────────
export function Calendar({ s, copy = {}, event, theme, t, actions }) {
  const a = when(event.start_date);
  if (s.variant === 'card') {
    return (
      <View style={{ paddingHorizontal: pad }}>
        <Card theme={theme} t={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ alignItems: 'center', width: 54 }}>
            <Text style={{ fontFamily: theme.fonts.bold, color: t.accent, fontSize: 12, textTransform: 'uppercase' }}>{a?.month.slice(0, 4)}</Text>
            <Text style={{ fontFamily: theme.fonts.display, color: t.text, fontSize: theme.size(30) }}>{a?.day}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Strong theme={theme} t={t}>{event.title}</Strong>
            <Body theme={theme} t={t} muted size={14}>{a?.long}</Body>
          </View>
          <Pressable onPress={actions.calendar} accessibilityRole="button" accessibilityLabel={copy.label || 'Ajouter à mon agenda'}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.btn, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={24} color={t.onBtn} />
          </Pressable>
        </Card>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: pad, alignItems: s.align === 'left' ? 'flex-start' : 'center' }}>
      <Button theme={theme} t={t} ghost label={copy.label || 'Ajouter à mon agenda'} onPress={actions.calendar} />
    </View>
  );
}
