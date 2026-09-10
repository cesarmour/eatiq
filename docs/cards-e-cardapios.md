# Descobertas na área logada

Quatro cards usam os filtros existentes de plataforma e período:
- Pratos e itens mais pedidos: pedidos distintos por nome do item, loja e plataforma; unidades como medida separada. Inclui alimentos, acompanhamentos e bebidas.
- Restaurantes mais pedidos: quantidade de pedidos, gasto total e ticket médio do pedido inteiro.
- Opções para repetir: itens do histórico ordenados por preço por unidade, proteína estimada por real ou frequência.
- Onde pedir essas opções: uma opção por restaurante, pelo mesmo critério.

Nenhum preço ou disponibilidade atual é presumido. Macros são estimativas médias
por unidade comprada, sem o ajuste de consumo pessoal utilizado em outras partes
do painel. Recomendações exigem campos completos, preço positivo, confiança
heurística >=40 e porção de 100–900 g / 150–1.200 kcal. Excluem complementos
identificados e nomes comuns de acompanhamentos e bebidas; essa classificação
não é perfeita. Não representam prescrição ou validação de alergênicos.

A consulta de itens usa a sessão do usuário, filtro de proprietário e paginação;
não utiliza chave administrativa. Falhas exibem erro e ação de repetir. Respostas
antigas são descartadas quando o filtro muda. Cache é invalidado na importação.
Nenhum dado do CSV do usuário foi incluído nos arquivos públicos do site.

## Avaliação do CSV de cardápios de 10/09/2026

Leitura com CSV padrão (vírgula, aspas duplas, suporte a quebras de linha), sem
linhas com colunas extras ou campos estruturalmente ausentes:

| Medida | Resultado |
|---|---:|
| Linhas | 4.121 |
| Lojas representadas | 50 |
| Itens identificados, únicos por loja + item | 4.114 |
| Itens com descrição | 3.535 |
| Nome/descrição com peso ou volume explícito | 1.378 |
| Itens com indicação SERVES de porções | 1.009 |
| Itens que exigem escolhas | 2.116 |
| Itens com EAN | 203 |
| Preço promocional preenchido com promoção inativa | 574 |
| Lojas sem itens visíveis / indisponíveis | 5 |
| Páginas sem cardápio, possível bloqueio ou loja inativa | 2 |

São dados de cardápio, não fichas nutricionais: não há campos de calorias ou dos
três macronutrientes. Descrições podem esclarecer receitas com nomes comerciais;
pesos precisam ser associados ao componente certo, não sempre ao prato inteiro.
SERVES informa pessoas, não massa em gramas. O sinal de escolhas não inclui o
conjunto completo das opções escolhidas em cada pedido.

Para integrar com segurança ao motor: manter catálogo por loja_id + item_id,
origem e data; preservar esses IDs nas novas exportações; usar nome apenas como
fallback sem ambiguidades; preferir descrição do pedido para reconstruir o
histórico; não aplicar retroativamente receita atual como certeza. Preço histórico
deve ficar separado de preço observado no cardápio, e promoção só deve ser usada
com sinal ativo e regras consistentes.

Distância, entrega no endereço e colunas hist_* refletem contexto do usuário:
não publicar o CSV bruto. A avaliação foi concluída; o catálogo não foi inserido
no motor nem usado como catálogo comercial atual nesta alteração.

Validação: node --test tests/*.test.cjs. Testes novos cobrem frequência distinta,
média por unidades, dados ausentes, filtros, critérios, escape HTML, paginação,
falha de consulta e respostas fora de ordem. Publicar o patch não exige SQL.
