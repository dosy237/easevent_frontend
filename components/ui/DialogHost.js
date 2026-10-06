/**
 * components/ui/DialogHost.js — fenêtre de dialogue (web).
 * Rôle « alertdialog », focus sur l'action principale, Échap = annuler.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { C, TOUCH } from '../../constants/theme';
import { registerDialogHost } from '../../utils/dialog';

export default function DialogHost() {
  const [dialog, setDialog] = useState(null);
  const firstBtn = useRef(null);

  useEffect(() => {
    registerDialogHost({ open: setDialog });
    return () => registerDialogHost(null);
  }, []);

  useEffect(() => {
    if (!dialog || Platform.OS !== 'web') return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(dialog.buttons.find((b) => b.style === 'cancel')); };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => firstBtn.current?.focus?.(), 30);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [dialog]);

  const close = (button) => {
    setDialog(null);
    button?.onPress?.();
  };

  if (!dialog) return null;
  // Action principale en dernier, comme sur iOS
  const buttons = [...dialog.buttons].sort((a, b) => (a.style === 'cancel' ? -1 : 0) - (b.style === 'cancel' ? -1 : 0));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(buttons.find((b) => b.style === 'cancel'))}>
      <View style={styles.backdrop}>
        <View
          style={styles.card}
          accessibilityRole="alert"
          accessibilityViewIsModal
          aria-modal="true"
          role="alertdialog"
          aria-labelledby="dialog-title"
        >
          <Text nativeID="dialog-title" style={styles.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={styles.row}>
            {buttons.map((b, i) => {
              const primary = b.style !== 'cancel';
              const destructive = b.style === 'destructive';
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  ref={i === buttons.length - 1 ? firstBtn : undefined}
                  onPress={() => close(b)}
                  accessibilityRole="button"
                  style={({ pressed, focused }) => [
                    styles.btn,
                    primary ? (destructive ? styles.btnDanger : styles.btnPrimary) : styles.btnGhost,
                    (pressed || focused) && styles.btnActive,
                  ]}
                >
                  <Text style={[styles.btnTxt, primary ? styles.btnTxtPrimary : styles.btnTxtGhost]}>{b.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: C.white, borderRadius: 20, padding: 22 },
  title: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8 },
  message: { fontSize: 15, color: C.textSub, lineHeight: 22, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: TOUCH, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: C.green },
  btnDanger: { backgroundColor: C.error },
  btnGhost: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border },
  btnActive: { opacity: 0.85 },
  btnTxt: { fontSize: 15, fontWeight: '700' },
  btnTxtPrimary: { color: C.white },
  btnTxtGhost: { color: C.text },
});
