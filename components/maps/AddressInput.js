/**
 * components/maps/AddressInput.js — saisie d'adresse avec suggestions
 * ════════════════════════════════════════════════════════════════
 * Suggestions dès 3 caractères (attente 400 ms). Choisir une suggestion
 * fixe l'adresse exacte et ses coordonnées : le lieu s'affiche ensuite
 * sur une carte, avec l'itinéraire. Une adresse tapée à la main reste
 * possible (sans carte précise).
 * onChange({ address, lat, lng })
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';
import geoService from '../../services/geoService';

const newSession = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export default function AddressInput({ value, located, onChange, error, label = 'Adresse du lieu' }) {
  const [text, setText] = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const session = useRef(newSession());

  useEffect(() => { setText(value || ''); }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const type = (t) => {
    setText(t);
    onChange({ address: t, lat: null, lng: null });
    clearTimeout(timer.current);
    if (t.trim().length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        setResults(await geoService.search(t.trim(), session.current));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const pick = async (r) => {
    setOpen(false);
    setResults([]);
    let place = r;
    if (r.lat == null) {
      try { place = { ...r, ...(await geoService.place(r.id, session.current)) }; } catch { /* adresse sans coordonnées */ }
    }
    session.current = newSession();
    const address = place.address || r.address;
    setText(address);
    onChange({ address, lat: place.lat ?? null, lng: place.lng ?? null });
  };

  return (
    <View>
      <View style={[styles.box, !!error && styles.boxError, located && styles.boxOk]}>
        <Ionicons name={located ? 'location' : 'location-outline'} size={18} color={located ? C.green : C.textMut} />
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={type}
          placeholder="Ex. Station F, Paris"
          placeholderTextColor={C.textFaint}
          accessibilityLabel={label}
          autoCorrect={false}
          onFocus={() => results.length && setOpen(true)}
        />
        {loading ? <ActivityIndicator size="small" color={C.green} /> : located ? <Ionicons name="checkmark-circle" size={18} color={C.green} /> : null}
      </View>
      {open && results.length > 0 && (
        <View style={styles.list} accessibilityRole="list">
          {results.map((r) => (
            <Pressable key={r.id} onPress={() => pick(r)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: C.bg }]}
              accessibilityRole="button" accessibilityLabel={r.address}>
              <Ionicons name="location-outline" size={18} color={C.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.main} numberOfLines={1}>{r.label}</Text>
                {r.secondary ? <Text style={styles.sub} numberOfLines={1}>{r.secondary}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {open && !loading && results.length === 0 && text.trim().length >= 3 && (
        <Text style={styles.hint}>Aucune suggestion : vous pouvez garder l'adresse telle que saisie.</Text>
      )}
      {!located && text.trim().length >= 3 && !open && (
        <Text style={styles.hint}>Choisissez une suggestion pour afficher le lieu sur une carte.</Text>
      )}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.inputBg,
  },
  boxOk: { borderColor: C.greenSoft, backgroundColor: '#F6FBF8' },
  boxError: { borderColor: C.error },
  input: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 12 },
  list: { marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  main: { fontSize: 15, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.textSub, marginTop: 1 },
  hint: { fontSize: 12, color: C.textSub, marginTop: 6 },
  error: { fontSize: 13, color: C.errorText, marginTop: 6 },
});
