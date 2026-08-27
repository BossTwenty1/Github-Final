-- Least-privilege grants for public visitor views.
-- Anonymous and authenticated visitors need SELECT only.

REVOKE ALL PRIVILEGES ON TABLE public.public_burial_records FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.public_burial_photos FROM anon, authenticated;

GRANT SELECT ON TABLE public.public_burial_records TO anon, authenticated;
GRANT SELECT ON TABLE public.public_burial_photos TO anon, authenticated;
