# Prompt CMS — Champ `is_grand_cru` sur les AOPs

Utilise ce prompt dans Claude Code pour qualifier chaque AOP comme Grand Cru ou non, puis générer le SQL de mise à jour correspondant.

---

## Prompt à exécuter

```
Tu es un expert en appellations viticoles françaises.

Voici la liste des AOPs présentes dans la base (slug, name). Pour chacune, détermine si elle est officiellement classifiée "Grand Cru" selon la réglementation INAO française — c'est-à-dire que le terme "Grand Cru" (ou "Grands Crus") fait partie intégrante du nom de l'appellation dans la nomenclature officielle.

Exemples de critères :
- "Alsace Grand Cru [lieu-dit]" → Grand Cru = true
- "Chablis Grand Cru" → true
- "Chambolle-Musigny" → false (village, pas Grand Cru)
- "Chambolle-Musigny Premier Cru" → false (Premier Cru ≠ Grand Cru)
- "Bonnes-Mares" → true (Grand Cru de Bourgogne sans mention explicite mais classifié)
- "Échézeaux" → true

Règles :
1. "Grand Cru" dans le NOM OFFICIEL de l'AOP → true
2. Grand Cru implicite (classements officiels Bourgogne, Saint-Émilion Grand Cru, etc.) → true
3. "Premier Cru" seul → false
4. Simple village ou régional → false

Pour chaque ligne, réponds UNIQUEMENT sous forme de SQL UPDATE :
  UPDATE public.aop SET is_grand_cru = true WHERE slug = '<slug>';
  -- (omets les false, ils sont déjà à false par défaut)

Liste des AOPs :
[COLLER ICI le résultat de : SELECT slug, name FROM public.aop ORDER BY name;]
```

---

## Comment l'utiliser

1. Dans Supabase Studio ou `psql`, exécute :
   ```sql
   SELECT slug, name FROM public.aop ORDER BY name;
   ```
2. Colle le résultat dans le prompt ci-dessus à la place de `[COLLER ICI ...]`.
3. Donne le prompt à Claude (claude.ai ou Claude Code).
4. Copie les `UPDATE` générés et exécute-les dans Supabase Studio ou via une migration.

---

## Migration de backfill (alternative automatique)

Si tu préfères une détection par nom (partielle, à compléter manuellement) :

```sql
-- Backfill automatique basé sur le nom officiel
UPDATE public.aop
SET is_grand_cru = true
WHERE
  name ILIKE '%grand cru%'
  -- Grands Crus de Bourgogne sans mention explicite (liste non exhaustive)
  OR slug IN (
    'chablis-grand-cru',
    'bonnes-mares',
    'chambertin',
    'chambertin-clos-de-beze',
    'chapelle-chambertin',
    'charmes-chambertin',
    'clos-de-la-roche',
    'clos-de-tart',
    'clos-de-vougeot',
    'clos-saint-denis',
    'corton',
    'corton-charlemagne',
    'criots-batard-montrachet',
    'echezeaux',
    'grands-echezeaux',
    'griotte-chambertin',
    'la-grande-rue',
    'la-romanee',
    'la-tache',
    'latricieres-chambertin',
    'mazis-chambertin',
    'mazoyeres-chambertin',
    'montrachet',
    'musigny',
    'petrus',
    'richebourg',
    'romanee-conti',
    'romanee-saint-vivant',
    'ruchottes-chambertin',
    'batard-montrachet',
    'bienvenues-batard-montrachet',
    'chevalier-montrachet'
  );
```

> **Note** : cette liste est indicative. Vérifie avec le prompt Claude ci-dessus pour une couverture exhaustive et correcte.
