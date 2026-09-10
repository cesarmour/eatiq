alter table public.profiles add column if not exists quiz_gostos jsonb;
alter table public.profiles add constraint profiles_quiz_gostos_valid check (
 quiz_gostos is null or coalesce(
 jsonb_typeof(quiz_gostos)='object' and quiz_gostos->>'version'='1'
 and jsonb_typeof(quiz_gostos->'answers')='array'
 and jsonb_array_length(quiz_gostos->'answers')=5
 and (quiz_gostos->'answers') <@ '[0,1,2,3]'::jsonb,false)
);
comment on column public.profiles.quiz_gostos is 'Versioned five-question taste quiz; protected by existing owner-only profile policies. No allergy inference.';
