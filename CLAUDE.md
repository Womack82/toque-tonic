# Règles du projet « Toque&Tonic »

## Le projet

- Petite web app installable (PWA) pour garder ses **recettes** et ses
  **cocktails** (fiches avec photos, ingrédients, étapes), avec des notes.
  Son nom affiché est **Toque&Tonic**.
- Elle est née le 15/11/2026 d'une copie de **Wodo** (v1.30), l'app sœur
  pour les films, séries, jeux et livres
  (dossier `..\wodo`, https://womack82.github.io/wodo/).
  Une correction faite dans le code commun (fiches, photos, notes,
  sauvegarde, IA) n'est pas reportée automatiquement dans l'autre app.
- Publiée sur GitHub Pages : https://womack82.github.io/toque-tonic/
  (dépôt github.com/Womack82/toque-tonic).
- Les deux apps sont sur le **même site** (womack82.github.io) : elles
  partagent la mémoire du navigateur (hors icônes de l'écran d'accueil de
  l'iPhone). Tous les noms techniques commencent donc par « toque-tonic » :
  clés de la mémoire (localStorage), base des photos (IndexedDB
  « toque-tonic-photos »), format des sauvegardes (`format: "toque-tonic"`),
  nom du cache (« toque-tonic-v… »). Ne pas les changer : on perdrait les
  données enregistrées. Le nettoyage du cache (`service-worker.js`) ne doit
  effacer que les caches « toque-tonic-… ».
- L'import accepte aussi les sauvegardes de Wodo (`format: "wodo"` ou
  `"mes-listes"`) : seuls les recettes, cocktails et notes sont repris.
- Le relais Cloudflare (import de recettes depuis un lien) est celui de
  Wodo : son code et son mode d'emploi sont dans `../wodo/relais/`.
- Utilisée surtout sur iPhone.
- Les améliorations à faire et déjà faites sont suivies dans `TODO.md`.

## Façon de travailler

- L'utilisateur débute en programmation : explique brièvement ce que tu fais
  et pourquoi, avec des mots simples.
- Avant de coder, signale tout point qui pose problème (limite technique,
  risque, effet secondaire) et attends sa réponse.
- Fais un commit Git par étape, avec un message clair qui dit ce qui change.
- Après chaque commit, fais `git push` automatiquement, sans demander
  l'accord de l'utilisateur (demande faite le 15/11/2026). Le site GitHub
  Pages se met alors à jour tout seul.
- Ne mets jamais une clé API dans un fichier suivi par Git sans le dire
  clairement à l'utilisateur. Aujourd'hui, la clé Gemini et l'adresse du
  relais sont gardées uniquement dans la mémoire de l'appareil (localStorage).

## Version et cache

- À chaque modification, change la version du cache (`NOM_CACHE`) dans
  `service-worker.js`. Sinon, le téléphone continue d'utiliser l'ancienne copie.
- Change en même temps `VERSION` en haut de `app.js` : c'est le numéro affiché
  en haut des Réglages, et il doit rester identique à celui du cache.
- Numérotation : première version **v1.0**. Chaque changement, quel qu'il
  soit (nouvelle demande ou retouche), ajoute 1 au second numéro :
  v1.0 → v1.1 → v1.2…

## Apparence

- Mobile d'abord : boutons et zones à toucher d'au moins 44 px, texte lisible
  sans zoomer.
- Direction artistique « Warm Editorial Gastronomy » (depuis v1.3) : carnet
  de cuisine ancien, papier crème, encre chaude ; ni ombres dures, ni
  dégradés, ni transparence floue. Interface en français, au tutoiement,
  sans emoji.
- **Tous les réglages visuels sont dans `theme.css`** (couleurs, polices,
  tailles de texte, espacements, rayons, ombres). Ne jamais écrire une
  couleur en dur ailleurs : utiliser `var(--…)`.
- Couleurs principales :

  | Rôle                                   | Token                         | Valeur    |
  |----------------------------------------|-------------------------------|-----------|
  | Fond (parchemin)                       | `--background`                | `#FFF8F3` |
  | Blocs, encarts, champs                 | `--surface-low/surface/-high` | `#FAF2EB` / `#F4EDE6` / `#E9E1DA` |
  | Cartes                                 | `--card`                      | `#FFFFFF` |
  | Texte principal / secondaire           | `--ink` / `--ink-muted`       | `#1E1B17` / `#57423B` |
  | Terracotta (actions, onglet actif)     | `--primary` (texte blanc)     | `#9F3C16` |
  | Sauge (RECETTE, boutons secondaires)   | `--sage`                      | `#506354` |
  | Ambre (COCKTAIL, métadonnées, minuteur)| `--amber`                     | `#8D4B00` |
  | Erreur                                 | `--error`                     | `#BA1A1A` |

- Polices (fichiers dans `fonts/`, gardés hors ligne) : **Newsreader** pour
  les titres et le texte, **Hanken Grotesk** pour les libellés, boutons,
  quantités et chiffres. Contraste du texte d'au moins 4.5:1.
- Animations légères, de 150 à 280 ms, et désactivées quand l'option
  « réduire les animations » est activée sur l'appareil
  (`@media (prefers-reduced-motion: reduce)`).
- Quand l'utilisateur demande un changement d'apparence, ne modifie que
  l'apparence (CSS, présentation) : ne touche à aucune fonction.
