-- When a seller sends parent details first and colour photos afterward, reopen the
-- recent processed context so each new image can be paired with the same catalogue.

CREATE OR REPLACE FUNCTION public.reopen_recent_whatsapp_catalog_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.whatsapp_catalog_messages
  SET
    status = 'pending',
    error_message = NULL,
    updated_at = NOW()
  WHERE sender_phone = NEW.sender_phone
    AND id <> NEW.id
    AND status = 'processed'
    AND received_at >= NEW.received_at - INTERVAL '15 minutes'
    AND received_at <= NEW.received_at + INTERVAL '1 minute';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_recent_whatsapp_catalog_context() FROM PUBLIC;

DROP TRIGGER IF EXISTS reopen_recent_whatsapp_catalog_context
  ON public.whatsapp_catalog_messages;
CREATE TRIGGER reopen_recent_whatsapp_catalog_context
  AFTER INSERT ON public.whatsapp_catalog_messages
  FOR EACH ROW EXECUTE FUNCTION public.reopen_recent_whatsapp_catalog_context();
