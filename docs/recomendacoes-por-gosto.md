# Recomendações por gosto

As sugestões usam tipos de prato e proteínas reconhecidos nos itens do próprio usuário. Um sinal por tipo e pedido evita que várias unidades distorçam preferências. Recência tem meia-vida de 120 dias relativa ao pedido mais recente no filtro. Afinidade de tipo pesa 65%, proteína 10% e reputação 25%. Não há peso para calorias ou preço.

Restaurantes precisam ter nota >= 4 e pelo menos 10 avaliações. A nota usada no ranking é suavizada com uma referência de 4,3 e peso de 50 avaliações. Esses valores são heurísticos, não probabilidades de satisfação. A diversidade limita duas sugestões do mesmo tipo e duas do mesmo restaurante, com uma por restaurante no segundo card. Nomes já pedidos no filtro saem do modo descobrir. Nomes diferentes podem ser variações de algo já pedido.

O catálogo compartilhado vem de `public.shared_menu_catalogs`, legível somente por usuários autenticados. Não contém histórico pessoal, alias de nome no pedido, endereço do usuário, distância ou elegibilidade de entrega. O histórico individual continua nas tabelas existentes sob suas políticas de acesso. Cada pessoa recebe sugestões calculadas com os próprios itens, sem aprendizado cruzado a partir do histórico alheio.

Dados carregados: 4.114 itens / 43 restaurantes, coleta iFood de 2026-09-10. Não é busca ao vivo; preço exibido é da coleta, sem promover preços promocionais inativos. Não há avaliação individual de pratos. Catálogo Rappi ainda não disponível. A interface explica o recorte temporal, as escolhas necessárias e pede conferir entrega e disponibilidade no restaurante. Não há filtro geográfico automático nem inferência segura de alergias. O reconhecimento é lexical e pode deixar de identificar nomes comerciais ou ambíguos.

A configuração SQL reproduzível está em `supabase/shared-menu-catalog.sql`; já aplicada ao projeto. Os dados compartilhados ficam no banco, não no patch. Para importar novos snapshots, higienizar campos e substituir atomicamente a linha correspondente à origem por um processo administrativo.

Validação: testes de personalização, independência de calorias e preço, notas com poucas avaliações, diversidade, novidades versus favoritos, isolamento por pedido, duplicação de unidades, paginação, respostas atrasadas, erros e HTML não confiável. Teste de integração com o histórico autorizado de Cesar e catálogo enviado. Verificada leitura autenticada e ausência de permissão de escrita pelo cliente e leitura anônima. Não houve teste visual em navegador real neste ambiente.
