# Motor e cards — 2026-09-11

Motor `2026-09-11.1`. Esta entrega prioriza interpretação de pedidos e conteúdo dos cards; não requer migração SQL.

## Estimativas

Nas receitas da base ampliada, pesos de ingredientes no nome e na descrição agora substituem a porção presumida daquele ingrediente. O peso total do prato distribui apenas a massa restante entre os componentes sem peso informado. A quantidade do item multiplica o resultado uma única vez. Um total inferior aos componentes explícitos é sinalizado como conflito e recebe baixa confiança.

Exemplos sintéticos, usando a mesma base nutricional antes e depois:

| Pedido | Antes | Depois |
|---|---|---|
| Carbonara com bacon 30 g | 30 g no prato inteiro; 73 kcal | 310 g; 741 kcal. Apenas o bacon tem peso informado. |
| Carbonara; descrição: bacon 20 g, sem parmesão | 290 g; 660 kcal | 275 g; 579 kcal. Respeita os 20 g e a retirada. |
| Carbonara 400 g; descrição: bacon 30 g | 400 g; 975 kcal | 400 g; 926 kcal. Preserva os 30 g e distribui os 370 g restantes. |

Esses exemplos verificam interpretação e cálculo; não são comparação com refeições medidas. Receitas desconhecidas, preparo, óleo e porções continuam sujeitos a erro. As alterações específicas de pesos de receitas se aplicam à base ampliada já existente; não a todos os caminhos do motor.

Opções gratuitas de retirada, como “sem queijo”, também são preservadas na leitura do JSON legado do iFood e aplicadas ao prato principal.

Os dados antigos não são recalculados automaticamente: usar **Reprocessar** com a exportação original para aplicar esta versão. Os novos cards podem ler o histórico existente imediatamente.

## Cards

- Pedido típico: mediana e quartis das calorias estimadas do pedido inteiro, com número de pedidos incluídos e total no filtro.
- Tendência: mediana dos últimos 28 dias contra os 28 anteriores, ancorada no último pedido do filtro. Exige histórico cobrindo 56 dias e pelo menos cinco pedidos elegíveis por janela. Não presume histórico completo nem mudança no consumo pessoal.
- Cobertura: substitui a nota genérica de qualidade do prato por contagens segundo o nível heurístico da estimativa. Não é probabilidade de acerto.
- Proteína por real: usa proteína do pedido inteiro e total pago, incluindo taxas; separa plataformas, exige três pedidos por grupo e elimina duplicação do mesmo grupo no ranking.
- Os cards de mediana, tendência e proteína excluem pedidos com confiança abaixo de 30 ou calorias ausentes/não positivas. A cobertura explicita as exclusões. O restante dos gráficos mantém suas regras anteriores.
- O resumo semanal identifica o cenário estimado e as premissas de alimentação fora dos apps.

## Verificação

`node --test tests/*.test.cjs`: 85 testes aprovados, incluindo pesos conflitantes, retiradas gratuitas, mediana, amostra insuficiente, separação de plataformas e escape de HTML.

Chrome com dados sintéticos: renderização em 1280 px e 390 px, estado vazio, sem erros de JavaScript e sem transbordamento horizontal na seção Semana. Serviços externos bloqueados durante essa verificação; não testa login nem banco de produção.
