-- ============================================================
-- FUNCTION: Assign guest role when paid = false or null
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_guest_role_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_guest_role_id BIGINT;
    v_current_role_id BIGINT;
BEGIN
    -- Get the guest role id
    SELECT id INTO v_guest_role_id
    FROM public.roles
    WHERE name = 'guest'
    LIMIT 1;

    IF v_guest_role_id IS NULL THEN
        RAISE EXCEPTION 'Guest role not found in roles table';
    END IF;

    -- Trigger on INSERT or UPDATE
    -- If paid is false or null, assign guest role
    IF (NEW.paid = FALSE OR NEW.paid IS NULL) THEN

        -- Only update if they aren't already a guest to avoid infinite trigger loops
        IF NEW.role_id IS DISTINCT FROM v_guest_role_id THEN
            NEW.role_id = v_guest_role_id;
        END IF;

    -- If paid flipped to true, only remove guest if they are still a guest
    -- (don't overwrite a manually assigned role)
    ELSIF (NEW.paid = TRUE AND OLD IS NOT NULL) THEN

        SELECT role_id INTO v_current_role_id
        FROM public.users
        WHERE id = NEW.id;

        IF v_current_role_id = v_guest_role_id THEN
            NEW.role_id = NULL; -- or set to a default 'member' role id if you have one
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- TRIGGER: Fires on INSERT and UPDATE of paid column
-- ============================================================
CREATE OR REPLACE TRIGGER assign_guest_role
BEFORE INSERT OR UPDATE OF paid ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_guest_role_assignment();


-- ============================================================
-- BACKFILL: Apply to existing users who are already unpaid
-- ============================================================
UPDATE public.users
SET paid = COALESCE(paid, FALSE)
WHERE paid = FALSE OR paid IS NULL;