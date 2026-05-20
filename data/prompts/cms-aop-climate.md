# Prompt CMS — Champ « Climat » sur les fiches AOP

Utilise ce prompt dans le repo **CMS Oenoboost** (édition des AOP) pour ajouter une section de saisie du climat, reliée aux colonnes Supabase `climate_fr` / `climate_en` sur `public.aop`.

---

## Contexte base de données

Migration app (`oenoboost-app`) : `supabase/migrations/20260520130000_aop_climate.sql`

| Colonne | Type | Description |
|---------|------|-------------|
| `climate_fr` | `text` nullable | Texte libre décrivant le climat de l'AOP (français) |
| `climate_en` | `text` nullable | Même contenu en anglais |

**Règles métier :**

- Si `climate_fr` **et** `climate_en` sont vides / `NULL` → la section **Climat** n'apparaît **pas** sur la fiche AOP publique.
- Dès qu'au moins une langue est renseignée, la fiche affiche la section avec le texte de la locale active (repli sur `climate_fr` si l'anglais est vide, via `getContent`).

---

## Prompt à exécuter dans le CMS

```
Tu travailles sur le CMS Oenoboost (édition des AOP / table public.aop).

Objectif : ajouter une section « Climat » dans le formulaire d'édition d'une AOP, pour renseigner climate_fr et climate_en.

## UX attendue

1. Titre de section : « Climat »
2. Aide sous le titre : « Décrivez le climat typique de l'appellation (températures, pluviométrie, influence océanique/montagne, saisons…). Laissez vide si non renseigné — la section ne s'affichera pas sur la fiche publique. »

3. Deux champs texte multiligne (comme Histoire ou Sols) :
   - « Climat (FR) » → `climate_fr`
   - « Climat (EN) » → `climate_en`
   - 4 à 8 lignes visibles, redimensionnable
   - Pas de limite stricte côté UI ; en base c'est du `text`

4. Optionnel : bouton « Traduire EN depuis FR » si le CMS a déjà ce pattern pour history / soils.

5. Aperçu ou compteur de caractères — optionnel, pas obligatoire.

6. Validation :
   - Aucune contrainte de longueur minimale
   - Trim des espaces en tête/fin avant save
   - Chaîne vide → enregistrer `NULL` (pas `""`)

## Technique

- Étendre le type / schéma AOP du CMS avec `climate_fr?: string | null` et `climate_en?: string | null`.
- Inclure les champs dans le SELECT et l'UPDATE Supabase existants de l'AOP.
- Placer la section après « Sols » ou à côté de « Histoire » (cohérent avec le contenu éditorial).
- Ne pas casser les autres champs (Grand Cru, répartition couleurs, etc.).

## Exemple de contenu (Champagne)

FR : « Climat tempéré à tendance continentale. Hivers frais, étés chauds modérés par l'océan Atlantique. Pluviométrie régulière toute l'année. Les gelées printanières sont un risque majeur pour les bourgeons. »

## Tests manuels

- [ ] AOP sans climat → fiche publique sans bloc Climat
- [ ] FR seul renseigné → section visible en FR, repli FR en EN si EN vide
- [ ] FR + EN → texte correct selon la locale du site
- [ ] Effacer les deux champs → colonnes NULL, section disparaît

Respecte le style UI existant du CMS (labels, spacing, onglets FR/EN si présents).
```

---

## Exemple SQL (Supabase Studio)

```sql
UPDATE public.aop
SET
  climate_fr = 'Climat océanique tempéré. Hivers doux, étés ensoleillés, humidité modérée grâce à la proximité de l''Atlantique.',
  climate_en = 'Temperate oceanic climate. Mild winters, sunny summers, moderate humidity from the Atlantic influence.'
WHERE slug = 'bordeaux';
```
