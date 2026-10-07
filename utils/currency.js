/**
 * utils/currency.js — afficher un prix dans la devise du visiteur
 * ════════════════════════════════════════════════════════════════
 * Les taux du jour viennent du serveur (/api/fx/rates/, Banque centrale
 * européenne, franc CFA à parité fixe) et sont gardés en mémoire 6 h.
 * La devise choisie est mémorisée sur le téléphone ; par défaut, celle du
 * pays du téléphone (Cameroun → FCFA, Royaume-Uni → £…), sinon aucune.
 * La conversion est indicative : le paiement reste débité dans la devise
 * de l'événement ou de l'offre.
 * ════════════════════════════════════════════════════════════════
 */
import { useEffect, useState } from 'react';

import { apiClient } from '../services/apiClient';
import { getItem, setItem } from '../services/storage';
import { deviceRegion } from './region';

const KEY = 'easevent_currency';
const TTL = 6 * 3600 * 1000;
const NO_DECIMALS = new Set(['XAF', 'XOF', 'JPY']);

// Pays → devise (régions où l'application est la plus utilisée, puis les grandes devises)
const BY_COUNTRY = {
  CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
  SN: 'XOF', CI: 'XOF', BJ: 'XOF', BF: 'XOF', ML: 'XOF', NE: 'XOF', TG: 'XOF', GW: 'XOF',
  US: 'USD', GB: 'GBP', CA: 'CAD', CH: 'CHF', ZA: 'ZAR', IN: 'INR', CN: 'CNY', JP: 'JPY', BR: 'BRL',
  MX: 'MXN', TR: 'TRY', AU: 'AUD', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN',
  FR: 'EUR', BE: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', LU: 'EUR', IE: 'EUR', AT: 'EUR',
};
export function deviceCurrency() {
  return BY_COUNTRY[deviceRegion()] || null;
}

// ── État commun : taux et devise choisie ─────────────────────────
let rates = null;
let fetchedAt = 0;
let pending = null;
let chosen;                                   // undefined : pas encore lu ; null : aucune conversion
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function loadRates() {
  if (rates && Date.now() - fetchedAt < TTL) return Promise.resolve(rates);
  if (!pending) {
    pending = apiClient.get('/api/fx/rates/')
      .then(({ data }) => { rates = data; fetchedAt = Date.now(); emit(); return data; })
      .catch(() => rates)
      .finally(() => { pending = null; });
  }
  return pending;
}

async function loadChoice() {
  if (chosen !== undefined) return chosen;
  const saved = await getItem(KEY);
  chosen = saved === 'none' ? null : saved || deviceCurrency();
  emit();
  return chosen;
}

export async function setCurrency(code) {
  chosen = code || null;
  await setItem(KEY, code || 'none');
  emit();
}

export function convert(amount, from, to) {
  const r = rates?.rates;
  if (!r || !r[from] || !r[to]) return null;
  return (Number(amount) / r[from]) * r[to];
}

export const symbolOf = (code) => rates?.currencies?.find((c) => c.code === code)?.symbol || code;

export function money(amount, code) {
  const n = Number(amount || 0);
  const digits = NO_DECIMALS.has(code) ? 0 : 2;
  const fixed = (NO_DECIMALS.has(code) ? Math.round(n) : n).toFixed(digits);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped}${dec ? `,${dec}` : ''} ${symbolOf(code)}`;
}

// { currency, currencies, date, source, ready, convert(amount, from) → texte « ≈ … » ou null }
export function useCurrency() {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((n) => n + 1);
    listeners.add(fn);
    loadChoice();
    loadRates();
    return () => listeners.delete(fn);
  }, []);
  return {
    currency: chosen ?? null,
    currencies: rates?.currencies || [],
    date: rates?.date || null,
    source: rates?.source || null,
    ready: !!rates,
    approx(amount, from = 'EUR') {
      if (!chosen || !from || chosen === from || !Number(amount)) return null;
      const v = convert(amount, from, chosen);
      return v == null ? null : `≈ ${money(v, chosen)}`;
    },
  };
}
