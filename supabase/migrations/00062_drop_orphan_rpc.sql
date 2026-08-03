-- Migration 00062: Drop orphaned SECURITY DEFINER overload of create_member_with_pending_subscription
-- L'overload 13 params (sans p_corporate_id) date de 00009 et n'a jamais été remplacé
-- (00027 puis 00061 ont créé/remplacé des signatures différentes). Il reste SECURITY DEFINER
-- sans autorisation -> faille. Le client n'utilise que la version 14 params (avec p_corporate_id).
DROP FUNCTION IF EXISTS create_member_with_pending_subscription(
  uuid, text, text, uuid, date, text, text, text, date, text, text, text, text
);
