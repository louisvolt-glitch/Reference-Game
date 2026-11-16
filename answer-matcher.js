/**
 * answer-matcher.js — Validation tolérante des réponses (aucune dépendance).
 *
 * Tolérances : casse, accents, ponctuation, article initial (the/le/la/les),
 * espaces ("pac man" = "pacman"), « & » = « and », et petite faute de frappe
 * (distance de Levenshtein) tant que les chiffres saisis sont exacts
 * (« Portal 2 » n'est donc pas accepté pour « Portal »).
 */

export function normalizeAnswer(input) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // accents
    .replace(/&/g, ' and ')
    .replace(/['’`´]/g, '')                               // apostrophes
    .replace(/[^a-z0-9]+/g, ' ')                          // ponctuation → espace
    .trim()
    .replace(/^(the|le|la|les) /, '')
    .replace(/\s+/g, ' ');
}

/** Forme compacte utilisée pour la comparaison (sans espaces). */
export const compact = (input) => normalizeAnswer(input).replace(/ /g, '');

/** Construit l'ensemble des réponses acceptées pour un jeu. */
export function buildAnswerSet(title, aliases = []) {
  const set = new Set();
  for (const a of [title, ...aliases]) {
    const c = compact(a);
    if (c) set.add(c);
  }
  return set;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const digitsOf = (s) => s.replace(/[^0-9]/g, '');

/**
 * @param {string} userText  saisie brute du joueur
 * @param {Set<string>} answers  ensemble produit par buildAnswerSet
 * @param {boolean} fuzzy  autorise 1 faute (≥ 6 caractères) ou 2 fautes (≥ 12)
 */
export function matchAnswer(userText, answers, fuzzy = true) {
  const guess = compact(userText);
  if (!guess) return false;
  if (answers.has(guess)) return true;
  if (!fuzzy) return false;
  for (const answer of answers) {
    const tolerance = answer.length >= 12 ? 2 : answer.length >= 6 ? 1 : 0;
    if (!tolerance) continue;
    if (Math.abs(answer.length - guess.length) > tolerance) continue;
    if (digitsOf(answer) !== digitsOf(guess)) continue;
    if (levenshtein(guess, answer) <= tolerance) return true;
  }
  return false;
}
