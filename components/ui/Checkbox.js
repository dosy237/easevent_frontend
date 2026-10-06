/**
 * components/ui/Checkbox.js — case à cocher accessible (rôle checkbox).
 * `children` = libellé (peut contenir des liens).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';

export default function Checkbox({ checked, onChange, children, accessibilityLabel, required = false }) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      aria-required={required}
      style={styles.row}
      hitSlop={4}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color={C.white} /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44 },
  box: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#8A8A8A',
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'center',
  },
  boxChecked: { backgroundColor: C.green, borderColor: C.green },
  label: { flex: 1 },
});
