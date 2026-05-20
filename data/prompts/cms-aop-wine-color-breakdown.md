# Prompt CMS — Répartition des couleurs de vin sur les fiches AOP

Utilise ce prompt dans le repo **CMS Oenoboost** (édition des AOP) pour ajouter une section intuitive de saisie des pourcentages, reliée aux colonnes Supabase `wine_pct_*` sur `public.aop`.

---

## Contexte base de données

Migration app (`oenoboost-app`) : `supabase/migrations/20260520120000_aop_wine_color_breakdown.sql`

Colonnes sur `public.aop` :

| Colonne | Type | Description |
|---------|------|-------------|
| `wine_pct_red` | `smallint` nullable | % vin **rouge** (0–100) |
| `wine_pct_white` | `smallint` nullable | % vin **blanc** (0–100) |
| `wine_pct_sparkling` | `smallint` nullable | % vin **effervescent** (0–100) |
| `wine_pct_liqueur` | `smallint` nullable | % vin **liqueureux** (fortifié, doux liquoreux, etc.) |

**Règles métier :**

- Les **4 colonnes à `NULL`** → pas de données → **pas de camembert** sur la fiche AOP publique.
- Dès qu’au moins une valeur est renseignée, la **somme des 4 doit être exactement 100** (contrainte SQL `aop_wine_pct_sum_100`).
- Des pourcentages à `0` sont autorisés (ex. AOP 100 % rouge : `70+30+0+0` non, plutôt `100,0,0,0`).

---

## Prompt à exécuter dans le CMS

```
Tu travailles sur le CMS Oenoboost (édition des AOP / table public.aop).

Objectif : ajouter une section « Répartition par couleur de vin » dans le formulaire d’édition d’une AOP, pour renseigner wine_pct_red, wine_pct_white, wine_pct_sparkling, wine_pct_liqueur.

## UX attendue (intuitive)

1. Titre de section : « Répartition par couleur » avec courte aide : « Pourcentages de production par type de vin. Laissez vide si inconnu — la fiche publique n’affichera pas de graphique. »

2. Quatre lignes (ou cartes) avec libellés FR :
   - Vin rouge
   - Vin blanc
   - Vin effervescent
   - Vin liqueureux

3. Pour chaque ligne :
   - Slider 0–100 **ou** input number avec step 1, min 0, max 100
   - Affichage du % en direct à côté

4. Barre de total en bas :
   - Affiche « Total : X % »
   - Vert si X = 100, orange si 1–99, gris si 0 (mode vide)
   - Bouton « Répartir équitablement » (met 25 % sur les 4) — optionnel mais utile

5. Mode « Pas de données » :
   - Case à cocher ou toggle « Données non renseignées »
   - Quand activé : désactive les 4 champs et envoie les 4 colonnes à `NULL` à l’enregistrement
   - Quand désactivé : l’utilisateur saisit les %

6. Validation avant save :
   - Si au moins un champ est rempli (non null) : somme **doit** être 100, sinon message d’erreur bloquant : « La somme des pourcentages doit être égale à 100 %. »
   - Si mode « pas de données » : forcer les 4 champs à null

7. Aperçu optionnel (nice to have) : mini camembert donut identique à l’app (couleurs : rouge #7C2736, blanc #f5f0e8, effervescent chart-3, liqueureux chart-5) — masqué si pas de données.

## Technique

- Étendre le type / schéma AOP du CMS avec les 4 champs optionnels (number | null).
- Mapper vers Supabase sur update : `wine_pct_red`, `wine_pct_white`, `wine_pct_sparkling`, `wine_pct_liqueur`.
- Ne pas casser les champs existants (Grand Cru, textes, etc.).
- Section placée après « Chiffres clés » ou avant « Couleurs & cépages » si l’ordre du formulaire le permet.

## API / Supabase

Exemple de payload save :

```json
{
  "wine_pct_red": 85,
  "wine_pct_white": 10,
  "wine_pct_sparkling": 5,
  "wine_pct_liqueur": 0
}
```

Ou tout à null :

```json
{
  "wine_pct_red": null,
  "wine_pct_white": null,
  "wine_pct_sparkling": null,
  "wine_pct_liqueur": null
}
```

## Tests manuels

- [ ] AOP sans données → fiche publique sans camembert
- [ ] 100 % rouge → camembert une seule tranche
- [ ] 40/35/20/5 → camembert + légende correcte
- [ ] Total 99 % → erreur à l’enregistrement
- [ ] Toggle « pas de données » après saisie → colonnes null en base

Respecte le style UI existant du CMS (composants, spacing, labels i18n si le CMS est bilingue).
```

---

## Exemples SQL de test (Supabase Studio)

```sql
-- Champagne typique
UPDATE public.aop
SET
  wine_pct_red = 32,
  wine_pct_white = 58,
  wine_pct_sparkling = 10,
  wine_pct_liqueur = 0
WHERE slug = 'champagne';

-- Effacer les données (pas de camembert)
UPDATE public.aop
SET
  wine_pct_red = NULL,
  wine_pct_white = NULL,
  wine_pct_sparkling = NULL,
  wine_pct_liqueur = NULL
WHERE slug = 'champagne';
```

---

## Lien avec l’app publique

Le composant `AopWineColorPieChart` dans `oenoboost-app` lit ces colonnes via `getAppellationBySlug` et n’affiche le graphique que si `getWineColorBreakdown()` retourne des données.
