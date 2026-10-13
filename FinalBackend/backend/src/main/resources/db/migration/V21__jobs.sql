-- Jobs & Placement Opportunities module: job postings and student applications.

CREATE TABLE IF NOT EXISTS public.job_opportunity (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    company VARCHAR(200) NOT NULL,
    location VARCHAR(200),
    employment_type VARCHAR(40),
    experience_level VARCHAR(40),
    salary_min_lpa DOUBLE PRECISION,
    salary_max_lpa DOUBLE PRECISION,
    description VARCHAR(4000),
    required_skills VARCHAR(1000),
    nice_to_have_skills VARCHAR(1000),
    apply_url VARCHAR(500),
    posted_at TIMESTAMP NOT NULL DEFAULT now(),
    closes_at DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    posted_by BIGINT REFERENCES public.app_user(id)
);

CREATE TABLE IF NOT EXISTS public.job_application (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES public.job_opportunity(id) ON DELETE CASCADE,
    applicant_id BIGINT NOT NULL REFERENCES public.app_user(id),
    status VARCHAR(40) NOT NULL DEFAULT 'APPLIED',
    applied_at TIMESTAMP NOT NULL DEFAULT now(),
    resume_text VARCHAR(8000),
    cover_note VARCHAR(4000),
    CONSTRAINT uk_job_applicant UNIQUE (job_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_job_application_job_id ON public.job_application(job_id);
CREATE INDEX IF NOT EXISTS idx_job_application_applicant_id ON public.job_application(applicant_id);
CREATE INDEX IF NOT EXISTS idx_job_opportunity_active ON public.job_opportunity(active);
