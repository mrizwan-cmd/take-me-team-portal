UPDATE portal_state
SET data = jsonb_set(
    data::jsonb,
    '{conversations}',
    (
      SELECT COALESCE(jsonb_agg(conversation ORDER BY position), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(data::jsonb -> 'conversations', '[]'::jsonb))
        WITH ORDINALITY AS saved_conversations(conversation, position)
      WHERE lower(btrim(conversation ->> 'name')) <> 'demo'
    ),
    false
  )::text,
  updated_at = GREATEST(
    (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint,
    updated_at + 1
  )
WHERE workspace_id = 'take-me-group'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(data::jsonb -> 'conversations', '[]'::jsonb)) AS saved_conversations(conversation)
    WHERE lower(btrim(conversation ->> 'name')) = 'demo'
  );
