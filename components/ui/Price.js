/**
 * components/ui/Price.js — un prix, sa conversion indicative, et le choix de la devise
 * ════════════════════════════════════════════════════════════════
 * <Price amount={12} currency="EUR" style={…} />
 *   12,00 €
 *   ≈ 7 872 FCFA · Convertir
 * « Convertir » ouvre la liste des devises (taux du jour). Le choix est
 * mémorisé et s'applique à tous les prix de l'application.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, TOUCH } from '../../constants/theme';
import { convert, money, setCurrency, symbolOf, useCurrency } from '../../utils/currency';

// Un taux garde ses décimales utiles : 1 EUR = 655,957 FCFA, 1 EUR = 1,0812 $
const rateText = (n, code) => `${Number(n.toFixed(n >= 100 ? 3 : 4)).toString().replace('.', ',')} ${symbolOf(code)}`;

export function CurrencySheet({ visible, onClose, from = 'EUR' }) {
  const fx = useCurrency();
  const pick = async (code) => { await setCurrency(code); onClose(); };
  const date = fx.date ? new Date(`${fx.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">Afficher les prix en</Text>
          <Text style={styles.sub}>
            {`Montants indicatifs, au taux du jour${date ? ` (${date})` : ''}. Le paiement est débité dans la devise affichée en premier.`}
          </Text>
          <FlatList
            data={[{ code: null, name: 'Sans conversion', symbol: '' }, ...fx.currencies]}
            keyExtractor={(c) => c.code || 'none'}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => {
              const on = (fx.currency || null) === item.code;
              return (
                <Pressable onPress={() => pick(item.code)} style={styles.row} accessibilityRole="radio"
                  accessibilityState={{ selected: on }} aria-selected={on} accessibilityLabel={item.name}>
                  <Text style={styles.code}>{item.code || '—'}</Text>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  {item.code && item.code !== from && convert(1, from, item.code) != null ? (
                    <Text style={styles.rate}>{`1 ${from} = ${rateText(convert(1, from, item.code), item.code)}`}</Text>
                  ) : null}
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? C.green : C.textMut} />
                </Pressable>
              );
            }}
          />
          {fx.source ? <Text style={styles.source}>{`Source : ${fx.source}`}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

export default function Price({ amount, currency = 'EUR', text, style, approxStyle, light = false, compact = false }) {
  const fx = useCurrency();
  const [open, setOpen] = useState(false);
  const approx = fx.approx(amount, currency);
  const tint = light ? 'rgba(255,255,255,0.9)' : C.textSub;
  return (
    <View>
      {text !== null ? <Text style={style}>{text ?? money(amount, currency)}</Text> : null}
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={[styles.line, compact && { marginTop: 2 }]}
        accessibilityRole="button" accessibilityLabel={approx ? `${approx}. Changer de devise` : 'Convertir dans une autre devise'}>
        {approx ? <Text style={[styles.approx, { color: tint }, approxStyle]}>{approx}</Text> : null}
        <Ionicons name="swap-horizontal" size={14} color={light ? '#fff' : C.green} />
        <Text style={[styles.convert, light && { color: '#fff' }]}>{approx ? 'Devise' : 'Convertir'}</Text>
      </Pressable>
      <CurrencySheet visible={open} onClose={() => setOpen(false)} from={currency} />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, minHeight: 22, flexWrap: 'wrap' },
  approx: { fontSize: 13, fontWeight: '600', marginRight: 4 },
  convert: { fontSize: 13, fontWeight: '700', color: C.green, textDecorationLine: 'underline' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 13, color: C.textSub, lineHeight: 19, marginTop: 6, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.bg },
  code: { width: 44, fontSize: 14, fontWeight: '800', color: C.text },
  name: { flex: 1, fontSize: 14, color: C.text },
  rate: { fontSize: 12, color: C.textMut },
  source: { fontSize: 12, color: C.textMut, marginTop: 10, textAlign: 'center' },
});
