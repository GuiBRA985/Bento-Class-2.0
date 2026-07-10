# Segurança — pontos ainda pendentes

1. Revisar a Edge Function `evaluate-pronunciation`.
2. Enviar access token do usuário, não a chave anon, para funções protegidas.
3. Implementar rate limiting para login, cadastro, recuperação e IA.
4. Confirmar e-mail obrigatório e política de senha no Supabase Auth.
5. Criar Edge Function para premiar Bentos por lição, com idempotência.
6. Criar Edge Function de conversa que:
   - valida JWT;
   - desconta Bentos atomicamente;
   - limita 5 minutos;
   - registra custo/tokens;
   - encerra ao atingir limite.
7. Corrigir `bug_reports` para só informar sucesso após inserção real.
8. Adicionar CSP por cabeçalho no servidor.
9. Não armazenar nome, e-mail, notas ou OCR em blockchain.
10. Fazer pentest autorizado antes da venda pública.
