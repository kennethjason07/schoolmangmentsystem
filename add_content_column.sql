-- Add content column to messages table
ALTER TABLE public.messages ADD COLUMN content text;

-- Optional: Copy existing message data to content column if needed
UPDATE public.messages SET content = message WHERE content IS NULL;

-- Optional: If you want to replace the message column entirely with content
-- ALTER TABLE public.messages DROP COLUMN message;
-- ALTER TABLE public.messages ALTER COLUMN content SET NOT NULL;
