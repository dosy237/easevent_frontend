/**
 * components/TicketView.js — Easevent (M27 « Ticket généré »)
 * ════════════════════════════════════════════════════════════════
 * Billet affiché dans TicketModal (Mes tickets) et après un paiement.
 * Structure reprise de l'ancien TicketModal : photo, découpe, lignes
 * d'info, QR, avertissement. Ajouts M27 : badges GÉNÉRÉ / PAYÉ ou
 * GRATUIT, prix, dress code, n° de ticket, Calendrier, Télécharger (PDF).
 *
 * Le QR encode uniquement l'identifiant signé du ticket (qr_payload),
 * jamais de donnée personnelle.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import { C } from '../constants/theme';
import { formatDateLong, formatPrice } from '../utils/format';
import ticketService from '../services/ticketService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';
import { openDirections } from './maps/EventMap';
import rsvpService from '../services/rsvpService';
import { askRsvp } from '../utils/rsvp';

// Lien « Ajouter à Google Agenda » : fonctionne sur tous les appareils, sans permission
const calendarUrl = (ticket) => {
  const e = ticket.event || {};
  const fmt = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title || 'Événement Easevent',
    ...(e.start_date ? { dates: `${fmt(e.start_date)}/${fmt(e.end_date || e.start_date)}` } : {}),
    details: `Ticket ${ticket.number} — Easevent`,
    location: e.is_online ? 'En ligne' : (e.location_address || ''),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export default function TicketView({ ticket, justPaid = false }) {
  const e = ticket.event || {};
  const paid = ticket.payment_status === 'paid';

  const [downloading, setDownloading] = useState(false);

  // PDF généré par le serveur : lien signé valable 5 minutes.
  // Android / web : le navigateur enregistre le fichier dans Téléchargements.
  // iOS : aperçu du PDF, enregistrable depuis la feuille de partage.
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const { url } = await ticketService.pdfLink(ticket.id);
      if (Platform.OS === 'ios') await WebBrowser.openBrowserAsync(url);
      else await Linking.openURL(url);
    } catch (err) {
      showAlert('Téléchargement impossible', apiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  // Questions de l'organisateur : revoir et modifier ses réponses (M19)
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const editAnswers = async () => {
    setRsvpBusy(true);
    try {
      const data = await rsvpService.mine(e.id);
      setRsvpBusy(false);
      const answers = await askRsvp({ ...data, submitLabel: 'Enregistrer mes réponses' });
      if (answers === null) return;
      await rsvpService.saveMine(e.id, answers);
      showAlert('Réponses enregistrées', "L'organisateur voit vos nouvelles réponses.");
    } catch (err) {
      showAlert('Action impossible', apiErrorMessage(err));
    } finally {
      setRsvpBusy(false);
    }
  };

  const shareTicket = () => Share.share({
    message: `Mon ticket ${ticket.number} pour « ${e.title} » — ${formatDateLong(e.start_date)}`
      + `${e.location_address ? ` · ${e.location_address}` : ''}. Présentez le QR code dans l'application Easevent.`,
  }).catch(() => {});

  const rows = [
    { label: 'Date', value: formatDateLong(e.start_date) },
    { label: 'Lieu', value: e.is_online ? 'En ligne' : (e.location_address || '—') },
    { label: 'Participant', value: ticket.participant },
    { label: 'Prix', value: formatPrice(ticket.price, ticket.currency), strong: true },
    ...(ticket.checked_in_at ? [{ label: 'Entrée', value: `Contrôlé le ${formatDateLong(ticket.checked_in_at)}` }] : []),
  ];

  return (
    <View>
      {justPaid && (
        <View style={styles.paidBanner} accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={16} color={C.green} />
          <Text style={styles.paidBannerTxt}>Paiement reçu — votre ticket est généré.</Text>
        </View>
      )}

      <View style={styles.ticket}>
        <View style={styles.head}>
          {e.cover_image ? <Image source={{ uri: e.cover_image }} style={styles.cover} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
          <View style={styles.headOverlay}>
            <View style={styles.badges}>
              <View style={styles.badgeMain}>
                <Ionicons name="checkmark-circle" size={12} color={C.green} />
                <Text style={styles.badgeMainTxt}>GÉNÉRÉ</Text>
              </View>
              <View style={styles.badgeGlass}>
                <Text style={styles.badgeGlassTxt}>{paid ? 'PAYÉ' : 'GRATUIT'}</Text>
              </View>
            </View>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{e.title}</Text>
          </View>
        </View>

        <View style={styles.tear}>
          <View style={[styles.tearHole, { marginLeft: -12 }]} />
          <View style={styles.tearDash} />
          <View style={[styles.tearHole, { marginRight: -12 }]} />
        </View>

        <View style={styles.body}>
          {rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={[styles.rowValue, r.strong && styles.rowStrong]} numberOfLines={2}>{r.value}</Text>
            </View>
          ))}
          {ticket.dress_code ? (
            <View style={[styles.row, { borderBottomWidth: 0, alignItems: 'center' }]}>
              <Text style={styles.rowLabel}>Dress code</Text>
              <View style={styles.dress}>
                <Ionicons name="shirt-outline" size={13} color="#B4492E" />
                <Text style={styles.dressTxt} numberOfLines={2}>{ticket.dress_code}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>Présentez ce QR code à l'entrée</Text>
            <View style={styles.qrBox} accessible accessibilityRole="image" accessibilityLabel={`QR code du ticket ${ticket.number}`}>
              {ticket.qr_payload ? (
                <QRCode value={ticket.qr_payload} size={168} color={C.text} backgroundColor={C.white} ecl="M" />
              ) : (
                <View style={styles.qrMissing}><Ionicons name="qr-code-outline" size={64} color={C.textMut} /></View>
              )}
            </View>
            <Text style={styles.number} selectable>TICKET N° {ticket.number}</Text>
          </View>

          <View style={styles.warning}>
            <Ionicons name="information-circle-outline" size={14} color={C.textMut} />
            <Text style={styles.warningTxt}>
              Ce ticket est personnel et non transférable. Valable uniquement pour {ticket.participant}.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
          onPress={() => Linking.openURL(calendarUrl(ticket)).catch(() => {})}
          accessibilityRole="button"
          accessibilityLabel="Ajouter au calendrier"
        >
          <Ionicons name="calendar-outline" size={16} color={C.text} />
          <Text style={styles.actionTxt}>Calendrier</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
          onPress={downloadPdf}
          disabled={downloading}
          accessibilityRole="button"
          accessibilityLabel="Télécharger mon ticket en PDF"
          accessibilityState={{ busy: downloading }} aria-busy={downloading}
        >
          {downloading
            ? <ActivityIndicator size="small" color={C.text} />
            : <Ionicons name="download-outline" size={16} color={C.text} />}
          <Text style={styles.actionTxt}>Télécharger</Text>
        </Pressable>
      </View>
      {!e.is_online && e.location_address ? (
        <Pressable onPress={() => openDirections(e.map, e.location_address)} style={styles.routeBtn} accessibilityRole="button"
          accessibilityHint="Ouvre Google Maps avec le trajet depuis votre position">
          <Ionicons name="navigate" size={16} color={C.white} />
          <Text style={styles.routeTxt}>Itinéraire jusqu'au lieu</Text>
        </Pressable>
      ) : null}
      {e.has_rsvp ? (
        <Pressable onPress={editAnswers} disabled={rsvpBusy} style={styles.shareLink} accessibilityRole="button"
          accessibilityHint="Revoir et modifier vos réponses aux questions de l'organisateur">
          {rsvpBusy ? <ActivityIndicator size="small" color={C.green} /> : <Ionicons name="document-text-outline" size={14} color={C.green} />}
          <Text style={styles.shareLinkTxt}>Mes réponses aux questions</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={shareTicket} accessibilityRole="button" style={styles.shareLink}>
        <Ionicons name="share-social-outline" size={14} color={C.green} />
        <Text style={styles.shareLinkTxt}>Partager mon ticket</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  paidBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenLight,
    borderWidth: 1, borderColor: C.greenSoft, borderRadius: 12, padding: 12, marginBottom: 14,
  },
  paidBannerTxt: { fontSize: 13, fontWeight: '600', color: C.greenDark, flex: 1 },
  ticket: {
    backgroundColor: C.white, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  head: { height: 170, backgroundColor: C.green },
  cover: { position: 'absolute', width: '100%', height: '100%' },
  headOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 16 },
  badges: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  badgeMain: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.white, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeMainTxt: { fontSize: 10, fontWeight: '800', color: C.green },
  badgeGlass: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGlassTxt: { fontSize: 10, fontWeight: '800', color: C.white },
  title: { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: -0.3 },
  tear: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white },
  tearHole: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.bg },
  tearDash: { flex: 1, borderTopWidth: 2, borderColor: C.border, borderStyle: 'dashed' },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  rowLabel: { fontSize: 12, color: C.textMut, fontWeight: '500' },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '600', color: C.text },
  rowStrong: { fontSize: 14, fontWeight: '900' },
  dress: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.orangeL, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: '70%' },
  dressTxt: { fontSize: 13, fontWeight: '700', color: '#B4492E', flexShrink: 1 },
  qrSection: { alignItems: 'center', paddingTop: 18, paddingBottom: 8 },
  qrLabel: { fontSize: 13, color: C.textMut, marginBottom: 14 },
  qrBox: { padding: 14, backgroundColor: C.white, borderRadius: 16, borderWidth: 2, borderColor: C.border },
  qrMissing: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 12, color: C.textMut, marginTop: 10, letterSpacing: 1 },
  warning: { flexDirection: 'row', gap: 6, backgroundColor: C.bg, borderRadius: 10, padding: 12, marginTop: 8 },
  warningTxt: { flex: 1, fontSize: 12, color: C.textMut, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: {
    flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white,
  },
  actionTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  routeBtn: { minHeight: 48, marginTop: 10, borderRadius: 14, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  routeTxt: { fontSize: 14, fontWeight: '800', color: C.white },
  shareLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  shareLinkTxt: { fontSize: 13, fontWeight: '700', color: C.green },
});
