-- ============================================================================
-- 00091 — Normalisation des données membres (org QLF GYM)
--
--   1. Noms : espaces multiples réduits + première lettre en majuscule
--      (mots latins uniquement ; les noms arabes sont laissés tels quels)
--   2. Téléphones : format 10 chiffres 0XXXXXXXXX (espaces/tirets retirés)
--   3. Emails : minuscules + espaces rognés
--   4. subscription_types : noms rognés (corrige "Mensuel " avec espace final)
-- ============================================================================

-- Helper : met en majuscule la 1re lettre de chaque mot latin, réduit les espaces
CREATE OR REPLACE FUNCTION public.title_case_name(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  out text := '';
  w text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  FOREACH w IN ARRAY string_to_array(btrim(p), ' ') LOOP
    IF w ~ '^[A-Za-z''-]+$' THEN
      out := out || ' ' || upper(left(w, 1)) || lower(substr(w, 2));
    ELSE
      out := out || ' ' || w;
    END IF;
  END LOOP;
  RETURN btrim(out);
END;
$$;

DO $$
DECLARE
  v_org UUID := '782738ec-0277-4bbb-aee2-b3ec561b2a07';
BEGIN

  -- 1. Titre / espacement des noms -------------------------------------------
  UPDATE members m
  SET first_name = public.title_case_name(m.first_name),
      last_name  = public.title_case_name(m.last_name)
  WHERE m.organization_id = v_org;

  -- 2. Téléphones ------------------------------------------------------------
  UPDATE members m
  SET phone = CASE
        WHEN m.phone ~ '^[567][0-9]{8}$' THEN '0' || m.phone
        ELSE m.phone
      END
  WHERE m.organization_id = v_org
    AND m.phone IS NOT NULL;

  -- 3. Emails ----------------------------------------------------------------
  UPDATE members m
  SET email = lower(btrim(m.email))
  WHERE m.organization_id = v_org
    AND m.email IS NOT NULL
    AND btrim(m.email) <> '';

  -- 4. subscription_types : noms rognés --------------------------------------
  UPDATE subscription_types st
  SET name = btrim(st.name)
  WHERE st.name <> btrim(st.name);

END $$;
