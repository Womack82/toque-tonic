# TODO — Toque&Tonic

Liste des améliorations de l'app. Quand une amélioration est faite,
on coche la case `[x]`, on la déplace dans « Fait » et on fait un commit Git.

## À faire

- [ ] Sur l'iPhone : installer Toque&Tonic depuis https://womack82.github.io/toque-tonic/ (Safari → Partager → « Sur l'écran d'accueil »), importer une sauvegarde exportée depuis Wodo, puis recoller l'adresse du relais, la clé Gemini et le prénom
- [ ] Icône de l'app : pour la changer, remplacer dans `icons/` les fichiers `icone-32.png` (onglet du navigateur), `icone-180.png` (iPhone), `icone-192.png` et `icone-512.png` (Android ; la 512 sert aussi d'icône « adaptative », son dessin doit tenir dans le cercle central de 80 %), `icone-1024.png` (original), en gardant les mêmes noms, puis changer la version du cache
- [ ] Remettre un bouton « Coller le lien copié » qui fonctionne sur iPhone (l'ancien code est dans l'historique Git de Wodo, avant sa v1.24)

## Fait

- [x] v1.0 — Création de Toque&Tonic à partir de Wodo v1.30 : recettes, cocktails et notes seulement (films, séries, jeux, recherches TMDB et IGDB, liens IMDb, Terminés et Clés API retirés). Accueil avec 2 carrés ; barre du bas Accueil, Recettes | + | Cocktails, Notes ; Notes aussi dans les Réglages. Données rangées sous des noms « toque-tonic… » (séparées de Wodo) ; sauvegardes au format « toque-tonic » ; l'import accepte une sauvegarde de Wodo et n'en garde que les recettes, cocktails, photos et notes. Logo toque de chef (marine, bande orange)
- [x] v1.1 — Notes : bouton retiré de la barre du bas, elles restent seulement dans Réglages → Notes. Barre : Accueil, Recettes | + | Cocktails
- [x] v1.2 — Nouvelle icône « T&T » (badge terracotta) : icône de l'écran d'accueil, de l'onglet du navigateur et icône adaptative Android ; logo retiré de l'en-tête
- [x] v1.3 — Refonte « Warm Editorial Gastronomy », étape 1 : couleurs, polices (Newsreader, Hanken Grotesk, dans `fonts/`), tailles, rayons et ombres réunis dans `theme.css` ; plus de dégradés ni d'effet verre ; barre d'état crème
- [x] v1.4 — Refonte, étape 2 : icônes « Trait fin » (`icones.js`) et composants de base (`composants.css` : boutons, badges, cartes, champ de recherche, barre d'onglets flottante) ; page de contrôle `galerie.html`
- [x] v1.5 — Refonte, étape 3 : navigation. Barre d'onglets flottante Accueil, Recettes | + | Cocktails, Favoris ; page Favoris ; en-tête « Toque & Tonic » avec bouton profil (ouvre les Réglages) ; rubrique Prénom cachée (code et valeur gardés)
- [x] v1.6 — Refonte, étape 4 : accueil « Mon carnet » (recherche par titre, ingrédient ou source ; filtres Tout, Recettes, Cocktails ; tri plus récent, plus ancien ou A à Z, gardé sur l'appareil) ; cartes horizontales avec photo de 104 px ou cadre pointillé, badge, titre et source ; mêmes cartes sur Recettes, Cocktails et Favoris ; carrés compteurs retirés
