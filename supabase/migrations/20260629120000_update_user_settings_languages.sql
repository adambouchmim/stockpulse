-- Add article_languages array column to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS article_languages TEXT[] DEFAULT ARRAY['en-US'];

-- Drop or keep newsapi_key_encrypted (keep or leave unused, but we can drop if desired or leave as nullable)
-- ALTER TABLE public.user_settings DROP COLUMN IF EXISTS newsapi_key_encrypted;
