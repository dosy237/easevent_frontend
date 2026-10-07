/**
 * components/events/Announcements.js — annonces de l'équipe Easevent, en tête du fil
 * ════════════════════════════════════════════════════════════════
 * Les plus prioritaires d'abord (le serveur trie). Mises à jour en direct : quand
 * l'équipe publie, modifie ou retire une annonce, les fils ouverts se rafraîchissent.
 * Une annonce peut être masquée sur cet appareil, sauf si elle est urgente.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';
import adminService from '../../services/adminService';
import realtime from '../../services/realtime';
import { getItem, setItem } from '../../services/storage';
import EventVideo from './EventVideo';

const HIDDEN_KEY = 'easevent_hidden_announcements';
const URGENT = 90;

export default function Announcements({ style }) {
  const [items, setItems] = useState([]);
  const [hidden, setHidden] = useState(new Set());
  const { width } = useWindowDimensions();

  const load = useCallback(() => {
    adminService.live().then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    getItem(HIDDEN_KEY).then((v) => { try { setHidden(new Set(JSON.parse(v || '[]'))); } catch { /* valeur illisible */ } });
    return realtime.subscribe((evt) => { if (evt?.type === 'announcements') load(); });
  }, [load]);

  const hide = (id) => {
    const next = new Set(hidden).add(id);
    setHidden(next);
    setItem(HIDDEN_KEY, JSON.stringify([...next].slice(-50)));
  };

  const shown = items.filter((a) => a.priority >= URGENT || !hidden.has(a.id));
  if (!shown.length) return null;
  const cardW = Math.min(width, 640) - 40;

  return (
    <View style={[{ paddingHorizontal: 20, gap: 14 }, style]}>
      {shown.map((a) => {
        const urgent = a.priority >= URGENT;
        return (
          <View key={a.id} style={[styles.card, urgent && styles.cardUrgent]}
            accessibilityLabel={`Annonce de l'équipe Easevent : ${a.title}`}>
            <View style={styles.head}>
              <View style={[styles.badge, urgent && styles.badgeUrgent]}>
                <Ionicons name={urgent ? 'alert-circle' : 'megaphone-outline'} size={13} color={urgent ? C.white : C.green} />
                <Text style={[styles.badgeTxt, urgent && { color: C.white }]}>{urgent ? 'Important' : 'Easevent'}</Text>
              </View>
              {!urgent ? (
                <Pressable onPress={() => hide(a.id)} hitSlop={10} style={styles.close} accessibilityRole="button"
                  accessibilityLabel={`Masquer l'annonce « ${a.title} »`}>
                  <Ionicons name="close" size={18} color={C.textSub} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.title}>{a.title}</Text>
            {a.body ? <Text style={styles.body}>{a.body}</Text> : null}
            {a.video?.url ? <EventVideo video={a.video} maxWidth={cardW - 32} maxHeightRatio={0.55} style={{ marginTop: 12 }} /> : null}
            {a.link_url ? (
              <Pressable onPress={() => Linking.openURL(a.link_url).catch(() => {})} style={styles.link} accessibilityRole="link">
                <Text style={styles.linkTxt}>{a.link_label || 'En savoir plus'}</Text>
                <Ionicons name="arrow-forward" size={16} color={C.white} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.greenSoft },
  cardUrgent: { borderColor: C.orange, borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeUrgent: { backgroundColor: C.orangeDark },
  badgeTxt: { fontSize: 12, fontWeight: '800', color: C.green, letterSpacing: 0.3 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  title: { fontSize: 17, fontWeight: '800', color: C.text, lineHeight: 23 },
  body: { fontSize: 14, color: C.textSub, lineHeight: 20, marginTop: 4 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 14, backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 16, minHeight: 44 },
  linkTxt: { color: C.white, fontWeight: '800', fontSize: 14 },
});
