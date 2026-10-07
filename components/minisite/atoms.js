/**
 * components/minisite/atoms.js — briques communes des sections
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export function Title({ theme, t, children, size = 30, align, style, numberOfLines }) {
  if (!children) return null;
  const { fonts } = theme;
  return (
    <Text accessibilityRole="header" numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts.display, color: t.text, fontSize: theme.size(size), lineHeight: Math.round(theme.size(size) * 1.18),
        textAlign: align, textTransform: fonts.upper ? 'uppercase' : 'none', letterSpacing: fonts.upper ? 1 : 0 }, style]}>
      {children}
    </Text>
  );
}

export function Kicker({ theme, t, children, align, style }) {
  if (!children) return null;
  return (
    <Text style={[{ fontFamily: theme.fonts.bold, color: t.accent, fontSize: 12, letterSpacing: 2.4, textTransform: 'uppercase',
      textAlign: align, marginBottom: 10 }, style]}>
      {children}
    </Text>
  );
}

export function Body({ theme, t, children, align, muted, size = 16, style, numberOfLines }) {
  if (!children) return null;
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: theme.fonts.body, color: muted ? t.muted : t.text, fontSize: size,
      lineHeight: Math.round(size * 1.6), textAlign: align }, style]}>
      {children}
    </Text>
  );
}

export function Strong({ theme, t, children, size = 16, align, style }) {
  if (!children) return null;
  return <Text style={[{ fontFamily: theme.fonts.bold, color: t.text, fontSize: size, textAlign: align }, style]}>{children}</Text>;
}

export function Button({ theme, t, label, onPress, ghost, style, accessibilityHint, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }} aria-disabled={!!disabled}
      style={({ pressed }) => [{
        backgroundColor: ghost ? 'transparent' : t.btn, borderColor: t.btn, borderWidth: ghost ? 1.5 : 0,
        borderRadius: theme.radius.btn, paddingVertical: 15, paddingHorizontal: 26, minHeight: 50,
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      }, style]}>
      <Text style={{ fontFamily: theme.fonts.bold, color: ghost ? t.btn : t.onBtn, fontSize: 16, letterSpacing: 0.3 }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ theme, t, children, style }) {
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: theme.radius.card, borderWidth: 1, borderColor: t.line, padding: 20 }, style]}>
      {children}
    </View>
  );
}
