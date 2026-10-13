-- V24: ATS Resume Screening, Configurable Shortlisting, Round Scheduling & Proctoring Configuration

-- 1. Extend job_opportunity with ATS screening and execution mode columns
ALTER TABLE public.job_opportunity
    ADD COLUMN IF NOT EXISTS pipeline_management_mode VARCHAR(50) DEFAULT 'PREP2PLACE_MANAGED',
    ADD COLUMN IF NOT EXISTS ats_screening_enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS ats_minimum_score DOUBLE PRECISION DEFAULT 75.0,
    ADD COLUMN IF NOT EXISTS auto_shortlist_enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS manual_review_required BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS min_graduation_year INTEGER,
    ADD COLUMN IF NOT EXISTS max_graduation_year INTEGER,
    ADD COLUMN IF NOT EXISTS allowed_degrees VARCHAR(500),
    ADD COLUMN IF NOT EXISTS ats_scoring_weights TEXT;

-- 2. Extend hiring_round with round scheduling and proctoring configuration
ALTER TABLE public.hiring_round
    ADD COLUMN IF NOT EXISTS round_status VARCHAR(50) DEFAULT 'DRAFT',
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS start_time TIME,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS end_time TIME,
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS proctoring_config TEXT;

-- 3. Extend job_application with ATS scoring results, eligibility, and recruiter audit notes
ALTER TABLE public.job_application
    ADD COLUMN IF NOT EXISTS ats_score DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS ats_parsing_status VARCHAR(50) DEFAULT 'PARSED',
    ADD COLUMN IF NOT EXISTS eligibility_passed BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS eligibility_failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS ats_score_breakdown TEXT,
    ADD COLUMN IF NOT EXISTS recruiter_audit_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_job_app_ats_score ON public.job_application(ats_score);
CREATE INDEX IF NOT EXISTS idx_job_app_eligibility ON public.job_application(eligibility_passed);
