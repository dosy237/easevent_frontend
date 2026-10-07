/**
 * components/ui/ColorPicker.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Sélecteur de couleur libre, inspiré de Figma :
 *   - carré saturation / luminosité (glisser le curseur)
 *   - barre de teinte (glisser, ou ±10° au lecteur d'écran)
 *   - champ hexadécimal (#RRGGBB) pour saisir une couleur exacte
 *   - suggestions (palette de l'ambiance) et couleurs récentes
 *
 * Aucune dépendance supplémentaire : dégradés dessinés avec react-native-svg.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { C, TOUCH } from '../../constants/theme';

const SV_HEIGHT = 170;
const HUE_HEIGHT = 18;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── Conversions couleur ───────────────────────────────────────
export function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (u) => Math.round((u + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Couleur du texte lisible sur un fond donné (pour les pastilles)
export const readableOn = (hex) => {
  const { v, s } = hexToHsv(hex);
  return v > 0.75 && s < 0.5 ? C.text : C.white;
};

// ── Zone tactile : position relative pendant le glisser ──────
function useDrag(onMove) {
  const width = useRef(1);
  const height = useRef(1);
  const handle = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    onMove(clamp(locationX / width.current, 0, 1), clamp(locationY / height.current, 0, 1));
  };
  return {
    onLayout: (e) => { width.current = e.nativeEvent.layout.width || 1; height.current = e.nativeEvent.layout.height || 1; },
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: handle,
    onResponderMove: handle,
  };
}

export default function ColorPicker({ value, onChange, suggestions = [], recent = [], label }) {
  const safe = HEX_RE.test(value || '') ? value.toUpperCase() : '#1B6B4A';
  const [hsv, setHsv] = useState(() => hexToHsv(safe));
  const [hexText, setHexText] = useState(safe);
  const lastEmitted = useRef(safe);

  // Valeur modifiée de l'extérieur (pastille, ambiance) → resynchroniser
  useEffect(() => {
    if (safe !== lastEmitted.current) {
      setHsv(hexToHsv(safe));
      setHexText(safe);
      lastEmitted.current = safe;
    }
  }, [safe]);

  const emit = (next) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexText(hex);
    lastEmitted.current = hex;
    onChange(hex);
  };

  const hueColor = useMemo(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }), [hsv.h]);
  const svDrag = useDrag((x, y) => emit({ ...hsv, s: x, v: 1 - y }));
  const hueDrag = useDrag((x) => emit({ ...hsv, h: Math.min(359.9, x * 360) }));

  const onHexChange = (txt) => {
    let t = txt.trim().toUpperCase();
    if (t && !t.startsWith('#')) t = `#${t}`;
    t = t.replace(/[^#0-9A-F]/g, '').slice(0, 7);
    setHexText(t);
    if (HEX_RE.test(t)) {
      setHsv(hexToHsv(t));
      lastEmitted.current = t;
      onChange(t);
    }
  };

  const swatches = [...new Set([...suggestions, ...recent].map((c) => c.toUpperCase()))].slice(0, 12);

  return (
    <View style={styles.wrap}>
      {/* Carré saturation / luminosité */}
      <View
        {...svDrag}
        style={styles.sv}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label || 'Couleur'} : nuance`}
        accessibilityValue={{ text: `saturation ${Math.round(hsv.s * 100)} %, luminosité ${Math.round(hsv.v * 100)} %` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const step = e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1;
          emit({ ...hsv, v: clamp(hsv.v + step, 0, 1) });
        }}
      >
        <Svg width="100%" height={SV_HEIGHT} pointerEvents="none">
          <Defs>
            <LinearGradient id="white" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="black" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={hueColor} />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#white)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#black)" />
        </Svg>
        <View
          pointerEvents="none"
          style={[styles.svThumb, {
            left: `${hsv.s * 100}%`, top: (1 - hsv.v) * SV_HEIGHT, backgroundColor: hsvToHex(hsv),
          }]}
        />
      </View>

      {/* Barre de teinte */}
      <View
        {...hueDrag}
        style={styles.hue}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label || 'Couleur'} : teinte`}
        accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.h) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const step = e.nativeEvent.actionName === 'increment' ? 10 : -10;
          emit({ ...hsv, h: (hsv.h + step + 360) % 360 });
        }}
      >
        <Svg width="100%" height={HUE_HEIGHT} pointerEvents="none">
          <Defs>
            <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
              {['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'].map((c, i) => (
                <Stop key={c + i} offset={String(i / 6)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={HUE_HEIGHT} rx={HUE_HEIGHT / 2} fill="url(#hue)" />
        </Svg>
        <View pointerEvents="none" style={[styles.hueThumb, { left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }]} />
      </View>

      {/* Saisie exacte */}
      <View style={styles.hexRow}>
        <View style={[styles.preview, { backgroundColor: HEX_RE.test(hexText) ? hexText : safe }]} />
        <TextInput
          value={hexText}
          onChangeText={onHexChange}
          style={[styles.hexInput, !HEX_RE.test(hexText) && styles.hexInvalid]}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          accessibilityLabel={`${label || 'Couleur'} : code hexadécimal`}
          placeholder="#RRGGBB"
          placeholderTextColor={C.textFaint}
        />
      </View>

      {swatches.length > 0 && (
        <View style={styles.swatches}>
          {swatches.map((c) => {
            const active = c === safe;
            return (
              <Pressable
                key={c}
                onPress={() => { setHsv(hexToHsv(c)); setHexText(c); lastEmitted.current = c; onChange(c); }}
                accessibilityRole="button"
                accessibilityLabel={`Choisir la couleur ${c}`}
                accessibilityState={{ selected: active }} aria-selected={active}
                style={[styles.swatchHit]}
              >
                <View style={[styles.swatch, { backgroundColor: c }, active && styles.swatchActive]} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  sv: { height: SV_HEIGHT, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, cursor: 'crosshair' },
  svThumb: {
    position: 'absolute', width: 22, height: 22, marginLeft: -11, marginTop: -11,
    borderRadius: 11, borderWidth: 3, borderColor: C.white,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  hue: { height: TOUCH, justifyContent: 'center', cursor: 'pointer' },
  hueThumb: {
    position: 'absolute', top: (TOUCH - 26) / 2, width: 26, height: 26, marginLeft: -13,
    borderRadius: 13, borderWidth: 3, borderColor: C.white,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  hexInput: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg,
    paddingHorizontal: 14, fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: 1, outlineStyle: 'none',
  },
  hexInvalid: { borderColor: C.error },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  swatchHit: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  swatchActive: { borderWidth: 3, borderColor: C.text },
});
