# Publicar alterações para todos

O editor só compartilha mudanças quando `supabase-config.js` está configurado e a tabela do Supabase foi criada. Sem isso, o site continua no modo local do navegador. O endereço e a chave `anon`/`publishable` do Supabase são públicos; nunca coloque a chave `service_role` neste site.

## 1. Criar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com/).
2. Em **Authentication**, desative o cadastro público de novos usuários.
3. Em **Authentication > Users**, crie/invite somente a sua conta de editora e confirme o usuário. Copie o UUID dessa conta.
4. Abra o **SQL Editor**, cole o conteúdo de `supabase-schema.sql` e execute o script. As políticas já estão limitadas ao UUID da sua conta.
5. Em **Project Settings > API**, copie o Project URL e a chave `anon`/`publishable`.
6. O arquivo `supabase-config.js` já contém a chave publicável. Preencha nele o Project URL:

```js
window.PORTFOLIO_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "<chave-publicável já configurada>"
};
```

As políticas de Row Level Security deixam a leitura do portfólio pública e limitam gravação à conta cujo UUID foi colocado no SQL. O site não contém senha de administrador.

## 2. Publicar no Netlify

O código está no repositório [github.com/kkuy0z/portfolio](https://github.com/kkuy0z/portfolio), na branch `main`.

1. No Netlify, escolha **Add new site > Import an existing project > GitHub** e autorize o acesso ao repositório `kkuy0z/portfolio`.
2. Selecione a branch `main`. O `netlify.toml` configura a raiz como diretório de publicação; não é necessário comando de build.
3. Clique em **Deploy site**. Depois, cada push na `main` publica automaticamente a versão nova.
4. Em **Supabase > Authentication > URL Configuration**, configure o domínio publicado como **Site URL** e adicione também as URLs locais de desenvolvimento à lista de redirecionamento, se for usar login local.
5. Abra o endereço público e use `Ctrl+Shift+E` (ou clique cinco vezes no monograma) para entrar com a conta que criou no Supabase. Alterações de conteúdo salvas serão lidas por todos os visitantes; alterações no código entram após o deploy automático.

## Segurança e armazenamento

- Não habilite cadastro público no Supabase.
- Não compartilhe sua senha nem use a chave `service_role` no front-end.
- A foto escolhida no editor é comprimida e guardada no registro JSON do portfólio. Projetos com imagens usam URLs públicas acessíveis aos visitantes.
- O repositório Git local já aponta para `https://github.com/kkuy0z/portfolio.git`.