# Motor nutricional 2026-09-10.2

O motor identifica ingredientes no nome e na descrição, resolve aliases sobrepostos,
interpreta pesos adjacentes a cada ingrediente e soma seus nutrientes por 100 g.
Pesos representam o estado do ingrediente na base: não são conversões de peso cru
para cozido. Quantidade do item multiplica a composição uma única vez.

Listas simples de alimentos têm prioridade sobre receitas genéricas. Em receitas,
a proteína informada substitui a padrão; retiradas explícitas removem componentes.
Complementos são estimados por seu próprio conteúdo, sem a antiga regra de metade
do prato pai. Sashimi identificado usa somente peixe; 15 g por peça é uma hipótese,
não uma medida do restaurante. Ingredientes registram se o peso foi informado,
se apenas o ingrediente foi informado ou se a composição foi presumida.

Limites: nomes comerciais ambíguos, receitas desconhecidas, óleo de preparo,
densidade de bebidas e tamanho de porções continuam sujeitos a erro. Os valores
por 100 g da base existente não foram substituídos nem certificados nesta mudança.
Os níveis internos de confiança são heurísticos, não probabilidades calibradas.
Alimentos desconhecidos usam uma aproximação de baixa confiança; os macros não
são mais registrados como zero junto de calorias positivas.

Verificação: node --test tests/*.test.cjs. Os testes verificam cálculo, seleção e
regressões; não medem exatidão clínica contra refeições pesadas em laboratório.
A planilha fornecida também foi processada em simulação: 221 pedidos, três lotes,
sem escrita no banco. Não há dados pessoais nos testes versionados.

Publicação: aplicar o patch, commitar e enviar main. O deploy Netlify ligado ao
GitHub publica a alteração. Depois usar Reprocessar com a exportação original
para atualizar o histórico, preservando as descrições que não existem nos itens
antigos do banco. A importação registra a versão do motor. Nenhuma migração SQL
é necessária.
