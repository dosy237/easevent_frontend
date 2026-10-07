/**
 * components/events/LikeButton.js — « J'aime » d'un événement public, à jour en direct
 */
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { C } from '../../constants/theme';
import { useLikes } from '../../utils/likes';

export default function LikeButton({ event, onRequireLogin, isAuthenticated, light = false, compact = false, style }) {
  const [{ count, liked }, toggle] = useLikes(event);
  const scale = useRef(new Animated.Value(1)).current;
  const color = liked ? '#E5484D' : light ? '#FFFFFF' : C.text;

  const press = () => {
    if (!isAuthenticated) { onRequireLogin?.(); return; }
    if (!liked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 40 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    toggle();
  };

  const label = `${liked ? 'Je n’aime plus' : 'J’aime'} « ${event?.title || 'cet événement'} », ${count} j’aime`;
  return (
    <Pressable onPress={press} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected: liked }} aria-selected={liked}
      style={({ pressed }) => [styles.btn, light && styles.light, compact && styles.compact, pressed && { opacity: 0.8 }, style]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={compact ? 18 : 20} color={color} />
      </Animated.View>
      {count > 0 ? <Text style={[styles.count, { color: light ? '#FFFFFF' : C.text }]}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 10, borderRadius: 20 },
  light: { backgroundColor: 'rgba(0,0,0,0.32)' },
  compact: { minHeight: 34, paddingHorizontal: 8 },
  count: { fontSize: 14, fontWeight: '700' },
});
