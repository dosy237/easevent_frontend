/**
 * components/ui/ImageViewer.js — photo en plein écran (fond noir, fermeture
 * par le bouton, le geste retour Android ou un toucher sur l'image).
 */
import React from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function ImageViewer({ uri, onClose }) {
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} accessibilityViewIsModal>
        <StatusBar style="light" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer la photo" accessibilityRole="button">
          {uri ? <Image source={{ uri }} style={styles.img} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
        </Pressable>
        <SafeAreaView style={styles.top} pointerEvents="box-none">
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={8}>
            <Ionicons name="close" size={26} color="#FFF" />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  img: { flex: 1, width: '100%', height: '100%' },
  top: { position: 'absolute', top: 0, right: 0, padding: 12 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
