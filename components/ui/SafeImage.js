/**
 * components/ui/SafeImage.js — image distante avec repli
 * Photo absente ou introuvable (lien expiré, hors ligne) : pastille
 * neutre avec une icône, jamais de carré gris vide.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';

export default function SafeImage({ uri, style, resizeMode = 'cover', icon = 'image-outline', iconSize = 28, accessibilityLabel, ...rest }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  if (!uri || failed) {
    return (
      <View style={[style, styles.fallback]} accessibilityRole={accessibilityLabel ? 'image' : undefined} accessibilityLabel={accessibilityLabel}>
        <Ionicons name={icon} size={iconSize} color={C.green} style={{ opacity: 0.55 }} />
      </View>
    );
  }
  return (
    <Image source={{ uri }} style={style} resizeMode={resizeMode} onError={() => setFailed(true)}
      accessibilityLabel={accessibilityLabel} accessibilityIgnoresInvertColors {...rest} />
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
