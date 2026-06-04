-- Nettoyage des notifications orphelines : marque comme lues les notifications
-- 'nouveau_compte_a_valider' dont l'utilisateur est déjà validé ou rejeté.
-- Cela corrige les cas où le trigger tg_notifier_admin_changement_statut
-- n'a pas pu s'exécuter (compte validé avant l'ajout du trigger).

UPDATE public.notifications_admin n
SET lue     = TRUE,
    lue_le  = NOW()
FROM public.utilisateurs u
WHERE n.user_id_concerne    = u.user_id
  AND n.type                = 'nouveau_compte_a_valider'
  AND n.lue                 = FALSE
  AND u.statut_validation  IN ('valide', 'rejete');

-- Met à jour le compteur pour qu'il filtre aussi les comptes déjà traités,
-- en cas de désynchronisation future entre trigger et table.
CREATE OR REPLACE FUNCTION public.notifications_admin_non_lues_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_admin_scs() THEN (
      SELECT COUNT(*)::INTEGER
      FROM public.notifications_admin n
      WHERE n.lue = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM public.utilisateurs u
          WHERE u.user_id = n.user_id_concerne
            AND u.statut_validation IN ('valide', 'rejete')
        )
    )
    ELSE 0
  END;
$$;
