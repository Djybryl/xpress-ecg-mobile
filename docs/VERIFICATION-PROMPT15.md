# Vérification finale — Prompt 15 (Mobile)

**Date :** 2026-05-15  
**Référence :** checklist *Prompts_Institution_Cardiologues_v2* (Prompt 15).

## Mobile (`xpress-ecg-mobile`)

| Contrôle | Résultat |
|----------|----------|
| `npx tsc --noEmit` | OK (exit 0). |
| `npm audit` | **4 vulnérabilités modérées** (chaîne `postcss` via `@expo/metro-config` / `expo`) — sortie `npm audit` avec exit 1 ; correction potentielle `npm audit fix --force` indique une montée de version **breaking** d’Expo — à traiter dans une tâche dédiée. |

## Supabase (requêtes SQL)

Les 4 requêtes de contrôle des tables/colonnes sont versionnées dans le dépôt **backend** :

`xpress-ecg-backend` → `supabase/scripts/verify_prompt15_institution_cardiologists.sql`
