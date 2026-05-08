REVOKE EXECUTE ON FUNCTION public.slugify(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_unique_client_slug(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clients_set_slug() FROM PUBLIC, anon, authenticated;
