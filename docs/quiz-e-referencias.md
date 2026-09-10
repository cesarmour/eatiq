# Quiz, cards e referências

## Quiz

Cinco perguntas, duas opções por pergunta e alternativas de ambos/nenhum. Voltar mantém respostas; continuar exige seleção; refazer permite revisão. Teclado, foco visível, progresso acessível, SVG decorativo próprio, layout móvel e redução de movimento são atendidos. Não se trata de inferência de alergias, restrições ou avaliação clínica.

A home usa modelos explícitos de pratos para mostrar duas ideias principais e uma sobremesa, quando há preferências suficientes. Não inventa ofertas, restaurantes, preços ou macros. Respostas insuficientes produzem menos resultados, em vez de sugestões fabricadas. O perfil versionado salva somente cinco escolhas; pesos são derivados do modelo, nunca aceitos de dados arbitrários enviados pelo cliente.

O visitante pode salvar as respostas em sessionStorage e ir ao login. Na conta, o botão Salvar minhas respostas grava em profiles.quiz_gostos sob RLS de proprietário. Em falha, preserva o rascunho; em sucesso, remove o rascunho e recalcula recomendações. É possível refazer ou remover o quiz. Sem histórico, o perfil já orienta os candidatos do catálogo. O histórico continua contando; cada sinal explícito acrescenta peso equivalente a seis sinais recentes por unidade do vetor. É heurístico e não probabilidade de satisfação. A preferência doce é usada na home; a lista logada de refeições principais ainda não inclui sobremesas.

A coluna foi criada e sua restrição de formato verificada no Supabase. Políticas existentes de profiles exigem auth.uid() = user_id para leitura, criação e alteração. Não há gravação pública. Scripts não contêm credenciais privilegiadas nem dados privados de pedidos.

## Cards

Descrição longa de prato removida. Uma única linha de motivo; favorito mostra contagem de pedidos. Restaurante, prato, avaliação, preço e CTA permanecem padronizados. A descrição ainda serve de evidência interna para o motor, sem poluir os cards.

## Referências financeiras

Comparação pronta: R$88 por pessoa no restaurante (R$80 de refeição + 10% serviço) e R$20 para cozinhar uma porção (R$18 ingredientes + R$2 energia por preparo). Ajustes ficam recolhidos. Uma pessoa por pedido é premissa inicial, editável; duas pessoas alteram os custos proporcionais e dividem o preparo. Nenhuma alegação de mesmos pratos ou equivalência nutricional.

Esses valores são referências editoriais, NÃO médias estatísticas atuais de São Paulo. O roteiro da Folha de agosto/2026 inclui pratos de R$75 a R$93; foi usado como contexto de preço, não amostra representativa. O valor doméstico é uma estimativa operacional do eatIQ, não número de pesquisa. Não foi possível verificar uma média atual para cozinhar uma refeição equivalente, e não se dividiu cesta básica por refeições para fabricar uma.

Referência de restaurantes: https://guia.folha.uol.com.br/restaurantes/2026/08/roteiro-reune-21-bons-restaurantes-franceses-em-sao-paulo.shtml

A composição financeira continua auditável em detalhes recolhidos. Concentração e fim de semana viram indicadores curtos, e apps exibem ticket. Tempo de preparo, álcool e transporte não estão incluídos nos valores iniciais. Sem teste visual em navegador real neste ambiente; verificados scripts, integrações por DOM simulado, modelo, estados vazios, salvamento e regressões existentes.
