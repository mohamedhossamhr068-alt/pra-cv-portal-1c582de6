-- Fix: chat_insert_bot_reply() (and the trigger logic that checks
-- NEW.kind = 'bot') were written assuming 'bot' is a valid value for
-- conversation_messages.kind, but the check constraint was never updated
-- to allow it. Every bot reply insert has been silently failing with a
-- check constraint violation since this was introduced, which is why the
-- support chatbot for logged-in users has never actually posted a reply.

ALTER TABLE public.conversation_messages
  DROP CONSTRAINT IF EXISTS conversation_messages_kind_check;

ALTER TABLE public.conversation_messages
  ADD CONSTRAINT conversation_messages_kind_check
  CHECK (kind = ANY (ARRAY['text'::text, 'credit_request'::text, 'system'::text, 'bot'::text]));
