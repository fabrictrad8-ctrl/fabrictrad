-- Real return/refund/dispute conversations and private evidence storage.

ALTER TABLE public.disputes
  DROP CONSTRAINT IF EXISTS disputes_dispute_type_check,
  ADD CONSTRAINT disputes_dispute_type_check CHECK (
    dispute_type IN (
      'return_request','exchange_request','refund_request','damage_claim',
      'quality_issue','delivery_issue','general_query'
    )
  );

CREATE INDEX IF NOT EXISTS disputes_buyer_user_created_idx
  ON public.disputes(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS disputes_seller_created_idx
  ON public.disputes(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dispute_messages_dispute_created_idx
  ON public.dispute_messages(dispute_id, created_at ASC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispute-evidence',
  'dispute-evidence',
  false,
  104857600,
  ARRAY[
    'image/jpeg','image/png','image/webp','application/pdf',
    'video/mp4','video/quicktime','video/webm'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS dispute_evidence_participant_read ON storage.objects;
DROP POLICY IF EXISTS dispute_evidence_participant_upload ON storage.objects;
DROP POLICY IF EXISTS dispute_evidence_owner_delete ON storage.objects;

CREATE POLICY dispute_evidence_participant_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'dispute-evidence'
  AND EXISTS (
    SELECT 1
    FROM public.disputes dispute
    WHERE dispute.id::text = (storage.foldername(name))[2]
      AND (
        dispute.buyer_user_id = (SELECT auth.uid())
        OR dispute.buyer_id IN (
          SELECT id FROM public.buyer_profiles WHERE user_id = (SELECT auth.uid())
        )
        OR dispute.seller_id = public.my_seller_id()
        OR public.is_admin()
      )
  )
);

CREATE POLICY dispute_evidence_participant_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dispute-evidence'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.disputes dispute
    WHERE dispute.id::text = (storage.foldername(name))[2]
      AND dispute.status IN ('open','under_review','escalated')
      AND (
        dispute.buyer_user_id = (SELECT auth.uid())
        OR dispute.buyer_id IN (
          SELECT id FROM public.buyer_profiles WHERE user_id = (SELECT auth.uid())
        )
        OR dispute.seller_id = public.my_seller_id()
      )
  )
);

CREATE POLICY dispute_evidence_owner_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'dispute-evidence'
  AND (
    owner = (SELECT auth.uid())
    OR public.is_admin()
  )
);
