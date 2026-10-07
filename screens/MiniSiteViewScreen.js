/**
 * screens/MiniSiteViewScreen.js — le mini-site d'un événement, dans l'application
 * ════════════════════════════════════════════════════════════════
 * Ouvert depuis la page de l'événement (invités, visiteurs d'un événement public)
 * ou depuis la gestion (organisateur : aperçu + « Retoucher »).
 * params : { eventId }  ou  { eventId, spec, event } pour un aperçu non enregistré
 * Le mini-site n'existe que dans l'application : aucune adresse web publique.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import MiniSite from '../components/minisite/MiniSite';
import ImageViewer from '../components/ui/ImageViewer';
import { C } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import minisiteService from '../services/minisiteService';
import { buildActions } from '../utils/minisiteActions';
import { passWord } from '../utils/wording';

export default function MiniSiteViewScreen({ route, navigation }) {
  const { eventId, spec: draftSpec, event: draftEvent } = route?.params || {};
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(draftSpec ? { spec: draftSpec, event: draftEvent, is_organizer: true, preview: true } : null);
  const [error, setError] = useState(null);
  const [viewer, setViewer] = useState(null);

  const load = useCallback(() => {
    if (draftSpec || !eventId) return;
    setError(null);
    minisiteService.get(eventId).then(setData).catch((err) => setError(err.response ? 'missing' : 'network'));
  }, [eventId, draftSpec]);
  useEffect(load, [load]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(isAuthenticated ? 'TabDiscover' : 'Home'));

  if (error || !data) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Ionicons name={error === 'network' ? 'wifi-outline' : 'sparkles-outline'} size={44} color={C.textMut} />
            <Text style={styles.errTitle} accessibilityRole="header">{error === 'network' ? 'Connexion impossible' : 'Mini-site indisponible'}</Text>
            <Text style={styles.errSub}>{error === 'network' ? 'Vérifiez votre connexion puis réessayez.' : "Ce mini-site n'existe pas ou n'est pas accessible."}</Text>
            {error === 'network' ? <Pressable style={styles.errBtn} onPress={load} accessibilityRole="button"><Text style={styles.errBtnTxt}>Réessayer</Text></Pressable> : null}
            <Pressable style={styles.errBtn} onPress={goBack} accessibilityRole="button"><Text style={styles.errBtnTxt}>Retour</Text></Pressable>
          </>
        ) : <ActivityIndicator color={C.green} />}
      </View>
    );
  }

  const { spec, event, is_organizer: isOrganizer, preview } = data;
  const myTicket = event.my_ticket;
  const ctaLabel = isOrganizer ? (spec.copy?.cta?.label || 'Je participe')
    : myTicket?.status === 'generated' ? `Voir ${passWord(event).my}`
    : myTicket?.status === 'pending' ? `Finaliser ${passWord(event).my}`
    : event.spots_left === 0 ? 'Complet' : (spec.copy?.cta?.label || 'Je participe');
  // La participation se fait sur la page de l'événement (ticket, paiement, questions RSVP)
  const participate = () => navigation.navigate('EventDetail', { id: event.id, event, participate: Date.now() });
  const actions = buildActions({
    event, ctaLabel, preview: isOrganizer,
    onParticipate: participate,
    onViewImage: setViewer,
    onContact: !isOrganizer && isAuthenticated ? () => navigation.navigate('Chat', { eventId: event.id, organizerName: event.organizer?.name }) : undefined,
  });

  return (
    <View style={{ flex: 1, backgroundColor: spec.theme?.colors?.bg || C.white }}>
      <StatusBar barStyle="dark-content" />
      <ImageViewer uri={viewer} onClose={() => setViewer(null)} />
      <MiniSite spec={spec} event={event} actions={actions} width={width} />
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={goBack} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={22} color="#141414" />
        </Pressable>
        {isOrganizer && !preview ? (
          <Pressable onPress={() => navigation.navigate('MiniSiteEditor', { eventId: event.id })} style={styles.pillBtn}
            accessibilityRole="button" accessibilityLabel="Retoucher le mini-site">
            <Ionicons name="color-palette-outline" size={18} color="#141414" />
            <Text style={styles.pillTxt}>Retoucher</Text>
          </Pressable>
        ) : null}
      </View>
      {isOrganizer ? (
        <View style={[styles.badge, { bottom: insets.bottom + 14 }]} pointerEvents="none">
          <Text style={styles.badgeTxt}>{preview ? 'Aperçu non enregistré' : 'Vue organisateur · vos invités voient ce mini-site'}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.white, gap: 8 },
  errTitle: { fontSize: 19, fontWeight: '800', color: C.text, marginTop: 8 },
  errSub: { fontSize: 14, color: C.textSub, textAlign: 'center', maxWidth: 340, lineHeight: 20 },
  errBtn: { marginTop: 10, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12, backgroundColor: C.greenLight },
  errBtnTxt: { color: C.green, fontWeight: '700', fontSize: 15 },
  topBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  pillTxt: { fontWeight: '700', color: '#141414', fontSize: 14 },
  badge: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(20,20,20,0.86)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  badgeTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
