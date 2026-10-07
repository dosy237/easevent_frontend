/**
 * components/ui/NotificationBell.js — cloche avec le nombre de
 * notifications non lues (M17). Le nombre est annoncé au lecteur d'écran.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';
import { useTicketBadge } from '../../context/TicketBadgeContext';

export const bellLabel = (count) =>
  (count > 0 ? `Notifications, ${count} non lue${count > 1 ? 's' : ''}` : 'Notifications');

export const messagesLabel = (count) =>
  (count > 0 ? `Messages, ${count} non lu${count > 1 ? 's' : ''}` : 'Messages');

// Bulle de la messagerie (M15) avec le nombre de messages non lus
export function MessagesBubble({ size = 20 }) {
  const { messages } = useTicketBadge();
  return <IconCount name="chatbubble-ellipses-outline" size={size} count={messages} />;
}

export default function NotificationBell({ size = 22, enabled = true }) {
  const { notifications } = useTicketBadge();
  const count = enabled ? notifications : 0;
  return <IconCount name={count > 0 ? 'notifications' : 'notifications-outline'} size={size} count={count} />;
}

function IconCount({ name, size, count }) {
  return (
    <View>
      <Ionicons name={name} size={size} color={C.text} />
      {count > 0 && (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeTxt}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white,
  },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: C.white },
});
