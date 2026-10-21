ALTER TABLE dictionary_lookup_requests
    ADD COLUMN IF NOT EXISTS context_json jsonb;
