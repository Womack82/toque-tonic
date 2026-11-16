// ============================================================
// icones.js : les icônes de l'app, style « Trait fin »
// Grille de 24 px, trait de 1.6 px, extrémités et angles arrondis,
// couleur héritée du texte (le style est dans composants.css, .icone).
//
// Chaque icône est un tracé SVG (attribut « d »). Pour s'en servir :
//   - en JavaScript : icone("toque") renvoie un <svg> prêt à placer ;
//   - en HTML : <svg data-icone="toque"></svg>, rempli au chargement.
// ============================================================

// Un cercle écrit en tracé : centre (cx, cy), rayon r
const cercle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

const ICONES = {
  // Navigation
  maison: "M4 10.5 12 4l8 6.5 M6 9v10.5h4.5V14h3v5.5H18V9",
  toque: "M7 14.5A4 4 0 0 1 6.3 6.6 A5.7 5.7 0 0 1 17.7 6.6 A4 4 0 0 1 17 14.5 M7 14.5V20h10v-5.5 M7 17h10",
  coupe: "M4.5 5h15L12 13z M12 13v6.5 M8 19.5h8",
  signet: "M7 4h10v16l-5-3.8L7 20z",
  grille: "M4.5 4.5h6v6h-6z M13.5 4.5h6v6h-6z M4.5 13.5h6v6h-6z M13.5 13.5h6v6h-6z",
  plus: "M12 5v14 M5 12h14",
  profil: cercle(12, 8, 4) + " M4.5 20.5a7.5 7.5 0 0 1 15 0",

  // Actions
  recherche: cercle(10.5, 10.5, 6.5) + " M15.5 15.5 20 20",
  trier: "M7 4v16 M3.5 16.5 7 20l3.5-3.5 M17 20V4 M13.5 7.5 17 4l3.5 3.5",
  retour: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  fermer: "M6 6l12 12 M18 6 6 18",
  moins: "M5 12h14",
  coche: "M6 12.5l4 4 8-9",
  crayon: "M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19z M13.5 7.3l3.2 3.2",
  poubelle: "M4.5 7h15 M9.5 7V4.5h5V7 M6.5 7l1 12.5h9l1-12.5 M10.5 11v5 M13.5 11v5",
  appareil: "M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z " + cercle(12, 13.2, 3.3),
  lien: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2",
  ouvrir: "M14 4.5h5.5V10 M19.5 4.5 11 13 M17 13.5v5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5",
  reglages: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z " + cercle(12, 12, 3),
  etincelles: "M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z",

  // Métadonnées des fiches
  horloge: cercle(12, 12, 8.5) + " M12 7.5V12l3 2",
  flamme: "M12 20.5c-3.3 0-5.8-2.3-5.8-5.5 0-3.6 3.1-5.3 3.6-9.5 2.5 1.4 3.4 3.7 3.4 5.4.9-.5 1.6-1.6 1.8-2.8 1.9 1.6 2.8 3.8 2.8 6.1 0 3.4-2.5 6.3-5.8 6.3z",
  personnes: cercle(9, 7.5, 3.5) + " M3 20a6 6 0 0 1 12 0 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14.3a6 6 0 0 1 3 5.7",
  niveau: "M6 19v-5 M12 19v-9 M18 19V5",
  verre: "M6 4.5h12l-1.4 15H7.4z M6.6 10h10.8",
  glace: "M12 3.5l7.5 4v9l-7.5 4-7.5-4v-9z M4.5 7.5l7.5 4 7.5-4 M12 11.5v9",
  garniture: cercle(12, 12, 8.5) + " M12 6.5v11 M7.2 9.2l9.6 5.6 M7.2 14.8l9.6-5.6",
  minuteur: cercle(12, 13.5, 7.5) + " M12 10v3.5 M10 2.5h4 M12 2.5V6",
};

// Fabrique l'icône « nom » : un <svg> de 24 × 24 qui prend la couleur du texte.
// classe : classes CSS en plus (ex. "plein" pour un signet rempli)
function icone(nom, classe = "") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", ("icone " + classe).trim());
  svg.setAttribute("aria-hidden", "true");
  const chemin = document.createElementNS(ns, "path");
  chemin.setAttribute("d", ICONES[nom] || "");
  svg.append(chemin);
  return svg;
}

// Remplit les <svg data-icone="…"> écrits dans le HTML
function remplirIcones(racine = document) {
  for (const svg of racine.querySelectorAll("svg[data-icone]")) {
    const classes = (svg.getAttribute("class") || "").replace(/\bicone\b/, "");
    const neuve = icone(svg.dataset.icone, classes);
    if (svg.id) neuve.id = svg.id;
    svg.replaceWith(neuve);
  }
}
remplirIcones();
