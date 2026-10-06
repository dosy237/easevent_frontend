/**
 * components/illustrations — Easevent
 * Illustrations vectorielles légères (quelques Ko, aucune image à
 * télécharger) reprises des maquettes du canvas « Easevent — Écrans MVP ».
 */
import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polyline, Rect } from 'react-native-svg';

// Symbole « calendrier + flèche » (planche Logo & identité)
export function LogoMark({ size = 64, background = '#1B6B4A', stroke = '#FFFFFF', radius = 18, simplified = false }) {
  const sw = size < 40 ? 4.4 : 3.2;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Easevent" role="img">
      <Rect width="64" height="64" rx={radius} fill={background} />
      <G fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 32v-7a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4v-2" />
        {!simplified && <Line x1="28" y1="17" x2="28" y2="24" />}
        {!simplified && <Line x1="40" y1="17" x2="40" y2="24" />}
        <Line x1="21" y1="29" x2="47" y2="29" />
        <Path d="M14 37h17" />
        <Path d="M27 33l4 4-4 4" />
      </G>
    </Svg>
  );
}

// M03 — enveloppe ouverte avec lettre validée
export function EnvelopeIllustration({ width = 220, height = 180 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 220 180" accessibilityLabel="Enveloppe ouverte avec une lettre validée" role="img">
      <Ellipse cx="110" cy="166" rx="78" ry="8" fill="#F1F1F1" />
      <Circle cx="110" cy="88" r="78" fill="#E8F5EE" />
      <Path d="M48 82l62-44 62 44v66a8 8 0 0 1-8 8H56a8 8 0 0 1-8-8z" fill="#C5E8D3" />
      <Rect x="66" y="42" width="88" height="92" rx="8" fill="#FFFFFF" stroke="#E8E8E8" strokeWidth="1.5" />
      <Rect x="80" y="58" width="44" height="7" rx="3.5" fill="#1B6B4A" />
      <Rect x="80" y="74" width="60" height="5" rx="2.5" fill="#E8E8E8" />
      <Rect x="80" y="86" width="52" height="5" rx="2.5" fill="#E8E8E8" />
      <Rect x="80" y="104" width="36" height="12" rx="6" fill="#E76F51" />
      <Path d="M48 90l62 40 62-40v58a8 8 0 0 1-8 8H56a8 8 0 0 1-8-8z" fill="#1B6B4A" />
      <Path d="M48 156l50-36M172 156l-50-36" stroke="#155C3C" strokeWidth="2" />
      <Circle cx="162" cy="58" r="17" fill="#E76F51" />
      <Polyline points="154,58 160,64 171,52" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M38 40l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5z" fill="#E76F51" opacity="0.8" />
      <Circle cx="186" cy="104" r="4" fill="#1B6B4A" opacity="0.5" />
      <Circle cx="30" cy="112" r="3" fill="#E76F51" opacity="0.5" />
    </Svg>
  );
}

// M04 — cadenas et clé
export function LockKeyIllustration({ width = 180, height = 140 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 180 140" accessibilityLabel="Cadenas et clé" role="img">
      <Circle cx="90" cy="72" r="62" fill="#FFF0EB" />
      <Rect x="54" y="58" width="72" height="58" rx="14" fill="#1B6B4A" />
      <Path d="M70 58V44a20 20 0 0 1 40 0v14" fill="none" stroke="#1B6B4A" strokeWidth="10" strokeLinecap="round" />
      <Rect x="54" y="58" width="72" height="14" rx="7" fill="#155C3C" opacity="0.5" />
      <Circle cx="90" cy="84" r="8" fill="#FFFFFF" />
      <Rect x="87" y="86" width="6" height="16" rx="3" fill="#FFFFFF" />
      <G transform="rotate(-28 140 100)">
        <Circle cx="140" cy="100" r="12" fill="none" stroke="#E76F51" strokeWidth="6" />
        <Rect x="150" y="97" width="30" height="6" rx="3" fill="#E76F51" />
        <Rect x="170" y="103" width="5" height="8" rx="2" fill="#E76F51" />
      </G>
      <Path d="M30 34l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z" fill="#E76F51" opacity="0.7" />
    </Svg>
  );
}

// M02 — document protégé par un bouclier (sur fond vert)
export function ShieldDocIllustration({ width = 118, height = 112 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 150 140" accessibilityLabel="Document protégé par un bouclier" role="img">
      <Rect x="18" y="16" width="70" height="92" rx="10" fill="#FFFFFF" opacity="0.18" transform="rotate(-8 53 62)" />
      <Rect x="26" y="20" width="70" height="92" rx="10" fill="#FFFFFF" />
      <Rect x="38" y="36" width="38" height="6" rx="3" fill="#1B6B4A" />
      <Rect x="38" y="50" width="46" height="5" rx="2.5" fill="#C5E8D3" />
      <Rect x="38" y="62" width="40" height="5" rx="2.5" fill="#C5E8D3" />
      <Rect x="38" y="74" width="30" height="5" rx="2.5" fill="#C5E8D3" />
      <Path d="M106 52l28 10v22c0 20-13 32-28 38-15-6-28-18-28-38V62z" fill="#E76F51" />
      <Path d="M106 52l28 10v22c0 20-13 32-28 38z" fill="#D45F43" />
      <Rect x="96" y="80" width="20" height="16" rx="4" fill="#FFFFFF" />
      <Path d="M100 80v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
      <Circle cx="106" cy="88" r="2.2" fill="#E76F51" />
      <Path d="M128 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#FFFFFF" opacity="0.85" />
      <Circle cx="16" cy="118" r="4" fill="#FFFFFF" opacity="0.5" />
    </Svg>
  );
}

// Écrans « à venir » — chantier en cours
export function WorkInProgressIllustration({ width = 200, height = 160 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 160" accessibilityLabel="Écran en préparation" role="img">
      <Ellipse cx="100" cy="148" rx="70" ry="7" fill="#F1F1F1" />
      <Circle cx="100" cy="78" r="66" fill="#E8F5EE" />
      <Rect x="58" y="40" width="84" height="92" rx="12" fill="#FFFFFF" stroke="#E8E8E8" strokeWidth="1.5" />
      <Rect x="70" y="56" width="40" height="7" rx="3.5" fill="#1B6B4A" />
      <Rect x="70" y="72" width="60" height="5" rx="2.5" fill="#E8E8E8" />
      <Rect x="70" y="84" width="52" height="5" rx="2.5" fill="#E8E8E8" />
      <Rect x="70" y="102" width="34" height="14" rx="7" fill="#C5E8D3" />
      <Circle cx="144" cy="44" r="18" fill="#E76F51" />
      <Path d="M137 44h14M144 37v14" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
      <Path d="M40 36l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5z" fill="#E76F51" opacity="0.75" />
    </Svg>
  );
}
