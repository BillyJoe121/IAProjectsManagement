-- Team members may maintain only organization contacts for their assigned project.
-- The security-definer boundary validates both project membership and the small,
-- fixed contact payload before changing a single approved column.
CREATE OR REPLACE FUNCTION public.set_project_contacts(
  target_project_id UUID,
  target_contacts JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contact_item JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_project(target_project_id) THEN
    RAISE EXCEPTION 'PROJECT_ACCESS_DENIED';
  END IF;

  IF jsonb_typeof(COALESCE(target_contacts, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(target_contacts, '[]'::jsonb)) > 30 THEN
    RAISE EXCEPTION 'PROJECT_CONTACTS_INVALID';
  END IF;

  FOR contact_item IN SELECT value FROM jsonb_array_elements(COALESCE(target_contacts, '[]'::jsonb))
  LOOP
    IF jsonb_typeof(contact_item) <> 'object'
       OR length(trim(COALESCE(contact_item->>'name', ''))) NOT BETWEEN 1 AND 160
       OR (NULLIF(trim(COALESCE(contact_item->>'email', '')), '') IS NOT NULL
           AND contact_item->>'email' !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
       OR (NULLIF(trim(COALESCE(contact_item->>'phone', '')), '') IS NOT NULL
           AND contact_item->>'phone' !~ '^[0-9+() .-]{5,30}$') THEN
      RAISE EXCEPTION 'PROJECT_CONTACT_INVALID';
    END IF;
  END LOOP;

  UPDATE public.projects
  SET organization_contacts = COALESCE(target_contacts, '[]'::jsonb),
      last_activity_at = now(),
      updated_at = now()
  WHERE id = target_project_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_contacts(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_project_contacts(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_project_contacts(UUID, JSONB) TO authenticated;
