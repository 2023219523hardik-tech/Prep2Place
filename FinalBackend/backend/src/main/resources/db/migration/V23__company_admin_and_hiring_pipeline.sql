-- V23: Company Admin and Configurable Hiring Pipeline

-- 1. Extend company table with metadata
ALTER TABLE public.company
    ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS website VARCHAR(500),
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';

-- 2. Link app_user to company for COMPANY_ADMIN role and update role constraint
ALTER TABLE public.app_user
    ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.app_user DROP CONSTRAINT IF EXISTS app_user_role_check;
ALTER TABLE public.app_user ADD CONSTRAINT app_user_role_check CHECK (role IN ('STUDENT', 'ADMIN', 'RECRUITER', 'COMPANY', 'COMPANY_ADMIN'));

CREATE INDEX IF NOT EXISTS idx_app_user_company_id ON public.app_user(company_id);

-- 3. Extend job_opportunity table
ALTER TABLE public.job_opportunity
    ADD COLUMN IF NOT EXISTS slug VARCHAR(200),
    ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES public.company(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS department VARCHAR(100),
    ADD COLUMN IF NOT EXISTS openings INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS stipend DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS min_cgpa DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS max_backlogs INTEGER,
    ADD COLUMN IF NOT EXISTS graduation_year INTEGER,
    ADD COLUMN IF NOT EXISTS branches VARCHAR(500),
    ADD COLUMN IF NOT EXISTS required_certifications VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS benefits VARCHAR(2000),
    ADD COLUMN IF NOT EXISTS responsibilities VARCHAR(4000);

CREATE INDEX IF NOT EXISTS idx_job_opportunity_company_id ON public.job_opportunity(company_id);
CREATE INDEX IF NOT EXISTS idx_job_opportunity_slug ON public.job_opportunity(slug);

-- 4. Create hiring_round table for configurable pipelines
CREATE TABLE IF NOT EXISTS public.hiring_round (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES public.job_opportunity(id) ON DELETE CASCADE,
    round_order INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    round_type VARCHAR(50) NOT NULL,
    duration_minutes INTEGER,
    passing_score DOUBLE PRECISION,
    weightage DOUBLE PRECISION,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    repeatable BOOLEAN NOT NULL DEFAULT FALSE,
    auto_unlock BOOLEAN NOT NULL DEFAULT TRUE,
    management_mode VARCHAR(50) NOT NULL DEFAULT 'AUTOMATIC',
    assessment_config TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hiring_round_job ON public.hiring_round(job_id, round_order);

-- 5. Extend job_application table
ALTER TABLE public.job_application
    ADD COLUMN IF NOT EXISTS current_round_id BIGINT REFERENCES public.hiring_round(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS overall_score DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS final_decision VARCHAR(50),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- 6. Create round_attempt table for candidate tracking in each round
CREATE TABLE IF NOT EXISTS public.round_attempt (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES public.job_application(id) ON DELETE CASCADE,
    round_id BIGINT NOT NULL REFERENCES public.hiring_round(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    score DOUBLE PRECISION,
    passed BOOLEAN,
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    feedback TEXT,
    notes TEXT,
    interview_scheduled_at TIMESTAMP,
    interviewer_meeting_link VARCHAR(500),
    evaluated_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uk_app_round_attempt UNIQUE (application_id, round_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_round_attempt_app ON public.round_attempt(application_id);
CREATE INDEX IF NOT EXISTS idx_round_attempt_round ON public.round_attempt(round_id);

-- 7. Seed initial companies if missing (e.g. sif360, tcs, infosys)
INSERT INTO public.company (slug, name, created_at, status, description, website)
VALUES 
    ('sif360', 'SIF360 Inc.', now(), 'ACTIVE', 'Leading AI, Data Analytics & Enterprise Software Solutions.', 'https://sif360.com'),
    ('tcs', 'Tata Consultancy Services', now(), 'ACTIVE', 'Global leader in IT services, consulting, and business solutions.', 'https://tcs.com'),
    ('infosys', 'Infosys', now(), 'ACTIVE', 'Global leader in next-generation digital services and consulting.', 'https://infosys.com')
ON CONFLICT (slug) DO UPDATE
SET status = 'ACTIVE',
    description = EXCLUDED.description,
    website = EXCLUDED.website;

-- 8. Seed a demo company admin user for sif360 (password: Admin@123 -> $2a$10$W2iE... or similar)
-- Password BCrypt: $2a$10$X8O57M3hZvgYI6Riq0hFLeN6bZ7516w1/JzO0vVqH1M6Y6XgYnJ0O or reuse existing admin password hash
DO $$
DECLARE
    v_sif360_id BIGINT;
    v_pwd TEXT;
BEGIN
    SELECT id INTO v_sif360_id FROM public.company WHERE slug = 'sif360' LIMIT 1;
    
    -- Pick an existing admin's BCrypt hash if available, or generate standard $2a$10$
    SELECT password INTO v_pwd FROM public.app_user WHERE role = 'ADMIN' LIMIT 1;
    IF v_pwd IS NULL THEN
        -- BCrypt for "Admin@123"
        v_pwd := '$2a$10$r8K7sBwPjU32R0C0s5eDTeY9W43b8Bf7hD0b0jLgR9yZkQ4J8M8aW';
    END IF;

    IF v_sif360_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.app_user WHERE email = 'admin@sif360.com') THEN
            INSERT INTO public.app_user (email, password, full_name, role, active, email_verified, premium, created_at, company_id)
            VALUES ('admin@sif360.com', v_pwd, 'SIF360 Hiring Admin', 'COMPANY_ADMIN', true, true, true, now(), v_sif360_id);
        ELSE
            UPDATE public.app_user 
            SET role = 'COMPANY_ADMIN', company_id = v_sif360_id 
            WHERE email = 'admin@sif360.com';
        END IF;

        -- Link any existing job opportunities for sif360
        UPDATE public.job_opportunity
        SET company_id = v_sif360_id
        WHERE LOWER(company) LIKE '%sif360%' AND company_id IS NULL;
    END IF;
END $$;
