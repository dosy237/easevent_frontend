#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# frontend/build.sh — Script de build Easevent (Expo Web)
# Exécuté par Render à chaque déploiement.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

log() { echo ""; echo "━━━  $*  ━━━"; }

# ── 1. Inject API URL from environment ──────────────────────────────────
# EXPO_PUBLIC_API_BASE est fourni par Render via render.yaml.
# Si absent, on garde l'URL hardcodée dans config.js.
if [ -n "${EXPO_PUBLIC_API_BASE:-}" ]; then
  log "Injecting API_BASE → ${EXPO_PUBLIC_API_BASE}"
  cat > config.js <<CONFIGEOF
// ⚠️  Auto-généré par build.sh — ne pas modifier manuellement.
//     Modifier la variable d'environnement EXPO_PUBLIC_API_BASE dans Render.
export const API_BASE = '${EXPO_PUBLIC_API_BASE}';
CONFIGEOF
else
  log "EXPO_PUBLIC_API_BASE non défini — utilisation de config.js existant"
fi

# ── 2. Node dependencies ────────────────────────────────────────────────
log "Installing Node.js dependencies"
npm ci --legacy-peer-deps

# ── 3. Expo web export ──────────────────────────────────────────────────
# Produit un dossier dist/ (HTML + JS + assets statiques)
# que Render sert comme un site statique.
log "Building Expo web export"
npx expo export --platform web

# ── 4. Vérification ─────────────────────────────────────────────────────
if [ ! -f "dist/index.html" ]; then
  echo "❌ ERREUR : dist/index.html introuvable après le build"
  exit 1
fi

log "Frontend build complete ✓  ($(du -sh dist | cut -f1) total)"
