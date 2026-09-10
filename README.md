# eatIQ

Protótipo independente e sem fins comerciais de **life analytics da alimentação**: lê o histórico de pedidos de delivery (iFood, Rappi), estima calorias e macronutrientes de cada item, cruza com Apple Health e exames clínicos, e devolve painéis sobre o que a pessoa come, quanto gasta e para onde o corpo está indo.

Site: https://eat-iq.netlify.app · Área logada: https://eat-iq.netlify.app/login

---

## 1. Arquitetura

Tudo é estático + Supabase. Não há servidor próprio.

```
Netlify (site estático)                      Supabase
┌───────────────────────────────┐            ┌──────────────────────────────┐
│ /            landing (demo)   │            │ Auth (e-mail + senha)        │
│ /login       login, cadastro, │  REST/JWT  │ Postgres + RLS por usuário   │
│              painéis          │ ─────────► │   profiles, pedidos, itens,  │
│ /login/engine.js  motor       │            │   produtos, health_daily,    │
│ /exportar-*  guias            │            │   uploads, nutri_*           │
└───────────────────────────────┘            │ Storage: bucket "pedidos"    │
        ▲                                    └──────────────────────────────┘
        │ arquivo exportado                          ▲
   navegador do usuário                              │ POST diário (token)
   (iFood JSON / Rappi XLSX / Health export)    Atalho do iOS (Apple Health)
```

Princípios:
- **Processamento no navegador.** Exportação, limpeza de dados pessoais, parsing e estimativa nutricional rodam no cliente. O servidor só recebe totais por pedido/item/dia.
- **Dados por usuário.** Toda tabela de dados tem `user_id` e policy `user_id = auth.uid()`. A chave anon exposta no front só consegue: criar conta, logar, ler as tabelas nutricionais (públicas) e gravar Health via token.
- **Minimização de dados.** Endereço, coordenadas, cartão, entregador, CPF, e-mail e códigos de entrega são removidos nos guias de exportação. O perfil do cadastro armazena nome e e-mail, e o usuário pode adicionar dados de saúde.

---

## 2. Estrutura do repositório

```
site/
  index.html                 landing com painéis de demonstração (dados de exemplo embutidos)
  login/index.html           área logada: auth, perfil, painéis, upload, Apple Health, exames, pedidos
  login/engine.js            motor de importação e estimativa nutricional (roda no navegador)
  exportar-ifood.html        guia renderizado (iFood)
  exportar-rappi.html        guia renderizado (Rappi)
  exportador-pedidos-*.md    guias em markdown (download)
supabase/
  supabase-app.sql           schema por usuário: profiles (+ trigger no cadastro), uploads, pedidos, produtos, storage policy
  supabase-fixes.sql         correções: waitlist só pelo painel, importar_pedidos (transação), recalcular_produtos, apagar_importacoes, premissas
  supabase-health.sql        health_daily, sync_token, função e policies do atalho iOS
  supabase-motor.sql         nutri_ingredientes, nutri_pratos, nutri_config, itens
  supabase-waitlist.sql      (legado) lista de espera; não é mais usada pelo site
  base_nutricional.py        fonte das tabelas nutricionais; gera os INSERTs do supabase-motor.sql
docs/
  exportador-pedidos-ifood.md
  exportador-pedidos-rappi.md
netlify.toml
```

---

## 3. Deploy

**Netlify.** Arraste a pasta `site/` (ou o zip dela) em Deploys, ou conecte este repositório com `publish = site` (já no `netlify.toml`). Não há build.

**Supabase.** Um projeto, rodar no SQL Editor, nesta ordem:

1. `supabase/supabase-app.sql`
2. `supabase/supabase-health.sql`
3. `supabase/supabase-motor.sql`
4. `supabase/supabase-fixes.sql`
5. `supabase/migrations/202609100001_reliability.sql`

Alternativa: executar `supabase/install.sql`, que reúne os cinco passos em uma transação. Aplique o SQL antes de publicar o frontend. Não é necessário criar a waitlist. As cargas nutricionais acrescentam entradas ausentes e preservam as existentes. Faça backup antes de migrar uma instalação existente.

Depois:
- Authentication › URL Configuration: Site URL `https://SEU-DOMINIO`, Redirect URL `https://SEU-DOMINIO/login/`.
- Storage: bucket `pedidos` privado, sem restrição de MIME (ou com `text/csv, application/json` e o MIME do XLSX).
- Em `site/login/index.html` e `site/index.html`, `SUPABASE_URL` e `SUPABASE_ANON_KEY` (a chave *publishable*; nunca a service_role).

---

## 4. Fluxo do usuário

1. **Cadastro** em `/login` › Criar conta (nome, e-mail, senha, consentimento). Supabase envia e-mail de confirmação. Trigger `handle_new_user` cria a linha em `profiles` com nome, e-mail, consentimento e data.
2. **Exportar pedidos** com os guias (`/exportar-ifood.html`, `/exportar-rappi.html`). Os dois rodam no console do Chrome na sessão do próprio usuário; o passo de limpeza remove dados pessoais antes de salvar.
3. **Importar** pelo botão "Enviar exportação" no painel. O arquivo é lido e analisado no navegador; **o arquivo não é enviado ao servidor**, só pedidos e itens já estimados. A importação fica registrada em `uploads`. "Reprocessar" solicita o arquivo e atualiza somente os pedidos presentes nele, preservando os demais. Cada lote de até 100 pedidos, seus itens e o agregado de produtos é gravado em transação; reenvie o arquivo para retomar uma falha.
4. **Perfil**: peso, altura, idade, sexo, atividade, meta → necessidade diária (Mifflin-St Jeor). Botão "Salvar perfil".
5. **Apple Health**: importar o export (`export.zip`/`export.xml`, lido em streaming) ou sincronizar diariamente pelo app Atalhos com o `sync_token` do perfil.
6. **Exames**: LDL, HDL, triglicérides, glicemia, ácido úrico → regras de cardápio geradas com o histórico.

---

## 5. Motor de análise (`site/login/engine.js`)

Entrada: JSON do iFood (array de pedidos da API interna) ou XLSX da Rappi (abas `Pedidos` e `Itens`).

Pipeline:
1. **Parse** → pedidos normalizados (app, data, loja, tipo, valores, itens com quantidade e preço, complementos ligados ao item pai). Só pedidos concluídos/entregues.
2. **Deduplicação** por `(user_id, app, pedido_ref)`; reimportar o mesmo arquivo não duplica.
3. **Estimativa por item** (`estimate`):
   - não alimento (regex `nutri_config.nao_alimento`) → 0 kcal;
   - mercado: tamanho da embalagem lido do nome (`500ml`, `1kg`, `6x350ml`) × ingrediente por 100 g;
   - restaurante: primeiro padrão de `nutri_pratos` que casa com o nome (fronteira de palavra) → soma da composição em gramas × `nutri_ingredientes`;
   - modificadores: meia/grande/mini, "N peças/unidades", "compre 2 leve 3", "para 2 pessoas", tamanho declarado, nomes compostos com "+" (soma por partes);
   - agrupadores: se os complementos somam o preço do pai (combo, "esfihas fechadas"), o pai não conta e cada complemento vira unidade; em combos o complemento é estimado sozinho, fora de combo com o nome do pai;
   - contexto da loja (ex.: casa de espetos trata "Filé mignon" como espeto);
   - fallback: ingrediente com porção padrão por categoria; por último, prato genérico com confiança 15.
4. **Gravação atômica** pela função `importar_pedidos_v2(jsonb,boolean)`: pedido e itens na mesma transação (falha no meio não deixa pedido sem itens); `recalcular_produtos()` refaz o agregado. Cada item guarda o nível da estimativa: *base conhecida (embalagem)*, *prato da base (porção padrão)*, *porção estimada*, *sem correspondência*, além da confiança numérica, que é heurística e não uma probabilidade calibrada.

Tabelas nutricionais são editáveis no Supabase sem redeploy; o motor as carrega a cada importação, invalidando o cache anterior. `versao_motor` registra a versão do código usada; não é um hash das tabelas nutricionais. `base_nutricional.py` contém as definições históricas; o SQL é a carga executável, e alterações na base devem ser versionadas explicitamente.

Comparação com uma estimativa item a item feita por LLM (161 pedidos de restaurante): 87% das calorias totais, erro mediano de 16% por pedido, 100 de 161 dentro de ±25%, correlação 0,83. Isso compara dois estimadores; não é validação contra refeições de composição conhecida. Cozinhas com porção grande ficam subestimadas.

---

## 6. Modelo de dados (Supabase)

| Tabela | Chave | Conteúdo | Acesso |
|---|---|---|---|
| `profiles` | `user_id` | nome, e-mail, consentimento, peso, altura, idade, sexo, atividade, meta, ldl, hdl, tg, gli, uri, `sync_token` | dono lê/edita |
| `pedidos` | `id`, único `(user_id, app, pedido_ref)` | app, data, loja, tipo, valores, kcal, macros, `peso_g`, `confianca`, itens (resumo) | dono lê/cria/apaga |
| `itens` | `id` → `pedidos.id` | nome, quantidade, preço, gramas, kcal, macros, confiança, prato, `ingredientes` (jsonb) | dono |
| `produtos` | `id` | agregado por produto (pedidos, unidades, gasto) | dono |
| `uploads` | `id` | arquivo, caminho no bucket, app, tamanho, `processado` | dono |
| `health_daily` | `(user_id, dia)` | passos, kcal ativas, kcal basal, peso, sono, treino, fonte | dono; anon com `x-sync-token` |
| `nutri_ingredientes` | `id` | 81 ingredientes por 100 g + palavras-chave | público (leitura) |
| `nutri_pratos` | `id` | 79 pratos: regex + composição em gramas | público (leitura) |
| `nutri_config` | `chave` | regex de não alimentos | público (leitura) |

Storage: bucket `pedidos`, privado. Policy: usuário autenticado grava só em `<user_id>/…`; ninguém lista ou lê pela chave anon.

---

## 7. Apple Health

Dois caminhos, porque navegador não acessa HealthKit:

- **Export completo**: `Saúde › perfil › Exportar todos os dados`. O painel lê o zip em streaming (fflate), agrega por dia (maior valor entre fontes para passos e energia, evitando somar iPhone + Watch), e envia só totais diários.
- **Atalho do iOS**: agendado diariamente, faz `POST /rest/v1/health_daily?on_conflict=user_id,dia` com cabeçalhos `apikey` (anon), `x-sync-token` (do perfil) e `Prefer: resolution=merge-duplicates`. A função `sync_user_id()` resolve o usuário pelo token via `request.headers`; o trigger `health_fill_user` preenche `user_id`; a policy só aceita se o token bater. O passo a passo de montagem está no próprio painel.

Com Health, a necessidade do dia passa a ser basal medido × 1,15 + ativas; o forecast ganha a linha de peso medido; entram os cruzamentos atividade × comida, sono × pedido tarde e dia de treino.

---

## 8. Painéis (área logada)

- **Semana**: anéis real vs necessário por macro, dia a dia, nota de qualidade por semana, proteína por real, heatmap hora × dia.
- **Dinheiro**: comida vs cozinhar vs comer fora, gasto mensal empilhado, custo por 1.000 kcal por cozinha, restaurantes por gasto, "se cozinhasse 2 refeições", tipo de loja, produtos de mercado.
- **Corpo**: forecast de peso/IMC em dois cenários, régua de IMC, atividade × comida, sono, treino, gordura por semana.
- **Exames**: valores + regras geradas.
- **Pedidos**: tabela com busca, peso e confiança por pedido.

Filtros globais: app (iFood, Rappi, ambos) e período (12 meses, 2026, tudo).

Premissas do modelo diário, editáveis no perfil e declaradas nos painéis: porção pessoal de pedidos grandes (padrão 900 kcal + 30% do excedente), kcal fora do delivery em dia sem pedido (padrão = necessidade) e corte do cenário "com mudanças" (padrão 350 kcal/dia). O forecast é uma projeção dessas premissas, não uma medição.

---

## 9. Privacidade

- Guias de exportação removem: endereço de entrega e coordenadas, entregador, códigos de confirmação, cartão, cupons pessoais, qualquer chave com cpf/email/phone/document e valores com padrão de CPF ou e-mail.
- O banco não tem coluna para nada disso. O repositório não contém dados de pedidos; a home usa dados de demonstração embutidos.
- Nomes de lojas e itens vindos de arquivo são escapados antes de ir para o HTML; a área logada tem CSP restringindo scripts e conexões.
- Chave anon no front é a *publishable*; RLS é a barreira real. Cadastro pode ser desligado em Authentication › Providers quando o beta fechar.
- Rodapé e cadastro declaram: projeto independente, sem fins comerciais, dados de demonstração na home.

---

## 10. Limitações e próximos passos

- Rappi exige rodar scripts no console; virar extensão como caminho de menor atrito.
- Motor é determinístico por regras; porções fixas subestimam casas de porção grande. Fator por loja ou por preço.
- Nenhum processamento no servidor: importações grandes dependem do navegador do usuário.
- Keeta ainda não tem exportador.
- Recomendação "onde pedir hoje" existe só na demo da home; na área logada precisa de cardápios ao vivo.
- `waitlist` é legado e pode ser removida.



## Correções de confiabilidade — 2026-09-10

- Reprocessamento por upsert sem apagar o histórico; deduplicação paginada e validação prévia do arquivo.
- Transação por lote: pedidos, itens e agregado de produtos. Uma falha posterior preserva os lotes concluídos.
- Vínculo de titularidade entre itens e pedidos, permissões explícitas e fechamento do upload anônimo legado.
- Peso declarado prevalece sobre "grande"; combinações mantêm partes desconhecidas; cache nutricional invalidado a cada carga.
- Apple Health: erro para ZIP sem XML, unidades kg/lb/g e kcal/kJ, intervalos de sono sobrepostos consolidados por fonte.
- Calendário local consistente, premissas com zero, ranking de produtos filtrado no banco e tabela paginada.
- JavaScript da área logada separado em `app.js`, `engine.js`, `health.js`; CSP não permite scripts inline.

### Verificação

Execute `node --test tests/regression.test.cjs` (Node.js 22 ou superior). Os testes usam dados sintéticos e APIs/DOM simulados, sem credenciais.

Antes de produção, validar `supabase/install.sql` em uma instância descartável e testar cadastro/login/recuperação, isolamento entre dois usuários, importação e reprocessamento autenticados, além do upsert do atalho Health. Testes locais de JavaScript não substituem essa validação do PostgreSQL/RLS.

### Limitações mantidas

- O histórico de pedidos e os totais Health ainda são carregados por páginas para os gráficos; não há agregação completa dos painéis no servidor.
- O motor nutricional continua heurístico. Não mede ingestão individual, e a projeção corporal é um cenário baseado nas premissas do perfil.
- A base nutricional não tem ainda snapshot imutável por importação.
- XLSX continua na versão existente; atualizar a dependência exige testar os arquivos exportados das duas plataformas.
- `exportador-pedidos-*` continua sendo um guia de console; os endpoints das plataformas não foram testados nesta revisão.
