/**
 * constants/theme.js — Easevent
 * Palette et réglages visuels partagés par les nouveaux écrans.
 * Mêmes valeurs que la constante `C` déclarée dans les écrans existants.
 */
export const C = {
  green:      '#1B6B4A',
  greenDark:  '#155C3C',
  greenLight: '#E8F5EE',
  greenSoft:  '#C5E8D3',
  orange:     '#E76F51',
  orangeDark: '#C4502F',
  orangeL:    '#FFF0EB',
  white:      '#FFFFFF',
  bg:         '#F7F7F7',
  inputBg:    '#F9F9F9',
  text:       '#1A1A1A',
  textSub:    '#555555',
  // #757575 : gris le plus clair qui garde un contraste 4.5:1 sur blanc (WCAG AA)
  textMut:    '#757575',
  textFaint:  '#9E9E9E',
  border:     '#E8E8E8',
  blue:       '#2563EB',
  blueL:      '#EFF6FF',
  error:      '#E53E3E',
  errorText:  '#C53030',
  errorBg:    '#FFF5F5',
  skeleton:   '#ECECEC',
};

// Zone tactile minimale recommandée (WCAG 2.5.5 / Apple HIG)
export const TOUCH = 44;

// Informations légales affichées dans la politique de confidentialité (M02).
// À compléter par le juridique.
export const LEGAL = {
  company:  '[NOM DE LA SOCIÉTÉ]',
  dpoEmail: '[EMAIL DPO]',
  updatedAt: '6 octobre 2026',
};
