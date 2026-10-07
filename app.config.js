/**
 * app.config.js — complète app.json au moment de la compilation.
 *
 * Notifications push Android : Firebase a besoin de google-services.json.
 * - en local : déposer le fichier à la racine du projet (il n'est pas versionné) ;
 * - sur EAS : créer une variable d'environnement de type « fichier » GOOGLE_SERVICES_JSON
 *   (expo.dev › projet › Environment variables), EAS fournit alors son chemin.
 * Sans ce fichier, l'application fonctionne normalement, sans notifications push.
 */
const fs = require('fs');

module.exports = ({ config }) => {
  const googleServices = process.env.GOOGLE_SERVICES_JSON
    || (fs.existsSync('./google-services.json') ? './google-services.json' : null);
  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
    },
  };
};
