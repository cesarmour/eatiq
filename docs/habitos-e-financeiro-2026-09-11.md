# Dez análises de hábitos e cenários financeiros

## Hábitos

A seção Hábitos usa somente os pedidos de restaurante da conta, já filtrados por plataforma e período. Nenhum resultado sintético é publicado no produto. O navegador calcula os cards a partir dos registros carregados; não há consultas adicionais nem migração SQL.

| Card | Medida e critérios |
|---|---|
| Você volta ao mesmo lugar? | Repetições de restaurante/plataforma entre pedidos consecutivos identificados. Pelo menos nove transições e dois restaurantes. |
| A novidade vira favorita? | Retorno em outro dia, até 30 dias após a primeira aparição de uma loja no filtro. Cinco lojas elegíveis; exclui os primeiros 14 dias e descobertas sem 30 dias de acompanhamento. |
| Os pedidos vêm em sequência? | Frequência de dia com pedido após dia com pedido versus após dia sem registro. Intervalo de 28 dias e dez oportunidades por grupo. Vários pedidos no mesmo dia contam uma vez. |
| O fim de semana muda a conta? | Gasto por dia de calendário, comparando sábado/domingo com segunda/sexta. Quatro semanas inteiras no recorte, cinco pedidos por grupo e totais conhecidos. |
| O pedido muda depois das 22h? | Mediana de kcal entre 22h–4h59 versus 18h–21h59. Cinco pedidos por grupo, calorias positivas e confiança heurística ≥30. |
| Desconto deixa a conta menor? | Total mediano com e sem desconto na mesma loja/plataforma, escolhida pela maior amostra. Três pedidos por grupo; desconto ausente não vira zero. |
| Pedidos pequenos carregam mais taxas? | Taxas e gorjetas / total pago, por soma dos valores, abaixo/acima do subtotal mediano. Cinco pedidos por grupo; valores precisam estar presentes. |
| Poucos pedidos concentram seu gasto? | Participação dos 20% de pedidos mais caros no gasto conhecido, arredondando a contagem para cima. Pelo menos dez pedidos. |
| Pagar mais traz mais proteína? | Mediana de g de proteína por 1.000 kcal nas faixas inferior/superior de preço. Cinco pedidos por faixa, sem sobreposição dos cortes, confiança ≥30. |
| Seu pedido tem hora marcada? | Janela circular de duas horas com mais pedidos, inclusive cruzando meia-noite. Vinte pedidos e intervalo de 14 dias. |

Todos os cards mostram a amostra, os valores de comparação e a metodologia. Estados sem dados suficientes explicam o requisito. Há filtros de tema: escolhas, ritmo, bolso e nutrição.

São associações descritivas, não causalidade nem testes de significância. Datas usam o fuso local do navegador. Um histórico incompleto altera contagens e denominadores; um dia sem registro não comprova ausência de delivery. Nomes de lojas podem agrupar filiais, e a mesma loja em apps diferentes permanece separada. A composição nutricional é a do pedido inteiro, não ingestão pessoal.

## Referências financeiras verificadas em 11/09/2026

**Mercado:** [Procon-SP / Dieese, julho de 2026, página 13](https://www.procon.sp.gov.br/wp-content/uploads/2026/08/CB-julho-2026-com-comparativo-anual.pdf). Preços médios: arroz 5 kg R$ 19,63; feijão carioquinha/kg R$ 8,96; batata/kg R$ 8,20; cebola/kg R$ 7,89; alho/kg R$ 31,60; óleo 900 ml R$ 7,37; carne de primeira/kg R$ 48,54; ovos/dúzia R$ 10,74.

As quantidades por pessoa são premissas do eatIQ: 75 g de arroz cru, 50 g de feijão seco, 150 g de batata crua, 30 g de cebola, 5 g de alho, 10 ml de óleo e 200 g de carne crua ou dois ovos. Custo proporcional de ingredientes: aproximadamente R$ 12,16 ou R$ 4,24. Não são custo de refeição publicado pelo Procon, porções prescritas nem pratos equivalentes aos comprados no delivery.

**Restaurantes:** [Pesquisa ABBT, publicada pela Alelo, São Paulo, setembro de 2025](https://www.pesquisaprecomedio.com.br/preco-medio-refeicao/sp/sao-paulo). Comercial R$ 44,16; executivo R$ 58,84; autosserviço R$ 61,44; à la carte R$ 103,66. A fonte considera refeição completa com prato principal, bebida, sobremesa/fruta e café. Contexto da pesquisa: almoço em estabelecimentos que aceitam vale-refeição, conforme [ABBT](https://www.abbt.org.br/home).

As referências são datadas, sem inflação aplicada automaticamente. O preço de serviço não é discriminado na página consultada; o adicional começa em zero, com orientação para acrescentar apenas o que não estiver incluído. Não se presume cotação atual, preço de jantar ou igualdade de cardápios.

## Motor financeiro

- Porções = pedidos × pessoas por refeição, incluindo média fracionária de pessoas se informada.
- Preparos = teto(pedidos / refeições do grupo por preparo). O último preparo pode ser parcial.
- Ingredientes = porções × custo por pessoa / (1 − perda). Perda de 100% é inválida.
- Energia = preparos × custo de energia/gás por preparo.
- Tempo opcional = preparos × minutos / 60 × valor/hora. Valor inicial zero.
- Presencial = pedidos × [pessoas × preço da refeição × (1 + serviço) + transporte por saída].
- Limite para empatar = (total delivery − energia − tempo) × (1 − perda) / porções. Se negativo, os custos fixos já superam o delivery.
- O simulador de até dois pedidos por semana recalcula preparos para o subconjunto escolhido; não rateia indevidamente o custo do histórico inteiro.

Os R$ 2 de energia por preparo são uma premissa editável. Água, equipamento, limpeza e deslocamento ao mercado não entram automaticamente. Campos vazios não viram preços zero; zero informado é aceito. Preços próprios trocam a origem do campo para personalizada. Comparações negativas são preservadas.

## Validação

103 testes locais aprovados (`node --test tests/*.test.cjs`), com cobertura das dez análises, limites de coorte, dias de calendário, duplicados, dados ausentes, normalização, unidades das referências, lotes, perdas e custos do tempo.

Chrome isolado, com rede externa bloqueada e dados sintéticos: dez resultados em uma amostra construída para exercitar os dez caminhos; filtro de tema e plataforma; presets; custo personalizado; pessoas inválidas; fontes expansíveis; estado vazio. Desktop 1280 px e celular 390 px sem erros de JavaScript ou transbordamento horizontal nas seções alteradas. Não valida banco de produção nem publicação Netlify.
