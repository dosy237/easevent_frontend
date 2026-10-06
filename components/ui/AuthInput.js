/**
 * components/ui/AuthInput.js — champ de saisie des écrans de compte.
 * Même rendu que InputField de LoginScreen, avec un libellé accessible
 * et l'annonce des erreurs.
 */
import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, TOUCH } from '../../constants/theme';

const AuthInput = forwardRef(function AuthInput({
  icon, label, value, onChangeText, error, secureEntry = false,
  keyboardType = 'default', autoCapitalize = 'none', autoComplete, textContentType,
  returnKeyType, onSubmitEditing, editable = true, maxLength,
}, ref) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, focused && styles.boxFocused, !!error && styles.boxError, !editable && styles.boxReadonly]}>
        <Ionicons name={icon} size={18} color={focused ? C.green : C.textFaint} style={styles.icon} />
        <TextInput
          ref={ref}
          style={styles.input}
          placeholder={label}
          placeholderTextColor={C.textFaint}
          accessibilityLabel={label}
          aria-invalid={!!error}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureEntry && (
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            hitSlop={8}
            style={styles.eye}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMut} />
          </Pressable>
        )}
      </View>
      {error ? (
        <View style={styles.err} accessibilityLiveRegion="polite" aria-live="polite">
          <Ionicons name="alert-circle-outline" size={12} color={C.errorText} />
          <Text style={styles.errTxt}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
});

export default AuthInput;

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  box: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.inputBg, paddingHorizontal: 16, height: 60,
  },
  boxFocused: { borderColor: C.green, backgroundColor: C.white },
  boxError: { borderColor: C.error, backgroundColor: C.errorBg },
  boxReadonly: { opacity: 0.75 },
  icon: { marginRight: 12 },
  input: { flex: 1, color: C.text, fontSize: 16, fontWeight: '500', height: '100%', outlineStyle: 'none' },
  eye: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  err: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingLeft: 4 },
  errTxt: { color: C.errorText, fontSize: 12 },
});
