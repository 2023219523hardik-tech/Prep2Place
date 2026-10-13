-- Technical MCQ no longer has a company/tag concept (see TechnicalMcqQuestion.java - both
-- @ElementCollection fields were removed). These two tables only ever backed those two fields
-- (created in V5, indexed on question_id, FK'd with ON DELETE CASCADE to technical_mcq_question) -
-- nothing else in the schema references them, so dropping them is safe and leaves
-- technical_mcq_question itself untouched.

DROP TABLE IF EXISTS public.technical_mcq_question_company;
DROP TABLE IF EXISTS public.technical_mcq_question_tag;
