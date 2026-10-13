-- User Service Schema Ownership
-- This service owns: student profiles, job roles, skills, user profile data

CREATE TABLE IF NOT EXISTS student_profile (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    university VARCHAR(255),
    college VARCHAR(255),
    branch VARCHAR(255),
    graduation_year INT,
    section VARCHAR(50),
    batch VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS job_roles (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT NOT NULL REFERENCES student_profile(id) ON DELETE CASCADE,
    role_name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    location VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT NOT NULL REFERENCES student_profile(id) ON DELETE CASCADE,
    skill_name VARCHAR(255) NOT NULL,
    proficiency VARCHAR(50),
    category VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_profile_user_id ON student_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_job_roles_profile_id ON job_roles(profile_id);
CREATE INDEX IF NOT EXISTS idx_skills_profile_id ON skills(profile_id);
