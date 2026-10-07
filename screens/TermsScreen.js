/**
 * TermsScreen.js — Easevent · Conditions générales d'utilisation (CGU)
 * ════════════════════════════════════════════════════════════════
 * Accessible depuis l'inscription (case de consentement), l'écran de
 * bienvenue, le profil et l'aide. Texte à faire relire par un juriste
 * avant la mise en ligne publique (voir docs/A_REPRENDRE.md).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, LEGAL } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import Accordion from '../components/ui/Accordion';
import { useAuth } from '../context/AuthContext';

const SECTIONS = [
  ['1. Objet', `Easevent est un service édité par ${LEGAL.company} qui permet de créer des événements, d'inviter des personnes, de vendre ou distribuer des tickets et d'échanger avec ses invités. Les présentes conditions encadrent l'utilisation de l'application et du site. En créant un compte, vous les acceptez.`],
  ['2. Votre compte', "L'inscription est gratuite et réservée aux personnes de 15 ans et plus. Vous fournissez des informations exactes (nom, email, numéro de téléphone vérifié) et gardez votre mot de passe confidentiel. Vous êtes responsable de l'activité de votre compte. Vous pouvez le supprimer à tout moment depuis votre profil."],
  ['3. Rôle d\'Easevent', "Easevent fournit l'outil ; l'organisateur est seul responsable de son événement : contenu, lieu, sécurité, respect de la loi (dont les règles de vente de billets et d'accueil du public). Easevent n'est pas l'organisateur des événements publiés et n'est pas partie au contrat entre l'organisateur et ses participants."],
  ['4. Tickets et paiements', "Les tickets payants sont réglés via Stripe ; Easevent ne voit ni ne conserve vos données bancaires. Le prix est fixé par l'organisateur ; une commission de service est prélevée sur chaque ticket vendu et l'organisateur reçoit le reste sur son compte bancaire. Un ticket n'est valable qu'une fois : il est contrôlé à l'entrée grâce à son QR code. Si un événement est annulé par l'organisateur, les tickets payés sont remboursés automatiquement. Pour toute autre demande de remboursement, adressez-vous à l'organisateur."],
  ['5. Abonnements', "Les plans Standard et Pro sont des abonnements mensuels ou annuels, sans engagement, renouvelés automatiquement. Vous pouvez résilier à tout moment depuis Profil › Abonnement : vous gardez votre plan jusqu'à la fin de la période payée, sans autre prélèvement. En souscrivant, vous demandez l'accès immédiat aux fonctionnalités et reconnaissez perdre votre droit de rétractation pour la période en cours, conformément à l'article L221-28 du Code de la consommation."],
  ['6. Contenus et comportement', "Vous restez propriétaire des contenus que vous publiez (textes, photos) et autorisez Easevent à les afficher pour faire fonctionner le service. Sont interdits : les contenus illégaux, haineux, violents ou trompeurs, le harcèlement, le spam, l'usurpation d'identité et toute tentative de contourner la sécurité. Easevent peut retirer un contenu signalé et suspendre un compte en cas de manquement."],
  ['7. Invitations', "En invitant une personne par email ou SMS, vous confirmez la connaître et avoir le droit de lui écrire. Les numéros de téléphone sont chiffrés et ne servent qu'à acheminer l'invitation. Les invitations sont envoyées progressivement pour éviter le spam."],
  ['8. Disponibilité et responsabilité', "Nous faisons de notre mieux pour que le service soit disponible et fiable, sans pouvoir garantir l'absence totale d'interruption. La responsabilité d'Easevent ne peut être engagée pour le déroulement d'un événement, ni pour les dommages indirects. Rien dans ces conditions ne limite vos droits de consommateur."],
  ['9. Données personnelles', 'Le traitement de vos données est décrit dans notre politique de confidentialité, accessible depuis le profil et l\'écran d\'inscription.'],
  ['10. Modifications', "Nous pouvons faire évoluer ces conditions ; vous serez prévenu dans l'application au moins 15 jours avant l'entrée en vigueur d'un changement important."],
  ['11. Droit applicable et litiges', `Ces conditions sont soumises au droit français. En cas de difficulté, contactez-nous d'abord : ${LEGAL.dpoEmail}. Vous pouvez aussi recourir gratuitement à un médiateur de la consommation ou à la plateforme européenne de règlement en ligne des litiges.`],
];

export default function TermsScreen({ navigation }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(0);
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(isAuthenticated ? 'TabProfile' : 'Home'));
  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={goBack} />
          <Text style={styles.headerTitle} accessibilityRole="header">Conditions d'utilisation</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.updated}>Dernière mise à jour : {LEGAL.updatedAt}</Text>
          {SECTIONS.map(([title, body], i) => (
            <Accordion key={title} title={title} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)}>{body}</Accordion>
          ))}
          <Text style={styles.contact} onPress={() => Linking.openURL(`mailto:${LEGAL.dpoEmail}`).catch(() => {})} accessibilityRole="link">
            Une question ? {LEGAL.dpoEmail}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  scroll: { padding: 16, gap: 10, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  updated: { fontSize: 12, color: C.textMut, marginBottom: 4 },
  contact: { fontSize: 14, color: C.green, fontWeight: '700', textAlign: 'center', marginTop: 10, paddingVertical: 10 },
});
