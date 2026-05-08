ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS slug text UNIQUE;

CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(translate(coalesce(_input, ''),
        'áàâãäåāăąçćčďđéèêëēĕėęěğģíìîïīĭįıłĺľńñňóòôõöőøŕřśšşťţúùûüūŭůűųýÿžźżÁÀÂÃÄÅĀĂĄÇĆČĎĐÉÈÊËĒĔĖĘĚĞĢÍÌÎÏĪĬĮİŁĹĽŃÑŇÓÒÔÕÖŐØŔŘŚŠŞŤŢÚÙÛÜŪŬŮŰŲÝŸŽŹŻ',
        'aaaaaaaaacccddeeeeeeeeegfiiiiiiiilllnnnoooooooorrsssttuuuuuuuuuyyzzzAAAAAAAAACCCDDEEEEEEEEEGGIIIIIIIILLLNNNOOOOOOORRSSSTTUUUUUUUUUYYZZZ'
      )),
      '[^a-z0-9]+', '-', 'g'
    ),
    '(^-+|-+$)', '', 'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_client_slug(_base text, _client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  candidate text;
  counter int := 1;
BEGIN
  base_slug := public.slugify(_base);
  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := 'cliente';
  END IF;
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.clients WHERE slug = candidate AND (id IS DISTINCT FROM _client_id)) LOOP
    counter := counter + 1;
    candidate := base_slug || '-' || counter;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.clients_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_unique_client_slug(COALESCE(NEW.company, NEW.name), NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_set_slug_trigger ON public.clients;
CREATE TRIGGER clients_set_slug_trigger
BEFORE INSERT OR UPDATE OF name, company, slug ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.clients_set_slug();

UPDATE public.clients
SET slug = public.generate_unique_client_slug(COALESCE(company, name), id)
WHERE slug IS NULL OR slug = '';
