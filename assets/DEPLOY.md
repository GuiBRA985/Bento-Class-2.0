# Bento Class 2.0 — Pacote BETA + Bentos

Este ZIP é um **pacote de atualização**, não uma cópia integral do repositório.

## Arquivos que podem substituir imediatamente

- `login.html`: selo BETA, mensagem Founding Beta e recuperação de senha.
- `index.html`: carteira visual de Bentos e selo de progresso.
- `games.html`: primeira interface do Bento Lab.
- `reset-password.html`: página de troca de senha.
- `assets/bentos.js`: leitura segura do saldo.

Antes de substituir, faça backup dos arquivos atuais.

## Banco de dados

Execute `supabase/migrations/001_bentos.sql` primeiro em homologação.

A migração cria:
- livro-caixa `bento_transactions`;
- RLS;
- leitura do próprio saldo;
- débito atômico;
- bônus inicial de 100 Bentos.

A função que concede Bentos não é liberada ao navegador. Recompensas por lição devem ser acionadas por Edge Function, trigger ou função administrativa validada.

## Servidor do amigo

Como a aplicação atual é estática, ela pode ser servida por Nginx ou Apache. O banco e autenticação continuam no Supabase.

Configuração mínima:
- HTTPS obrigatório;
- redirecionamento HTTP → HTTPS;
- CSP revisada;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` restringindo câmera e microfone ao próprio domínio;
- backup diário dos arquivos;
- deploy por usuário sem privilégios de root.

## GoDaddy

O domínio permanece na GoDaddy. Basta alterar o DNS para o IP ou hostname informado pelo servidor, quando o ambiente novo estiver testado.

Não desligue o GitHub Pages antes de validar o servidor novo.
