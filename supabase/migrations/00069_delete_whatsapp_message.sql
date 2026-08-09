-- Migration 00069: RPC delete_whatsapp_message (admin only)
CREATE OR REPLACE FUNCTION public.delete_whatsapp_message(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
BEGIN
  SELECT organization_id INTO v_org FROM public.whatsapp_outbox WHERE id = p_message_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF NOT is_admin(v_org) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  DELETE FROM public.whatsapp_outbox WHERE id = p_message_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_whatsapp_message(UUID) TO authenticated;
