// ============================================================
// service-worker.js : garde une copie des fichiers de l'app
// pour qu'elle s'ouvre même sans connexion internet.
// ============================================================

// Change ce numéro à chaque modification des fichiers, sinon le
// téléphone continuera d'utiliser l'ancienne copie :
// chaque changement ajoute 1 au second numéro : v1.0 → v1.1 → v1.2…
// ⚠️ Change aussi VERSION en haut de app.js (affichée dans Réglages).
const NOM_CACHE = "toque-tonic-v1.13";

// ⚠️ Si un seul de ces fichiers est introuvable, rien n'est mis en cache
// (l'app ne marchera pas hors ligne) : vérifier chaque chemin.
const FICHIERS = [
  "./",
  "index.html",
  "theme.css",
  "composants.css",
  "style.css",
  "icones.js",
  "recettes.js",
  "ia.js",
  "photos.js",
  "app.js",
  "notes.js",
  "manifest.json",
  // Polices (dossier fonts)
  "fonts/newsreader.woff2",
  "fonts/newsreader-italique.woff2",
  "fonts/hanken-grotesk.woff2",
  // Icônes de l'app (dossier icons). Pour changer l'icône, remplacer
  // ces fichiers en gardant les mêmes noms et tailles (voir TODO.md).
  "icons/icone-180.png",
  "icons/icone-192.png",
  "icons/icone-512.png",
  "icons/icone-32.png",
];

// À l'installation : on met tous les fichiers en cache
self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(NOM_CACHE).then((cache) => cache.addAll(FICHIERS))
  );
  self.skipWaiting();
});

// À l'activation : on supprime les anciens caches de Toque&Tonic (v1.0
// quand v1.1 arrive, etc.). Seulement les siens (« toque-tonic-… ») :
// Wodo, publiée sur le même site (womack82.github.io), garde les siens.
const estCacheDeToqueTonic = (nom) => nom.startsWith("toque-tonic-");
self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => estCacheDeToqueTonic(n) && n !== NOM_CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// À chaque demande de fichier : on sert la copie en cache si elle existe,
// sinon on va la chercher sur internet.
self.addEventListener("fetch", (evenement) => {
  // Les demandes vers d'autres sites (relais des recettes, Gemini, photos) ne passent
  // pas par le cache : le navigateur s'en occupe normalement.
  if (new URL(evenement.request.url).origin !== self.location.origin) return;
  evenement.respondWith(
    caches.match(evenement.request).then((reponse) => reponse || fetch(evenement.request))
  );
});
