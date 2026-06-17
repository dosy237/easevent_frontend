/**
 * CreateEventScreen.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Formulaire multi-étapes de création d'événement.
 *
 * 5 étapes :
 * 1. Informations de base  (titre, type, description)
 * 2. Date et lieu          (calendrier + horloge natifs, adresse)
 * 3. Images                (cover + 2 photos galerie → Cloudinary)
 * 4. Personnalisation      (ambiance, couleurs principales)
 * 5. Paramètres            (visibilité, nombre de places, prix)
 *
 * À la fin → POST /api/events/create/ → Dashboard
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Animated, Platform, Alert,
  ActivityIndicator, Image, KeyboardAvoidingView, Modal,
} from 'react-native';

import { SafeAreaView }     from 'react-native-safe-area-context';
import { Ionicons }         from '@expo/vector-icons';
import * as ImagePicker     from 'expo-image-picker';
import DateTimePicker       from '@react-native-community/datetimepicker';
import { useAuth }          from '../context/AuthContext';

import eventService from '../services/eventService';
// ─────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────
const C = {
  green:      '#1B6B4A',
  greenDark:  '#155C3C',
  greenLight: '#E8F5EE',
  orange:     '#E76F51',
  orangeL:    '#FFF0EB',
  white:      '#FFFFFF',
  bg:         '#F7F7F7',
  text:       '#1A1A1A',
  textSub:    '#555555',
  textMut:    '#9E9E9E',
  border:     '#E8E8E8',
  error:      '#E53E3E',
};

// ─────────────────────────────────────────────────────────────────
// TYPES D'ÉVÉNEMENT
// ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { value: 'mariage',      label: 'Mariage',      icon: 'heart' },
  { value: 'conference',   label: 'Conférence',   icon: 'mic' },
  { value: 'anniversaire', label: 'Anniversaire', icon: 'gift' },
  { value: 'soiree',       label: 'Soirée',       icon: 'musical-notes' },
  { value: 'concert',      label: 'Concert',      icon: 'headset' },
  { value: 'autre',        label: 'Autre',        icon: 'calendar' },
];

// ─────────────────────────────────────────────────────────────────
// AMBIANCES
// ─────────────────────────────────────────────────────────────────
const AMBIANCES = [
  { value: 'elegant',       label: 'Élégant',       color: '#C4A882' },
  { value: 'festif',        label: 'Festif',        color: '#E76F51' },
  { value: 'minimaliste',   label: 'Minimaliste',   color: '#555555' },
  { value: 'colore',        label: 'Coloré',        color: '#9B59B6' },
  { value: 'professionnel', label: 'Professionnel', color: '#1B6B4A' },
];

// ─────────────────────────────────────────────────────────────────
// PALETTES DE COULEURS PAR AMBIANCE
// ─────────────────────────────────────────────────────────────────
const COLOR_PALETTES = {
  elegant:       ['#C4A882', '#2C3E50', '#ECF0F1', '#8E7057', '#1A252F'],
  festif:        ['#E76F51', '#F4A261', '#264653', '#2A9D8F', '#E9C46A'],
  minimaliste:   ['#2D3436', '#636E72', '#B2BEC3', '#DFE6E9', '#FFFFFF'],
  colore:        ['#9B59B6', '#3498DB', '#2ECC71', '#F39C12', '#E74C3C'],
  professionnel: ['#1B6B4A', '#2C3E50', '#3498DB', '#ECF0F1', '#95A5A6'],
};

const TOTAL_STEPS = 5;

// ─────────────────────────────────────────────────────────────────
// FONCTION UTILITAIRE : formater une date en texte lisible
// Date → "Samedi 15 septembre 2026 à 18h00"
// ─────────────────────────────────────────────────────────────────
const formatDateDisplay = (date) => {
  if (!date) return null;
  const jours  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const mois   = ['janvier','février','mars','avril','mai','juin',
                  'juillet','août','septembre','octobre','novembre','décembre'];
  const j  = jours[date.getDay()];
  const d  = date.getDate();
  const m  = mois[date.getMonth()];
  const y  = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${j} ${d} ${m} ${y} à ${hh}h${mm}`;
};

// ─────────────────────────────────────────────────────────────────
// FONCTION UTILITAIRE : formater une date pour l'API Django
// Date → "2026-09-15T18:00:00"
// ─────────────────────────────────────────────────────────────────
const formatDateISO = (date) => {
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : StepIndicator
// Barre de progression colorée en haut du formulaire.
// vert = étape complétée, orange = étape active, gris = à venir
// ════════════════════════════════════════════════════════════════
const StepIndicator = ({ currentStep, total }) => (
  <View style={styles.stepIndicator}>
    {Array.from({ length: total }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.stepDot,
          i < currentStep - 1  && styles.stepDotDone,
          i === currentStep - 1 && styles.stepDotActive,
        ]}
      />
    ))}
  </View>
);

// ════════════════════════════════════════════════════════════════
// COMPOSANT : InputField
// Champ de saisie stylisé avec label, icône et gestion d'erreur.
// ════════════════════════════════════════════════════════════════
const InputField = ({
  label, icon, value, onChangeText,
  placeholder, multiline = false,
  keyboardType = 'default', maxLength, error,
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      {label && <Text style={styles.fieldLabel}>{label}</Text>}
      <View style={[
        styles.fieldBox,
        focused && styles.fieldBoxFocused,
        error  && styles.fieldBoxError,
      ]}>
        {icon && (
          <Ionicons name={icon} size={18}
            color={focused ? C.green : C.textMut}
            style={styles.fieldIcon}
          />
        )}
        <TextInput
          style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textMut}
          multiline={multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="sentences"
          autoCorrect={false}
        />
        {maxLength && (
          <Text style={styles.charCount}>{value?.length || 0}/{maxLength}</Text>
        )}
      </View>
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : DatePickerField
// Sélecteur de date et heure natif du téléphone.
// Affiche un bouton qui ouvre le calendrier puis l'horloge.
// Sur Android : deux étapes (date puis heure).
// Sur iOS     : un seul picker mode datetime.
//
// Props :
// - label    : étiquette du champ
// - date     : objet Date sélectionné (ou null)
// - onChange : fonction appelée avec la nouvelle date
// - minDate  : date minimum autorisée
// - error    : message d'erreur
// ════════════════════════════════════════════════════════════════
const DatePickerField = ({ label, date, onChange, minDate, error }) => {
  // showPicker : contrôle l'affichage du picker natif
  const [showPicker, setShowPicker] = useState(false);

  // mode : 'date' d'abord, puis 'time' sur Android
  // Sur Android le picker ne supporte qu'un mode à la fois
  const [mode, setMode] = useState('date');

  // tempDate : stocke temporairement la date pendant la sélection
  // sur iOS avant confirmation
  const [tempDate, setTempDate] = useState(date || new Date());

  // handleChange : appelé par le DateTimePicker à chaque sélection
  const handleChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      // L'utilisateur a annulé
      setShowPicker(false);
      return;
    }

    const current = selectedDate || tempDate;

    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (mode === 'date') {
        // Sur Android : après la date, ouvrir l'heure
        setTempDate(current);
        setMode('time');
        setTimeout(() => setShowPicker(true), 150);
      } else {
        // Après l'heure : on a la date complète
        onChange(current);
        setMode('date'); // Réinitialiser pour la prochaine fois
      }
    } else {
      // Sur iOS : mise à jour en temps réel
      setTempDate(current);
    }
  };

  // Confirmer sur iOS (bouton "Valider")
  const handleIOSConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  return (
    <View style={styles.fieldWrap}>
      {label && <Text style={styles.fieldLabel}>{label}</Text>}

      {/* Bouton qui affiche la date sélectionnée ou un placeholder */}
      <TouchableOpacity
        style={[styles.dateBtn, error && styles.fieldBoxError]}
        onPress={() => {
          setTempDate(date || new Date());
          setMode('date');
          setShowPicker(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="calendar-outline" size={18} color={date ? C.green : C.textMut} />
        <Text style={[styles.dateBtnTxt, !date && styles.datePlaceholder]}>
          {date ? formatDateDisplay(date) : 'Choisir une date et une heure'}
        </Text>
        <Ionicons name="chevron-forward-outline" size={16} color={C.textMut} />
      </TouchableOpacity>

      {error && <Text style={styles.fieldError}>{error}</Text>}

      {/* DateTimePicker Android — affiché directement */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode={mode}
          display="default"
          onChange={handleChange}
          minimumDate={minDate}
          locale="fr-FR"
        />
      )}

      {/* DateTimePicker iOS — dans un Modal avec bouton Valider */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
        >
          <View style={styles.iosPickerOverlay}>
            <View style={styles.iosPickerContainer}>

              {/* Barre de titre du modal */}
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.iosPickerCancel}>Annuler</Text>
                </TouchableOpacity>
                <Text style={styles.iosPickerTitle}>Choisir la date</Text>
                <TouchableOpacity onPress={handleIOSConfirm}>
                  <Text style={styles.iosPickerConfirm}>Valider</Text>
                </TouchableOpacity>
              </View>

              {/* Picker iOS natif — mode datetime = calendrier + horloge en un seul composant */}
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={handleChange}
                minimumDate={minDate}
                locale="fr-FR"
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// COMPOSANT : ImageUploadCard
// Card pour uploader une image vers Cloudinary.
// Affiche un aperçu de l'image après sélection + statut d'upload.
// ════════════════════════════════════════════════════════════════
const ImageUploadCard = ({ label, imageUri, imageUrl, onPick, uploading }) => (
  <View style={styles.imageCard}>
    <Text style={styles.imageCardLabel}>{label}</Text>
    {imageUri ? (
      <TouchableOpacity onPress={onPick} activeOpacity={0.85} style={{ position: 'relative' }}>
        <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
        <View style={styles.imageOverlay}>
          {uploading ? (
            <>
              <ActivityIndicator size="small" color={C.white} />
              <Text style={styles.imageOverlayTxt}>Upload en cours...</Text>
            </>
          ) : (
            <>
              <Ionicons name={imageUrl ? 'checkmark-circle' : 'cloud-upload-outline'} size={20}
                color={imageUrl ? '#2ECC71' : C.white} />
              <Text style={styles.imageOverlayTxt}>
                {imageUrl ? 'Uploadée ✓  — Appuyer pour changer' : 'Upload en attente...'}
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity style={styles.imagePicker} onPress={onPick} activeOpacity={0.8}>
        <Ionicons name="cloud-upload-outline" size={32} color={C.green} />
        <Text style={styles.imagePickerTxt}>Choisir une photo</Text>
        <Text style={styles.imagePickerSub}>JPG, PNG — max 10 Mo</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ════════════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL : CreateEventScreen
// ════════════════════════════════════════════════════════════════
export default function CreateEventScreen({ navigation }) {

  const { accessToken } = useAuth();

  // ── Étape actuelle ────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Étape 1 : Informations de base ───────────────────────────
  const [title,       setTitle]       = useState('');
  const [eventType,   setEventType]   = useState('');
  const [description, setDescription] = useState('');

  // ── Étape 2 : Date et lieu ────────────────────────────────────
  // startDate et endDate sont des objets Date JavaScript (pas des strings)
  // On les convertit en ISO string uniquement au moment d'envoyer à l'API
  const [startDate,       setStartDate]       = useState(null);
  const [endDate,         setEndDate]         = useState(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [isOnline,        setIsOnline]        = useState(false);
  const [onlineLink,      setOnlineLink]      = useState('');

  // ── Étape 3 : Images ─────────────────────────────────────────
  const [coverImageUri,  setCoverImageUri]  = useState(null);
  const [coverImageUrl,  setCoverImageUrl]  = useState(null);
  const [gallery1Uri,    setGallery1Uri]    = useState(null);
  const [gallery1Url,    setGallery1Url]    = useState(null);
  const [gallery2Uri,    setGallery2Uri]    = useState(null);
  const [gallery2Url,    setGallery2Url]    = useState(null);
  const [uploadingCover,    setUploadingCover]    = useState(false);
  const [uploadingGallery1, setUploadingGallery1] = useState(false);
  const [uploadingGallery2, setUploadingGallery2] = useState(false);

  // ── Étape 4 : Style ──────────────────────────────────────────
  const [ambiance,       setAmbiance]       = useState('');
  const [primaryColor,   setPrimaryColor]   = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');

  // ── Étape 5 : Paramètres ─────────────────────────────────────
  const [visibility, setVisibility] = useState('public');
  const [maxGuests,  setMaxGuests]  = useState('');
  const [isPaid,     setIsPaid]     = useState(false);
  const [price,      setPrice]      = useState('');

  // ── UI ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [errors,     setErrors]     = useState({});

  // ── Transitions animées entre étapes ─────────────────────────
  const transitionToStep = (newStep) => {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(() => {
      setStep(newStep);
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    });
  };


  // ── Upload image vers Cloudinary ──────────────────────────────
  // 1. Demande permission galerie
  // 2. Ouvre le sélecteur natif
  // 3. Envoie en base64 à notre endpoint Django
  // 4. Django upload sur Cloudinary et retourne l'URL publique
  const pickAndUploadImage = async (imageName, setUri, setUrl, setUploading) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisez l\'accès à votre galerie dans les paramètres.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:    ['images'],
        allowsEditing: true,
        quality:       0.8,
        base64:        true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      setUri(asset.uri);        // Aperçu local immédiat
      setUploading(true);

      const base64Data = `data:image/jpeg;base64,${asset.base64}`;

      try {
        const data = await eventService.uploadImage(base64Data, imageName);
        setUrl(data.url);
      } catch (err) {
        Alert.alert('Erreur', 'Impossible d\'uploader l\'image. Réessayez.');
        setUri(null);
      }
    } catch (err) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'upload.');
      console.error('Erreur upload:', err);
    } finally {
      setUploading(false);
    }
  };

  // ── Validation par étape ──────────────────────────────────────
  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (!title.trim())       e.title       = 'Le titre est obligatoire';
      if (!eventType)          e.eventType   = 'Choisissez un type d\'événement';
      if (!description.trim()) e.description = 'Ajoutez une description';
    }
    if (step === 2) {
      if (!startDate) e.startDate = 'Choisissez une date de début';
      if (!endDate)   e.endDate   = 'Choisissez une date de fin';
      if (startDate && endDate && endDate <= startDate) {
        e.endDate = 'La fin doit être après le début';
      }
      if (!isOnline && !locationAddress.trim()) {
        e.locationAddress = 'Ajoutez une adresse ou cochez "En ligne"';
      }
    }
    if (step === 3) {
      if (!coverImageUrl) e.coverImage = 'La photo de couverture est obligatoire';
    }
    if (step === 4) {
      if (!ambiance) e.ambiance = 'Choisissez une ambiance';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS) transitionToStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 1) transitionToStep(step - 1);
    else navigation?.goBack();
  };

  // ── Soumission finale → création de l'événement ───────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const palette = primaryColor ? {
        primary:   primaryColor,
        secondary: secondaryColor || primaryColor,
      } : null;

      const template_config = {
        cover_image: coverImageUrl,
        gallery:     [gallery1Url, gallery2Url].filter(Boolean),
        ambiance, palette,
        max_guests:  maxGuests ? parseInt(maxGuests) : null,
        is_paid:     isPaid,
        price:       isPaid && price ? parseFloat(price) : null,
      };

      await eventService.createEvent({
        title,
        event_type:       eventType,
        description,
        start_date:       formatDateISO(startDate),
        end_date:         formatDateISO(endDate),
        location_address: locationAddress,
        is_online:        isOnline,
        online_link:      onlineLink || null,
        cover_image:      coverImageUrl,
        ambiance, palette, visibility, template_config,
      });

      Alert.alert(
        '🎉 Événement créé !',
        `"${title}" a été créé avec succès. Rendez-vous sur votre tableau de bord pour le personnaliser.`,
        [{
          text: 'Voir mon tableau de bord',
          onPress: () => navigation?.reset({
             index: 0,
             routes: [{ name: 'TabDashboard' }],
          }),
        }]
      );
    } catch (err) {
      const detail = err.response?.data?.detail || 'Vérifiez votre connexion et réessayez.';
      Alert.alert('Erreur', detail);
      console.error('Erreur création:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ['Informations', 'Date & Lieu', 'Photos', 'Style', 'Paramètres'];

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 1 — Informations de base
  // ════════════════════════════════════════════════════════════
  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Informations de base</Text>
      <Text style={styles.stepSub}>Commençons par les informations essentielles de votre événement.</Text>

      <InputField
        label="Titre de l'événement *"
        icon="text-outline"
        value={title}
        onChangeText={setTitle}
        placeholder="Ex: Notre Mariage, Soirée Annuelle..."
        maxLength={100}
        error={errors.title}
      />

      <Text style={styles.fieldLabel}>Type d'événement *</Text>
      {errors.eventType && <Text style={styles.fieldError}>{errors.eventType}</Text>}
      <View style={styles.typeGrid}>
        {EVENT_TYPES.map(t => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeCard, eventType === t.value && styles.typeCardActive]}
            onPress={() => setEventType(t.value)}
            activeOpacity={0.8}
          >
            <Ionicons name={t.icon} size={22} color={eventType === t.value ? C.white : C.green} />
            <Text style={[styles.typeCardLabel, eventType === t.value && { color: C.white }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <InputField
        label="Description *"
        icon="document-text-outline"
        value={description}
        onChangeText={setDescription}
        placeholder="Décrivez votre événement — ambiance, programme, dress code..."
        multiline
        maxLength={500}
        error={errors.description}
      />
    </View>
  );

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 2 — Date et lieu (avec calendrier + horloge natifs)
  // ════════════════════════════════════════════════════════════
  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Date et Lieu</Text>
      <Text style={styles.stepSub}>
        Appuyez sur les champs ci-dessous pour choisir vos dates avec le calendrier de votre téléphone.
      </Text>

      {/* Sélecteur de date de début */}
      <DatePickerField
        label="Date et heure de début *"
        date={startDate}
        onChange={setStartDate}
        minDate={new Date()}
        error={errors.startDate}
      />

      {/* Sélecteur de date de fin */}
      <DatePickerField
        label="Date et heure de fin *"
        date={endDate}
        onChange={setEndDate}
        minDate={startDate || new Date()}
        error={errors.endDate}
      />

      {/* Indicateur visuel de la durée */}
      {startDate && endDate && endDate > startDate && (
        <View style={styles.durationBadge}>
          <Ionicons name="time-outline" size={16} color={C.green} />
          <Text style={styles.durationTxt}>
            Durée : {Math.round((endDate - startDate) / 3600000 * 10) / 10} heure(s)
          </Text>
        </View>
      )}

      {/* Toggle : événement en ligne */}
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.toggleLabel}>Événement en ligne</Text>
          <Text style={styles.toggleSub}>Webinaire, réunion virtuelle, livestream...</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggle, isOnline && styles.toggleActive]}
          onPress={() => setIsOnline(!isOnline)}
        >
          <View style={[styles.toggleThumb, isOnline && styles.toggleThumbActive]} />
        </TouchableOpacity>
      </View>

      {/* Adresse ou lien selon le type */}
      {!isOnline ? (
        <InputField
          label="Adresse du lieu *"
          icon="location-outline"
          value={locationAddress}
          onChangeText={setLocationAddress}
          placeholder="Ex: Château de Versailles, 78000 Versailles"
          error={errors.locationAddress}
        />
      ) : (
        <InputField
          label="Lien de la réunion"
          icon="link-outline"
          value={onlineLink}
          onChangeText={setOnlineLink}
          placeholder="https://zoom.us/j/..."
          keyboardType="url"
        />
      )}
    </View>
  );

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 3 — Photos
  // ════════════════════════════════════════════════════════════
  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Photos de l'événement</Text>
      <Text style={styles.stepSub}>
        Ajoutez jusqu'à 3 photos. Elles seront utilisées pour votre mini-site et vos invitations digitales.
      </Text>

      {errors.coverImage && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={C.error} />
          <Text style={styles.errorBannerTxt}>{errors.coverImage}</Text>
        </View>
      )}

      <ImageUploadCard
        label="Photo de couverture *"
        imageUri={coverImageUri}
        imageUrl={coverImageUrl}
        uploading={uploadingCover}
        onPick={() => pickAndUploadImage('cover', setCoverImageUri, setCoverImageUrl, setUploadingCover)}
      />
      <ImageUploadCard
        label="Photo galerie 1 (optionnelle)"
        imageUri={gallery1Uri}
        imageUrl={gallery1Url}
        uploading={uploadingGallery1}
        onPick={() => pickAndUploadImage('gallery_1', setGallery1Uri, setGallery1Url, setUploadingGallery1)}
      />
      <ImageUploadCard
        label="Photo galerie 2 (optionnelle)"
        imageUri={gallery2Uri}
        imageUrl={gallery2Url}
        uploading={uploadingGallery2}
        onPick={() => pickAndUploadImage('gallery_2', setGallery2Uri, setGallery2Url, setUploadingGallery2)}
      />
    </View>
  );

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 4 — Style et personnalisation
  // ════════════════════════════════════════════════════════════
  const renderStep4 = () => (
    <View>
      <Text style={styles.stepTitle}>Style de votre événement</Text>
      <Text style={styles.stepSub}>
        Ces choix définissent l'identité visuelle de votre mini-site et de vos invitations.
      </Text>

      <Text style={styles.fieldLabel}>Ambiance *</Text>
      {errors.ambiance && <Text style={styles.fieldError}>{errors.ambiance}</Text>}
      <View style={styles.ambianceGrid}>
        {AMBIANCES.map(a => (
          <TouchableOpacity
            key={a.value}
            style={[
              styles.ambianceCard,
              { borderColor: a.color },
              ambiance === a.value && { backgroundColor: a.color },
            ]}
            onPress={() => {
              setAmbiance(a.value);
              const p = COLOR_PALETTES[a.value];
              if (p) { setPrimaryColor(p[0]); setSecondaryColor(p[1]); }
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.ambianceLabel, ambiance === a.value && { color: C.white, fontWeight: '800' }]}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {ambiance && COLOR_PALETTES[ambiance] && (
        <View style={styles.paletteSection}>
          <Text style={styles.fieldLabel}>Couleur principale</Text>
          <View style={styles.colorRow}>
            {COLOR_PALETTES[ambiance].map(color => (
              <TouchableOpacity
                key={color}
                style={[styles.colorDot, { backgroundColor: color }, primaryColor === color && styles.colorDotSelected]}
                onPress={() => setPrimaryColor(color)}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Couleur secondaire</Text>
          <View style={styles.colorRow}>
            {COLOR_PALETTES[ambiance].map(color => (
              <TouchableOpacity
                key={color}
                style={[styles.colorDot, { backgroundColor: color }, secondaryColor === color && styles.colorDotSelected]}
                onPress={() => setSecondaryColor(color)}
              />
            ))}
          </View>

          {primaryColor && secondaryColor && (
            <View style={styles.colorPreview}>
              <View style={[styles.colorPreviewBar, { backgroundColor: primaryColor }]} />
              <View style={[styles.colorPreviewBar, { backgroundColor: secondaryColor }]} />
              <Text style={styles.colorPreviewTxt}>Aperçu de votre palette</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  // ════════════════════════════════════════════════════════════
  // ÉTAPE 5 — Paramètres
  // ════════════════════════════════════════════════════════════
  const renderStep5 = () => (
    <View>
      <Text style={styles.stepTitle}>Paramètres</Text>
      <Text style={styles.stepSub}>Dernière étape — définissez l'accès et les options de votre événement.</Text>

      <Text style={styles.fieldLabel}>Visibilité</Text>
      <View style={styles.visibilityRow}>
        {[
          { value: 'public',  label: 'Public',  icon: 'earth-outline',       desc: 'Visible par tous' },
          { value: 'private', label: 'Privé',   icon: 'lock-closed-outline', desc: 'Sur invitation uniquement' },
        ].map(v => (
          <TouchableOpacity
            key={v.value}
            style={[styles.visibilityCard, visibility === v.value && styles.visibilityCardActive]}
            onPress={() => setVisibility(v.value)}
            activeOpacity={0.8}
          >
            <Ionicons name={v.icon} size={24} color={visibility === v.value ? C.white : C.green} />
            <Text style={[styles.visibilityLabel, visibility === v.value && { color: C.white }]}>{v.label}</Text>
            <Text style={[styles.visibilityDesc, visibility === v.value && { color: 'rgba(255,255,255,0.8)' }]}>{v.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <InputField
        label="Nombre de places (optionnel)"
        icon="people-outline"
        value={maxGuests}
        onChangeText={setMaxGuests}
        placeholder="Laissez vide = illimité"
        keyboardType="numeric"
      />
      {maxGuests !== '' && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color={C.green} />
          <Text style={styles.infoCardTxt}>
            Une liste d'attente sera activée automatiquement dès que les {maxGuests} places seront épuisées.
          </Text>
        </View>
      )}

      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.toggleLabel}>Événement payant</Text>
          <Text style={styles.toggleSub}>Activez pour vendre des billets</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggle, isPaid && styles.toggleActive]}
          onPress={() => setIsPaid(!isPaid)}
        >
          <View style={[styles.toggleThumb, isPaid && styles.toggleThumbActive]} />
        </TouchableOpacity>
      </View>

      {isPaid && (
        <InputField
          label="Prix du billet (€)"
          icon="card-outline"
          value={price}
          onChangeText={setPrice}
          placeholder="Ex: 25.00"
          keyboardType="decimal-pad"
        />
      )}

      {/* Récapitulatif final */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Récapitulatif</Text>
        {[
          { icon: 'text-outline',     value: title },
          { icon: 'calendar-outline', value: startDate ? formatDateDisplay(startDate) : '—' },
          { icon: 'time-outline',     value: endDate   ? formatDateDisplay(endDate)   : '—' },
          { icon: 'location-outline', value: isOnline ? 'En ligne' : locationAddress || '—' },
          { icon: visibility === 'public' ? 'earth-outline' : 'lock-closed-outline',
            value: visibility === 'public' ? 'Public' : 'Privé' },
          { icon: 'ticket-outline',   value: isPaid ? `${price || '?'} € / personne` : 'Gratuit' },
        ].map((row, i) => (
          <View key={i} style={styles.summaryRow}>
            <Ionicons name={row.icon} size={14} color={C.green} />
            <Text style={styles.summaryTxt} numberOfLines={1}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back-outline" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Créer un événement</Text>
            <Text style={styles.headerStep}>
              Étape {step}/{TOTAL_STEPS} — {stepLabels[step - 1]}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Barre de progression */}
        <StepIndicator currentStep={step} total={TOTAL_STEPS} />

        {/* Contenu */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollPad}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ opacity: fadeAnim }}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
              {step === 5 && renderStep5()}
            </Animated.View>
            <View style={{ height: 120 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer avec bouton */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, submitting && { opacity: 0.7 }]}
            onPress={handleNext}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <>
                <Text style={styles.nextBtnTxt}>
                  {step === TOTAL_STEPS ? 'Créer mon événement' : 'Continuer'}
                </Text>
                <Ionicons
                  name={step === TOTAL_STEPS ? 'checkmark-outline' : 'arrow-forward-outline'}
                  size={18} color={C.white}
                />
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.stepCounter}>{step} sur {TOTAL_STEPS}</Text>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: C.text },
  headerStep:   { fontSize: 12, color: C.textMut, marginTop: 2 },

  stepIndicator: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12,
    gap: 6, backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  stepDot:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  stepDotDone:   { backgroundColor: C.green },
  stepDotActive: { backgroundColor: C.orange },

  scroll:    { flex: 1, backgroundColor: C.bg },
  scrollPad: { padding: 20 },

  stepTitle: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 6 },
  stepSub:   { fontSize: 14, color: C.textSub, lineHeight: 20, marginBottom: 24 },

  // InputField
  fieldWrap:  { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13, fontWeight: '700', color: C.textSub,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  fieldBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F9F9', borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: C.border, minHeight: 52,
  },
  fieldBoxFocused: { borderColor: C.green, backgroundColor: C.white },
  fieldBoxError:   { borderColor: C.error },
  fieldIcon:       { marginRight: 10 },
  fieldInput:      { flex: 1, fontSize: 15, color: C.text, padding: 0, paddingVertical: 14 },
  fieldInputMulti: { minHeight: 100, textAlignVertical: 'top' },
  charCount:       { fontSize: 11, color: C.textMut },
  fieldError:      { fontSize: 12, color: C.error, marginTop: 4, fontWeight: '500' },

  // DatePickerField
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9F9F9', borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 16, borderWidth: 1.5, borderColor: C.border,
    marginBottom: 4,
  },
  dateBtnTxt:     { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
  datePlaceholder:{ color: C.textMut, fontWeight: '400' },

  // iOS DatePicker Modal
  iosPickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  iosPickerContainer: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  iosPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iosPickerTitle:   { fontSize: 16, fontWeight: '700', color: C.text },
  iosPickerCancel:  { fontSize: 15, color: C.textMut },
  iosPickerConfirm: { fontSize: 15, color: C.green, fontWeight: '700' },
  iosPicker:        { height: 220 },

  // Durée badge
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.greenLight, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 16, borderWidth: 1, borderColor: '#C5E8D3',
    alignSelf: 'flex-start',
  },
  durationTxt: { fontSize: 13, color: C.green, fontWeight: '600' },

  // Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: C.border,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  toggleSub:   { fontSize: 12, color: C.textMut, marginTop: 2 },
  toggle: {
    width: 50, height: 28, borderRadius: 14,
    backgroundColor: C.border, padding: 2, justifyContent: 'center',
  },
  toggleActive:      { backgroundColor: C.green },
  toggleThumb: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: C.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },

  // Types
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white,
  },
  typeCardActive: { backgroundColor: C.green, borderColor: C.green },
  typeCardLabel:  { fontSize: 14, fontWeight: '600', color: C.text },

  // Images
  imageCard:      { marginBottom: 16 },
  imageCardLabel: {
    fontSize: 13, fontWeight: '700', color: C.textSub,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  imagePreview: { width: '100%', height: 180, borderRadius: 14 },
  imageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 10,
  },
  imageOverlayTxt: { color: C.white, fontSize: 13, fontWeight: '600' },
  imagePicker: {
    height: 140, borderRadius: 14,
    borderWidth: 2, borderColor: C.green, borderStyle: 'dashed',
    backgroundColor: C.greenLight,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  imagePickerTxt: { fontSize: 15, fontWeight: '700', color: C.green },
  imagePickerSub: { fontSize: 12, color: C.textMut },

  // Ambiance
  ambianceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  ambianceCard: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 2, backgroundColor: C.white,
  },
  ambianceLabel: { fontSize: 14, fontWeight: '600', color: C.text },

  // Couleurs
  paletteSection: { marginBottom: 16 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected: { borderColor: C.text, transform: [{ scale: 1.2 }] },
  colorPreview: {
    flexDirection: 'row', borderRadius: 12, overflow: 'hidden', height: 48,
  },
  colorPreviewBar: { flex: 1, height: '100%' },
  colorPreviewTxt: {
    position: 'absolute', alignSelf: 'center', width: '100%',
    textAlign: 'center', fontSize: 12, color: C.white, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Visibilité
  visibilityRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  visibilityCard: {
    flex: 1, alignItems: 'center', padding: 16, borderRadius: 16,
    borderWidth: 2, borderColor: C.border, backgroundColor: C.white, gap: 6,
  },
  visibilityCardActive: { backgroundColor: C.green, borderColor: C.green },
  visibilityLabel:      { fontSize: 15, fontWeight: '800', color: C.text },
  visibilityDesc:       { fontSize: 11, color: C.textMut, textAlign: 'center' },

  // Info card
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: C.greenLight, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#C5E8D3', marginBottom: 16, marginTop: -8,
  },
  infoCardTxt: { fontSize: 13, color: C.green, flex: 1, lineHeight: 18 },

  // Récapitulatif
  summaryCard: {
    backgroundColor: C.greenLight, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#C5E8D3', marginTop: 8,
  },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: C.green, marginBottom: 10 },
  summaryRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  summaryTxt:   { fontSize: 13, color: C.textSub, flex: 1 },

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF5F5', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 16,
  },
  errorBannerTxt: { fontSize: 13, color: C.error, flex: 1 },

  // Footer
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, gap: 8,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.green, borderRadius: 16, paddingVertical: 16,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  nextBtnTxt:  { color: C.white, fontSize: 16, fontWeight: '800' },
  stepCounter: { textAlign: 'center', fontSize: 12, color: C.textMut },
});