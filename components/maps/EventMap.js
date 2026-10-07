/**
 * components/maps/EventMap.js — le lieu sur une carte, avec l'itinéraire
 * ════════════════════════════════════════════════════════════════
 * map = { image, view, directions } (champ « map » de l'API événement)
 * « Itinéraire » ouvre Google Maps (application si installée) avec le
 * trajet depuis la position du téléphone jusqu'au lieu.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';

const fallback = (address, kind) => (kind === 'directions'
  ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);

export const openDirections = (map, address) => Linking.openURL(map?.directions || fallback(address, 'directions')).catch(() => {});
export const openInMaps = (map, address) => Linking.openURL(map?.view || fallback(address, 'view')).catch(() => {});

export default function EventMap({ map, address, title, compact = false }) {
  const [broken, setBroken] = useState(false);
  if (!address) return null;
  const hasImage = map?.image && !broken;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => openInMaps(map, address)} accessibilityRole="button"
        accessibilityLabel={`Voir ${address} sur la carte`}>
        {hasImage ? (
          <Image source={{ uri: map.image }} style={[styles.map, compact && { height: 120 }]} resizeMode="cover"
            onError={() => setBroken(true)} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.map, styles.placeholder, compact && { height: 96 }]}>
            <Ionicons name="map-outline" size={30} color={C.green} />
            <Text style={styles.placeholderTxt}>Voir sur la carte</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.body}>
        <View style={styles.addressRow}>
          <Ionicons name="location" size={18} color={C.green} />
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
            <Text style={styles.address} selectable>{address}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => openDirections(map, address)} style={[styles.btn, styles.primary]} accessibilityRole="button"
            accessibilityHint="Ouvre Google Maps avec le trajet depuis votre position">
            <Ionicons name="navigate" size={16} color={C.white} />
            <Text style={styles.primaryTxt}>Itinéraire</Text>
          </Pressable>
          <Pressable onPress={() => openInMaps(map, address)} style={[styles.btn, styles.ghost]} accessibilityRole="button">
            <Ionicons name="map-outline" size={16} color={C.green} />
            <Text style={styles.ghostTxt}>Ouvrir dans Maps</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden', backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  map: { width: '100%', height: 160, backgroundColor: '#EEF2EF' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderTxt: { fontSize: 13, fontWeight: '700', color: C.green },
  body: { padding: 14, gap: 12 },
  addressRow: { flexDirection: 'row', gap: 10 },
  title: { fontSize: 14, fontWeight: '800', color: C.text },
  address: { fontSize: 14, color: C.textSub, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primary: { backgroundColor: C.green },
  primaryTxt: { fontSize: 14, fontWeight: '800', color: C.white },
  ghost: { borderWidth: 1.5, borderColor: C.greenSoft, backgroundColor: '#F6FBF8' },
  ghostTxt: { fontSize: 14, fontWeight: '700', color: C.green },
});
