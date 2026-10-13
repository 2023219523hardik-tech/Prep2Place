-- managed_test_assignment already does the right thing on revoke (flips active=false, never
-- deletes the row - see ManagedTestAdminService.unassign), so historical access history was
-- already safe. What was missing was *who* revoked access, *when*, and *why* - spec section 42
-- explicitly wants an admin override to be traceable. These three columns close that gap without
-- touching the existing active-flag mechanism at all.

ALTER TABLE public.managed_test_assignment
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP(6) WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS revoked_by_id BIGINT,
    ADD COLUMN IF NOT EXISTS reason VARCHAR(500);

ALTER TABLE public.managed_test_assignment
    ADD CONSTRAINT fk_mt_assignment_revoked_by FOREIGN KEY (revoked_by_id) REFERENCES public.app_user (id);
