# Pedidos × Apple Health — 12/09/2026

## Problema corrigido

Os três gráficos antigos compartilhavam uma condição: ao menos cinco dias com kcal_ativas positivas. Isso escondia sono e treino mesmo quando esses campos estavam disponíveis. A comparação antiga também juntava o sono ao dia do pedido, embora o importador XML salve sono no dia em que o intervalo termina, e misturava refeições presumidas do perfil com os pedidos observados.

A nova seção substitui esses gráficos por dez cards independentes. Funciona no carregamento da conta, após importar Health e ao trocar plataforma/período. O status mostra interseção de datas, campos disponíveis e quantidade de cards com dados suficientes. Não depende de calorias ativas e não requer reimportação para usar os dados já salvos.

## Dez cards implementados

| Card | Cruzamento | Medida |
|---|---|---|
| Pedido nos dias de mais passos | Passos × calorias dos pedidos | Mediana diária das kcal por pedido; comparação entre medianas dos dias |
| Movimento e conta | Passos × gasto | Mediana do total pago por dia com pedido |
| Movimento e frequência | Passos × quantidade de pedidos | Mediana de pedidos por dia com pedido |
| Movimento e proteína | Passos × densidade de proteína | Mediana de g/1.000 kcal por dia |
| Movimento e horário | Passos × pedido às 22h ou depois | Fração dos dias com pedidos noturnos; diferença em pontos percentuais |
| Duração do treino e pedido | Treino registrado × calorias por pedido | Comparação das medianas diárias |
| Duração do treino e proteína | Treino registrado × densidade de proteína | Comparação das medianas diárias |
| Passos após pedido tarde | Horário de D × passos de D+1 | Mediana dos passos no dia seguinte |
| Sono após pedido tarde | Horário de D × sono de D+1 | Mediana de horas de sono no dia seguinte |
| Sono e gasto | Sono no dia do despertar × pedidos dessa data | Mediana do total pago por dia com pedido |

## Regras de cálculo

- Pedidos de restaurante, filtros globais de plataforma e período e chaves únicas por plataforma/ID. Mercado fica de fora. Vários pedidos no dia formam uma observação diária; não multiplicam a medida do Health.
- Datas dos pedidos usam o fuso do navegador. Datas Health são as gravadas na origem. Diferentes fusos e viagens exigem cautela, explicitada na tela. Não há informação suficiente para reconstruir o fuso de cada medida Health depois da agregação.
- Divisão pela mediana pessoal dos passos, minutos de treino ou minutos de sono nos dias com pedido e campo válido. Empates ficam no grupo superior; não fazemos grupos sobrepostos para forçar um resultado.
- Cada grupo precisa de pelo menos cinco dias. Não é um teste de significância. Os cards são explorações descritivas de hipóteses predefinidas; não controlam dia da semana, sazonalidade, restaurante ou pessoas que dividiram o pedido.
- Zero explícito é uma observação de passos; null não é zero. Treinos usam apenas durações positivas registradas, nunca presumindo “sem treino” por ausência. Sono usa durações entre zero exclusivo e 1.440 minutos inclusive. Treinos também têm limite de 1.440 minutos/dia.
- Calorias precisam ser positivas e ter confiança ≥30 em todos os pedidos do dia. Densidade exige ainda proteína informada em todos eles. Para gasto, total deve existir em todos os pedidos da data. Um dia incompleto para nutrição pode continuar válido para gasto ou contagem.
- Relações com a noite consideram dias com pedido às 18h ou depois. Grupo cedo: último pedido noturno antes das 22h; grupo tarde: algum pedido às 22h ou depois. Madrugada após meia-noite pertence à nova data; não é atribuída à véspera. A metodologia explica esta limitação.
- D+1 é a próxima data do calendário, nunca o próximo registro disponível. O sono do XML fica na data final do intervalo; pode incluir cochilos. Atalhos depende da data enviada pelo usuário. Relações D+1 respeitam o limite de ano/filtro; “Tudo” pode usar a observação do dia seguinte ao último pedido.
- Duplicatas de Health na mesma data são excluídas como ambíguas. A tabela de produção já tem uma linha por usuário/data.
- Sem estimar calorias de refeições não importadas, balanço energético, metabolismo ou consumo individual. Não afirma que exercício causou pedido, nem que pedido causou alteração no sono.

## Validação

Consulta somente de leitura nas tabelas profiles/health_daily/pedidos via conexão Supabase autorizada. O caso reportado tinha dados suficientes para oito cards e nenhum sono registrado para os outros dois. O cálculo novo foi executado sobre as linhas necessárias, sem expor valores individuais no relatório de verificação ou gravar cópia local dos dados pessoais. Nenhuma alteração nos dados do usuário ou schema.

116 testes automatizados passaram. Os testes novos verificam dez resultados com deltas conhecidos, oito cards sem sono/calorias ativas, alinhamento D+1 e lacunas, fronteira de ano, campos nulos/zero, tamanho mínimo, empates, duplicatas, exclusão de mercado e estimativas incompletas. Chrome com dados sintéticos: dez cards, filtros de categoria e plataforma, retorno de filtro vazio, falta de sono, metodologia expansível e layout de 1.280/390 pixels.
