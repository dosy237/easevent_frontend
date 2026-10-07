/**
 * components/ui/Accordion.js — section repliable accessible (CGU, Aide)
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';

export default function Accordion({ title, children, open, onToggle, icon }) {
  return (
    <View style={[styles.acc, open && styles.accOpen]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}
        aria-expanded={open} style={styles.head}>
        {icon ? <Ionicons name={icon} size={18} color={C.green} /> : null}
        <Text style={[styles.title, open && { fontWeight: '800' }]}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={open ? C.green : C.textMut} />
      </Pressable>
      {open ? <View style={styles.body}>{typeof children === 'string' ? <Text style={styles.text}>{children}</Text> : children}</View> : null}
    </View>
  );
}

export const accordionText = StyleSheet.create({ p: { fontSize: 14, color: C.textSub, lineHeight: 22 } }).p;

const styles = StyleSheet.create({
  acc: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  accOpen: { borderWidth: 1.5, borderColor: C.green },
  head: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  text: { fontSize: 14, color: C.textSub, lineHeight: 22 },
});
