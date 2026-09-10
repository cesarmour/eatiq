# Recomendações por gosto

As sugestões usam tipos de prato e proteínas reconhecidos nos itens do próprio usuário. Um sinal por tipo e pedido evita que várias unidades distorçam preferências. Recência tem meia-vida de 120 dias relativa ao pedido mais recente no filtro. Afinidade de tipo pesa 65%, proteína 10% e reputação 25%. Não há peso para calorias ou preço.

Restaurantes precisam ter nota >= 4 e pelo menos 10 avaliações. A nota usada no ranking é suavizada com uma referência de 4,3 e peso de 50 avaliações. Esses valores são heurísticos, não probabilidades de satisfação. A diversidade limita duas sugestões do mesmo tipo e duas do mesmo restaurante, com uma por restaurante no segundo card. Nomes já pedidos no filtro saem do modo descobrir. Nomes diferentes podem ser variações de algo já pedido.

O catálogo compartilhado vem de `public.shared_menu_catalogs`, legível somente por usuários autenticados. Não contém histórico pessoal, alias de nome no pedido, endereço do usuário, distância ou elegibilidade de entrega. O histórico individual continua nas tabelas existentes sob suas políticas de acesso. Cada pessoa recebe sugestões calculadas com os próprios itens, sem aprendizado cruzado a partir do histórico alheio.

Dados carregados: 4.114 itens / 43 restaurantes, coleta iFood de 2026-09-10. Não é busca ao vivo; preço exibido é da coleta, sem promover preços promocionais inativos. Não há avaliação individual de pratos. Catálogo Rappi ainda não disponível. A interface explica o recorte temporal, as escolhas necessárias e pede conferir entrega e disponibilidade no restaurante. Não há filtro geográfico automático nem inferência segura de alergias. O reconhecimento é lexical e pode deixar de identificar nomes comerciais ou ambíguos.

A configuração SQL reproduzível está em `supabase/shared-menu-catalog.sql`; já aplicada ao projeto. Os dados compartilhados ficam no banco, não no patch. Para importar novos snapshots, higienizar campos e substituir atomicamente a linha correspondente à origem por um processo administrativo.

Validação: testes de personalização, independência de calorias e preço, notas com poucas avaliações, diversidade, novidades versus favoritos, isolamento por pedido, duplicação de unidades, paginação, respostas atrasadas, erros e HTML não confiável. Teste de integração com o histórico autorizado de Cesar e catálogo enviado. Verificada leitura autenticada e ausência de permissão de escrita pelo cliente e leitura anônima. Não houve teste visual em navegador real neste ambiente.

## Curadoria em três cards

A interface substitui as listas por até três cards com funções explícitas. Seu favorito exige correspondência de prato/restaurante em pelo menos dois pedidos distintos. Para variar exclui nomes já pedidos no filtro. Para uma ocasião especial exige afinidade, nota >=4,5, pelo menos 50 avaliações e um prato identificado por ingredientes/preparos como mignon, picanha, risoto ou carbonara. É uma proposta editorial, não certificação de luxo; preço não define qualidade. Seu estilo substitui um papel sem evidência suficiente. A afinidade de formato usa raiz quadrada para reduzir concentração em uma única preferência frequente.

Cada restaurante e família aparece uma única vez. Lámen e yakissoba têm preferências separadas; lámen, yakissoba e sushi compartilham apenas o limite de diversidade japonesa. Os cards preservam as notas e preços da coleta e não alegam atendimento a metas nutricionais ou exames. Sem candidatos suficientes, menos de três cards são exibidos. As regras desta seção substituem os limites anteriores de duas sugestões por formato/restaurante.

## Objetivos adicionais

O seletor oferece No budget (teto editável, inicialmente R$50 por item), Low-carb (estimativa <=20 g de carboidratos e <=25% da energia), Mais proteína (>=25 g e >=20% da energia) e Para variar. O teto refere-se ao item, sem entrega; não é orçamento por pessoa nem garantia de refeição completa. Nutrição usa a base existente carregada sob demanda, confiança interna >=40, composição identificada, porção estimada 100–700 g, e exclui escolhas obrigatórias e combos identificados. Esses limiares são filtros internos, não certificação nutricional. Mais proteína não usa a razão proteína/preço. Os pratos continuam exigindo afinidade e reputação.

## Revisão financeira

Removidas as fórmulas sem fundamento de 32% do subtotal para cozinhar e 130% + R$43 para restaurante. Os custos agora são informados explicitamente: porções por pedido; ingredientes por porção; energia por preparo; prato presencial por porção; serviço percentual; transporte e extras por saída. Campos vazios não geram comparação. Casa = pedidos × (porções × ingredientes + energia). Presencial = pedidos × (porções × prato × (1 + serviço/100) + transporte). Equivalência depende de os valores cobrirem as mesmas porções; não há equivalência nutricional verificada. Tempo de preparo e assinaturas não estão incluídos.

Ticket mediano, média mensal incluindo meses vazios entre o primeiro e último registros, concentração em três restaurantes, participação de fins de semana, médias por plataforma e conciliação da composição importada foram adicionados. Total pago é a referência; diferença versus produtos + taxas + gorjetas − descontos permanece visível. O gráfico mensal exibe total pago, sem confundir subtotal bruto com desembolso. Meses extremos podem ser parciais e a completude da exportação não é garantida. A comparação entre apps não controla pratos/restaurantes/quantidades.

A troca de até dois pedidos por semana usa semanas de calendário e mostra diferença apenas no período observado, inclusive se negativa. Removidas projeção anual automática e redução fictícia de 35% nas calorias ao cozinhar. Premissas são mantidas apenas no DOM durante a sessão.
