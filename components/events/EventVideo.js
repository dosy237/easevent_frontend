/**
 * components/events/EventVideo.js — vidéo de présentation d'un événement
 * ════════════════════════════════════════════════════════════════
 * Affichée EN ENTIER (jamais recadrée) : le cadre prend le format de la vidéo
 * (portrait, carré ou paysage), avec la légende en dessous. Aperçu fixe et
 * lecture au toucher (pas de lecture automatique : données et batterie).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';

import { C } from '../../constants/theme';
import SafeImage from '../ui/SafeImage';

function Player({ url, style }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  // Lecture dès que la vidéo est prête (un ordre donné avant le chargement est ignoré par les navigateurs)
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => { if (status === 'readyToPlay') player.play(); });
    if (player.status === 'readyToPlay') player.play();
    return () => sub.remove();
  }, [player]);
  return <VideoView player={player} style={style} contentFit="contain" nativeControls allowsFullscreen />;
}

export default function EventVideo({ video, style, maxWidth }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [playing, setPlaying] = useState(false);
  if (!video?.url) return null;
  const ratio = video.width && video.height ? video.width / video.height : 9 / 16;
  const width = Math.min(maxWidth || screenW - 40, screenW - 40);
  // Hauteur limitée à 70 % de l'écran ; la largeur s'ajuste pour garder la vidéo entière
  const height = Math.min(width / ratio, screenH * 0.7);
  const frame = { width: height * ratio, height, alignSelf: 'center' };
  const secs = video.duration ? `${Math.round(video.duration)} s` : '';

  return (
    <View style={style}>
      <View style={[styles.frame, frame]}>
        {playing ? <Player url={video.url} style={StyleSheet.absoluteFill} /> : (
          <Pressable onPress={() => setPlaying(true)} style={[StyleSheet.absoluteFill, styles.center]} accessibilityRole="button"
            accessibilityLabel={`Lire la vidéo de présentation${secs ? `, ${secs}` : ''}${video.caption ? `. ${video.caption}` : ''}`}>
            <SafeImage uri={video.poster} style={StyleSheet.absoluteFill} resizeMode="contain" icon="videocam-outline" />
            <View style={styles.play}><Ionicons name="play" size={30} color="#FFFFFF" /></View>
            {secs ? <View style={styles.badge}><Text style={styles.badgeTxt}>{secs}</Text></View> : null}
          </Pressable>
        )}
      </View>
      {video.caption ? <Text style={styles.caption}>{video.caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  frame: { backgroundColor: '#000', borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  badge: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  caption: { marginTop: 10, fontSize: 15, lineHeight: 22, color: C.text, textAlign: 'center', paddingHorizontal: 8 },
});
