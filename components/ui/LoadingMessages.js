/**
 * components/ui/LoadingMessages.js — Easevent
 * Petites phrases qui défilent pendant un chargement, pour montrer
 * que l'application travaille. Annoncées poliment aux lecteurs d'écran.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';

export const MESSAGES = {
  feed: [
    'Nous cherchons les événements près de vous…',
    'Les organisateurs préparent leurs plus belles affiches…',
    'On met les chaises en place…',
    'Presque prêt, encore un instant…',
  ],
  dashboard: [
    'Nous rassemblons vos événements…',
    'On compte vos invités…',
    'Vos invitations arrivent…',
    'Encore un instant…',
  ],
  generic: [
    'Chargement en cours…',
    'Nous préparons tout pour vous…',
    'Encore un instant…',
  ],
};

export default function LoadingMessages({ messages = MESSAGES.generic, interval = 2200, style }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (messages.length < 2) return undefined;
    const timer = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % messages.length);
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, interval);
    return () => clearInterval(timer);
  }, [messages, interval, opacity]);

  return (
    <View style={[styles.row, style]} accessibilityLiveRegion="polite" aria-live="polite">
      <Ionicons name="sparkles-outline" size={14} color={C.green} />
      <Animated.Text style={[styles.txt, { opacity }]}>{messages[index]}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  txt: { fontSize: 13, color: C.textSub, fontWeight: '600' },
});
