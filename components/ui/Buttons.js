/**
 * components/ui/Buttons.js — boutons principal / secondaire / retour.
 * Styles identiques à LoginScreen (rayon 16, padding 16, ombre verte).
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, TOUCH } from '../../constants/theme';

export function PrimaryButton({ label, onPress, icon, loading = false, disabled = false, style, accessibilityHint }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [styles.primary, inactive && styles.primaryDisabled, pressed && styles.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={C.white} />
      ) : (
        <>
          <Text style={styles.primaryTxt}>{label}</Text>
          {icon ? <Ionicons name={icon} size={18} color={C.white} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, icon, disabled = false, style, children }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.secondary, disabled && styles.secondaryDisabled, pressed && styles.pressed, style]}
    >
      {icon ? <Ionicons name={icon} size={18} color={C.text} /> : null}
      <Text style={[styles.secondaryTxt, disabled && { color: C.textMut }]}>{label}</Text>
      {children}
    </Pressable>
  );
}

export function BackButton({ onPress, label = 'Retour', variant = 'round' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [variant === 'square' ? styles.backSquare : styles.backRound, pressed && styles.pressed]}
    >
      <Ionicons name="arrow-back-outline" size={variant === 'square' ? 22 : 20} color={C.text} />
    </Pressable>
  );
}

export function LinkButton({ label, onPress, style, textStyle }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={10} style={[styles.link, style]}>
      <Text style={[styles.linkTxt, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.green, borderRadius: 16, paddingVertical: 16, minHeight: TOUCH,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  primaryDisabled: { backgroundColor: '#8DB5A3', shadowOpacity: 0, elevation: 0 },
  primaryTxt: { color: C.white, fontSize: 16, fontWeight: '800' },
  secondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.white, borderRadius: 16, paddingVertical: 15, minHeight: TOUCH,
    borderWidth: 1.5, borderColor: C.border,
  },
  secondaryDisabled: { backgroundColor: C.bg },
  secondaryTxt: { color: C.text, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  backRound: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  backSquare: { width: TOUCH, height: TOUCH, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: TOUCH, justifyContent: 'center' },
  linkTxt: { color: C.green, fontSize: 14, fontWeight: '700' },
});
