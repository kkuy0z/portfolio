create table if not exists public.portfolio_content (
  id smallint primary key check (id = 1),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_content enable row level security;

grant select on public.portfolio_content to anon, authenticated;
grant insert, update, delete on public.portfolio_content to authenticated;

drop policy if exists "Public can read portfolio" on public.portfolio_content;
drop policy if exists "Owner can insert portfolio" on public.portfolio_content;
drop policy if exists "Owner can update portfolio" on public.portfolio_content;
drop policy if exists "Owner can delete portfolio" on public.portfolio_content;

create policy "Public can read portfolio"
on public.portfolio_content for select
to anon, authenticated
using (true);

create policy "Owner can insert portfolio"
on public.portfolio_content for insert
to authenticated
with check (auth.uid() = 'c57cadec-0d78-442f-b2ea-e4cd26ace32f'::uuid);

create policy "Owner can update portfolio"
on public.portfolio_content for update
to authenticated
using (auth.uid() = 'c57cadec-0d78-442f-b2ea-e4cd26ace32f'::uuid)
with check (auth.uid() = 'c57cadec-0d78-442f-b2ea-e4cd26ace32f'::uuid);

create policy "Owner can delete portfolio"
on public.portfolio_content for delete
to authenticated
using (auth.uid() = 'c57cadec-0d78-442f-b2ea-e4cd26ace32f'::uuid);

insert into public.portfolio_content (id, content)
values (
  1,
  $content${
    "profile": {
      "name": "Eloise Arruda Borges",
      "pronouns": "Ela/Dela",
      "role": "Desenvolvedora Front-end & Designer UI/UX",
      "location": "Betim, Minas Gerais, Brasil",
      "email": "",
      "linkedin": "https://www.linkedin.com/in/eloise-arruda-borges/",
      "intro": "Desenvolvedora front-end e estudante de Desenvolvimento de Sistemas com foco em interfaces criativas, experiência do usuário e desenvolvimento web moderno. Tenho experiência com HTML, CSS, JavaScript e MySQL, além de interesse em UI/UX e design digital.",
      "experience": "Aluna em tempo integral na E.E. Newton Amaral · fev. 2024 — atual · Betim, MG · Desenvolvimento de front-end",
      "skills": "HTML, CSS, JavaScript, MySQL, Python (básico), Desenvolvimento front-end, UI/UX, Ética em Inteligência Artificial, Tecnologia e Sociedade",
      "certifications": "Ética na Era da IA — Fundação Bradesco (ago. 2026)\nLinguagem de Programação Python - Básico — Fundação Bradesco (ago. 2026)",
      "photo": "assets/eloise-arruda-borges.jpg"
    },
    "projects": []
  }$content$::jsonb
)
on conflict (id) do nothing;
