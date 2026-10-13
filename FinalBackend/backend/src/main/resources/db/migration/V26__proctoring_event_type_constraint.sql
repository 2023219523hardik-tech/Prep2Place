-- V26__proctoring_event_type_constraint.sql
-- Drop restrictive proctoring_event_event_type_check constraint to allow FORMAL_DRESS_NOT_DETECTED and extensible proctoring events

ALTER TABLE public.proctoring_event DROP CONSTRAINT IF EXISTS proctoring_event_event_type_check;
