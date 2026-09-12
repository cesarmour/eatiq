# Personalização por marcadores — 12/09/2026

## Implementado

Os cinco campos já existentes em profiles são passados explicitamente ao motor de sugestões. A classificação de gosto continua usando histórico e quiz; o ajuste por ingredientes acontece antes da seleção dos pratos, inclusive nas modalidades orçamento, proteína e low-carb. Favoritos, diversidade de restaurantes, cardápio disponível e limites do filtro continuam valendo. O catálogo de restaurantes Michelin não tem composição de pratos e não recebe ajuste clínico.

Cada prato mostra o motivo do ajuste ou a insuficiência de evidência. Um ajuste positivo não garante que o prato mude de posição; uma opção com ponto de atenção pode permanecer por falta de alternativas no filtro. Ausência de um ingrediente no texto não significa ausência no prato.

Critérios de ativação preservados do produto: LDL ≥100, HDL ≤40, triglicérides ≥150, glicemia de jejum ≥100 e ácido úrico ≥7, em mg/dL. São critérios gerais de curadoria, não diagnóstico ou metas clínicas. Não consideram idade, sexo, medicamentos, risco individual, data e condições da coleta. HDL não é tratado como meta a elevar. Estes critérios requerem futura revisão clínica e individualização.

A composição é identificada por termos explícitos no nome/descrição. Gordura total não vira gordura saturada. Não estimamos purinas, açúcar, resposta glicêmica ou redução do marcador. Itens com escolhas e composição ambígua recebem ajuste zero. Uma preocupação identificada prevalece sobre benefícios, por exemplo camarão com legumes para um perfil com ácido úrico acionado. Ajustes: −0,45 quando há preocupação, +0,15 quando há ingrediente favorável sem preocupação, zero quando a evidência é insuficiente. São pesos do ranking do produto, sem significado médico.

Os campos salvam somente o marcador editado e updated_at. A atualização visual usa o valor devolvido pelo banco; resposta sem linha ou erro não confirma salvamento. O formulário de perfil não regrava exames incidentalmente. Nenhum dado clínico real foi alterado durante o desenvolvimento. Não houve mudança de schema ou políticas; RLS e políticas SELECT/UPDATE existentes foram conferidas em leitura.

Removidas promessas de limite universal de 18 g, alerta antes da compra, prioridade automática de peixes para HDL e curva de LDL que não existiam. PDF permanece sem suporte e isso agora aparece na tela.

## Fontes de orientação alimentar

Consultadas em 12/09/2026. Sustentam os critérios qualitativos dos ingredientes, não os pesos do ranking nem uma previsão individual.

- [American Heart Association — recomendações alimentares](https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/nutrition-basics/aha-diet-and-lifestyle-recommendations): padrão alimentar com vegetais, integrais, substituição de gorduras saturadas por insaturadas, menos açúcar adicionado e álcool.
- [NIDDK — alimentação e diabetes](https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes): fontes de carboidratos com fibra e atenção a bebidas açucaradas.
- [NIAMS — gota](https://www.niams.nih.gov/health-topics/gout/diagnosis-treatment-and-steps-to-take): orientação sobre álcool e fontes animais de purinas. Um valor de ácido úrico isolado não diagnostica gota.

## Seis cards propostos — ainda não implementados

Todos devem usar apenas a conta e o período selecionados, deduplicar por pedido, mostrar numerador/denominador, cobertura de descrições e ingredientes reconhecidos. Composição desconhecida não conta como ausência. Compras não comprovam consumo individual. O exame é o valor informado atual: não existe histórico datado suficiente para atribuir mudanças ao comportamento. Mínimo inicial sugerido: 10 pedidos com itens identificáveis; suprimir comparações com menos de 5 pedidos por grupo. Esses mínimos são regras de apresentação, não testes de significância.

1. **A repetição concentra a atenção?** LDL × frequência dos três pratos mais repetidos com ingredientes associados a gordura saturada. Mostrar a fração dos pedidos sinalizados concentrada nesses pratos e alternativas concretas, sem estimar gramas consumidos.
2. **A bebida vem no automático?** Triglicérides/glicemia × presença explícita de bebida açucarada nos combos versus pedidos fora de combo. Separar versões zero e composições opcionais. Comparar taxas, não valores absolutos, com exemplos verificáveis.
3. **O fim de semana concentra as combinações?** Triglicérides/ácido úrico × pedidos com álcool e fonte animal de purinas na mesma compra, comparando a fração de pedidos em sábado/domingo com dias úteis. Não inferir quem bebeu nem quantidade ingerida.
4. **Dá para mudar o prato sem mudar de restaurante?** LDL/HDL × restaurantes mais frequentes com alternativas de legumes, leguminosas, integrais ou azeite no cardápio coletado. Mostrar cobertura das visitas por locais com uma alternativa identificada; não prometer elevar HDL.
5. **Mais proteína, outro ponto de atenção.** LDL/ácido úrico × pratos proteicos repetidos que também trazem ingredientes sinalizados. Só chamar de proteico quando houver estimativa com evidência suficiente; explicitar conflito entre critérios e sugerir alternativa compatível com o gosto.
6. **Quanto custa uma troca dentro do seu hábito?** Marcadores ativos × prato recorrente e alternativa da mesma família no catálogo. Mostrar diferença de preço por item na coleta, sem entrega, e os motivos dos dois pratos. Sem equivalência clínica/nutricional presumida ou promessa de economia mensal.

## Verificação

110 testes automatizados, incluindo ativação, valores ausentes, composição incerta, conflito entre marcadores e mudança real de prato preservando orçamento. Chrome com API simulada: editar e salvar muda a sugestão mesmo com histórico em cache; apagar restaura o ranking; resposta de atualização sem linha é erro; razão legível em desktop/mobile. Não foi efetuada gravação de teste na conta de usuários reais.
