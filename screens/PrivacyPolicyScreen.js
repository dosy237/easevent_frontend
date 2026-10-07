/**
 * PrivacyPolicyScreen.js — Easevent (M02)
 * ════════════════════════════════════════════════════════════════
 * Politique de confidentialité.
 * Accessible depuis : inscription (M01), Bienvenue (E03), Profil (E12),
 * email d'invitation (M30).
 *
 * - Bandeau vert + illustration, « L'essentiel » en 3 points
 * - 6 sections en accordéon (une seule ouverte à la fois)
 * - « Mes données » : export RGPD Art. 20 (connecté) ou connexion
 * - « Contacter le DPO » : ouvre la messagerie
 *
 * Le texte juridique est à valider par le juridique (voir LEGAL).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { C, LEGAL, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import { ShieldDocIllustration } from '../components/illustrations';
import { useAuth } from '../context/AuthContext';
import { authService, apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';
import { downloadJson } from '../utils/files';

const ESSENTIALS = [
  { icon: 'lock-closed-outline', color: C.green, bg: C.greenLight, title: 'Aucune revente',
    text: "Vos données ne sont jamais vendues. Les liens d'invitation ne sont suivis que pour l'organisateur." },
  { icon: 'eye-outline', color: C.orangeDark, bg: C.orangeL, title: 'Seulement le nécessaire',
    text: 'Email, nom, photo et ce que vous publiez. Les numéros de téléphone sont chiffrés.' },
  { icon: 'trash-outline', color: C.blue, bg: C.blueL, title: 'Effacement en un geste',
    text: 'Supprimez votre compte depuis le profil : vos données personnelles sont effacées aussitôt.' },
];

const SECTIONS = [
  {
    title: '1. Données collectées',
    body: "Compte : email, prénom, nom, photo, bio. Événements : titres, dates, lieux, photos. Invitations : email ou numéro de l'invité (chiffré), statut de réponse. Les mots de passe sont hachés et jamais stockés en clair.",
  },
  {
    title: '2. Pourquoi nous les utilisons',
    body: "Pour faire fonctionner le service que vous utilisez (exécution du contrat) : créer vos événements, envoyer vos invitations, générer vos tickets et traiter vos paiements. Les emails de nouveautés ne vous sont envoyés que si vous l'avez accepté (consentement), et vous pouvez retirer ce consentement à tout moment depuis votre profil.",
  },
  {
    title: '3. Durées de conservation',
    body: "Votre compte est conservé tant qu'il est actif. Les liens d'invitation expirent 7 jours après la fin de l'événement. Les brouillons d'événements non finalisés sont supprimés après 30 jours, avec un avertissement préalable. Les journaux techniques contenant une adresse IP sont purgés après 90 jours.",
  },
  {
    title: '4. Prestataires (paiement, emails, SMS)',
    body: "Nous faisons appel à des prestataires reconnus : Stripe (paiements et abonnements — nous ne voyons jamais votre carte), SendGrid (emails), Twilio (SMS), Cloudinary (photos), Expo, Google Firebase et Apple (notifications sur le téléphone, avec un simple identifiant d'appareil). Les adresses saisies peuvent être complétées par OpenStreetMap ou Google Maps. Certains sont situés hors de l'Union européenne ; ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne.",
  },
  {
    title: '5. Vos droits (RGPD)',
    body: "Vous pouvez à tout moment accéder à vos données, les corriger, les télécharger dans un format lisible par machine (bouton « Mes données »), vous opposer à un traitement ou demander leur effacement. La suppression du compte efface immédiatement vos données personnelles. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).",
  },
  {
    title: '6. Nous contacter',
    body: `Responsable du traitement : ${LEGAL.company}. Pour toute question sur vos données, écrivez à notre délégué à la protection des données : ${LEGAL.dpoEmail}. Nous répondons sous un mois au plus.`,
  },
];

function AccordionItem({ title, body, open, onToggle }) {
  return (
    <View style={[styles.acc, open && styles.accOpen]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        style={styles.accHead}
      >
        <Text style={[styles.accTitle, open && { fontWeight: '800' }]}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={open ? C.green : C.textMut} />
      </Pressable>
      {open ? <Text style={styles.accBody}>{body}</Text> : null}
    </View>
  );
}

export default function PrivacyPolicyScreen({ navigation }) {
  const { isAuthenticated } = useAuth();
  const [openIndex, setOpenIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate(isAuthenticated ? 'TabProfile' : 'Home');
  };

  const handleShare = async () => {
    const message = "Politique de confidentialité d'Easevent : vos données vous appartiennent.";
    try {
      if (Platform.OS === 'web' && navigator.share) await navigator.share({ title: 'Easevent', text: message, url: window.location.href });
      else if (Platform.OS !== 'web') await Share.share({ message });
      else showAlert('Lien copié', 'Partagez cette page depuis la barre d’adresse de votre navigateur.');
    } catch { /* partage annulé */ }
  };

  const handleMyData = async () => {
    if (!isAuthenticated) {
      showAlert('Connexion requise', 'Connectez-vous pour télécharger vos données.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se connecter', onPress: () => navigation.navigate('Login', { mode: 'login' }) },
      ]);
      return;
    }
    setExporting(true);
    try {
      const data = await authService.exportData();
      await downloadJson('easevent-mes-donnees.json', data);
    } catch (err) {
      showAlert('Export impossible', apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const handleContactDpo = () => {
    const email = LEGAL.dpoEmail.startsWith('[') ? '' : LEGAL.dpoEmail;
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('Données personnelles — Easevent')}`)
      .catch(() => showAlert('Messagerie indisponible', `Écrivez-nous à ${LEGAL.dpoEmail}.`));
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={goBack} />
          <Text style={styles.headerTitle} accessibilityRole="header">Confidentialité</Text>
          <Pressable onPress={handleShare} accessibilityRole="button" accessibilityLabel="Partager" style={styles.iconBtn}>
            <Ionicons name="share-outline" size={18} color={C.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroBubble} />
            <View style={styles.heroText}>
              <Text style={styles.heroTitle} accessibilityRole="header">Vos données vous appartiennent</Text>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipTxt}>Mise à jour : {LEGAL.updatedAt}</Text>
              </View>
            </View>
            <ShieldDocIllustration />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle} accessibilityRole="header">L'essentiel</Text>
            {ESSENTIALS.map((item, i) => (
              <View key={item.title} style={[styles.essRow, i < ESSENTIALS.length - 1 && { marginBottom: 14 }]}>
                <View style={[styles.essIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.essTitle}>{item.title}</Text>
                  <Text style={styles.essText}>{item.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.sections}>
            {SECTIONS.map((s, i) => (
              <AccordionItem
                key={s.title}
                title={s.title}
                body={s.body}
                open={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleMyData}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityState={{ busy: exporting }}
              style={({ pressed }) => [styles.actionGhost, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="download-outline" size={16} color={C.text} />
              <Text style={styles.actionGhostTxt}>{exporting ? 'Préparation…' : 'Mes données'}</Text>
            </Pressable>
            <Pressable
              onPress={handleContactDpo}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionPrimary, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="mail-outline" size={16} color={C.white} />
              <Text style={styles.actionPrimaryTxt}>Contacter le DPO</Text>
            </Pressable>
          </View>
          <Text style={styles.legal}>
            Responsable du traitement : {LEGAL.company} · DPO : {LEGAL.dpoEmail}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  header: {
    backgroundColor: C.white, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  iconBtn: {
    width: TOUCH, height: TOUCH, borderRadius: 12, backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { padding: 16, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  hero: {
    backgroundColor: C.green, borderRadius: 22, paddingVertical: 22, paddingHorizontal: 20,
    overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  heroBubble: {
    position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroText: { flex: 1, gap: 8 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: C.white, letterSpacing: -0.4, lineHeight: 27 },
  heroChip: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  heroChipTxt: { fontSize: 12, fontWeight: '600', color: C.white },
  card: { backgroundColor: C.white, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 14 },
  essRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  essIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  essTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  essText: { fontSize: 13, color: C.textSub, lineHeight: 19 },
  sections: { gap: 10 },
  acc: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  accOpen: { borderWidth: 1.5, borderColor: C.green },
  accHead: {
    minHeight: 52, paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  accTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  accBody: { paddingHorizontal: 16, paddingBottom: 16, fontSize: 14, color: C.textSub, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 4 },
  actionGhost: {
    flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white,
  },
  actionGhostTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  actionPrimary: {
    flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, backgroundColor: C.green,
  },
  actionPrimaryTxt: { fontSize: 14, fontWeight: '700', color: C.white },
  legal: { fontSize: 12, color: C.textMut, textAlign: 'center', lineHeight: 18 },
});
