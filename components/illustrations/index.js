/**
 * components/illustrations — Easevent
 * Logo et illustrations des maquettes « Easevent — Écrans MVP ».
 * Les fichiers SVG sont hébergés sur le backend (static/app/) et
 * chargés à la demande : aucune image n'est embarquée dans l'APK.
 */
import React from 'react';

import RemoteSvg from '../ui/RemoteSvg';

// Symbole « calendrier + flèche » (planche Logo & identité)
export function LogoMark({ size = 64, simplified = false }) {
  return (
    <RemoteSvg
      path={simplified ? 'logo-small.svg' : 'logo.svg'}
      width={size}
      height={size}
      accessibilityLabel="Easevent"
    />
  );
}

// M03 — enveloppe ouverte avec lettre validée
export const EnvelopeIllustration = ({ width = 220, height = 180 }) => (
  <RemoteSvg path="illustrations/envelope.svg" width={width} height={height}
    accessibilityLabel="Enveloppe ouverte avec une lettre validée" />
);

// M04 — cadenas et clé
export const LockKeyIllustration = ({ width = 180, height = 140 }) => (
  <RemoteSvg path="illustrations/lock-key.svg" width={width} height={height}
    accessibilityLabel="Cadenas et clé" />
);

// M02 — document protégé par un bouclier
export const ShieldDocIllustration = ({ width = 118, height = 112 }) => (
  <RemoteSvg path="illustrations/shield-doc.svg" width={width} height={height}
    accessibilityLabel="Document protégé par un bouclier" />
);

// Écrans « à venir »
export const WorkInProgressIllustration = ({ width = 200, height = 160 }) => (
  <RemoteSvg path="illustrations/work-in-progress.svg" width={width} height={height}
    accessibilityLabel="Écran en préparation" />
);
