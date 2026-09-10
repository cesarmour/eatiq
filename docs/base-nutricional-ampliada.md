# Base ampliada — 2026-09-10.3

655 registros no banco: 77 legados e 578 novos perfis. Não são 655 ingredientes
básicos distintos: incluem variedades, estados de preparo e pratos completos.
114 receitas: 79 legadas e 35 adicionais.

Fonte dos novos perfis: transcrição da TACO 4ª edição (2011) disponibilizada em
https://github.com/elyrio/tacoSQL/blob/master/taco_CMVCol.csv . O esquema do
repositório confirma as colunas de energia kcal, proteína, carboidrato e lipídios.
Não foi possível conferir toda a transcrição contra a publicação original nesta
sessão. A origem intermediária está registrada em cada perfil; não se trata de
nova análise laboratorial ou de integração oficial à UNICAMP. Dos 597 registros
lidos, 19 com nutrientes principais ausentes foram excluídos. Traços são tratados
como zero para estes cálculos; valores ausentes não foram convertidos em zero.

Os perfis têm valores por 100 g de parte comestível. O reconhecimento inclui
nomes completos normalizados e aliases selecionados para alimentos comuns.
Variações não cobertas por aliases podem exigir o nome mais completo. Não se
promete reconhecimento de qualquer grafia, marca ou receita.

Receitas novas são hipóteses de composição e porção, não fichas de restaurantes.
Exemplos de substitutos: bacon por guanciale, parmesão por pecorino e nozes em
pesto. Receitas regionais baseadas em um perfil de prato completo não identificam
seus ingredientes internos. Peso declarado escala a porção inteira dessas
receitas; pesos de componentes em descrições não são usados nesse caminho.

As 578 referências e 35 receitas foram aplicadas ao Supabase. O patch publica o
motor .3, que prioriza receitas específicas e desempata a favor da nova base.
Recarregar a página após o deploy e reprocessar o arquivo original é necessário
para atualizar o histórico. Nenhum pedido foi alterado por esta expansão.

Validação: node --test tests/*.test.cjs (27 testes); importação simulada dos
221 pedidos com a base ampliada; nenhuma referência de receita ausente no banco.
Não há percentual de precisão nutricional validado contra refeições medidas.

Para reinstalação, executar expand-nutrition-schema.sql e depois
expand-nutrition-data.sql, após a instalação normal. Ambos preservam registros
existentes; a carga atualiza apenas os perfis de mesmo nome TACO.
