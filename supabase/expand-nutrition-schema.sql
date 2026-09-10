alter table public.nutri_ingredientes
 add column if not exists fonte text,
 add column if not exists fonte_url text,
 add column if not exists fonte_id text,
 add column if not exists porcao_g numeric,
 add column if not exists estado text,
 add column if not exists versao_base text;
alter table public.nutri_pratos add column if not exists versao_base text;
