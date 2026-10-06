/**
 * components/ui/Skeleton.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Maquette « basse fidélité » affichée pendant le chargement : la
 * forme du contenu apparaît tout de suite, l'attente paraît plus courte.
 *
 * Éco-conception / accessibilité : une seule animation partagée par
 * tous les blocs, et aucune animation si l'utilisateur a demandé à
 * réduire les mouvements.
 * ════════════════════════════════════════════════════════════════
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { C } from '../../constants/theme';

const PulseContext = createContext(null);

export function SkeletonGroup({ children, label = 'Chargement en cours', style }) {
  const pulse = useRef(new Animated.Value(0.55)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => mounted && setReduceMotion(!!v))
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, pulse]);

  return (
    <PulseContext.Provider value={pulse}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={label} aria-busy style={style}>
        {children}
      </View>
    </PulseContext.Provider>
  );
}

export function Bone({ width = '100%', height = 14, radius = 8, style }) {
  const pulse = useContext(PulseContext);
  return (
    <Animated.View
      importantForAccessibility="no"
      style={[{ width, height, borderRadius: radius, backgroundColor: C.skeleton, opacity: pulse ?? 0.7 }, style]}
    />
  );
}

// Carte « événement » : image + titre + 2 lignes d'info
export function EventCardSkeleton({ horizontal = false }) {
  if (horizontal) {
    return (
      <View style={[styles.card, styles.row]}>
        <Bone width={100} height={110} radius={0} />
        <View style={styles.rowBody}>
          <Bone width={70} height={16} radius={6} />
          <Bone width="85%" height={16} />
          <Bone width="60%" height={11} />
          <Bone width="50%" height={11} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Bone height={140} radius={0} />
      <View style={styles.body}>
        <Bone width="75%" height={18} />
        <Bone width="45%" height={11} />
        <Bone width="55%" height={11} />
      </View>
    </View>
  );
}

export function StatsSkeleton() {
  return (
    <View style={styles.stats}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.stat}>
          <Bone width={44} height={44} radius={14} />
          <Bone width={30} height={20} />
          <Bone width={64} height={10} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 12 },
  body: { padding: 14, gap: 10 },
  row: { flexDirection: 'row' },
  rowBody: { flex: 1, padding: 12, gap: 9 },
  stats: { flexDirection: 'row', backgroundColor: C.white, paddingVertical: 20, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  stat: { flex: 1, alignItems: 'center', gap: 8 },
});
