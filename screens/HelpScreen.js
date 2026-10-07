/**
 * HelpScreen.js — Easevent · Aide (questions fréquentes + contact)
 */
import React, { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';

import { C, LEGAL, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import Accordion from '../components/ui/Accordion';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/dialog';

const FAQ = [
  { icon: 'calendar-outline', title: 'Créer et publier un événement', items: [
    ['Comment créer un événement ?', "Touchez « Créer » dans la barre du bas et suivez les 5 étapes (informations, date et lieu, photos, style, paramètres). L'événement est créé en brouillon : publiez-le pour pouvoir inviter."],
    ['Public ou privé : quelle différence ?', "Un événement public apparaît dans Découvrir : tout le monde peut le voir et prendre un ticket. Un événement privé n'est visible que par vos invités. Vous pouvez changer à tout moment depuis la page de l'événement."],
    ['Puis-je modifier mon événement après l\'avoir publié ?', "Oui, avec le crayon en haut de la page de l'événement. Si la date, l'heure ou le lieu changent, vos participants sont prévenus automatiquement."],
    ['Comment annuler un événement ?', "Page de l'événement › Supprimer l'événement. Les participants sont prévenus et les tickets payés sont remboursés automatiquement."],
  ] },
  { icon: 'person-add-outline', title: 'Inviter', items: [
    ['Comment inviter mes contacts ?', "Page de l'événement › Inviter des participants : choisissez parmi vos amis Easevent, vos contacts du téléphone, par email ou par SMS. Les personnes sans l'application reçoivent un lien vers leur invitation."],
    ['Combien de personnes puis-je inviter ?', "50 par événement avec le plan Gratuit, 500 avec le plan Standard, sans limite avec le plan Pro."],
    ['Comment savoir qui vient ?', "« Invités & réponses » sur la page de l'événement : confirmés, en attente, déclinés, et les réponses à vos questions RSVP. Vous recevez aussi une notification à chaque réponse."],
  ] },
  { icon: 'ticket-outline', title: 'Tickets et paiements', items: [
    ['Où trouver mon ticket ?', "Onglet Tickets › Générés. Présentez le QR code à l'entrée. Vous pouvez aussi le télécharger en PDF ou l'ajouter à votre calendrier."],
    ['Mon paiement est-il sécurisé ?', "Oui : le paiement se fait sur la page sécurisée de Stripe (carte, Apple Pay, Google Pay). Easevent ne voit jamais vos données bancaires."],
    ['Comment vendre des tickets ?', "Profil › Paiements & virements : activez les paiements avec Stripe (identité et IBAN). L'argent des tickets est ensuite versé sur votre compte bancaire."],
    ['Comment contrôler les tickets à l\'entrée ?', "Page de l'événement › Scanner les tickets : visez le QR code du participant. Un ticket ne peut entrer qu'une fois."],
    ['Je veux être remboursé', "Si l'organisateur annule l'événement, le remboursement est automatique. Sinon, contactez l'organisateur depuis la page de l'événement (bouton « Contacter »)."],
  ] },
  { icon: 'chatbubbles-outline', title: 'Messages et notifications', items: [
    ['Comment écrire à l\'organisateur ?', "Page de l'événement › Contacter. Vous pouvez envoyer du texte, des photos, des captures d'écran et l'itinéraire."],
    ['Je ne reçois pas les notifications', "Vérifiez que les notifications d'Easevent sont autorisées dans les réglages du téléphone, puis dans Profil › Notifications."],
  ] },
  { icon: 'shield-checkmark-outline', title: 'Compte et sécurité', items: [
    ['J\'ai oublié mon mot de passe', "Sur l'écran de connexion, touchez « Mot de passe oublié » : vous recevez un lien valable 1 heure."],
    ['Pourquoi mon numéro de téléphone est-il demandé ?', "Il vous relie aux invitations reçues par SMS. Il est chiffré et n'est jamais montré aux autres membres."],
    ['Comment supprimer mon compte ?', "Profil › Supprimer mon compte. Vos données personnelles sont effacées immédiatement ; vos événements à venir sont annulés."],
  ] },
  { icon: 'star-outline', title: 'Abonnements', items: [
    ['Que m\'apportent les plans Standard et Pro ?', "Des événements illimités (le plan Gratuit en permet 1 par mois), plus d'invités par événement (500 ou illimité) et l'export de la liste des invités. Détails dans Profil › Abonnement."],
    ['Combien d\'événements puis-je créer gratuitement ?', "Un événement par mois, avec jusqu'à 50 invités. La billetterie publique n'est pas limitée par le plan. Une nouvelle place se libère le 1er de chaque mois ; un brouillon supprimé sans avoir été publié rend sa place."],
    ['Comment résilier ?', "Profil › Abonnement › Résilier. Vous gardez votre plan jusqu'à la fin de la période payée, sans autre prélèvement."],
  ] },
];

export default function HelpScreen({ navigation }) {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return FAQ;
    return FAQ.map((g) => ({ ...g, items: g.items.filter(([a, b]) => `${a} ${b}`.toLowerCase().includes(needle)) }))
      .filter((g) => g.items.length);
  }, [q]);

  const contact = () => {
    const version = Application.nativeApplicationVersion || '1.0.0';
    const body = `\n\n—\nEasevent ${version} · ${Platform.OS} ${Platform.Version || ''}${user?.email ? ` · ${user.email}` : ''}`;
    Linking.openURL(`mailto:${LEGAL.dpoEmail}?subject=${encodeURIComponent('Aide Easevent')}&body=${encodeURIComponent(body)}`)
      .catch(() => showAlert('Messagerie indisponible', `Écrivez-nous à ${LEGAL.dpoEmail}.`));
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(isAuthenticated ? 'TabProfile' : 'Home'));

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={goBack} />
          <Text style={styles.headerTitle} accessibilityRole="header">Aide</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.search}>
            <Ionicons name="search-outline" size={18} color={C.textMut} />
            <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Rechercher une question"
              placeholderTextColor={C.textFaint} accessibilityLabel="Rechercher dans l'aide" />
          </View>
          {groups.map((g) => (
            <View key={g.title} style={{ gap: 8 }}>
              <View style={styles.groupHead}>
                <Ionicons name={g.icon} size={16} color={C.green} />
                <Text style={styles.groupTitle} accessibilityRole="header">{g.title}</Text>
              </View>
              {g.items.map(([question, answer]) => {
                const id = `${g.title}:${question}`;
                return (
                  <Accordion key={id} title={question} open={open === id || !!q.trim()} onToggle={() => setOpen(open === id ? null : id)}>
                    {answer}
                  </Accordion>
                );
              })}
            </View>
          ))}
          {!groups.length ? <Text style={styles.empty}>Aucune réponse trouvée. Écrivez-nous, nous répondons vite.</Text> : null}

          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>Besoin d'un coup de main ?</Text>
            <Text style={styles.contactTxt}>Notre équipe répond par email, en général dans la journée.</Text>
            <Pressable onPress={contact} style={styles.contactBtn} accessibilityRole="button">
              <Ionicons name="mail-outline" size={18} color={C.white} />
              <Text style={styles.contactBtnTxt}>Contacter le support</Text>
            </Pressable>
          </View>
          <View style={styles.links}>
            <Text style={styles.link} onPress={() => navigation.navigate('Terms')} accessibilityRole="link">Conditions d'utilisation</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.link} onPress={() => navigation.navigate('PrivacyPolicy')} accessibilityRole="link">Confidentialité</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  scroll: { padding: 16, gap: 18, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, minHeight: 50 },
  searchInput: { flex: 1, fontSize: 15, color: C.text, minHeight: 48 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { fontSize: 13, fontWeight: '800', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { fontSize: 14, color: C.textSub, textAlign: 'center' },
  contactCard: { backgroundColor: C.green, borderRadius: 20, padding: 18, gap: 8 },
  contactTitle: { fontSize: 17, fontWeight: '900', color: C.white },
  contactTxt: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: TOUCH + 4, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 4 },
  contactBtnTxt: { fontSize: 15, fontWeight: '800', color: C.white },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  link: { fontSize: 13, color: C.green, fontWeight: '700', paddingVertical: 8 },
  dot: { fontSize: 13, color: C.textMut, paddingVertical: 8 },
});
