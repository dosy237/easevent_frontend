/**
 * components/minisite/catalog.js — miroir de la bibliothèque du serveur (minisite/catalog.py)
 * Chaque variante listée ici a son rendu dans sections/. Le test de parité
 * (tools/minisite-parity) vérifie que serveur et application sont alignés.
 */
export const SECTION_VARIANTS = {
  hero:      ['fullbleed', 'split', 'framed', 'typographic', 'stacked', 'arch', 'poster'],
  countdown: ['tiles', 'inline', 'ring', 'minimal'],
  intro:     ['centered', 'quote', 'columns', 'letter'],
  details:   ['cards', 'list', 'timeline', 'stub'],
  location:  ['mapcard', 'splitmap', 'minimal', 'illustrated'],
  online:    ['joincard', 'banner'],
  gallery:   ['grid', 'mosaic', 'carousel', 'polaroid', 'filmstrip'],
  dresscode: ['swatches', 'card', 'banner'],
  capacity:  ['bar', 'badge'],
  cta:       ['card', 'banner', 'split', 'minimal'],
  host:      ['card', 'signature', 'inline'],
  faq:       ['accordion', 'cards', 'twocol'],
  divider:   ['ornament', 'quote', 'marquee'],
  calendar:  ['button', 'card'],
  footer:    ['simple', 'signature', 'centered'],
};

export const SECTION_LABELS = {
  hero: 'Accueil', countdown: 'Compte à rebours', intro: 'Présentation', details: 'Informations',
  location: 'Lieu', online: 'En ligne', gallery: 'Galerie', dresscode: 'Tenue', capacity: 'Places',
  cta: 'Participation', host: 'Organisateur', faq: 'Questions', divider: 'Citation', calendar: 'Agenda',
  footer: 'Pied de page',
};

export const HARMONY_LABELS = {
  monochrome: 'Monochrome', analogous: 'Harmonie douce', complementary: 'Contraste', triadic: 'Trio',
  pastel: 'Pastel', dark: 'Nuit', gold: 'Or et nuit', neutral: 'Neutre', vivid: 'Éclatant',
};

export const FONT_LABELS = {
  'playfair-inter': 'Playfair', 'cormorant-lora': 'Cormorant', 'dmserif-poppins': 'DM Serif',
  'fraunces-nunito': 'Fraunces', 'bebas-inter': 'Bebas', 'syne-inter': 'Syne',
  'spacegrotesk-inter': 'Space Grotesk', 'greatvibes-lora': 'Great Vibes', 'poppins-nunito': 'Poppins',
  'lora-inter': 'Lora', 'dmserif-inter': 'DM Serif & Inter', 'syne-nunito': 'Syne & Nunito',
};

// Sections que l'organisateur ne peut pas masquer
export const LOCKED = ['hero', 'cta', 'footer'];
