// ============================================================
// app.js : toute la logique de Toque&Tonic (recettes et cocktails)
// Née d'une copie de Wodo (v1.30), dont on a retiré films, séries et jeux
// ============================================================

// Numéro de version affiché dans Réglages.
// ⚠️ Doit toujours être le même que NOM_CACHE dans service-worker.js
// Chaque changement, quel qu'il soit, ajoute 1 au second numéro
// (v1.0 → v1.1 → v1.2…).
const VERSION = "v1.18";

// Noms sous lesquels on range les données dans la mémoire du téléphone.
// Ils commencent par « toque-tonic » : Wodo est publiée sur le même site
// (womack82.github.io) et ses données commencent par « wodo ».
const CLE_STOCKAGE = "toque-tonic";

// Recettes et cocktails sont des FICHES à conserver : pas de case à cocher,
// jamais « terminées ».
const FICHES = new Set(["recette", "cocktail"]);
const estFiche = (type) => FICHES.has(type);

// --- 1. Charger les données sauvegardées --------------------
// localStorage ne stocke que du texte : on transforme le texte en
// tableau avec JSON.parse. Si rien n'est enregistré, on part d'un tableau vide.
function charger(cle) {
  try {
    return JSON.parse(localStorage.getItem(cle)) || [];
  } catch (erreur) {
    console.error("Impossible de lire les données :", erreur);
    return [];
  }
}

// --- 2. Sauvegarder les données ------------------------------
function sauvegarder() {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(elements));
}

// Les éléments de la liste. Chacun ressemble à :
// { id: "1731...", titre: "Tarte aux pommes", type: "recette", fait: false, … }
let elements = charger(CLE_STOCKAGE);


// Migration (v1.9) : une recette cochée « faite » avant que les recettes
// deviennent des fiches redevient une fiche normale (rien n'est perdu)
function migrerFiches() {
  let change = false;
  for (const el of elements) {
    if (estFiche(el.type) && el.fait) {
      el.fait = false;
      change = true;
    }
  }
  if (change) sauvegarder();
}
migrerFiches();

// La page affichée : "accueil", une catégorie ("recette", "cocktail")
// ou "favoris"
let pageActive = "accueil";

// On récupère les morceaux de la page dont on a besoin
// Le calque « Ajouter » : formulaire et champ titre
const formulaire = document.getElementById("formulaire-ajout");
const champTitre = document.getElementById("champ-titre");
// En-tête, pages et barre du bas
const titreCategorie = document.getElementById("titre-categorie");
const compteCategorie = document.getElementById("compte-categorie");
const pageAccueil = document.getElementById("page-accueil");
const pageCategorie = document.getElementById("page-categorie");
const champRecherche = document.getElementById("champ-recherche");
const boutonsFiltre = document.querySelectorAll(".filtre");
const boutonTrier = document.getElementById("bouton-trier");
const texteTri = document.getElementById("texte-tri");
const listeRecents = document.getElementById("liste-recents");
const recentsVide = document.getElementById("recents-vide");
const liste = document.getElementById("liste");
const messageVide = document.getElementById("message-vide");
const onglets = document.querySelectorAll(".tabbar-onglet");

// Nom du type affiché sous le titre des cartes
const NOMS_SIMPLES = { recette: "Recette", cocktail: "Cocktail" };

// Icônes des types (tracés de icones.js) : toque, coupe à cocktail
const ICONES_TYPES = { recette: ICONES.toque, cocktail: ICONES.coupe };

// Fabrique une icône SVG à partir d'un tracé (trait de la couleur du texte)
function creerIcone(trace, classe = "icone-svg") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", classe);
  svg.setAttribute("aria-hidden", "true");
  const chemin = document.createElementNS(ns, "path");
  chemin.setAttribute("d", trace);
  svg.append(chemin);
  return svg;
}

// Les 2 catégories de la navigation
const NOMS_PLURIELS = { recette: "Recettes", cocktail: "Cocktails", favoris: "Favoris" };

// Date d'ajout d'un élément : son identifiant est l'heure de création
// (Date.now()). Renvoie null si l'identifiant n'est pas une date.
function dateAjout(el) {
  const temps = Number(el.id);
  return Number.isFinite(temps) && temps > 1e12 ? new Date(temps) : null;
}

// --- 3. Afficher les pages et les listes ----------------------
// Accueil : recherche, filtre (Tout, Recettes, Cocktails) et tri.
// Pages Recettes, Cocktails, Favoris : les fiches de la page, même ordre.

// Choix de l'accueil : filtre et texte cherché (oubliés à la fermeture),
// ordre de tri (gardé sur l'appareil)
let filtreAccueil = "tout";
let texteCherche = "";
const CLE_TRI = "toque-tonic-tri";
const TRIS = {
  recent: { texte: "Du plus récent au plus ancien", comparer: (a, b) => (Number(b.id) || 0) - (Number(a.id) || 0) },
  ancien: { texte: "Du plus ancien au plus récent", comparer: (a, b) => (Number(a.id) || 0) - (Number(b.id) || 0) },
  alpha: { texte: "De A à Z", comparer: (a, b) => a.titre.localeCompare(b.titre, "fr", { sensitivity: "base" }) },
};
let tri = "recent";
try {
  if (TRIS[localStorage.getItem(CLE_TRI)]) tri = localStorage.getItem(CLE_TRI);
} catch { /* mémoire indisponible : ordre par défaut */ }

// Texte simplifié pour chercher : minuscules, sans accents (« crème » = « creme »)
const simplifier = (texte) => String(texte).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Source affichée sous le titre : le texte saisi, sinon le site du lien
function texteSource(el) {
  if (el.source) return el.source;
  if (el.lien) {
    try { return domaine(el.lien); } catch { return ""; }
  }
  return "";
}

// La fiche contient-elle le texte cherché ? (titre, ingrédients, source)
function correspond(el, cherche) {
  if (!cherche) return true;
  const lieux = [el.titre, texteSource(el), ...(el.ingredients || [])];
  return lieux.some((texte) => simplifier(texte).includes(cherche));
}

// animer = true : les cartes apparaissent en fondu, l'une après l'autre
// (seulement en arrivant sur une page).
function afficher(animer = false) {
  const fiches = elements.filter((el) => estFiche(el.type)).sort(TRIS[tri].comparer);
  texteTri.textContent = TRIS[tri].texte;

  // Accueil : filtre + recherche
  const cherche = simplifier(texteCherche.trim());
  const visiblesAccueil = fiches.filter((el) =>
    (filtreAccueil === "tout" || el.type === filtreAccueil) && correspond(el, cherche));
  listeRecents.replaceChildren(...visiblesAccueil.map(creerCarte));
  recentsVide.hidden = visiblesAccueil.length > 0;
  if (fiches.length === 0) {
    recentsVide.textContent = "Ton carnet est encore vide. Appuie sur + pour ajouter ta première recette ou ton premier cocktail.";
  } else if (cherche) {
    recentsVide.textContent = `Rien ne correspond à « ${texteCherche.trim()} ».`;
  } else {
    recentsVide.textContent = filtreAccueil === "cocktail" ? "Aucun cocktail pour l'instant." : "Aucune recette pour l'instant.";
  }
  for (const bouton of boutonsFiltre) {
    bouton.setAttribute("aria-pressed", String(bouton.dataset.filtre === filtreAccueil));
  }

  // Page Recettes, Cocktails ou Favoris
  liste.innerHTML = "";
  if (pageActive !== "accueil") {
    // Favoris : les fiches marquées d'un signet ; sinon, un type
    const visibles = pageActive === "favoris"
      ? fiches.filter((el) => el.favori)
      : fiches.filter((el) => el.type === pageActive);
    liste.append(...visibles.map(creerCarte));
    messageVide.textContent = pageActive === "favoris"
      ? "Aucun favori pour l'instant. Touche le signet d'une fiche pour la retrouver ici."
      : "Rien ici pour l'instant. Appuie sur + pour ajouter.";
    messageVide.hidden = visibles.length > 0;
    compteCategorie.textContent = pluriel(visibles.length, "fiche");
  }

  if (animer && !sansAnimation.matches) {
    const blocs = pageActive === "accueil" ? [...listeRecents.children] : [...liste.children];
    blocs.forEach((bloc, rang) => {
      bloc.style.setProperty("--rang", Math.min(rang, 8));
      bloc.classList.remove("apparition");
      void bloc.offsetWidth; // relance l'animation si le bloc l'avait déjà
      bloc.classList.add("apparition");
    });
  }
}

// Recherche : la liste se met à jour à chaque lettre
champRecherche.addEventListener("input", () => {
  texteCherche = champRecherche.value;
  afficher();
});
// Filtres Tout, Recettes, Cocktails
for (const bouton of boutonsFiltre) {
  bouton.addEventListener("click", () => {
    filtreAccueil = bouton.dataset.filtre;
    afficher(true);
  });
}
// Trier : plus récent → plus ancien → A à Z → plus récent…
boutonTrier.addEventListener("click", () => {
  const ordres = Object.keys(TRIS);
  tri = ordres[(ordres.indexOf(tri) + 1) % ordres.length];
  try { localStorage.setItem(CLE_TRI, tri); } catch { /* gardé jusqu'à la fermeture */ }
  afficher(true);
});

// Change de page : "accueil", une catégorie ("recette", "cocktail")
// ou "favoris"
function allerA(page) {
  pageActive = page;
  const accueil = page === "accueil";
  pageAccueil.hidden = !accueil;
  pageCategorie.hidden = accueil;
  if (!accueil) titreCategorie.textContent = NOMS_PLURIELS[page];
  // Onglet de la page surligné dans la barre
  // (aria-current indique la page aux lecteurs d'écran)
  for (const onglet of onglets) {
    const actif = onglet.dataset.page === page;
    onglet.classList.toggle("actif", actif);
    if (actif) onglet.setAttribute("aria-current", "page");
    else onglet.removeAttribute("aria-current");
  }
  window.scrollTo(0, 0);
  afficher(true);
}

// Prénom : gardé sur l'appareil (Réglages → Prénom, rubrique cachée depuis
// la v1.5 ; affiché dans l'en-tête depuis la v1.14), « Alex » s'il n'a jamais été changé
const CLE_PRENOM = "toque-tonic-prenom";
const PRENOM_PAR_DEFAUT = "Alex";
function lirePrenom() {
  try {
    return localStorage.getItem(CLE_PRENOM) || PRENOM_PAR_DEFAUT;
  } catch {
    return PRENOM_PAR_DEFAUT;
  }
}


// Fabrique la carte <li> d'une fiche (carte horizontale) :
// à gauche, la photo (104 px) ; à droite, le badge RECETTE ou COCKTAIL,
// le titre et la source en italique. Un appui ouvre la fiche.
function creerCarte(el) {
  const li = document.createElement("li");
  li.className = "carte-fiche";
  li.dataset.id = el.id; // pour retrouver la carte (animations)

  // Toute la carte est un bouton
  const corps = document.createElement("button");
  corps.type = "button";
  corps.className = "carte-fiche-corps carte-papier";
  corps.addEventListener("click", () => ouvrirFiche(el.id));

  // Vignette : la première photo de la fiche (la photo gardée en priorité)
  const photo = adressePhotoFiche(el) || (el.images ? el.images[0] : null);

  const textes = document.createElement("span");
  textes.className = "carte-fiche-textes";
  const haut = document.createElement("span");
  haut.className = "carte-fiche-haut";
  const badge = document.createElement("span");
  badge.className = `pilule pilule-${el.type}`;
  badge.textContent = NOMS_SIMPLES[el.type];
  haut.append(badge);
  // Favori : petit signet plein à côté du badge
  if (el.favori) {
    const signet = icone("signet", "plein petite");
    signet.setAttribute("aria-hidden", "false");
    signet.setAttribute("role", "img");
    signet.setAttribute("aria-label", "Favori");
    haut.append(signet);
  }
  // Titre et source : textContent empêche d'injecter du code HTML par erreur
  const titre = document.createElement("span");
  titre.className = "t-carte carte-fiche-titre";
  titre.textContent = el.titre;
  textes.append(haut, titre);
  const source = texteSource(el);
  if (source) {
    const ligne = document.createElement("span");
    ligne.className = "t-italique carte-fiche-source";
    ligne.textContent = source;
    textes.append(ligne);
  }

  corps.append(creerVignette(photo, el.type), textes);
  li.append(corps);
  return li;
}

// --- Liens et notes des recettes ---
// Note : 1 000 caractères au plus
const LONGUEUR_MAX_NOTE = 1000;

// Renvoie l'adresse propre si le texte est un lien http ou https, sinon null.
// (On refuse tout le reste, par exemple « javascript: », qui pourrait lancer du code.)
function lienValide(texte) {
  if (typeof texte !== "string") return null;
  try {
    const adresse = new URL(texte.trim());
    if (adresse.protocol !== "http:" && adresse.protocol !== "https:") return null;
    return adresse.href;
  } catch {
    return null; // ce n'est pas une adresse
  }
}

// Le nom de domaine d'un lien, sans « www. » : « instagram.com »
function domaine(lien) {
  return new URL(lien).hostname.replace(/^www\./, "");
}

// --- 4. Les actions ------------------------------------------
// infos (facultatif) : { lien, note } (tous les deux facultatifs)
//                          + les champs trouvés par « Importer » (CHAMPS_FICHE :
//                          photos, ingrédients, étapes, portions, temps…)
function ajouter(titre, type, infos = null) {
  const el = {
    id: Date.now().toString(), // identifiant unique basé sur l'heure
    titre: titre,
    type: type,
    fait: false,
  };
  if (infos) {
    if (infos.lien) el.lien = infos.lien;
    if (infos.note) el.note = infos.note;
    if (estFiche(type)) {
      for (const cle of CHAMPS_FICHE) {
        const valeur = infos[cle];
        if (valeur === undefined || valeur === "" || (Array.isArray(valeur) && valeur.length === 0)) continue;
        el[cle] = valeur;
      }
    }
  }
  elements.push(el);
  sauvegarder();
  afficher();
}

// « Réduire les animations » activé sur le téléphone ?
const sansAnimation = window.matchMedia("(prefers-reduced-motion: reduce)");

// Cocher / décocher. La coche est enregistrée tout de suite ; seul
// l'affichage attend la fin de l'animation :
// 1. la case se remplit (150 ms, en CSS)
// 2. la carte disparaît en fondu (220 ms, classe "sortie")
// 3. la liste est redessinée et les autres cartes remontent en glissant
function basculer(id, carte = null) {
  const el = elements.find((e) => e.id === id);
  el.fait = !el.fait; // true devient false et inversement
  sauvegarder();

  if (!carte || sansAnimation.matches) {
    afficher();
    return;
  }
  setTimeout(() => {
    carte.classList.add("sortie");
    setTimeout(afficherEnDouceur, 220);
  }, 150);
}

// Redessine les listes, puis fait glisser chaque carte restante de son
// ancienne place vers la nouvelle (au lieu de sauter d'un coup).
// On mesure les positions avant et après, et on anime seulement "transform".
function afficherEnDouceur() {
  const cle = (carte) => `${carte.parentElement.id}/${carte.dataset.id}`;
  const avant = new Map();
  for (const carte of document.querySelectorAll(".carte-fiche[data-id]")) {
    avant.set(cle(carte), carte.getBoundingClientRect().top);
  }
  afficher();
  for (const carte of document.querySelectorAll(".carte-fiche[data-id]")) {
    const ancienHaut = avant.get(cle(carte));
    if (ancienHaut === undefined) continue; // carte nouvelle dans cette liste
    const ecart = ancienHaut - carte.getBoundingClientRect().top;
    if (Math.abs(ecart) < 1) continue; // n'a pas bougé
    carte.animate(
      [{ transform: `translateY(${ecart}px)` }, { transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
  }
}

// recette (facultatif) : { lien, note, + contenu de la fiche } quand on
// modifie une recette ou un cocktail ; une valeur vide efface le champ.
// Un champ absent de « recette » (ex. : la cuisson pour un cocktail) reste
// tel quel. Sans « recette », tout reste tel quel (gardé même si le type change).
function modifier(id, titre, type, recette = null) {
  const el = elements.find((e) => e.id === id);
  el.titre = titre;
  el.type = type;
  // Devenu recette ou cocktail : une fiche n'est jamais « terminée »
  if (estFiche(type)) el.fait = false;
  if (recette) {
    if (recette.lien) el.lien = recette.lien; else delete el.lien;
    if (recette.note) el.note = recette.note; else delete el.note;
    for (const cle of CHAMPS_FICHE) {
      if (!Object.hasOwn(recette, cle)) continue; // champ non modifié
      const valeur = recette[cle];
      const vide = valeur === undefined || valeur === "" || (Array.isArray(valeur) && valeur.length === 0);
      if (vide) delete el[cle]; else el[cle] = valeur;
    }
  }
  sauvegarder();
  afficher();
}

// Suppression définitive (plus d'historique « Supprimés » depuis la v1.18).
// Sa photo gardée est aussi effacée de la mémoire des photos.
function supprimer(id) {
  const el = elements.find((e) => e.id === id);
  if (el && el.photoId) supprimerPhoto(el.photoId).catch(() => {});
  elements = elements.filter((e) => e.id !== id);
  sauvegarder();
  afficher();
}

// --- 4 bis. L'écran Modifier (crayon de la fiche) -------------
// Formulaire complet, plein écran : photo, titre, type, source, lien,
// portions et temps, champs propres au type, ingrédients, étapes (une ligne
// par étape, avec sa durée facultative), notes. « Supprimer la fiche » en bas.
const pageEdition = document.getElementById("page-edition");
const actionsTitre = document.getElementById("actions-titre");
const actionsEdition = document.getElementById("actions-edition");
const editionBarreTitre = document.getElementById("edition-barre-titre");
const editionTitre = document.getElementById("edition-titre");
const editionType = document.getElementById("edition-type");
const editionSource = document.getElementById("edition-source");
const editionLien = document.getElementById("edition-lien");
const editionNote = document.getElementById("edition-note");
const editionErreur = document.getElementById("edition-erreur");
const editionPortions = document.getElementById("edition-portions");
const editionEtiquettePortions = document.getElementById("edition-etiquette-portions");
const editionPreparation = document.getElementById("edition-preparation");
const editionEtiquettePreparation = document.getElementById("edition-etiquette-preparation");
const editionCuisson = document.getElementById("edition-cuisson");
const editionChampCuisson = document.getElementById("edition-champ-cuisson");
const editionNiveau = document.getElementById("edition-niveau");
const editionChampNiveau = document.getElementById("edition-champ-niveau");
const editionChampsCocktail = document.getElementById("edition-champs-cocktail");
const editionVerre = document.getElementById("edition-verre");
const editionGlace = document.getElementById("edition-glace");
const editionGarniture = document.getElementById("edition-garniture");
const editionMethode = document.getElementById("edition-methode");
const editionAlcool = document.getElementById("edition-alcool");
const editionAvecAlcool = document.getElementById("edition-avec-alcool");
const editionIngredients = document.getElementById("edition-ingredients");
const editionEtapes = document.getElementById("edition-etapes");
const editionPhotoApercu = document.getElementById("edition-photo-apercu");
const editionChangerPhoto = document.getElementById("edition-changer-photo");
const editionRetirerPhoto = document.getElementById("edition-retirer-photo");
const editionSupprimer = document.getElementById("edition-supprimer");
// true quand Modifier a été ouvert depuis la page d'une fiche (toujours
// le cas aujourd'hui) : la fiche est redessinée après « Enregistrer »
let editionDepuisFiche = false;

// La fiche modifiée (null = écran fermé)
let idActions = null;
let minuteurConfirmation = null;

// Le menu des types : « Recette », « Cocktail »
function remplirTypes() {
  editionType.replaceChildren();
  for (const type of Object.keys(NOMS_SIMPLES)) {
    editionType.append(new Option(NOMS_SIMPLES[type], type));
  }
}

// Remet « Supprimer la fiche » dans son état normal
function annulerConfirmation() {
  clearTimeout(minuteurConfirmation);
  editionSupprimer.textContent = "Supprimer la fiche";
  editionSupprimer.classList.remove("confirmer");
}

function fermerActions() {
  annulerConfirmation();
  idActions = null;
  if (pageEdition.open) pageEdition.close();
}

// Champs selon le type : cuisson et niveau pour une recette ; verre,
// glace, garniture, méthode, alcool pour un cocktail
function majEditionRecette() {
  const cocktail = editionType.value === "cocktail";
  editionChampCuisson.hidden = cocktail;
  editionChampNiveau.hidden = cocktail;
  editionChampsCocktail.hidden = !cocktail;
  editionEtiquettePortions.textContent = cocktail ? "Verres" : "Portions";
  editionEtiquettePreparation.textContent = cocktail ? "Temps (min)" : "Préparation (min)";
  editionBarreTitre.textContent = cocktail ? "Modifier le cocktail" : "Modifier la recette";
}
editionType.addEventListener("change", majEditionRecette);

// --- Étapes : une ligne par étape (texte + durée en minutes) ou par titre
// de partie (texte seul). Les étapes sont numérotées par le CSS. ---
const LIMITE_MINUTES_ETAPE = LIMITES_FICHE.secondesEtapeMax / 60;

// Une zone de texte qui grandit avec son contenu
function ajusterHauteurChamp(champ) {
  champ.style.height = "auto";
  champ.style.height = `${champ.scrollHeight}px`;
}

// Durée enregistrée (secondes) → texte du champ : 2700 → « 45 », 90 → « 1,5 »
const minutesEnTexte = (secondes) => String(Math.round((secondes / 60) * 100) / 100).replace(".", ",");

function creerLigneEtape(texte = "", secondes = null, partie = false) {
  const li = document.createElement("li");
  li.className = partie ? "edition-etape edition-partie" : "edition-etape";
  const champ = document.createElement("textarea");
  champ.className = "champ-saisie edition-etape-texte";
  champ.rows = 1;
  champ.maxLength = LIMITES_FICHE.longueurEtape;
  champ.autocapitalize = "sentences";
  champ.value = texte;
  champ.placeholder = partie ? "Titre de la partie (ex. La pâte)" : "Décris l'étape…";
  champ.setAttribute("aria-label", partie ? "Titre de partie" : "Texte de l'étape");
  champ.addEventListener("input", () => ajusterHauteurChamp(champ));
  li.append(champ);
  if (!partie) {
    const zone = document.createElement("label");
    zone.className = "edition-duree";
    const duree = document.createElement("input");
    duree.type = "text";
    duree.inputMode = "decimal";
    duree.className = "champ-saisie edition-duree-champ";
    duree.value = secondes ? minutesEnTexte(secondes) : "";
    duree.placeholder = "—";
    duree.setAttribute("aria-label", "Durée en minutes (facultatif)");
    const unite = document.createElement("span");
    unite.className = "t-libelle-petit";
    unite.textContent = "min";
    zone.append(duree, unite);
    li.append(zone);
  }
  // Monter d'un cran (pour insérer une étape ou placer un titre de partie)
  const monter = document.createElement("button");
  monter.type = "button";
  monter.className = "btn-icone edition-etape-monter";
  monter.setAttribute("aria-label", partie ? "Monter ce titre de partie" : "Monter cette étape");
  monter.append(icone("chevron"));
  monter.addEventListener("click", () => {
    if (li.previousElementSibling) {
      li.previousElementSibling.before(li);
      monter.focus();
    }
  });
  li.append(monter);
  const retirer = document.createElement("button");
  retirer.type = "button";
  retirer.className = "btn-icone edition-etape-retirer";
  retirer.setAttribute("aria-label", partie ? "Retirer ce titre de partie" : "Retirer cette étape");
  retirer.append(icone("poubelle"));
  retirer.addEventListener("click", () => li.remove());
  li.append(retirer);
  return li;
}

function ajouterLigneEtape(partie) {
  if (editionEtapes.children.length >= LIMITES_FICHE.etapes) return;
  const li = creerLigneEtape("", null, partie);
  editionEtapes.append(li);
  li.querySelector("textarea").focus();
}
document.getElementById("edition-ajouter-etape").addEventListener("click", () => ajouterLigneEtape(false));
document.getElementById("edition-ajouter-partie").addEventListener("click", () => ajouterLigneEtape(true));

// Lit les lignes d'étapes → { etapes, durees } ou { erreur }.
// Une étape tapée « 1. Mélanger » devient « Mélanger » (déjà numérotée).
function lireLignesEtapes() {
  const etapes = [];
  const durees = [];
  for (const li of editionEtapes.children) {
    const texte = li.querySelector("textarea").value.trim().slice(0, LIMITES_FICHE.longueurEtape);
    if (texte === "") continue;
    if (li.classList.contains("edition-partie")) {
      etapes.push(`# ${texte.replace(/^#+\s*/, "")}`);
      durees.push(null);
      continue;
    }
    const champDuree = li.querySelector(".edition-duree-champ");
    const valeur = champDuree.value.trim().replace(",", ".");
    let secondes = null;
    if (valeur !== "") {
      const minutes = Number(valeur);
      if (!(minutes > 0) || minutes > LIMITE_MINUTES_ETAPE) {
        champDuree.focus();
        return { erreur: `Durée d'une étape : un nombre de minutes entre 0,1 et ${LIMITE_MINUTES_ETAPE} (ex. 45 ou 1,5), ou rien.` };
      }
      secondes = Math.max(1, Math.round(minutes * 60));
    }
    etapes.push(texte.replace(/^\d{1,2}\s*[.)]\s+/, ""));
    durees.push(secondes);
  }
  return { etapes: etapes.slice(0, LIMITES_FICHE.etapes), durees: durees.slice(0, LIMITES_FICHE.etapes) };
}

// Aperçu de la photo dans le formulaire (même photo que la fiche)
function majPhotoEdition(el) {
  if (!el || idActions !== el.id) return;
  const photo = adressePhotoFiche(el) || (el.images ? el.images[0] : null);
  editionPhotoApercu.replaceChildren(creerVignette(photo, el.type));
  const aSaPhoto = Boolean(el.photoId || el.photoPerso);
  editionChangerPhoto.textContent = photo ? "Changer la photo" : "Ajouter une photo";
  editionChangerPhoto.disabled = false;
  editionRetirerPhoto.hidden = !aSaPhoto;
}

// Ouvre l'écran Modifier, rempli avec la fiche
function ouvrirEdition(id) {
  const el = elements.find((e) => e.id === id);
  if (!el) return;
  idActions = id;
  annulerConfirmation();
  actionsTitre.textContent = el.titre;
  editionTitre.value = el.titre;
  remplirTypes();
  editionType.value = el.type;
  editionSource.value = el.source || "";
  editionLien.value = el.lien || "";
  editionNote.value = el.note || "";
  editionPortions.value = el.portions || "";
  editionPreparation.value = el.tempsPreparation || "";
  editionCuisson.value = el.tempsCuisson || "";
  editionNiveau.value = el.niveau || "";
  editionVerre.value = el.verre || "";
  editionGlace.value = el.glace || "";
  editionGarniture.value = el.garniture || "";
  editionMethode.value = el.methode || "";
  editionAlcool.value = el.alcoolBase || "";
  editionAvecAlcool.value = el.avecAlcool === undefined ? "" : el.avecAlcool ? "oui" : "non";
  editionIngredients.value = (el.ingredients || []).join("\n");
  const durees = el.etapesDurees || [];
  editionEtapes.replaceChildren(...(el.etapes || []).map((etape, i) =>
    etape.startsWith("#")
      ? creerLigneEtape(etape.replace(/^#+\s*/, ""), null, true)
      : creerLigneEtape(etape, durees[i] || null, false)));
  editionErreur.hidden = true;
  majEditionRecette();
  majPhotoEdition(el);
  if (!pageEdition.open) pageEdition.showModal();
  pageEdition.scrollTop = 0;
  // Hauteur des zones de texte une fois l'écran affiché
  for (const champ of pageEdition.querySelectorAll(".edition-etape-texte")) ajusterHauteurChamp(champ);
}

// Un champ nombre : vide → undefined ; entier entre min et max → le nombre ;
// sinon NaN (erreur à afficher)
function lireEntier(champ, max) {
  const texte = champ.value.trim();
  if (texte === "") return undefined;
  const nombre = Number(texte);
  return Number.isInteger(nombre) && nombre >= 1 && nombre <= max ? nombre : NaN;
}

// Une zone de texte → une liste de lignes non vides (avec limites)
function lireLignes(champ, max, longueur) {
  return champ.value.split("\n")
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== "")
    .slice(0, max)
    .map((ligne) => ligne.slice(0, longueur));
}

// Une zone de texte d'étapes → la liste des étapes (écran « Photos et
// texte »). Une étape tapée « 1. Mélanger » devient « Mélanger » ;
// « #Titre » devient « # Titre » (titre de partie)
function lireChampEtapes(champ) {
  return lireLignes(champ, LIMITES_FICHE.etapes, LIMITES_FICHE.longueurEtape)
    .map((e) => (e.startsWith("#") ? `# ${e.replace(/^#+\s*/, "")}` : e.replace(/^\d{1,2}\s*[.)]\s+/, "")))
    .filter((e) => e !== "# " && e !== "");
}

const court = (champ) => champ.value.trim().slice(0, LIMITES_FICHE.champCourt);

actionsEdition.addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const nouveauTitre = editionTitre.value.trim();
  if (idActions === null) return;
  if (nouveauTitre === "") {
    afficherMessage("Donne un titre à la fiche.", false, editionErreur);
    editionTitre.focus();
    return;
  }
  const type = editionType.value;
  const texteLien = editionLien.value.trim();
  const lien = lienValide(texteLien);
  if (texteLien !== "" && !lien) {
    afficherMessage("Ce lien n'est pas valide : il doit commencer par http:// ou https://.", false, editionErreur);
    editionLien.focus();
    return;
  }
  const portions = lireEntier(editionPortions, LIMITES_FICHE.portionsMax);
  const preparation = lireEntier(editionPreparation, LIMITES_FICHE.minutesMax);
  const cuisson = lireEntier(editionCuisson, LIMITES_FICHE.minutesMax);
  if (Number.isNaN(portions)) {
    afficherMessage(`${type === "cocktail" ? "Verres" : "Portions"} : un nombre entier entre 1 et ${LIMITES_FICHE.portionsMax}.`, false, editionErreur);
    return;
  }
  if (Number.isNaN(preparation) || (type === "recette" && Number.isNaN(cuisson))) {
    afficherMessage("Temps : un nombre entier de minutes (ou rien).", false, editionErreur);
    return;
  }
  const lus = lireLignesEtapes();
  if (lus.erreur) {
    afficherMessage(lus.erreur, false, editionErreur);
    return;
  }
  const ingredients = lireLignes(editionIngredients, LIMITES_FICHE.ingredients, LIMITES_FICHE.longueurIngredient);
  const ancien = elements.find((e) => e.id === idActions) || {};
  const recette = {
    lien,
    note: editionNote.value.trim().slice(0, LONGUEUR_MAX_NOTE),
    source: court(editionSource),
    portions,
    tempsPreparation: preparation,
    ingredients,
    // Fiche créée avec l'IA : les lignes inchangées gardent leur détail
    ingredientsDetail: detailPourLignes(ingredients, ancien.ingredients, ancien.ingredientsDetail),
    etapes: lus.etapes,
    etapesDurees: lus.durees.some(Boolean) ? lus.durees : undefined,
  };
  // Seuls les champs du type choisi sont modifiés : la cuisson d'une recette
  // passée en cocktail (ou l'inverse) est gardée
  if (type === "recette") {
    recette.tempsCuisson = cuisson;
    recette.niveau = editionNiveau.value || undefined;
  }
  if (type === "cocktail") {
    recette.verre = court(editionVerre);
    recette.glace = court(editionGlace);
    recette.garniture = court(editionGarniture);
    recette.methode = court(editionMethode);
    recette.alcoolBase = court(editionAlcool);
    recette.avecAlcool = editionAvecAlcool.value === "" ? undefined : editionAvecAlcool.value === "oui";
  }
  modifier(idActions, nouveauTitre, type, recette);
  fermerActions();
  // Page de la fiche ouverte derrière : on la redessine
  if (pageFiche.open) {
    personnesFiche = null; // repart des portions (peut-être modifiées)
    afficherFiche();
  }
});

document.getElementById("edition-annuler").addEventListener("click", fermerActions);

// « Supprimer la fiche » : premier appui → « Confirmer la suppression ? »
// pendant 3 secondes ; deuxième appui → la fiche est supprimée
// définitivement, et la fiche ouverte derrière se ferme aussi
editionSupprimer.addEventListener("click", () => {
  if (idActions === null) return;
  if (editionSupprimer.classList.contains("confirmer")) {
    supprimer(idActions);
    fermerActions();
    fermerFiche();
    return;
  }
  editionSupprimer.textContent = "Confirmer la suppression ?";
  editionSupprimer.classList.add("confirmer");
  minuteurConfirmation = setTimeout(annulerConfirmation, 3000);
});

// Photo : mêmes actions que sur la fiche (enregistrées tout de suite)
editionChangerPhoto.addEventListener("click", () => ficheChangerPhoto.click());
editionRetirerPhoto.addEventListener("click", () => ficheRetirerPhoto.click());

// Échap (clavier) ferme aussi l'écran : on remet tout à zéro
pageEdition.addEventListener("close", () => {
  annulerConfirmation();
  idActions = null;
});

// Un appui sur le voile sombre (autour du panneau) ferme le panneau.
// Le contenu est dans un <div> intérieur : un clic qui vise le <dialog>
// lui-même est donc forcément un clic sur le voile.
function fermerSurVoile(panneau, fermer) {
  panneau.addEventListener("click", (evenement) => {
    if (evenement.target === panneau) fermer();
  });
}

// --- 4 ter. Le panneau Réglages (descend du haut de l'écran) ---
const panneauReglages = document.getElementById("panneau-reglages");
const reglagesTitre = document.getElementById("reglages-titre");
const reglagesRetour = document.getElementById("reglages-retour");
const VUES = {
  menu: { titre: "Réglages", bloc: document.getElementById("vue-menu") },
  prenom: { titre: "Prénom", bloc: document.getElementById("vue-prenom") },
  sauvegarde: { titre: "Sauvegarde", bloc: document.getElementById("vue-sauvegarde") },
  relais: { titre: "Relais", bloc: document.getElementById("vue-relais") },
  gemini: { titre: "IA (Gemini)", bloc: document.getElementById("vue-gemini") },
};

// Montre une seule vue du panneau ; la flèche de retour hors du menu
function afficherVue(nom) {
  for (const [cle, vue] of Object.entries(VUES)) vue.bloc.hidden = cle !== nom;
  reglagesTitre.textContent = VUES[nom].titre;
  reglagesRetour.hidden = nom === "menu";
  // Sauvegarde : les photos sont préparées tout de suite, pour que le
  // menu de partage s'ouvre sans attendre après « Exporter »
  if (nom === "sauvegarde") preparerPhotosExport();
}

document.getElementById("bouton-reglages").addEventListener("click", () => {
  afficherVue("menu");
  panneauReglages.showModal();
});
for (const ligne of document.querySelectorAll(".ligne-reglage")) {
  // « Notes » ouvre sa propre page (voir notes.js), pas une vue du panneau
  if (!ligne.dataset.vue) continue;
  ligne.addEventListener("click", () => afficherVue(ligne.dataset.vue));
}
reglagesRetour.addEventListener("click", () => afficherVue("menu"));
const fermerReglages = () => panneauReglages.close();
document.getElementById("reglages-fermer").addEventListener("click", fermerReglages);
fermerSurVoile(panneauReglages, fermerReglages);

// --- 4 quater bis. Navigation : accueil, catégories, favoris ----------
for (const onglet of onglets) {
  onglet.addEventListener("click", () => allerA(onglet.dataset.page));
}

// --- 4 quater. Ajouter un élément : menu des catégories, puis calque de saisie ---
const feuilleAjout = document.getElementById("feuille-ajout");
const ajoutIcone = document.getElementById("ajout-icone");
const ajoutTitre = document.getElementById("ajout-titre");
const ajoutDirect = document.getElementById("ajout-direct");
// Recette : lien, note, et message sous le lien (lien non valide)
const zoneRecette = document.getElementById("zone-recette");
const champLien = document.getElementById("champ-lien");
const champNote = document.getElementById("champ-note");
const messageColler = document.getElementById("message-coller");
// Recette, cocktail : « Importer depuis le lien »
const boutonImporterLien = document.getElementById("bouton-importer-lien");
const messageImport = document.getElementById("message-import");
// Recette, cocktail : « Photos et texte (IA) »
const boutonOuvrirIa = document.getElementById("bouton-ouvrir-ia");

// Catégorie choisie dans le menu (recette, cocktail)
let categorieAjout = "recette";
function categorieChoisie() {
  return categorieAjout;
}

// Titre du calque et texte indicatif du champ, selon la catégorie
const TITRES_AJOUT = {
  recette: "Ajouter une recette",
  cocktail: "Ajouter un cocktail",
};
const INDICATIONS = {
  recette: "Nom de la recette",
  cocktail: "Nom du cocktail",
};

// Quand le clavier de l'iPhone s'ouvre, la page ne rétrécit pas : il
// recouvre le bas de l'écran. On mesure la partie vraiment visible
// (visualViewport) pour caler le calque juste au-dessus du clavier et
// limiter sa hauteur à cette partie visible (voir .feuille dans style.css).
function ajusterAuClavier() {
  const vue = window.visualViewport;
  if (!vue) return; // vieux navigateur : on laisse faire
  const clavier = Math.max(0, window.innerHeight - vue.height - vue.offsetTop);
  feuilleAjout.style.setProperty("--clavier", `${clavier}px`);
  feuilleAjout.style.setProperty("--visible", `${vue.height}px`);
  // Même mesure pour les panneaux (Modifier une fiche, Réglages) : ils
  // restent au-dessus du clavier et jamais plus hauts que la partie visible
  const racine = document.documentElement.style;
  racine.setProperty("--clavier-ecran", `${clavier}px`);
  racine.setProperty("--visible-ecran", `${vue.height}px`);
  // Un site ne peut pas demander si le clavier est ouvert : on le devine
  // quand plus de 100 px du bas de l'écran sont cachés
  feuilleAjout.classList.toggle("clavier-ouvert", clavier > 100);
}

// Empêche la page derrière le menu et le calque de défiler :
// classe « verrou » sur <html> tant que l'un des deux est ouvert
function verrouillerPage() {
  document.documentElement.classList.add("verrou");
}
function deverrouillerPage() {
  const pageNotesOuverte = document.getElementById("page-notes").open;
  if (!menuCategories.open && !feuilleAjout.open && !pageFiche.open && !pageIa.open && !pageNotesOuverte) {
    document.documentElement.classList.remove("verrou");
  }
}
// Sur iPhone, glisser le doigt sur une partie fixe (voile, en-tête, champ)
// fait quand même bouger l'écran : on l'interdit partout, sauf dans les
// champs (pour placer le curseur)
function bloquerGlissement(panneau) {
  panneau.addEventListener("touchmove", (evenement) => {
    if (!evenement.target.matches("input, textarea")) evenement.preventDefault();
  }, { passive: false });
}

// Ouvre le calque de saisie pour une catégorie
function ouvrirAjout(type) {
  categorieAjout = type;
  ajoutIcone.replaceChildren(creerIcone(ICONES_TYPES[type]));
  ajoutTitre.textContent = TITRES_AJOUT[type];
  champTitre.placeholder = INDICATIONS[type];
  champTitre.value = "";
  ajoutDirect.hidden = false;
  champTitre.enterKeyHint = "done"; // touche « OK » du clavier
  // Lien et note vides
  zoneRecette.hidden = false;
  champLien.value = "";
  champNote.value = "";
  messageColler.hidden = true;
  mettreEnAvant(null);
  reinitialiserImport();
  ajusterAuClavier();
  verrouillerPage();
  feuilleAjout.showModal();
  // Focus dans le champ tout de suite (pendant l'appui) : c'est la condition
  // pour que l'iPhone accepte d'ouvrir le clavier
  champTitre.focus();
}

function fermerAjout() {
  reinitialiserImport();
  feuilleAjout.close();
}

// --- Menu des catégories (bouton +) ---
// Le bouton + ouvre le menu ; un appui sur une catégorie ferme le menu et
// ouvre le calque de saisie tout de suite (pendant l'appui : sinon l'iPhone
// refuse d'ouvrir le clavier).
const menuCategories = document.getElementById("menu-categories");
function ouvrirMenu() {
  verrouillerPage();
  menuCategories.showModal();
}
const fermerMenu = () => menuCategories.close();
menuCategories.addEventListener("close", deverrouillerPage);
bloquerGlissement(menuCategories);
for (const choix of menuCategories.querySelectorAll(".choix-menu")) {
  choix.querySelector(".rond-menu").append(creerIcone(ICONES_TYPES[choix.dataset.type]));
  choix.addEventListener("click", () => {
    fermerMenu();
    ouvrirAjout(choix.dataset.type);
  });
}
document.getElementById("menu-fermer").addEventListener("click", fermerMenu);
// Appui sur le voile : la colonne laisse passer les appuis entre les
// boutons (pointer-events), ils arrivent donc sur le <dialog> lui-même
fermerSurVoile(menuCategories, fermerMenu);

// Bouton + : sur Recettes ou Cocktails, saisie directe dans cette catégorie
// (pendant l'appui : le clavier s'ouvre) ; ailleurs, menu des catégories
document.getElementById("bouton-ajouter").addEventListener("click", () => {
  if (estFiche(pageActive)) ouvrirAjout(pageActive);
  else ouvrirMenu();
});
// Flèche de retour : on referme le calque et on revient au menu
document.getElementById("ajout-retour").addEventListener("click", () => {
  fermerAjout();
  ouvrirMenu();
});
document.getElementById("ajout-fermer").addEventListener("click", fermerAjout);
fermerSurVoile(feuilleAjout, fermerAjout);
feuilleAjout.addEventListener("close", deverrouillerPage);
bloquerGlissement(feuilleAjout);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", ajusterAuClavier);
  window.visualViewport.addEventListener("scroll", ajusterAuClavier);
}
ajusterAuClavier(); // premières mesures (panneaux)

// « Ajouter » : le titre tel qu'il est écrit, avec le lien et la note
function ajouterTelQuel() {
  const type = categorieChoisie();
  const titre = champTitre.value.trim();
  let infos = null;
  // Recette, cocktail : lien (vérifié) et note, tous les deux facultatifs
  if (estFiche(type)) {
    const texteLien = champLien.value.trim();
    const lien = lienValide(texteLien);
    if (texteLien !== "" && !lien) {
      montrerMessageColler("Ce lien n'est pas valide : il doit commencer par http:// ou https://.");
      champLien.focus();
      return;
    }
    // Titre vide mais lien présent : on propose le nom du site comme titre
    if (titre === "" && lien) {
      proposerTitre(lien);
      return;
    }
    infos = { lien, note: champNote.value.trim().slice(0, LONGUEUR_MAX_NOTE) };
    // Recette importée depuis ce même lien : on garde tout ce qui a été trouvé
    // (photos, ingrédients, étapes, portions, temps)
    if (recetteImportee && recetteImportee.lien === lien) {
      for (const cle of CHAMPS_FICHE) infos[cle] = recetteImportee[cle];
    }
  }
  if (titre === "") {
    champTitre.focus(); // rien d'écrit : on remet simplement le curseur
    return;
  }
  ajouter(titre, type, infos);
  fermerAjout();
  // La nouvelle fiche s'ouvre (comme après « Photos et texte ») : le crayon
  // permet de la compléter (photo, ingrédients, étapes…)
  ouvrirFiche(elements[elements.length - 1].id);
}

// --- Recette : message sous le lien ---
function montrerMessageColler(texte) {
  messageColler.textContent = texte;
  messageColler.hidden = false;
}

// Titre vide : on y met le nom du site (« instagram.com »), déjà
// sélectionné pour qu'il suffise de taper par-dessus
function proposerTitre(lien) {
  if (champTitre.value.trim() !== "") return;
  champTitre.value = domaine(lien);
  champTitre.focus();
  champTitre.select();
}

// Met un bouton en avant (orange) pour montrer l'étape suivante conseillée
function mettreEnAvant(bouton) {
  for (const b of [boutonImporterLien, boutonOuvrirIa]) b.classList.toggle("mise-en-avant", b === bouton);
}

// Lien collé ou tapé à la main : même proposition de titre.
// (Collé : tout de suite ; tapé : quand on quitte le champ, pour ne pas
// proposer un titre à partir d'une adresse à moitié écrite.)
champLien.addEventListener("input", (evenement) => {
  messageColler.hidden = true;
  // Le lien a changé : ce qui avait été importé ne correspond plus
  if (recetteImportee && lienValide(champLien.value) !== recetteImportee.lien) {
    recetteImportee = null;
    messageImport.hidden = true;
  }
  if (evenement.inputType === "insertFromPaste") {
    const lien = lienValide(champLien.value);
    if (lien) proposerTitre(lien);
  }
});
champLien.addEventListener("change", () => {
  const lien = lienValide(champLien.value);
  if (lien) proposerTitre(lien);
});

// --- Recette, cocktail : « Importer depuis le lien » ---
// 1. l'app demande la page au relais (Réglages → Relais) ;
// 2. recettes.js cherche le bloc JSON-LD « Recipe » dans le HTML ;
// 3. le titre est rempli et un résumé s'affiche ; rien n'est enregistré
//    tant qu'on n'a pas touché « Ajouter ».
// En cas d'échec (pas de relais, hors ligne, site qui refuse, pas de
// recette), un message simple : on peut toujours ajouter à la main.
const CLE_RELAIS = "toque-tonic-relais";
const DELAI_IMPORT = 12000; // 12 s : le relais abandonne lui-même au bout de 8 s
const TEXTE_BOUTON_IMPORT = "Importer depuis le lien";
const MESSAGE_PAS_DE_RECETTE = "Je n'ai pas trouvé de recette sur cette page. Tu peux l'ajouter à la main.";

// Ce qu'« Importer » a trouvé, en attendant « Ajouter » : { lien, titre, images, … }
let recetteImportee = null;
// Numéro du dernier import : une réponse qui arrive après la fermeture du
// calque (ou après un nouvel import) est ignorée
let numeroImport = 0;

function reinitialiserImport() {
  numeroImport++;
  recetteImportee = null;
  messageImport.hidden = true;
  boutonImporterLien.disabled = false;
  boutonImporterLien.textContent = TEXTE_BOUTON_IMPORT;
}

// Import impossible : on montre le message, et « Photos et texte (IA) »
// passe en orange (l'IA peut lire des captures ou la légende copiée)
const SUITE_ECHEC_IMPORT = " Essaie aussi « Photos et texte (IA) » avec des captures ou le texte de la recette.";
function echecImport(texte) {
  afficherMessage(texte + SUITE_ECHEC_IMPORT, false, messageImport);
  mettreEnAvant(boutonOuvrirIa);
}

async function importerDepuisLien() {
  messageImport.hidden = true;
  messageColler.hidden = true;
  mettreEnAvant(null);
  const lien = lienValide(champLien.value);
  if (!lien) {
    afficherMessage("Colle d'abord le lien de la page (il doit commencer par http:// ou https://).", false, messageImport);
    champLien.focus();
    return;
  }
  const relais = lireCle(CLE_RELAIS);
  if (relais === "") {
    echecImport("Import impossible : ajoute l'adresse du relais dans Réglages → Relais. Tu peux ajouter la recette à la main.");
    return;
  }

  const numero = ++numeroImport;
  recetteImportee = null;
  boutonImporterLien.disabled = true;
  boutonImporterLien.textContent = "Import en cours…";

  let recette = null;
  try {
    const adresse = new URL(relais);
    adresse.searchParams.set("url", lien);
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), DELAI_IMPORT);
    try {
      const reponse = await fetch(adresse, { signal: controle.signal, credentials: "omit", cache: "no-store" });
      if (reponse.ok) recette = extraireRecette(await reponse.text(), lien);
    } finally {
      clearTimeout(minuteur);
    }
  } catch {
    recette = null; // relais injoignable, délai dépassé, hors ligne…
  }
  if (numero !== numeroImport) return; // calque fermé ou autre import lancé entre-temps

  boutonImporterLien.disabled = false;
  boutonImporterLien.textContent = TEXTE_BOUTON_IMPORT;
  if (!recette) {
    echecImport(MESSAGE_PAS_DE_RECETTE);
    return;
  }

  recetteImportee = { lien, ...recette };
  // Titre : on remplace un champ vide ou le nom du site proposé automatiquement,
  // jamais un titre tapé à la main
  const titreActuel = champTitre.value.trim();
  if (recette.titre && (titreActuel === "" || titreActuel === domaine(lien))) {
    champTitre.value = recette.titre;
  }
  const nbEtapes = recette.etapes.filter((e) => !e.startsWith("# ")).length;
  const trouve = [
    recette.ingredients.length ? pluriel(recette.ingredients.length, "ingrédient") : "",
    nbEtapes ? pluriel(nbEtapes, "étape") : "",
    recette.images.length ? pluriel(recette.images.length, "photo") : "",
  ].filter(Boolean).join(", ");
  afficherMessage(`✓ Recette trouvée${trouve ? ` : ${trouve}` : ""}. Touche « Ajouter » pour l'enregistrer.`, true, messageImport);
}
boutonImporterLien.addEventListener("click", importerDepuisLien);

// Touche Entrée dans le titre ou le lien. Le formulaire a maintenant
// plusieurs champs : le navigateur ne l'envoie plus tout seul, on le fait ici.
// (Dans la note, Entrée passe simplement à la ligne.)
for (const champ of [champTitre, champLien]) {
  champ.addEventListener("keydown", (evenement) => {
    if (evenement.key !== "Enter" || evenement.isComposing) return;
    evenement.preventDefault();
    formulaire.requestSubmit();
  });
}
// Touche Entrée du clavier ou bouton « Ajouter » : ajoute la fiche
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche la page de se recharger
  ajouterTelQuel();
});
ajoutDirect.addEventListener("click", ajouterTelQuel);

// --- 5. La page d'une fiche (recette, cocktail) ---------------
// S'ouvre quand on touche la carte : en-tête (retour, modifier, favori),
// badge et numéro dans le carnet, grande photo, métadonnées, portions,
// ingrédients à cocher, étapes, notes, source, bouton « mode cuisine ».
// Tout le texte passe par textContent : un texte importé ne peut jamais
// injecter de HTML.
const pageFiche = document.getElementById("fiche");
const ficheBarreTitre = document.getElementById("fiche-barre-titre");
const ficheFavori = document.getElementById("fiche-favori");
const ficheBadges = document.getElementById("fiche-badges");
const ficheNumeroCarnet = document.getElementById("fiche-numero-carnet");
const fichePhotos = document.getElementById("fiche-photos");
const fichePoints = document.getElementById("fiche-points");
const fichePhotoVide = document.getElementById("fiche-photo-vide");
const ficheBoutonsPhoto = document.getElementById("fiche-boutons-photo");
const ficheTitre = document.getElementById("fiche-titre");
const ficheInfos = document.getElementById("fiche-infos");
const ficheInfosPlus = document.getElementById("fiche-infos-plus");
const fichePortionsLibelle = document.getElementById("fiche-portions-libelle");
const ficheTitreIngredients = document.getElementById("fiche-titre-ingredients");
const ficheTitreEtapes = document.getElementById("fiche-titre-etapes");
const ficheTitreNotes = document.getElementById("fiche-titre-notes");
const fichePour = document.getElementById("fiche-pour");
const ficheNote = document.getElementById("fiche-note");
const ficheBlocSource = document.getElementById("fiche-bloc-source");
const ficheSourceTexte = document.getElementById("fiche-source-texte");
const ficheSource = document.getElementById("fiche-source");
const ficheBlocPortions = document.getElementById("fiche-bloc-portions");
const ficheBlocIngredients = document.getElementById("fiche-bloc-ingredients");
const ficheIngredients = document.getElementById("fiche-ingredients");
const ficheBlocEtapes = document.getElementById("fiche-bloc-etapes");
const ficheEtapes = document.getElementById("fiche-etapes");
const ficheVide = document.getElementById("fiche-vide");
const ficheBas = document.getElementById("fiche-bas");
const portionsTexte = document.getElementById("portions-texte");
const portionsMoins = document.getElementById("portions-moins");
const portionsPlus = document.getElementById("portions-plus");
const portionsInconnues = document.getElementById("portions-inconnues");

// Fiche affichée (null = fermée) et nombre de personnes choisi (null = celui
// de la recette). Ce choix n'est pas enregistré : la fiche repart de zéro
// à chaque ouverture.
let idFiche = null;
let personnesFiche = null;

// Portions d'origine ; si la fiche ne les donne pas : 4 pour une recette,
// 1 verre pour un cocktail
const portionsDeBase = (el) => el.portions || (el.type === "cocktail" ? 1 : 4);
// Un cocktail s'affiche toujours pour 1 verre à l'ouverture
const portionsAuDepart = (el) => (el.type === "cocktail" ? 1 : portionsDeBase(el));

// Dosages des cocktails : toujours en onces (v1.14 ; la bascule CL / OZ
// est retirée). Les centilitres et millilitres sont convertis à l'affichage.
const UNITE_DOSAGES = "oz";

function ouvrirFiche(id) {
  if (!elements.some((e) => e.id === id)) return;
  idFiche = id;
  personnesFiche = null;
  ficheMessagePhoto.hidden = true;
  afficherFiche();
  verrouillerPage();
  pageFiche.showModal();
  pageFiche.scrollTop = 0;
  fichePhotos.scrollLeft = 0;
}

function fermerFiche() {
  if (pageFiche.open) pageFiche.close();
}
pageFiche.addEventListener("close", () => {
  idFiche = null;
  deverrouillerPage();
});
document.getElementById("fiche-retour").addEventListener("click", fermerFiche);

// Numéro de la fiche dans le carnet : 1 pour la plus ancienne
function numeroDansCarnet(el) {
  const fiches = elements.filter((e) => estFiche(e.type))
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  return fiches.indexOf(el) + 1;
}

// Une métadonnée : icône ambre, libellé en capitales, valeur
function creerInfo(nomIcone, libelle, valeur) {
  const li = document.createElement("li");
  li.className = "fiche-info";
  const etiquette = document.createElement("span");
  etiquette.className = "t-libelle-petit fiche-info-libelle";
  etiquette.textContent = libelle;
  const texte = document.createElement("span");
  texte.className = "t-quantite fiche-info-valeur";
  texte.textContent = valeur || "—";
  li.append(icone(nomIcone), etiquette, texte);
  return li;
}

// Dessine toute la fiche à partir de l'élément enregistré
function afficherFiche() {
  const el = elements.find((e) => e.id === idFiche);
  // Supprimée : la page n'a plus lieu d'être
  if (!el || !estFiche(el.type)) {
    fermerFiche();
    return;
  }
  ficheBarreTitre.textContent = NOMS_SIMPLES[el.type];
  majFavoriFiche(el);

  const badge = document.createElement("span");
  badge.className = `pilule pilule-${el.type}`;
  badge.textContent = NOMS_SIMPLES[el.type];
  ficheBadges.replaceChildren(badge);
  // Cocktail : « Contient de l'alcool » (le champ, sinon un alcool de base
  // renseigné) ou « Sans alcool » si c'est indiqué
  const cocktail = el.type === "cocktail";
  const alcool = el.avecAlcool ?? (el.alcoolBase ? true : undefined);
  if (cocktail && alcool !== undefined) {
    const pilule = document.createElement("span");
    pilule.className = alcool ? "pilule pilule-alerte" : "pilule pilule-neutre";
    pilule.textContent = alcool ? "Contient de l'alcool" : "Sans alcool";
    ficheBadges.append(pilule);
  }
  ficheNumeroCarnet.textContent = `Mon carnet · N° ${numeroDansCarnet(el)}`;
  ficheTitre.textContent = el.titre;

  afficherPhotos(el);
  majBoutonsPhotoFiche(el);

  // Recette : 4 métadonnées (préparation, cuisson, portions, niveau).
  // Cocktail (v1.14) : plus de tuiles verre, glace, garniture, temps (les
  // champs restent dans Modifier) ; seulement méthode et alcool de base
  // sur une ligne discrète.
  const infos = cocktail
    ? []
    : [
      creerInfo("horloge", "Prép.", el.tempsPreparation && formaterDuree(el.tempsPreparation)),
      creerInfo("flamme", "Cuisson", el.tempsCuisson && formaterDuree(el.tempsCuisson)),
      creerInfo("personnes", "Portions", el.portions && String(el.portions)),
      creerInfo("niveau", "Niveau", el.niveau && NOMS_NIVEAUX[el.niveau]),
    ];
  ficheInfos.replaceChildren(...infos);
  ficheInfos.hidden = cocktail;
  const plus = cocktail
    ? [el.methode && `Méthode : ${el.methode}`, el.alcoolBase && `Alcool de base : ${el.alcoolBase}`].filter(Boolean)
    : [];
  ficheInfosPlus.hidden = plus.length === 0;
  ficheInfosPlus.textContent = plus.join(" · ");

  // Titres des blocs selon le type
  ficheTitreIngredients.textContent = cocktail ? "Dosages" : "Ingrédients";
  ficheTitreEtapes.textContent = cocktail ? "Préparation" : "Étapes";
  ficheTitreNotes.textContent = cocktail ? "Mes notes de dégustation" : "Mes notes";
  fichePortionsLibelle.textContent = cocktail ? "Verres" : "Portions";
  portionsMoins.setAttribute("aria-label", cocktail ? "Un verre de moins" : "Une personne de moins");
  portionsPlus.setAttribute("aria-label", cocktail ? "Un verre de plus" : "Une personne de plus");

  afficherIngredients(el);

  // Étapes : un bloc par étape, numéroté ; « # Titre » = titre de partie ;
  // une étape avec une durée affiche un petit minuteur
  const etapes = el.etapes || [];
  const durees = el.etapesDurees || [];
  let numero = 0;
  ficheEtapes.replaceChildren(...etapes.map((etape, i) => {
    const li = document.createElement("li");
    if (etape.startsWith("#")) {
      li.className = "fiche-section t-libelle";
      li.textContent = etape.replace(/^#+\s*/, "");
      return li;
    }
    numero++;
    li.className = "fiche-etape";
    const pastille = document.createElement("span");
    pastille.className = "fiche-numero";
    pastille.textContent = numero;
    pastille.setAttribute("aria-label", `Étape ${numero}`);
    const corps = document.createElement("div");
    corps.className = "fiche-etape-corps";
    const texte = document.createElement("p");
    texte.textContent = etape;
    corps.append(texte);
    if (durees[i]) {
      const duree = document.createElement("span");
      duree.className = "pilule pilule-cocktail fiche-etape-duree";
      duree.append(icone("minuteur"), formaterSecondes(durees[i]));
      corps.append(duree);
    }
    li.append(pastille, corps);
    return li;
  }));
  ficheBlocEtapes.hidden = etapes.length === 0;
  ficheVide.hidden = etapes.length > 0 || (el.ingredients || []).length > 0;
  // « Lancer le mode cuisine » : pour une recette avec des étapes numérotées
  const modeCuisinePossible = numero > 0 && !cocktail;
  ficheBas.hidden = !modeCuisinePossible;
  pageFiche.classList.toggle("avec-bas", modeCuisinePossible);

  // Mes notes
  ficheNote.textContent = el.note || "Pas encore de note. Touche le crayon pour en ajouter une.";
  ficheNote.classList.toggle("fiche-note-vide", !el.note);

  // D'où ça vient : la source écrite, sinon le site du lien
  const source = texteSource(el);
  ficheBlocSource.hidden = !source;
  ficheSourceTexte.textContent = source;
  ficheSource.hidden = !el.lien;
  if (el.lien) ficheSource.href = el.lien;
}

// Durée d'une étape : 90 → « 1 min 30 », 600 → « 10 min », 20 → « 20 s »
function formaterSecondes(secondes) {
  if (secondes < 60) return `${secondes} s`;
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  if (minutes >= 60) return formaterDuree(minutes);
  return reste ? `${minutes} min ${String(reste).padStart(2, "0")}` : `${minutes} min`;
}

// --- Favori : le signet de l'en-tête ---
function majFavoriFiche(el) {
  const favori = Boolean(el.favori);
  ficheFavori.setAttribute("aria-pressed", String(favori));
  ficheFavori.setAttribute("aria-label", favori ? "Retirer des favoris" : "Ajouter aux favoris");
  ficheFavori.querySelector("svg").classList.toggle("plein", favori);
}
ficheFavori.addEventListener("click", () => {
  const el = elements.find((e) => e.id === idFiche);
  if (!el) return;
  if (el.favori) delete el.favori; else el.favori = true;
  sauvegarder();
  majFavoriFiche(el);
  afficher();
});

// Photo de présentation : une seule, la première (v1.14 : plus de
// défilement ; les autres restent enregistrées dans la fiche). Sans photo : le
// cadre pointillé « Ajouter une photo ». Une photo qui ne se charge pas
// (hors ligne, site qui refuse) laisse voir l'appareil photo du fond.
function afficherPhotos(el) {
  // La photo gardée (mémoire des photos, « idb:… ») passe en premier
  const images = [adressePhotoFiche(el), ...(el.images || [])].filter(Boolean).slice(0, 1);
  fichePhotos.replaceChildren();
  fichePoints.replaceChildren();
  fichePhotos.hidden = images.length === 0;
  fichePhotoVide.hidden = images.length > 0;
  fichePoints.hidden = images.length < 2;
  images.forEach((adresse, rang) => {
    const cadre = document.createElement("div");
    cadre.className = "fiche-photo";
    cadre.append(icone("appareil")); // fond de repli
    // Copie floutée de la même photo, derrière : elle comble les bandes
    // vides quand la photo (affichée en entier) n'a pas le format du cadre.
    // Purement décorative : cachée aux lecteurs d'écran.
    const fond = document.createElement("img");
    fond.className = "fiche-photo-fond";
    poserSource(fond, adresse, () => fond.remove());
    fond.alt = "";
    fond.setAttribute("aria-hidden", "true");
    fond.referrerPolicy = "no-referrer";
    fond.decoding = "async";
    if (rang > 0) fond.loading = "lazy";
    fond.addEventListener("error", () => fond.remove());
    cadre.append(fond);
    const image = document.createElement("img");
    poserSource(image, adresse, () => image.remove());
    image.alt = images.length > 1 ? `Photo ${rang + 1} sur ${images.length}` : "";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    if (rang > 0) image.loading = "lazy";
    image.addEventListener("error", () => image.remove());
    cadre.append(image);
    fichePhotos.append(cadre);
    if (images.length > 1) {
      const point = document.createElement("span");
      point.className = "fiche-point";
      fichePoints.append(point);
    }
  });
  majPoints();
}

// Le point de la photo visible devient terracotta
function majPoints() {
  const rang = Math.round(fichePhotos.scrollLeft / Math.max(1, fichePhotos.clientWidth));
  [...fichePoints.children].forEach((point, i) => point.classList.toggle("actif", i === rang));
}
fichePhotos.addEventListener("scroll", majPoints, { passive: true });

// Ingrédients pour le nombre de personnes choisi. Le texte d'origine n'est
// jamais modifié : on calcule seulement ce qui est affiché. Pas de case à
// cocher (v1.14). Dose et ingrédient ensemble : « 300 g de champignons »,
// et pour un cocktail (v1.15) « 1 ½ oz de gin » (dosage en onces).
function afficherIngredients(el) {
  const ingredients = el.ingredients || [];
  ficheBlocIngredients.hidden = ingredients.length === 0;
  ficheBlocPortions.hidden = ingredients.length === 0;
  const cocktail = el.type === "cocktail";
  const base = portionsDeBase(el);
  const depart = portionsAuDepart(el);
  const personnes = personnesFiche ?? depart;
  const facteur = personnes / base;

  portionsTexte.textContent = String(personnes);
  portionsTexte.setAttribute("aria-label", cocktail ? `Pour ${pluriel(personnes, "verre")}` : `Pour ${pluriel(personnes, "personne")}`);
  portionsMoins.disabled = personnes <= 1;
  portionsPlus.disabled = personnes >= LIMITES_FICHE.portionsMax;
  portionsInconnues.hidden = Boolean(el.portions) || cocktail;
  // Cocktail : « Pour 1 verre »
  fichePour.hidden = !cocktail;
  fichePour.textContent = `Pour ${pluriel(personnes, "verre")}`;

  // Fiche créée avec l'IA : la quantité détaillée de la ligne (plus fiable),
  // sinon la quantité lue dans la ligne
  const detail = el.ingredientsDetail || [];
  ficheIngredients.replaceChildren(...ingredients.map((ligne, i) => {
    const separe = separerIngredient(ligne, detail[i], facteur);
    const nom = separe.nom;
    // Cocktail : en onces ; recette : en g / kg et ml / L (v1.16)
    const quantite = cocktail ? convertirDosage(separe.quantite, UNITE_DOSAGES) : convertirMetrique(separe.quantite);
    const li = document.createElement("li");
    li.className = "ingredient";
    const etiquette = document.createElement("div");
    etiquette.className = "ingredient-ligne";
    // « 300 g » en terracotta, puis « de champignons »
    const texte = document.createElement("span");
    texte.className = "ingredient-nom";
    if (quantite) {
      const dose = document.createElement("span");
      dose.className = "t-quantite ingredient-dose";
      dose.textContent = quantite;
      texte.append(dose, liaisonIngredient(quantite, nom) + nom);
    } else {
      texte.textContent = nom;
    }
    etiquette.append(texte);
    li.append(etiquette);
    return li;
  }));
}

// Ce qui relie la dose au nom : « 300 g » + « de » + « champignons »,
// « 1 c. à s. » + « d' » + « huile » ; un simple nombre (« 2 œufs ») ou un
// nom qui commence déjà par « de » : juste une espace.
function liaisonIngredient(quantite, nom) {
  const avecUnite = /[a-zA-ZÀ-ÿ.]$/.test(quantite.trim());
  if (!avecUnite || /^(de|du|des|d')(\s|$)/i.test(nom)) return " ";
  return /^([aeiouyàâäéèêëîïôöùûüœæ]|h(uile|erbe))/i.test(nom) ? " d'" : " de ";
}

// Boutons − et + (minimum 1 personne), et « Revenir à … »
function changerPersonnes(ecart) {
  const el = elements.find((e) => e.id === idFiche);
  if (!el) return;
  const actuel = personnesFiche ?? portionsAuDepart(el);
  personnesFiche = Math.min(LIMITES_FICHE.portionsMax, Math.max(1, actuel + ecart));
  afficherIngredients(el);
}
portionsMoins.addEventListener("click", () => changerPersonnes(-1));
portionsPlus.addEventListener("click", () => changerPersonnes(1));

// Crayon : le panneau de modification monte par-dessus la fiche
// (« Supprimer la fiche » est en bas de ce panneau depuis la v1.7)
document.getElementById("fiche-modifier").addEventListener("click", () => {
  if (idFiche === null) return;
  editionDepuisFiche = true;
  ouvrirEdition(idFiche);
});

// --- 5 ter. Le mode Cuisine ---------------------------------
// Une étape à la fois, en grand, par-dessus la fiche. L'écran reste allumé
// (Wake Lock) quand l'appareil le permet. Une étape qui a une durée
// (« etapesDurees ») affiche un minuteur. Rien n'est enregistré.
const modeCuisine = document.getElementById("mode-cuisine");
const cuisineTitre = document.getElementById("cuisine-titre");
const cuisineProgression = document.getElementById("cuisine-progression");
const cuisineSegments = document.getElementById("cuisine-segments");
const cuisinePartie = document.getElementById("cuisine-partie");
const cuisineNumero = document.getElementById("cuisine-numero");
const cuisineTexte = document.getElementById("cuisine-texte");
const cuisinePrecedent = document.getElementById("cuisine-precedent");
const cuisineSuivant = document.getElementById("cuisine-suivant");
const cuisineMinuteur = document.getElementById("cuisine-minuteur");
const minuteurArc = document.getElementById("minuteur-arc");
const minuteurTemps = document.getElementById("minuteur-temps");
const minuteurLancer = document.getElementById("minuteur-lancer");
const minuteurRemettre = document.getElementById("minuteur-remettre");
const minuteurMessage = document.getElementById("minuteur-annonce");

// Étapes numérotées de la fiche : { texte, partie, duree (secondes ou null) }
let etapesCuisine = [];
let rangCuisine = 0;
// Minuteurs, un par étape (clé : rang) : { duree, fin (heure de fin si
// lancé), restant (secondes, si en pause ou pas lancé), sonne }.
// On garde l'heure de fin plutôt qu'un compte à rebours : si l'iPhone met
// l'app en pause (écran verrouillé), le temps reste juste au retour.
let minuteurs = new Map();
let tic = null;
let verrouEcran = null;

function etapesPourCuisine(el) {
  const durees = el.etapesDurees || [];
  const liste = [];
  let partie = "";
  (el.etapes || []).forEach((etape, i) => {
    if (etape.startsWith("#")) {
      partie = etape.replace(/^#+\s*/, "");
      return;
    }
    liste.push({ texte: etape, partie, duree: durees[i] || null });
  });
  return liste;
}

function ouvrirModeCuisine() {
  const el = elements.find((e) => e.id === idFiche);
  if (!el) return;
  etapesCuisine = etapesPourCuisine(el);
  if (etapesCuisine.length === 0) return;
  rangCuisine = 0;
  minuteurs = new Map();
  cuisineTitre.textContent = el.titre;
  cuisineSegments.replaceChildren(...etapesCuisine.map(() => document.createElement("span")));
  afficherEtapeCuisine();
  modeCuisine.showModal();
  garderEcranAllume();
  clearInterval(tic);
  tic = setInterval(majMinuteur, 250);
}
document.getElementById("fiche-mode-cuisine").addEventListener("click", ouvrirModeCuisine);

const fermerModeCuisine = () => modeCuisine.close();
document.getElementById("cuisine-fermer").addEventListener("click", fermerModeCuisine);
modeCuisine.addEventListener("close", () => {
  clearInterval(tic);
  tic = null;
  minuteurs = new Map();
  libererEcran();
});

function afficherEtapeCuisine() {
  const total = etapesCuisine.length;
  const etape = etapesCuisine[rangCuisine];
  cuisineProgression.textContent = `Étape ${rangCuisine + 1} sur ${total}`;
  [...cuisineSegments.children].forEach((segment, i) => {
    segment.classList.toggle("fait", i < rangCuisine);
    segment.classList.toggle("actuel", i === rangCuisine);
  });
  cuisinePartie.hidden = !etape.partie;
  cuisinePartie.textContent = etape.partie;
  cuisineNumero.textContent = String(rangCuisine + 1);
  cuisineTexte.textContent = etape.texte;
  cuisinePrecedent.disabled = rangCuisine === 0;
  const derniere = rangCuisine === total - 1;
  cuisineSuivant.replaceChildren(derniere ? "Bon appétit" : "Suivant");
  if (!derniere) cuisineSuivant.append(icone("chevron"));
  cuisineMinuteur.hidden = !etape.duree;
  if (etape.duree && !minuteurs.has(rangCuisine)) {
    minuteurs.set(rangCuisine, { duree: etape.duree, fin: null, restant: etape.duree, sonne: false });
  }
  majMinuteur();
  modeCuisine.scrollTop = 0;
}

cuisinePrecedent.addEventListener("click", () => {
  if (rangCuisine === 0) return;
  rangCuisine--;
  afficherEtapeCuisine();
});
cuisineSuivant.addEventListener("click", () => {
  if (rangCuisine >= etapesCuisine.length - 1) {
    fermerModeCuisine(); // « Bon appétit »
    return;
  }
  rangCuisine++;
  afficherEtapeCuisine();
});

// --- Minuteur ---
// Secondes restantes d'un minuteur (jamais moins de 0)
function secondesRestantes(m) {
  if (m.fin === null) return m.restant;
  return Math.max(0, Math.ceil((m.fin - Date.now()) / 1000));
}
// 125 → « 2:05 », 3725 → « 1:02:05 »
function formaterChrono(secondes) {
  const h = Math.floor(secondes / 3600);
  const min = Math.floor((secondes % 3600) / 60);
  const sec = String(secondes % 60).padStart(2, "0");
  return h ? `${h}:${String(min).padStart(2, "0")}:${sec}` : `${min}:${sec}`;
}

const CIRCONFERENCE = 2 * Math.PI * 52; // rayon du cercle : 52
minuteurArc.style.strokeDasharray = String(CIRCONFERENCE);

function majMinuteur() {
  // Un minuteur lancé sur une autre étape peut finir : on le signale aussi
  for (const [rang, m] of minuteurs) {
    if (m.fin !== null && !m.sonne && secondesRestantes(m) === 0) {
      m.sonne = true;
      m.restant = 0;
      m.fin = null;
      signalerFinMinuteur(rang);
    }
  }
  const m = minuteurs.get(rangCuisine);
  if (!m || cuisineMinuteur.hidden) return;
  const restant = secondesRestantes(m);
  minuteurTemps.textContent = formaterChrono(restant);
  minuteurArc.style.strokeDashoffset = String(CIRCONFERENCE * (1 - restant / m.duree));
  cuisineMinuteur.classList.toggle("fini", m.sonne);
  const enCours = m.fin !== null;
  minuteurLancer.textContent = m.sonne ? "Terminé" : enCours ? "Pause" : restant < m.duree ? "Reprendre" : "Lancer";
  minuteurLancer.disabled = m.sonne;
  minuteurRemettre.hidden = !m.sonne && restant === m.duree;
}

minuteurLancer.addEventListener("click", () => {
  const m = minuteurs.get(rangCuisine);
  if (!m || m.sonne) return;
  preparerSon(); // l'iPhone n'autorise le son qu'après un appui
  if (m.fin === null) {
    m.fin = Date.now() + secondesRestantes(m) * 1000;
  } else {
    m.restant = secondesRestantes(m);
    m.fin = null;
  }
  majMinuteur();
});
minuteurRemettre.addEventListener("click", () => {
  const m = minuteurs.get(rangCuisine);
  if (!m) return;
  Object.assign(m, { fin: null, restant: m.duree, sonne: false });
  majMinuteur();
});

// Fin d'un minuteur : petit signal sonore (si le son est permis), vibration
// (Android) et message lu par VoiceOver
let contexteSon = null;
function preparerSon() {
  try {
    contexteSon = contexteSon || new (window.AudioContext || window.webkitAudioContext)();
    if (contexteSon.state === "suspended") contexteSon.resume();
  } catch { contexteSon = null; }
}
function signalerFinMinuteur(rang) {
  minuteurMessage.textContent = `Minuteur de l'étape ${rang + 1} terminé.`;
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (!contexteSon) return;
  try {
    const debut = contexteSon.currentTime;
    for (const decalage of [0, 0.35, 0.7]) {
      const oscillateur = contexteSon.createOscillator();
      const volume = contexteSon.createGain();
      oscillateur.frequency.value = 880;
      volume.gain.setValueAtTime(0.0001, debut + decalage);
      volume.gain.exponentialRampToValueAtTime(0.25, debut + decalage + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, debut + decalage + 0.25);
      oscillateur.connect(volume).connect(contexteSon.destination);
      oscillateur.start(debut + decalage);
      oscillateur.stop(debut + decalage + 0.3);
    }
  } catch { /* pas de son : le minuteur affiche quand même « Terminé » */ }
}

// --- Écran allumé (Wake Lock) ---
// Demandé à l'ouverture, et de nouveau au retour dans l'app (l'iPhone le
// relâche quand l'app passe en arrière-plan). Sans cette fonction
// (anciens iPhone), l'écran s'éteint comme d'habitude.
async function garderEcranAllume() {
  if (!("wakeLock" in navigator) || !modeCuisine.open || verrouEcran) return;
  try {
    verrouEcran = await navigator.wakeLock.request("screen");
    verrouEcran.addEventListener("release", () => { verrouEcran = null; });
  } catch {
    verrouEcran = null;
  }
}
function libererEcran() {
  if (verrouEcran) verrouEcran.release().catch(() => {});
  verrouEcran = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && modeCuisine.open) {
    garderEcranAllume();
    majMinuteur(); // le temps passé en arrière-plan est rattrapé
  }
});

// « Changer la photo » / « Retirer la photo » : la photo de la fiche,
// choisie dans la photothèque ou prise avec l'appareil photo, sans IA.
// Réduite sur l'appareil (1200 px, JPEG 80 %) puis rangée dans la mémoire
// des photos ; l'ancienne est effacée. Les photos venues d'un site web
// restent derrière, dans le défilement.
const ficheChangerPhoto = document.getElementById("fiche-changer-photo");
const ficheRetirerPhoto = document.getElementById("fiche-retirer-photo");
const ficheFichierPhoto = document.getElementById("fiche-fichier-photo");
const ficheMessagePhoto = document.getElementById("fiche-message-photo");
const ficheAjouterPhoto = document.getElementById("fiche-ajouter-photo");
const TEXTE_CHANGER_PHOTO = "Changer la photo";

// Avec une photo : « Changer » (et « Retirer » si c'est la photo gardée)
// sous la photo. Sans photo : « Ajouter une photo » dans le cadre pointillé.
function majBoutonsPhotoFiche(el) {
  const aSaPhoto = Boolean(el.photoId || el.photoPerso);
  const aDesPhotos = aSaPhoto || (el.images || []).length > 0;
  ficheBoutonsPhoto.hidden = !aDesPhotos;
  ficheChangerPhoto.textContent = TEXTE_CHANGER_PHOTO;
  ficheChangerPhoto.disabled = false;
  ficheAjouterPhoto.textContent = "Ajouter une photo";
  ficheAjouterPhoto.disabled = false;
  ficheRetirerPhoto.hidden = !aSaPhoto;
  majPhotoEdition(el); // écran Modifier ouvert : même photo
}

// Remplace la photo de la fiche (null : la retire) ; renvoie true si c'est fait
function remplacerPhotoFiche(el, nouvelId) {
  const ancienId = el.photoId;
  const ancienTexte = el.photoPerso;
  if (nouvelId) el.photoId = nouvelId; else delete el.photoId;
  delete el.photoPerso;
  try {
    sauvegarder();
  } catch {
    // mémoire pleine : on remet comme avant
    if (ancienId) el.photoId = ancienId; else delete el.photoId;
    if (ancienTexte) el.photoPerso = ancienTexte;
    if (nouvelId) supprimerPhoto(nouvelId).catch(() => {});
    afficherMessage("Impossible d'enregistrer : la mémoire de l'app est pleine.", false, ficheMessagePhoto);
    return false;
  }
  if (ancienId && ancienId !== nouvelId) supprimerPhoto(ancienId).catch(() => {});
  photosEnTexte.delete(ancienId);
  afficher();
  afficherFiche();
  fichePhotos.scrollLeft = 0;
  return true;
}

for (const bouton of [ficheChangerPhoto, ficheAjouterPhoto]) {
  bouton.addEventListener("click", () => {
    ficheMessagePhoto.hidden = true;
    ficheFichierPhoto.click();
  });
}
ficheFichierPhoto.addEventListener("change", async () => {
  const fichier = ficheFichierPhoto.files[0];
  ficheFichierPhoto.value = ""; // permet de rechoisir la même photo
  const id = idFiche;
  const el = elements.find((e) => e.id === id);
  if (!fichier || !el) return;
  for (const bouton of [ficheChangerPhoto, ficheAjouterPhoto, editionChangerPhoto]) {
    bouton.disabled = true;
    bouton.textContent = "Préparation de la photo…";
  }
  let nouvelId = null;
  let message = "";
  try {
    nouvelId = await enregistrerPhoto(await reduireImage(fichier, LIMITES_IA.coteGardee, LIMITES_IA.qualiteGardee));
  } catch (erreur) {
    message = erreur && erreur.code === "image"
      ? MESSAGES_IA.image
      : "Impossible d'enregistrer la photo sur cet appareil.";
  }
  // Fiche fermée, changée ou supprimée entre-temps : on n'y touche pas
  if (idFiche !== id || !elements.includes(el)) {
    if (nouvelId) supprimerPhoto(nouvelId).catch(() => {});
    return;
  }
  majBoutonsPhotoFiche(el);
  if (message) {
    afficherMessage(message, false, ficheMessagePhoto);
    return;
  }
  remplacerPhotoFiche(el, nouvelId);
});
ficheRetirerPhoto.addEventListener("click", () => {
  const el = elements.find((e) => e.id === idFiche);
  if (!el) return;
  if (!window.confirm("Retirer la photo de cette fiche ? Elle sera effacée de l'app.")) return;
  ficheMessagePhoto.hidden = true;
  remplacerPhotoFiche(el, null);
});

// --- 5 bis. Ajouter avec l'IA : photos et texte → Gemini → brouillon ---
// 1. On ajoute des photos (jusqu'à 6, réduites tout de suite) et / ou du texte.
// 2. « Analyser avec l'IA » envoie tout à Gemini en une seule fois (ia.js).
// 3. La fiche revient en brouillon modifiable, avec les avertissements.
// 4. « Enregistrer » crée la fiche. Les photos envoyées ne sont pas gardées,
//    sauf celle choisie avec la case « Garder une photo ».
// Le contenu de la page est oublié à sa fermeture.
const pageIa = document.getElementById("page-ia");
const iaTitre = document.getElementById("ia-titre");
const iaSaisie = document.getElementById("ia-saisie");
const iaCompte = document.getElementById("ia-compte");
const iaMiniatures = document.getElementById("ia-miniatures");
const iaAjouterPhoto = document.getElementById("ia-ajouter-photo");
const iaFichiers = document.getElementById("ia-fichiers");
const iaMessagePhotos = document.getElementById("ia-message-photos");
const iaTexte = document.getElementById("ia-texte");
const iaLien = document.getElementById("ia-lien");
const iaAnalyser = document.getElementById("ia-analyser");
const iaMessage = document.getElementById("ia-message");
const iaChargement = document.getElementById("ia-chargement");
const iaChargementTexte = document.getElementById("ia-chargement-texte");
const iaBrouillon = document.getElementById("ia-brouillon");
const iaAvertissements = document.getElementById("ia-avertissements");
const iaListeAvertissements = document.getElementById("ia-liste-avertissements");
const iaMessageBrouillon = document.getElementById("ia-message-brouillon");
const iaBlocPhoto = document.getElementById("ia-bloc-photo");
const iaGarderPhoto = document.getElementById("ia-garder-photo");
const iaChoixPhoto = document.getElementById("ia-choix-photo");
const iaCaseGarder = document.getElementById("ia-case-garder");
// Photo de la fiche (vignette) : jamais envoyée à l'IA
const iaVignetteBloc = document.getElementById("ia-vignette");
const iaVignetteImage = document.getElementById("ia-vignette-image");
const iaVignetteChoisir = document.getElementById("ia-vignette-choisir");
const iaVignetteFichier = document.getElementById("ia-vignette-fichier");
const iaMessageVignette = document.getElementById("ia-message-vignette");
const iaRappelVignette = document.getElementById("ia-rappel-vignette");
const iaRappelVignetteImage = document.getElementById("ia-rappel-vignette-image");
// { fichier: JPEG réduit (1200 px), adresse: pour l'aperçu } ou null
let iaVignette = null;
// Champs du brouillon
const iaB = {
  titre: document.getElementById("ia-b-titre"),
  type: document.getElementById("ia-b-type"),
  portions: document.getElementById("ia-b-portions"),
  preparation: document.getElementById("ia-b-preparation"),
  cuisson: document.getElementById("ia-b-cuisson"),
  champCuisson: document.getElementById("ia-b-champ-cuisson"),
  cocktail: document.getElementById("ia-b-cocktail"),
  verre: document.getElementById("ia-b-verre"),
  methode: document.getElementById("ia-b-methode"),
  alcool: document.getElementById("ia-b-alcool"),
  ingredients: document.getElementById("ia-b-ingredients"),
  etapes: document.getElementById("ia-b-etapes"),
  note: document.getElementById("ia-b-note"),
  lien: document.getElementById("ia-b-lien"),
};

const TITRES_IA = { recette: "Recette : photos et texte", cocktail: "Cocktail : photos et texte" };

let iaType = "recette";         // catégorie choisie (recette, cocktail)
let iaPhotos = [];              // [{ fichier: JPEG réduit, adresse: pour la miniature }]
let iaPreparation = false;      // photos en cours de réduction
let iaControle = null;          // appel à Gemini en cours (pour « Annuler »)
let iaOuverture = 0;            // change à chaque ouverture / fermeture de la page
let iaEnregistrement = false;   // « Enregistrer » en cours (pas de double appui)
let iaPhotoChoisie = 0;         // photo à garder (si la case est cochée)
// Ce qui avait été tapé dans le calque d'ajout avant d'ouvrir cette page
let iaDepart = { titre: "", note: "" };
// Ingrédients tels que renvoyés par Gemini : chaque ligne restée identique
// dans le brouillon garde sa quantité détaillée
let iaReference = { lignes: [], detail: [] };

// Une seule partie visible à la fois : saisie, chargement ou brouillon
function montrerVueIa(nom) {
  iaSaisie.hidden = nom !== "saisie";
  iaChargement.hidden = nom !== "chargement";
  iaBrouillon.hidden = nom !== "brouillon";
  pageIa.scrollTop = 0;
}

// Tout oublier : photos (libère la mémoire), texte, brouillon, appel en cours
function viderIa() {
  iaOuverture++;
  if (iaControle) iaControle.abort();
  iaControle = null;
  for (const photo of iaPhotos) URL.revokeObjectURL(photo.adresse);
  iaPhotos = [];
  retirerVignetteIa();
  iaPreparation = false;
  iaEnregistrement = false;
  iaTexte.value = "";
  iaLien.value = "";
  iaBrouillon.reset();
  iaReference = { lignes: [], detail: [] };
  iaPhotoChoisie = 0;
  for (const zone of [iaMessage, iaMessagePhotos, iaMessageBrouillon]) zone.hidden = true;
  afficherAvertissementsIa([]);
  afficherMiniaturesIa();
  majAnalyserIa();
}

// depart : { titre, lien, note } tapés dans le calque d'ajout, et texte
// copié (presse-papiers) à mettre dans le champ texte
function ouvrirIa(type, depart = {}) {
  viderIa();
  iaType = type;
  iaTitre.textContent = TITRES_IA[type];
  iaLien.value = depart.lien || "";
  iaTexte.value = (depart.texte || "").slice(0, LIMITES_IA.texte);
  majAnalyserIa();
  iaDepart = { titre: depart.titre || "", note: depart.note || "" };
  montrerVueIa("saisie");
  verrouillerPage();
  pageIa.showModal();
  pageIa.scrollTop = 0;
}

// Fermer : on demande confirmation si quelque chose a été commencé
function quitterIa() {
  const commence = iaPhotos.length > 0 || iaVignette !== null || iaTexte.value.trim() !== "" ||
    !iaBrouillon.hidden || iaControle !== null;
  if (commence && !window.confirm("Quitter sans enregistrer ? Les photos, le texte et le brouillon seront perdus.")) return;
  pageIa.close();
}
document.getElementById("ia-fermer").addEventListener("click", quitterIa);
// Touche Échap : même chose (avec confirmation)
pageIa.addEventListener("cancel", (evenement) => {
  evenement.preventDefault();
  quitterIa();
});
pageIa.addEventListener("close", () => {
  viderIa();
  deverrouillerPage();
});

// Depuis le calque d'ajout d'une recette ou d'un cocktail : le titre, le
// lien et la note suivent.
// Un titre qui n'est que le nom du site (« instagram.com ») ne suit pas.
boutonOuvrirIa.addEventListener("click", () => {
  const type = categorieChoisie();
  const lien = lienValide(champLien.value) || "";
  const titre = champTitre.value.trim();
  const depart = {
    titre: lien && titre === domaine(lien) ? "" : titre,
    lien,
    note: champNote.value.trim().slice(0, LONGUEUR_MAX_NOTE),
  };
  fermerAjout();
  ouvrirIa(type, depart);
});

// --- Photos ---
const tailleTotaleIa = () => iaPhotos.reduce((total, photo) => total + photo.fichier.size, 0);

function afficherMiniaturesIa() {
  iaMiniatures.replaceChildren(...iaPhotos.map((photo, rang) => {
    const li = document.createElement("li");
    li.className = "ia-miniature";
    const image = document.createElement("img");
    image.src = photo.adresse;
    image.alt = `Photo ${rang + 1}`;
    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.className = "ia-retirer";
    retirer.textContent = "✕";
    retirer.setAttribute("aria-label", `Retirer la photo ${rang + 1}`);
    retirer.addEventListener("click", () => {
      URL.revokeObjectURL(photo.adresse);
      iaPhotos = iaPhotos.filter((p) => p !== photo);
      iaMessagePhotos.hidden = true;
      afficherMiniaturesIa();
      majAnalyserIa();
    });
    li.append(image, retirer);
    return li;
  }));
  iaMiniatures.hidden = iaPhotos.length === 0;
  iaCompte.textContent = `${iaPhotos.length} / ${LIMITES_IA.photos}`;
  iaAjouterPhoto.hidden = iaPhotos.length >= LIMITES_IA.photos;
  iaAjouterPhoto.disabled = iaPreparation;
  iaAjouterPhoto.textContent = iaPreparation ? "Préparation des photos…" : "+ Ajouter une photo";
}

// « Analyser » : actif dès qu'il y a une photo ou du texte
function majAnalyserIa() {
  iaAnalyser.disabled = iaPreparation || (iaPhotos.length === 0 && iaTexte.value.trim() === "");
}
iaTexte.addEventListener("input", majAnalyserIa);

iaAjouterPhoto.addEventListener("click", () => iaFichiers.click());

// Photos choisies (photothèque ou appareil photo) : réduites une par une,
// dans l'ordre, avant d'apparaître en miniature
iaFichiers.addEventListener("change", async () => {
  const choisies = [...iaFichiers.files];
  iaFichiers.value = ""; // permet de rechoisir la même photo
  if (choisies.length === 0) return;
  iaMessagePhotos.hidden = true;
  const ouverture = iaOuverture;
  const problemes = [];
  const place = LIMITES_IA.photos - iaPhotos.length;
  if (choisies.length > place) {
    problemes.push(`${LIMITES_IA.photos} photos au maximum : les photos en trop n'ont pas été ajoutées.`);
  }
  iaPreparation = true;
  afficherMiniaturesIa();
  majAnalyserIa();
  for (const fichier of choisies.slice(0, Math.max(0, place))) {
    let reduite;
    try {
      reduite = await reduireImage(fichier, LIMITES_IA.cote, LIMITES_IA.qualite);
    } catch {
      if (ouverture !== iaOuverture) return;
      problemes.push(`« ${fichier.name} » : ${MESSAGES_IA.image}`);
      continue;
    }
    if (ouverture !== iaOuverture) return; // page fermée entre-temps
    if (tailleTotaleIa() + reduite.size > LIMITES_IA.tailleTotale) {
      problemes.push("Taille totale des photos dépassée (environ 8 Mo) : retire une photo pour en ajouter une autre.");
      break;
    }
    iaPhotos.push({ fichier: reduite, adresse: URL.createObjectURL(reduite) });
    afficherMiniaturesIa();
  }
  iaPreparation = false;
  afficherMiniaturesIa();
  majAnalyserIa();
  if (problemes.length) afficherMessage(problemes.join(" "), false, iaMessagePhotos);
});

// --- Photo de la fiche (vignette) ---
// Une seule photo, réduite tout de suite (1200 px, JPEG 80 %). Elle n'est
// jamais envoyée à l'IA : elle devient seulement l'image de la fiche.
function retirerVignetteIa() {
  if (iaVignette) URL.revokeObjectURL(iaVignette.adresse);
  iaVignette = null;
  iaVignetteBloc.hidden = true;
  iaVignetteImage.removeAttribute("src");
  iaVignetteChoisir.hidden = false;
  iaVignetteChoisir.disabled = false;
  iaVignetteChoisir.textContent = "+ Choisir la photo de la fiche";
  iaMessageVignette.hidden = true;
  afficherChoixPhotoIa();
}
iaVignetteChoisir.addEventListener("click", () => iaVignetteFichier.click());
document.getElementById("ia-vignette-retirer").addEventListener("click", retirerVignetteIa);
iaVignetteFichier.addEventListener("change", async () => {
  const fichier = iaVignetteFichier.files[0];
  iaVignetteFichier.value = ""; // permet de rechoisir la même photo
  if (!fichier) return;
  const ouverture = iaOuverture;
  iaMessageVignette.hidden = true;
  iaVignetteChoisir.disabled = true;
  iaVignetteChoisir.textContent = "Préparation de la photo…";
  let reduite;
  try {
    reduite = await reduireImage(fichier, LIMITES_IA.coteGardee, LIMITES_IA.qualiteGardee);
  } catch {
    if (ouverture !== iaOuverture) return;
    retirerVignetteIa();
    afficherMessage(MESSAGES_IA.image, false, iaMessageVignette);
    return;
  }
  if (ouverture !== iaOuverture) return; // page fermée entre-temps
  if (iaVignette) URL.revokeObjectURL(iaVignette.adresse);
  iaVignette = { fichier: reduite, adresse: URL.createObjectURL(reduite) };
  iaVignetteImage.src = iaVignette.adresse;
  iaVignetteBloc.hidden = false;
  iaVignetteChoisir.hidden = true;
  iaVignetteChoisir.disabled = false;
  afficherChoixPhotoIa();
});

// --- Appel à Gemini (analyse ou revérification) ---
// Montre la roue et « Annuler » ; en cas d'échec, revient à l'écran
// d'avant avec un message simple. Rien de ce qui a été saisi n'est perdu.
async function lancerAppelIa(texteChargement, vueRetour, zoneMessage, travail) {
  const controle = new AbortController();
  iaControle = controle;
  iaChargementTexte.textContent = texteChargement;
  montrerVueIa("chargement");
  try {
    await travail(controle.signal);
    if (iaControle !== controle) return; // page fermée entre-temps
    montrerVueIa("brouillon");
  } catch (erreur) {
    if (iaControle !== controle) return;
    montrerVueIa(vueRetour);
    afficherMessage(messageIa(erreur), false, zoneMessage);
  } finally {
    if (iaControle === controle) iaControle = null;
  }
}
document.getElementById("ia-annuler").addEventListener("click", () => {
  if (iaControle) iaControle.abort();
});

iaAnalyser.addEventListener("click", () => {
  iaMessage.hidden = true;
  const texte = iaTexte.value.trim().slice(0, LIMITES_IA.texte);
  if (iaPreparation || (iaPhotos.length === 0 && texte === "")) return;
  if (lireCleGemini() === "") {
    afficherMessage(MESSAGES_IA["pas-de-cle"], false, iaMessage);
    return;
  }
  const photos = iaPhotos.map((photo) => photo.fichier);
  lancerAppelIa("Analyse en cours… (45 secondes au plus)", "saisie", iaMessage, async (signal) => {
    const fiche = await analyserAvecGemini({ type: iaType, photos, texte }, signal);
    if (signal.aborted) throw new ErreurIa("annule");
    remplirBrouillonIa(fiche, true);
  });
});

// --- Brouillon ---
function afficherAvertissementsIa(liste) {
  iaListeAvertissements.replaceChildren(...liste.map((texte) => {
    const li = document.createElement("li");
    li.textContent = texte;
    return li;
  }));
  iaAvertissements.hidden = liste.length === 0;
}

// Cuisson pour une recette ; verre, méthode, alcool de base pour un cocktail
function majTypeBrouillonIa() {
  iaB.champCuisson.hidden = iaB.type.value !== "recette";
  iaB.cocktail.hidden = iaB.type.value !== "cocktail";
}
iaB.type.addEventListener("change", majTypeBrouillonIa);

// Case « Garder une photo » : s'il y a plusieurs photos, on choisit laquelle.
// Une photo de la fiche choisie à l'étape 1 remplace la case (rappel).
function afficherChoixPhotoIa() {
  const vignette = iaVignette !== null;
  iaBlocPhoto.hidden = iaPhotos.length === 0 && !vignette;
  iaRappelVignette.hidden = !vignette;
  if (vignette) iaRappelVignetteImage.src = iaVignette.adresse;
  iaCaseGarder.hidden = vignette;
  iaPhotoChoisie = Math.min(iaPhotoChoisie, Math.max(0, iaPhotos.length - 1));
  iaChoixPhoto.hidden = vignette || !iaGarderPhoto.checked || iaPhotos.length < 2;
  iaChoixPhoto.replaceChildren(...iaPhotos.map((photo, rang) => {
    const choix = document.createElement("label");
    choix.className = "ia-photo-choix";
    const bouton = document.createElement("input");
    bouton.type = "radio";
    bouton.name = "ia-photo-gardee";
    bouton.checked = rang === iaPhotoChoisie;
    bouton.setAttribute("aria-label", `Photo ${rang + 1}`);
    bouton.addEventListener("change", () => { iaPhotoChoisie = rang; });
    const image = document.createElement("img");
    image.src = photo.adresse;
    image.alt = "";
    choix.append(bouton, image);
    return choix;
  }));
}
iaGarderPhoto.addEventListener("change", afficherChoixPhotoIa);

// Met la fiche de Gemini dans le brouillon.
// premiere = true : première analyse (tout est rempli) ;
// false : revérification (un champ laissé vide par Gemini garde sa valeur).
function remplirBrouillonIa(fiche, premiere) {
  const remplir = (champ, valeur) => {
    if (premiere || (valeur !== undefined && valeur !== "")) champ.value = valeur ?? "";
  };
  const avertissements = [...fiche.avertissements];
  if (premiere) {
    iaB.type.value = iaType;
    if (fiche.type !== iaType) {
      avertissements.unshift(fiche.type === "cocktail"
        ? "L'IA pense qu'il s'agit plutôt d'un cocktail : vérifie le type."
        : "L'IA pense qu'il s'agit plutôt d'une recette : vérifie le type.");
    }
    iaB.titre.value = fiche.titre || iaDepart.titre;
    iaB.lien.value = lienValide(iaLien.value) || "";
    iaB.note.value = [iaDepart.note, fiche.notes].filter(Boolean).join("\n\n").slice(0, LONGUEUR_MAX_NOTE);
    iaGarderPhoto.checked = false;
    iaPhotoChoisie = 0;
  } else {
    remplir(iaB.titre, fiche.titre);
    remplir(iaB.note, fiche.notes.slice(0, LONGUEUR_MAX_NOTE));
  }
  remplir(iaB.portions, fiche.portions);
  remplir(iaB.preparation, fiche.tempsPreparation);
  remplir(iaB.cuisson, fiche.tempsCuisson);
  remplir(iaB.verre, fiche.verre);
  remplir(iaB.methode, fiche.methode);
  remplir(iaB.alcool, fiche.alcoolBase);
  if (premiere || fiche.ingredients.length) {
    iaReference = {
      lignes: fiche.ingredients.map((i) => i.ligne),
      detail: fiche.ingredients.map((i) => i.detail),
    };
    iaB.ingredients.value = iaReference.lignes.join("\n");
  }
  if (premiere || fiche.etapes.length) iaB.etapes.value = fiche.etapes.join("\n");
  afficherAvertissementsIa(avertissements);
  majTypeBrouillonIa();
  afficherChoixPhotoIa();
  iaMessageBrouillon.hidden = true;
}

// Lit le brouillon. Renvoie { erreur } si un champ est invalide.
function lireBrouillonIa() {
  const type = iaB.type.value === "cocktail" ? "cocktail" : "recette";
  const portions = lireEntier(iaB.portions, LIMITES_FICHE.portionsMax);
  const preparation = lireEntier(iaB.preparation, LIMITES_FICHE.minutesMax);
  const cuisson = type === "recette" ? lireEntier(iaB.cuisson, LIMITES_FICHE.minutesMax) : undefined;
  if (Number.isNaN(portions)) return { erreur: `Portions : un nombre entier entre 1 et ${LIMITES_FICHE.portionsMax}.` };
  if (Number.isNaN(preparation) || Number.isNaN(cuisson)) return { erreur: "Temps : un nombre entier de minutes (ou rien)." };
  const texteLien = iaB.lien.value.trim();
  const lien = lienValide(texteLien);
  if (texteLien !== "" && !lien) return { erreur: "Ce lien n'est pas valide : il doit commencer par http:// ou https://." };
  const ingredients = lireLignes(iaB.ingredients, LIMITES_FICHE.ingredients, LIMITES_FICHE.longueurIngredient);
  const court = (champ) => (type === "cocktail" ? champ.value.trim().slice(0, LIMITES_FICHE.champCourt) : "");
  return {
    type,
    titre: iaB.titre.value.trim().slice(0, LIMITES_FICHE.longueurTitre),
    portions,
    tempsPreparation: preparation,
    tempsCuisson: cuisson,
    verre: court(iaB.verre),
    methode: court(iaB.methode),
    alcoolBase: court(iaB.alcool),
    ingredients,
    ingredientsDetail: detailPourLignes(ingredients, iaReference.lignes, iaReference.detail),
    etapes: lireChampEtapes(iaB.etapes),
    note: iaB.note.value.trim().slice(0, LONGUEUR_MAX_NOTE),
    lien,
  };
}

// « Revérifier avec l'IA » : renvoie la fiche actuelle (texte seulement)
document.getElementById("ia-reverifier").addEventListener("click", () => {
  iaMessageBrouillon.hidden = true;
  const b = lireBrouillonIa();
  if (b.erreur) {
    afficherMessage(b.erreur, false, iaMessageBrouillon);
    return;
  }
  if (lireCleGemini() === "") {
    afficherMessage(MESSAGES_IA["pas-de-cle"], false, iaMessageBrouillon);
    return;
  }
  const fiche = {
    type: b.type,
    titre: b.titre,
    portions: b.portions ?? null,
    tempsPreparation: b.tempsPreparation ?? null,
    tempsCuisson: b.tempsCuisson ?? null,
    verre: b.verre,
    methode: b.methode,
    alcoolBase: b.alcoolBase,
    ingredients: b.ingredients.map((ligne, i) => {
      const d = b.ingredientsDetail && b.ingredientsDetail[i];
      return d ? { quantite: d.q, unite: d.u, nom: d.n } : { quantite: null, unite: "", nom: ligne };
    }),
    etapes: b.etapes,
    notes: b.note,
  };
  lancerAppelIa("Revérification en cours… (45 secondes au plus)", "brouillon", iaMessageBrouillon, async (signal) => {
    const corrigee = await reverifierAvecGemini(fiche, signal);
    if (signal.aborted) throw new ErreurIa("annule");
    remplirBrouillonIa(corrigee, false);
  });
});

document.getElementById("ia-retour-saisie").addEventListener("click", () => {
  iaMessage.hidden = true;
  montrerVueIa("saisie");
});

// « Enregistrer » : crée la fiche, puis l'ouvre
iaBrouillon.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  if (iaEnregistrement) return;
  iaMessageBrouillon.hidden = true;
  const b = lireBrouillonIa();
  if (b.erreur) {
    afficherMessage(b.erreur, false, iaMessageBrouillon);
    return;
  }
  if (b.titre === "") {
    afficherMessage("Donnez un titre à la fiche.", false, iaMessageBrouillon);
    iaB.titre.focus();
    return;
  }
  const infos = {
    lien: b.lien,
    note: b.note,
    portions: b.portions,
    tempsPreparation: b.tempsPreparation,
    ingredients: b.ingredients,
    ingredientsDetail: b.ingredientsDetail,
    etapes: b.etapes,
  };
  if (b.type === "recette") infos.tempsCuisson = b.tempsCuisson;
  else Object.assign(infos, { verre: b.verre, methode: b.methode, alcoolBase: b.alcoolBase });

  iaEnregistrement = true;
  const ouverture = iaOuverture;
  let photoPerdue = false;
  // Photo de la fiche : la vignette choisie (déjà réduite) ; sinon, la
  // photo envoyée gardée avec la case. Rangée dans la mémoire des photos
  // (IndexedDB, photos.js) ; la fiche ne garde que son identifiant.
  const photoAGarder = iaVignette ? iaVignette.fichier
    : iaGarderPhoto.checked && iaPhotos[iaPhotoChoisie] ? iaPhotos[iaPhotoChoisie].fichier : null;
  if (photoAGarder) {
    try {
      infos.photoId = await enregistrerPhoto(iaVignette ? photoAGarder : await photoPourFiche(photoAGarder));
    } catch {
      photoPerdue = true; // photo illisible ou mémoire des photos inaccessible
    }
    if (ouverture !== iaOuverture) {
      if (infos.photoId) supprimerPhoto(infos.photoId).catch(() => {});
      return; // page fermée entre-temps
    }
  }

  // Mémoire de l'app pleine : on prévient (la fiche à moitié ajoutée est
  // retirée, rien n'est perdu du brouillon)
  const avant = elements.length;
  let reussi = true;
  try {
    ajouter(b.titre, b.type, infos);
  } catch {
    elements.length = avant;
    reussi = false;
  }
  iaEnregistrement = false;
  if (!reussi) {
    if (infos.photoId) supprimerPhoto(infos.photoId).catch(() => {});
    afficherMessage("Impossible d'enregistrer : la mémoire de l'app est pleine.", false, iaMessageBrouillon);
    return;
  }
  const id = elements[elements.length - 1].id;
  pageIa.close();
  ouvrirFiche(id);
  if (photoPerdue) {
    window.alert("La fiche est enregistrée, mais sans la photo (photo illisible ou mémoire des photos inaccessible).");
  }
});

// --- 6. Sauvegarde : exporter et importer --------------------
// Numéro de version du format du fichier. Si un jour on change la forme
// du fichier, on passera à 2 et on saura lire les anciens fichiers.
const FORMAT_NOM = "toque-tonic";
// Seules les sauvegardes de Toque&Tonic sont acceptées (depuis la v1.13) :
// celles de Wodo (« wodo », ancien nom « mes-listes ») restent à Wodo
const FORMATS_ACCEPTES = [FORMAT_NOM];
const FORMATS_WODO = ["wodo", "mes-listes"];
// Version 1 : titre, type, fait. Version 2 : + année, affiche, identifiant TMDB
// (facultatifs). Version 3 : + identifiant RAWG pour les jeux (facultatif).
// Version 4 : + identifiant IMDb pour les films et séries (facultatif).
// Version 5 : + lien et note des recettes (facultatifs).
// Version 6 : + type « cocktail » ; recettes et cocktails ne sont jamais
// « terminés » (une ancienne recette cochée est remise en fiche à l'import).
// Version 7 : + contenu des fiches (facultatif) : photos (adresses),
// ingrédients, étapes, portions, temps de préparation et de cuisson,
// verre, méthode et alcool de base (cocktails).
// Version 8 : + fiches créées avec l'IA (facultatif) : ingrédients détaillés
// (quantité, unité, nom) et une photo gardée dans la fiche (image JPEG).
// Version 9 : + notes (Réglages → Notes) : texte, état, date de création.
// Un fichier sans notes laisse les notes actuelles intactes.
// Version 10 : plus d'historique « supprimes » (suppression définitive) ;
// celui des anciens fichiers est ignoré à l'import.
// Version 11 : les photos gardées sont rangées dans IndexedDB ; la fiche
// garde « photoId » et le fichier contient « photos » : { id: image JPEG
// en texte }. Les anciennes photos « photoPerso » (versions 8 à 10) sont
// rangées dans IndexedDB après l'import.
// Version 12 : jeux venus d'IGDB : identifiant « idIgdb » et jaquette dans « affiche »
// (adresse images.igdb.com) ; les anciens jeux RAWG gardent « idRawg ».
// (Versions 1 à 12 : format commun avec Wodo, dont Toque&Tonic est issue.)
// Version 13 (Toque&Tonic v1.7) : + favori, niveau, source en texte ;
// cocktails : glace, garniture, présence d'alcool ; durée des étapes
// (« etapesDurees », en secondes). Tous facultatifs.
// L'app sait lire les treize. Les clés (Gemini) n'y sont jamais.
const FORMAT_VERSION = 13;
// Taille maximale d'une photo dans un fichier de sauvegarde (texte base64)
const LONGUEUR_MAX_PHOTO_FICHIER = 5 * 1024 * 1024;

const boutonExporter = document.getElementById("bouton-exporter");
const boutonImporter = document.getElementById("bouton-importer");
const champFichier = document.getElementById("champ-fichier");
const messageSauvegarde = document.getElementById("message-sauvegarde");
const fenetreImport = document.getElementById("fenetre-import");
const texteImport = document.getElementById("texte-import");
const conseilSauvegarde = document.getElementById("conseil-sauvegarde");
const infoSauvegardeFaite = document.getElementById("info-sauvegarde-faite");
const boutonSauverAvant = document.getElementById("bouton-sauver-avant");
const boutonRemplacer = document.getElementById("bouton-remplacer");
const boutonAnnulerImport = document.getElementById("bouton-annuler-import");

// Les données du fichier choisi, en attente de confirmation
let importEnAttente = null;

// Affiche un message dans une zone (succes = vert, sinon rouge).
// Par défaut, la zone de la section Sauvegarde.
function afficherMessage(texte, succes, zone = messageSauvegarde) {
  zone.textContent = texte;
  zone.className = succes ? "message succes" : "message erreur";
  zone.hidden = false;
}

// "1 élément" / "3 éléments"
function pluriel(nombre, mot) {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

// Résumé lisible d'une liste : "12 recettes, 5 cocktails"
function resumer(lesElements) {
  const recettes = lesElements.filter((e) => e.type === "recette").length;
  return `${pluriel(recettes, "recette")}, ${pluriel(lesElements.length - recettes, "cocktail")}`;
}

// Proposer le fichier à l'utilisateur.
// - Sur iPhone / téléphone : le menu de partage ("Enregistrer dans Fichiers", AirDrop…)
// - Sur ordinateur : un téléchargement classique
// Photos des fiches, écrites en texte pour le fichier de sauvegarde
// (version 11) : { "p-…": "data:image/jpeg;base64,…" }. Préparées dès
// l'ouverture de « Sauvegarde » : sur iPhone, le menu de partage doit
// s'ouvrir très vite après l'appui sur « Exporter ».
const photosEnTexte = new Map();
async function preparerPhotosExport() {
  for (const el of elements) {
    if (!el.photoId || photosEnTexte.has(el.photoId)) continue;
    try {
      const fichier = await lirePhoto(el.photoId);
      if (fichier) photosEnTexte.set(el.photoId, await photoEnTexte(fichier));
    } catch {
      // photo illisible : la fiche sera exportée sans elle
    }
  }
  const photos = {};
  for (const el of elements) {
    if (el.photoId && photosEnTexte.has(el.photoId)) photos[el.photoId] = photosEnTexte.get(el.photoId);
  }
  return photos;
}

async function exporter() {
  const donnees = {
    format: FORMAT_NOM,
    version: FORMAT_VERSION,
    dateExport: new Date().toISOString(),
    elements: elements,
    notes: notesPourExport(), // version 9 : notes de Réglages → Notes
    photos: await preparerPhotosExport(), // version 11 : photos des fiches
  };
  const texte = JSON.stringify(donnees, null, 2); // indenté : lisible à l'œil
  const date = new Date().toLocaleDateString("sv-SE"); // donne "2026-11-09"
  const nomFichier = `toque-tonic-${date}.json`; // ex. : toque-tonic-2026-11-15.json
  const fichier = new File([texte], nomFichier, { type: "application/json" });

  // Écran tactile + partage de fichiers possible → menu de partage
  const ecranTactile = window.matchMedia("(pointer: coarse)").matches;
  if (ecranTactile && navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nomFichier });
      return true;
    } catch (erreur) {
      // L'utilisateur a fermé le menu sans rien choisir : ce n'est pas une erreur
      if (erreur.name === "AbortError") return false;
      // Autre problème : on essaie le téléchargement classique
    }
  }

  // Téléchargement classique : on crée un lien invisible et on "clique" dessus
  const adresse = URL.createObjectURL(fichier);
  const lien = document.createElement("a");
  lien.href = adresse;
  lien.download = nomFichier;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 1000); // libère la mémoire
  return true;
}

// Vérifie le contenu d'un fichier. Renvoie { elements, notes } si tout
// est correct, sinon lance une erreur avec un message clair.
// L'historique « supprimes » des anciens fichiers (versions 1 à 9) est ignoré.
// Fichier de Wodo : les films, séries, jeux (et anciens « Autre ») sont
// laissés de côté ; « ignores » donne leur nombre.
// On recopie seulement les champs connus, pour ne rien garder d'inattendu.
function verifierFichier(donnees) {
  if (typeof donnees === "object" && donnees !== null && FORMATS_WODO.includes(donnees.format)) {
    throw new Error("Ce fichier est une sauvegarde de Wodo : importe-le dans Wodo.");
  }
  if (typeof donnees !== "object" || donnees === null || !FORMATS_ACCEPTES.includes(donnees.format)) {
    throw new Error("Ce fichier n'est pas une sauvegarde de Toque&Tonic.");
  }
  if (!Number.isInteger(donnees.version) || donnees.version < 1) {
    throw new Error("Le numéro de version du fichier est invalide.");
  }
  if (donnees.version > FORMAT_VERSION) {
    throw new Error("Ce fichier vient d'une version plus récente de l'app. Mets l'app à jour puis réessaie.");
  }
  if (!Array.isArray(donnees.elements)) {
    throw new Error("Le fichier est incomplet : il manque la liste des éléments.");
  }

  const titreValide = (t) => typeof t === "string" && t.trim() !== "";
  const idsVus = new Set();
  // Seulement les recettes et les cocktails
  const fiches = donnees.elements.filter((el) => typeof el === "object" && el !== null && estFiche(el.type));
  const ignores = donnees.elements.length - fiches.length;

  const nouveauxElements = fiches.map((el, i) => {
    const numero = `L'élément n°${i + 1}`;
    if (typeof el !== "object" || el === null) throw new Error(`${numero} est illisible.`);
    if (typeof el.id !== "string" || el.id === "") throw new Error(`${numero} n'a pas d'identifiant.`);
    if (idsVus.has(el.id)) throw new Error(`${numero} a le même identifiant qu'un autre élément.`);
    idsVus.add(el.id);
    if (!titreValide(el.titre)) throw new Error(`${numero} n'a pas de titre.`);
    // Une fiche n'est jamais « terminée »
    const propre = { id: el.id, titre: el.titre.trim(), type: el.type, fait: false };

    // Les infos de films, séries et jeux (TMDB, IGDB, IMDb, année, affiche)
    // ne concernent pas les fiches : elles ne sont pas reprises.
    // Lien et note des recettes (version 5, facultatifs). Gardés aussi pour
    // les autres types : une recette changée de catégorie les conserve.
    if (el.lien !== undefined) {
      const lien = lienValide(el.lien);
      if (!lien) throw new Error(`${numero} a un lien invalide (il doit commencer par http:// ou https://).`);
      propre.lien = lien;
    }
    if (el.note !== undefined) {
      if (typeof el.note !== "string" || el.note.length > LONGUEUR_MAX_NOTE) {
        throw new Error(`${numero} a une note invalide (texte de ${LONGUEUR_MAX_NOTE} caractères au plus).`);
      }
      if (el.note.trim() !== "") propre.note = el.note.trim();
    }
    // Contenu des fiches (version 7, facultatif) : vérifié dans recettes.js.
    // Gardé aussi pour les autres types, comme le lien et la note.
    Object.assign(propre, verifierChampsFiche(el, numero));
    return propre;
  });

  // Photos des fiches (version 11) : seulement celles d'une fiche du
  // fichier, en JPEG ; une fiche dont la photo manque est gardée sans photo
  const photos = {};
  const photosFichier = typeof donnees.photos === "object" && donnees.photos !== null ? donnees.photos : {};
  for (const el of nouveauxElements) {
    if (!el.photoId) continue;
    const texte = Object.hasOwn(photosFichier, el.photoId) ? photosFichier[el.photoId] : null;
    if (typeof texte === "string" && texte.length <= LONGUEUR_MAX_PHOTO_FICHIER &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(texte)) {
      photos[el.photoId] = texte;
    } else {
      delete el.photoId;
    }
  }

  // Notes (version 9, facultatives) : null si le fichier n'en contient pas
  // (les notes actuelles seront alors gardées) ; vérifiées dans notes.js
  return { elements: nouveauxElements, notes: verifierNotesFichier(donnees.notes), photos, ignores };
}

// Fichier de Wodo : « Les 42 films, séries et jeux du fichier sont laissés de côté. »
function phraseIgnores(nombre) {
  if (!nombre) return "";
  return nombre > 1
    ? ` Les ${nombre} films, séries et jeux du fichier sont laissés de côté.`
    : " Le film, la série ou le jeu du fichier est laissé de côté.";
}

// Le fichier a été choisi : on le lit, on le vérifie, puis on demande confirmation
async function lireFichierChoisi() {
  const fichier = champFichier.files[0];
  champFichier.value = ""; // permet de rechoisir le même fichier plus tard
  if (!fichier) return;
  messageSauvegarde.hidden = true;

  let donnees;
  try {
    donnees = JSON.parse(await fichier.text());
  } catch {
    afficherMessage(`« ${fichier.name} » n'est pas un fichier de sauvegarde lisible. Rien n'a été modifié.`, false);
    return;
  }

  try {
    importEnAttente = verifierFichier(donnees);
  } catch (erreur) {
    afficherMessage(`Fichier refusé : ${erreur.message} Rien n'a été modifié.`, false);
    return;
  }

  // Préparer la fenêtre de confirmation
  const nbActuels = elements.length;
  const nbImportes = importEnAttente.elements.length;
  // Notes (version 9) : remplacées seulement si le fichier en contient
  const notesDuFichier = importEnAttente.notes;
  const notesPerdues = notesDuFichier === null ? 0 : notes.length;
  const listeVide = nbActuels === 0 && notesPerdues === 0;
  const phraseNotes = notesDuFichier === null
    ? (notes.length
      ? ` Le fichier ne contient pas de notes : ${notes.length > 1 ? `tes ${notes.length} notes sont gardées` : "ta note est gardée"}.`
      : "")
    : (notes.length
      ? ` ${notes.length > 1 ? `Tes ${notes.length} notes seront remplacées` : "Ta note sera remplacée"} par les notes du fichier (${notesDuFichier.length}).`
      : ` Le fichier contient ${pluriel(notesDuFichier.length, "note")}.`);
  texteImport.textContent = (nbActuels === 0
    ? `Ta liste actuelle est vide. Elle sera remplacée par celle du fichier (${resumer(importEnAttente.elements)}).`
    : `Tu vas perdre ${pluriel(nbActuels, "fiche")} de ta liste actuelle (${resumer(elements)}). ` +
      `Elles seront remplacées par les ${pluriel(nbImportes, "fiche")} du fichier (${resumer(importEnAttente.elements)}).`) +
    phraseIgnores(importEnAttente.ignores) +
    phraseNotes;
  // Pas de sauvegarde à proposer si rien ne sera perdu
  conseilSauvegarde.hidden = listeVide;
  boutonSauverAvant.hidden = listeVide;
  infoSauvegardeFaite.hidden = true;
  fenetreImport.showModal();
}

// Remplace toute la liste par le fichier importé
async function remplacerListe() {
  if (!importEnAttente || boutonRemplacer.disabled) return;
  const enAttente = importEnAttente;
  boutonRemplacer.disabled = true;
  // 1. Les photos du fichier d'abord, dans la mémoire des photos. Si elle
  //    est inaccessible, les fiches sont importées sans leur photo.
  let photosPerdues = 0;
  for (const [id, texte] of Object.entries(enAttente.photos)) {
    try {
      await enregistrerPhoto(texteEnPhoto(texte), id);
      oublierAdressePhoto(id); // une ancienne image avec ce nom ne doit plus s'afficher
    } catch {
      photosPerdues++;
      for (const el of enAttente.elements) if (el.photoId === id) delete el.photoId;
    }
  }
  boutonRemplacer.disabled = false;
  // 2. La liste et les notes
  const anciensElements = elements;
  elements = enAttente.elements;
  try {
    sauvegarder();
    // Notes du fichier (s'il en contient) ; en cas d'échec, notes.js
    // remet les anciennes et on remet aussi la liste
    if (enAttente.notes !== null) remplacerNotes(enAttente.notes);
  } catch (erreur) {
    // Mémoire du téléphone pleine, etc. : on remet tout comme avant
    elements = anciensElements;
    sauvegarder();
    fenetreImport.close();
    nettoyerPhotos(); // photos du fichier qui ne servent finalement pas
    afficherMessage("Impossible d'enregistrer la nouvelle liste (mémoire pleine ?). Rien n'a été modifié.", false);
    return;
  }
  fenetreImport.close();
  photosEnTexte.clear();
  afficher();
  afficherMessage(`Import réussi : ${resumer(elements)}.` +
    (photosPerdues > 1 ? ` ${photosPerdues} photos n'ont pas pu être enregistrées.`
      : photosPerdues ? " 1 photo n'a pas pu être enregistrée." : ""), true);
  // 3. Ménage : photos des anciennes fiches, et anciennes photos en texte
  //    (fichiers des versions 8 à 10) rangées dans la mémoire des photos
  await rangerAnciennesPhotos();
  nettoyerPhotos();
}

// Efface de la mémoire des photos celles qu'aucune fiche n'utilise plus.
// Seulement après un import réussi : la liste est alors sûre.
async function nettoyerPhotos() {
  try {
    const utilisees = new Set(elements.map((el) => el.photoId).filter(Boolean));
    for (const id of await idsDesPhotos()) {
      if (!utilisees.has(id)) await supprimerPhoto(id);
    }
  } catch {
    // mémoire des photos inaccessible : rien à faire
  }
}

// Photos gardées avant la v1.19 : écrites en texte dans la fiche
// (« photoPerso »). On les range dans la mémoire des photos ; la fiche ne
// garde plus que l'identifiant. Rien n'est effacé avant d'être bien rangé.
async function rangerAnciennesPhotos() {
  let change = false;
  for (const el of elements.filter((e) => typeof e.photoPerso === "string")) {
    const fichier = texteEnPhoto(el.photoPerso);
    if (!fichier) continue;
    try {
      el.photoId = await enregistrerPhoto(fichier);
    } catch {
      break; // mémoire des photos inaccessible : l'ancienne forme reste affichée
    }
    delete el.photoPerso;
    change = true;
  }
  if (!change) return;
  try {
    sauvegarder();
  } catch {
    // ne devrait pas arriver : la liste devient plus légère
  }
  afficher();
  if (pageFiche.open) afficherFiche();
}

boutonExporter.addEventListener("click", async () => {
  messageSauvegarde.hidden = true;
  await exporter();
});
boutonImporter.addEventListener("click", () => champFichier.click());
champFichier.addEventListener("change", lireFichierChoisi);
boutonSauverAvant.addEventListener("click", async () => {
  if (await exporter()) infoSauvegardeFaite.hidden = false;
});
boutonRemplacer.addEventListener("click", remplacerListe);
boutonAnnulerImport.addEventListener("click", () => fenetreImport.close());
// Quand la fenêtre se ferme (Annuler, touche Échap…), on oublie le fichier
fenetreImport.addEventListener("close", () => {
  importEnAttente = null;
});

// --- 7. Les réglages gardés sur l'appareil ------------------------
// Rangés dans la mémoire de l'appareil (localStorage), jamais dans un
// fichier du projet ni dans les exports.
function lireCle(nomStockage) {
  try {
    return localStorage.getItem(nomStockage) || "";
  } catch {
    return "";
  }
}

// --- 7 ter. L'adresse du relais (import de recettes) -------------
// Gardée uniquement sur l'appareil (localStorage), comme les clés.
// Ce n'est pas un secret : on la réaffiche dans le champ pour la vérifier.
{
  const formulaireRelais = document.getElementById("formulaire-relais");
  const champRelais = document.getElementById("champ-relais");
  const etatRelais = document.getElementById("etat-relais");
  const messageRelais = document.getElementById("message-relais");
  const boutonEffacerRelais = document.getElementById("bouton-effacer-relais");

  const afficherEtatRelais = () => {
    const adresse = lireCle(CLE_RELAIS);
    etatRelais.textContent = adresse
      ? "Un relais est enregistré sur cet appareil : l'import de recettes est activé."
      : "Aucun relais enregistré sur cet appareil : l'import de recettes est désactivé (l'ajout à la main reste possible).";
    champRelais.value = adresse;
    boutonEffacerRelais.hidden = !adresse;
  };

  formulaireRelais.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    let adresse = null;
    try {
      adresse = new URL(champRelais.value.trim());
    } catch {
      // pas une adresse
    }
    if (!adresse || adresse.protocol !== "https:") {
      afficherMessage("L'adresse doit commencer par https:// (exemple : https://mes-listes-relais.ton-pseudo.workers.dev).", false, messageRelais);
      return;
    }
    // On ne garde que le site et le chemin (pas de « ?… » ni de « #… »)
    localStorage.setItem(CLE_RELAIS, adresse.origin + adresse.pathname);
    afficherEtatRelais();
    afficherMessage("Adresse enregistrée. L'import de recettes est activé.", true, messageRelais);
  });

  boutonEffacerRelais.addEventListener("click", () => {
    localStorage.removeItem(CLE_RELAIS);
    afficherEtatRelais();
    afficherMessage("Adresse effacée de cet appareil.", true, messageRelais);
  });

  afficherEtatRelais();
}

// --- 7 ter bis. Le prénom de l'accueil ---------------------------
// Gardé uniquement sur l'appareil (localStorage), pas dans les exports.
{
  const formulairePrenom = document.getElementById("formulaire-prenom");
  const champPrenom = document.getElementById("champ-prenom");
  const messagePrenom = document.getElementById("message-prenom");
  const boutonEffacerPrenom = document.getElementById("bouton-effacer-prenom");

  const afficherPrenom = () => {
    champPrenom.value = lirePrenom();
    // « Remettre Alex » n'a de sens que si le prénom a été changé
    boutonEffacerPrenom.hidden = lirePrenom() === PRENOM_PAR_DEFAUT;
    // En-tête : « Bonjour Alex » (v1.14)
    document.getElementById("entete-prenom").textContent = lirePrenom();
  };

  formulairePrenom.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    const prenom = champPrenom.value.trim();
    if (!prenom) {
      afficherMessage("Écris un prénom avant d'enregistrer.", false, messagePrenom);
      return;
    }
    localStorage.setItem(CLE_PRENOM, prenom);
    afficherPrenom();
    afficherMessage(`Prénom enregistré : « Bonjour ${prenom} ».`, true, messagePrenom);
  });

  boutonEffacerPrenom.addEventListener("click", () => {
    localStorage.removeItem(CLE_PRENOM);
    afficherPrenom();
    afficherMessage(`Prénom remis à « ${PRENOM_PAR_DEFAUT} ».`, true, messagePrenom);
  });

  afficherPrenom();
}

// --- 7 quater. La clé et le modèle Gemini (ajout avec l'IA) --------
// Gardés uniquement sur l'appareil (localStorage), jamais dans les exports.
// La clé n'est jamais réaffichée : le champ se vide après l'enregistrement.
{
  const formulaireGemini = document.getElementById("formulaire-gemini");
  const champCleGemini = document.getElementById("champ-cle-gemini");
  const champModeleGemini = document.getElementById("champ-modele-gemini");
  const etatGemini = document.getElementById("etat-gemini");
  const messageGemini = document.getElementById("message-gemini");
  const boutonEnregistrerGemini = document.getElementById("bouton-enregistrer-gemini");
  const boutonEffacerGemini = document.getElementById("bouton-effacer-gemini");
  document.getElementById("aide-modele-gemini").textContent =
    `Par défaut : ${MODELE_GEMINI_DEFAUT} (rapide et peu coûteux). Les noms possibles sont sur ai.google.dev/gemini-api/docs/models.`;
  champModeleGemini.placeholder = MODELE_GEMINI_DEFAUT;

  const afficherEtatGemini = () => {
    const presente = lireCleGemini() !== "";
    etatGemini.textContent = presente
      ? `Une clé Gemini est enregistrée sur cet appareil (modèle : ${lireModeleGemini()}).`
      : "Aucune clé Gemini enregistrée sur cet appareil : l'ajout par photos et texte est désactivé.";
    champModeleGemini.value = lireModeleGemini();
    boutonEffacerGemini.hidden = !presente;
  };

  // Enregistrer : on vérifie d'abord la clé et le modèle auprès de Google.
  // Champ « Clé » vide : on garde la clé déjà enregistrée (changement de modèle).
  formulaireGemini.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const modele = nettoyerNomModele(champModeleGemini.value || MODELE_GEMINI_DEFAUT);
    if (!modele) {
      afficherMessage(`Nom de modèle invalide (exemple : ${MODELE_GEMINI_DEFAUT}).`, false, messageGemini);
      return;
    }
    const cle = champCleGemini.value.trim() || lireCleGemini();
    if (cle === "") {
      afficherMessage("Colle d'abord ta clé Gemini dans le champ.", false, messageGemini);
      return;
    }
    boutonEnregistrerGemini.disabled = true;
    afficherMessage("Vérification auprès de Google…", true, messageGemini);
    let verifiee = true;
    try {
      await verifierGemini(cle, modele);
    } catch (erreur) {
      if (erreur.code === "cle") {
        afficherMessage("Google refuse cette clé. Vérifie que tu l'as copiée en entier. Rien n'a été enregistré.", false, messageGemini);
        return;
      }
      if (erreur.code === "modele") {
        afficherMessage(`Le modèle « ${modele} » est introuvable pour cette clé. Rien n'a été enregistré.`, false, messageGemini);
        return;
      }
      verifiee = false; // pas de connexion, quota… : on enregistre quand même
    } finally {
      boutonEnregistrerGemini.disabled = false;
    }
    try {
      localStorage.setItem(CLE_GEMINI, cle);
      localStorage.setItem(CLE_MODELE_GEMINI, modele);
    } catch {
      afficherMessage("Impossible d'enregistrer sur cet appareil (mémoire pleine ?).", false, messageGemini);
      return;
    }
    champCleGemini.value = "";
    afficherEtatGemini();
    afficherMessage(verifiee
      ? "Clé et modèle vérifiés et enregistrés. L'ajout par photos et texte est activé."
      : "Enregistré, mais impossible de vérifier auprès de Google pour le moment (pas de connexion ?).",
    verifiee, messageGemini);
  });

  boutonEffacerGemini.addEventListener("click", () => {
    localStorage.removeItem(CLE_GEMINI);
    champCleGemini.value = "";
    afficherEtatGemini();
    afficherMessage("Clé effacée de cet appareil.", true, messageGemini);
  });

  afficherEtatGemini();
}

// --- 8. Les vignettes des cartes ---------------------------------
// Fabrique la vignette d'une fiche : sa photo, ou un cadre pointillé avec
// un appareil photo quand il n'y a pas de photo ou qu'elle ne se charge
// pas (hors ligne)
function creerVignette(affiche, type) {
  const vide = document.createElement("span");
  vide.className = "vignette cadre-pointille";
  vide.append(icone("appareil"));
  if (!affiche) return vide;

  const image = document.createElement("img");
  image.className = "vignette";
  image.alt = "";
  image.loading = "lazy";
  // Le site de la photo ne sait pas qu'elle est affichée dans l'app
  // (certains sites refusent aussi leurs photos quand on l'indique)
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => image.replaceWith(vide));
  // Adresse web, ou photo rangée dans la mémoire des photos (« idb:… »)
  poserSource(image, affiche, () => image.replaceWith(vide));
  return image;
}

// --- 9. Démarrage --------------------------------------------
document.getElementById("version").textContent = VERSION;
allerA("accueil");
// Mémoire des photos (v1.19) : on demande au navigateur de la conserver,
// puis on y range les photos gardées avant cette version
demanderConservation();
rangerAnciennesPhotos();

// Enregistre le service worker (permet le fonctionnement hors ligne)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .catch((erreur) => console.error("Service worker non enregistré :", erreur));
}
