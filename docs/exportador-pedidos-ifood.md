# Coleta de pedidos do iFood

Como coletar todos os pedidos de uma conta do iFood a partir de uma sessão já logada no site `www.ifood.com.br`.

Setembro de 2026

---

## 1. Visão geral

Depois do login, o site do iFood lista os pedidos chamando uma API interna. A coleta reaproveita essa chamada:

1. Abrir `https://www.ifood.com.br/pedidos` com o usuário logado.
2. Capturar os cabeçalhos que o próprio site envia na chamada de pedidos.
3. Repetir a chamada, no contexto da página, para cada página da lista.
4. Juntar tudo num único array JSON, sem duplicatas.

O resultado é a lista completa de pedidos que a API devolve para a conta, com todos os metadados de cada pedido.

---

## 2. Pré-condições

- Usuário logado em `www.ifood.com.br` no navegador.
- Acesso ao contexto da página (console do DevTools, script injetado ou ferramenta de automação de navegador).

---

## 3. Endpoint

A página `/pedidos` dispara esta requisição ao carregar:

```http
GET https://www.ifood.com.br/site-api/v4/customers/me/orders?page=0&size=10
```

| Item | Valor |
|---|---|
| Método | `GET` |
| Caminho | `/site-api/v4/customers/me/orders` |
| `page` | Índice da página, começando em 0 |
| `size` | Itens por página. O servidor limita a 25 (pedir 50 devolve 25) |
| Ordem | Mais recentes primeiro |
| Resposta | Array JSON de pedidos |
| Paginação extra | Botão **Ver mais pedidos** chama a mesma rota com `page=1`, `page=2` etc. |

Não existe endpoint de detalhe por pedido. Tentativas em `/site-api/v1`, `/v2` e `/v4` com `/orders/{id}` responderam 404 ou 400. A listagem já traz todos os dados.

---

## 4. Autenticação

Só os cookies não bastam. Um `fetch` com `credentials: 'include'` e sem os cabeçalhos do app responde:

```http
HTTP 401
{"message": "no jwt token"}
```

A chamada precisa dos cabeçalhos que o JavaScript do site adiciona na requisição:

| Cabeçalho | Função |
|---|---|
| `Authorization` | Token JWT da sessão |
| `X-Ifood-Session-Id` | Sessão do app |
| `X-Ifood-Device-Id` | Identificador do dispositivo |
| `x-ifood-user-id` | Usuário |
| `account_id` | Conta |
| `x-client-application-key` | Chave do cliente web |
| `x-px-cookies` | Sinais do antifraude (PerimeterX) |
| `platform`, `app_name`, `app_version`, `browser`, `x-device-model` | Identificação do app |
| `Accept`, `Cache-Control`, `accept-language` | Padrão da requisição |

Os valores mudam por sessão e o JWT expira, então eles não devem ser fixados. O caminho seguro é capturá-los da própria chamada do site a cada coleta.

---

## 5. Captura dos cabeçalhos

Qualquer mecanismo que leia os cabeçalhos da requisição de pedidos funciona: aba Network do DevTools, Chrome DevTools Protocol, proxy local ou um hook no `XMLHttpRequest` da página.

O hook é o mais simples e foi o método validado:

1. Na página `/pedidos`, substituir `XMLHttpRequest.prototype.open`, `setRequestHeader` e `send` para registrar URL e cabeçalhos das requisições que contêm `/customers/me/orders`.
2. Fazer o site disparar uma nova chamada: clicar em **Ver mais pedidos** ou recarregar a lista.
3. Guardar os cabeçalhos capturados e o caminho da rota (a versão `v4` pode mudar).

O hook precisa estar instalado antes da chamada. Como a primeira chamada acontece no carregamento da página, instalar pelo console exige o clique em **Ver mais pedidos** depois.

---

## 6. Coleta paginada

Com os cabeçalhos em mãos, a coleta roda **dentro da própria página do iFood**. Assim a requisição sai com a mesma origem, os mesmos cookies e o mesmo contexto antifraude do site.

Regras:

| Regra | Detalhe |
|---|---|
| Tamanho da página | `size=25` |
| Início | `page=0` |
| Fim | Página vazia ou página sem nenhum `id` novo |
| Deduplicação | Por `id` do pedido |
| Intervalo | 350 a 400 ms entre páginas |
| Cabeçalhos | Reenviar os capturados, descartando os controlados pelo navegador: `cookie`, `host`, `origin`, `referer`, `user-agent`, `connection`, `content-length`, `accept-encoding`, `sec-*` |

O critério de fim não usa "página com menos de 25 itens". Se o limite do servidor mudar para menos de 25, esse critério pararia cedo demais. Uma página a mais, vazia, é o custo de ser robusto.

Referência de volume: numa conta real, a coleta trouxe 252 pedidos em 11 páginas com dados (mais uma vazia para confirmar o fim), com histórico de fevereiro a setembro de 2026.

---

## 7. Erros e sessão

| Situação | Resposta | Tratamento |
|---|---|---|
| Sem cabeçalhos do app | `401 {"message": "no jwt token"}` | Capturar os cabeçalhos antes de coletar |
| Token expirado no meio da coleta | `401` ou `403` | Recarregar `/pedidos`, capturar de novo e repetir a página que falhou |
| Usuário deslogado | A página não chama a API de pedidos | Pedir login e recomeçar |
| Resposta não JSON ou status inesperado | Qualquer outro status | Interromper e registrar status e corpo |

---

## 8. Código de referência

Executado como está no console do Chrome em `https://www.ifood.com.br/pedidos`, com usuário logado, em 10/09/2026: 15 cabeçalhos capturados, 252 pedidos coletados, nenhum duplicado.

### Passo 1: instalar o hook

```js
(() => {
  if (window.__ifoodCap) return;
  const cap = (window.__ifoodCap = { headers: null, path: null });
  const open = XMLHttpRequest.prototype.open;
  const setHeader = XMLHttpRequest.prototype.setRequestHeader;
  const send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__url = url;
    this.__headers = {};
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    this.__headers[name] = value;
    return setHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (String(this.__url).includes('/customers/me/orders')) {
      cap.headers = { ...this.__headers };
      cap.path = new URL(this.__url, location.href).pathname;
    }
    return send.apply(this, arguments);
  };
})();
```

### Passo 2: disparar uma chamada do site

Clicar em **Ver mais pedidos** no fim da lista. Conferir:

```js
Boolean(window.__ifoodCap.headers) // deve ser true
```

### Passo 3: coletar todas as páginas

```js
async function coletarPedidos({ size = 25, pausaMs = 400, maxPaginas = 400 } = {}) {
  const cap = window.__ifoodCap;
  if (!cap || !cap.headers) throw new Error('Cabeçalhos não capturados. Clique em "Ver mais pedidos".');

  const bloqueados = /^(cookie|host|origin|referer|user-agent|connection|content-length|accept-encoding|sec-)/i;
  const headers = Object.fromEntries(Object.entries(cap.headers).filter(([k]) => !bloqueados.test(k)));

  const pedidos = [];
  const vistos = new Set();

  for (let page = 0; page < maxPaginas; page++) {
    const url = new URL(cap.path, location.origin);
    url.searchParams.set('page', page);
    url.searchParams.set('size', size);

    const r = await fetch(url, { headers, credentials: 'include' });
    if (r.status === 401 || r.status === 403) {
      throw new Error(`Sessão recusada (${r.status}) na página ${page}. Recarregue /pedidos e capture de novo.`);
    }
    if (!r.ok) throw new Error(`Status ${r.status} na página ${page}`);

    const lote = await r.json();
    if (!Array.isArray(lote)) throw new Error('Resposta inesperada: não é um array');

    const novos = lote.filter((p) => p && p.id && !vistos.has(p.id));
    novos.forEach((p) => { vistos.add(p.id); pedidos.push(p); });
    console.log(`página ${page}: ${lote.length} recebidos, ${novos.length} novos, total ${pedidos.length}`);

    if (lote.length === 0 || novos.length === 0) break;
    await new Promise((ok) => setTimeout(ok, pausaMs));
  }
  return pedidos;
}

const pedidos = await coletarPedidos();
```

### Passo 4: remover dados pessoais

Antes de salvar ou enviar, apague tudo que identifica você, sua casa ou terceiros. A lista abaixo remove endereço de entrega (com coordenadas e complemento), entregador, códigos de confirmação, dados de pagamento além do método, avaliações e qualquer campo com e-mail, CPF ou telefone. Nutrição, valores, loja e itens ficam intactos.

```js
function limparPedido(p) {
  const c = structuredClone(p);
  delete c.delivery?.address;
  delete c.delivery?.driver;
  delete c.pickUp?.address;
  delete c.verificationCodes;
  delete c.reviews;
  delete c.customer;
  if (c.payments?.methods) c.payments.methods = c.payments.methods.map(m => ({ method: m.method, type: m.type, amount: m.amount }));
  const proibidos = /cpf|email|e-mail|phone|telefone|document|customer|address|coordinates|driver|token/i;
  const varrer = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (proibidos.test(k)) { delete o[k]; continue; }
      if (typeof o[k] === 'string' && /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|@/.test(o[k])) { o[k] = '[removido]'; continue; }
      varrer(o[k]);
    }
  };
  varrer(c);
  return c;
}
const pedidosLimpos = pedidos.map(limparPedido);
```

### Passo 5: salvar o JSON

Gera o download do array já sem dados pessoais.

```js
const blob = new Blob([JSON.stringify(pedidosLimpos)], { type: 'application/json' });
const a = Object.assign(document.createElement('a'), {
  href: URL.createObjectURL(blob),
  download: `ifood_pedidos_${new Date().toLocaleDateString('sv-SE')}.json`,
});
a.click();
```

---

## 9. Estrutura de um pedido

Chaves de primeiro nível presentes em todos os pedidos:

`id`, `shortId`, `orderNumber`, `createdAt`, `updatedAt`, `lastStatus`, `details`, `deliveryOperation`, `merchant`, `payments`, `bag`, `origin`, `deliveryMethod`, `fees`, `salesChannel`, `verificationCodes`

Chaves que só aparecem em alguns pedidos:

| Chave | Quando aparece |
|---|---|
| `closedAt` | Pedido encerrado (ausente em pedido em andamento) |
| `delivery` | Pedido com entrega (ausente em retirada) |
| `pickUp` | Pedido para retirada (`details.mode = TAKEOUT`) |
| `refund` | Pedido com reembolso total ou parcial |
| `historyChanges` | Pedido alterado depois de feito (item removido ou substituído) |
| `reviews` | Pedido avaliado |

| Bloco | Campos |
|---|---|
| Raiz | `id`, `shortId`, `orderNumber`, `createdAt`, `updatedAt`, `closedAt`, `lastStatus`, `salesChannel` |
| `details` | `mode`, `scheduled`, `tippable`, `indoorTipEnabled`, `trackable`, `boxable`, `placedAtBox`, `reviewed`, `darkKitchen` |
| `merchant` | `id`, `name`, `logo`, `type`, `address` (`streetName`, `streetNumber`, `neighborhood`, `city`, `state`, `country`, `coordinates.latitude`, `coordinates.longitude`) |
| `delivery.address` | `establishment`, `streetName`, `streetNumber`, `complement`, `reference`, `neighborhood`, `city`, `state`, `country`, `coordinates` |
| `delivery.driver` | `id`, `name`, `photoUrl`, `modal`, `isSuperDriver` |
| `delivery` (outros) | `estimatedTimeOfArrival` (`deliversAt`, `deliversEndAt`, `updatedAt`), `expectedDeliveryTime`, `expectedDeliveryTimeEnd`, `expectedDuration`, `isFullService` |
| `deliveryOperation.executions[]` | `deliveryRequestId`, `lastState`, `lastStateAt`, `deliveryParameters` (`logisticProvider`, `deliveryProduct`, `code`, `schedulingType`), `source` (`trigger`, `triggerId`, `requester`, `requesterId`, `reason`), `timeline[]` |
| `timeline[]` | `deliveryId`, `deliveryType`, `events[]` (`value`, `timestamp`, `metadata`) |
| `bag` | `items[]`, `subTotal`, `deliveryFee`, `total` (cada um com `value` e `valueWithDiscount`), `benefits[]`, `updated` |
| `bag.items[]` | `id`, `uniqueId`, `externalId`, `name`, `description`, `quantity`, `weight` (`value`, `unit`), `unitPrice`, `unitPriceWithDiscount`, `totalPrice`, `totalPriceWithDiscount`, `tags`, `notes`, `logoUrl`, `attachments`, `subItems[]` |
| `bag.items[].subItems[]` | `id`, `externalId`, `name`, `quantity`, `unitPrice`, `unitPriceWithDiscount`, `totalPrice`, `totalPriceWithDiscount`, `tags` |
| `bag.benefits[]` | `type`, `target`, `targetId`, `description`, `value`, `experienceType` |
| `payments.methods[]` | `id`, `uniqueId`, `method` (`name`, `description`), `type` (`name`, `description`), `brand` (`id`, `name`, `description`, `image`), `digitalWallet` (`id`, `name`, `description`, `image`), `amount` (`currency`, `value`), `transactions` |
| `payments.total` | `currency`, `value` |
| `fees[]` | `id`, `title`, `description`, `type`, `amount` (`currency`, `value`) |
| `origin` | `platform`, `appName`, `appVersion` |
| `deliveryMethod` | `id`, `mode`, `timeSlot` (`id`, `startDateTime`, `endDateTime`) |
| `verificationCodes[]` | `source`, `name`, `value`, `required` |
| `pickUp` | `expectedPickupTime`, `address` (mesmo formato do endereço da loja) |
| `refund` | `type`, `context` (`title`, `description`), `paymentRefundAmount` |
| `historyChanges` | `bag` (itens com `deltaType` e `ean`, totais, `amountChange`, `amountChangeType`), `payments`, `patchIds`, `patchRequestIds` |
| `reviews[]` | `id`, `reviewType`, `reviewedAt`, `score`, `version`, `visibility`, `status`, `answers` |

### Valores observados

| Campo | Valores |
|---|---|
| `lastStatus` | `CONCLUDED`, `CANCELLED`, `DECLINED`, `ARRIVED` (em andamento) |
| `details.mode` | `DELIVERY`, `TAKEOUT` |
| `merchant.type` | `RESTAURANT`, `MARKET`, `PHARMACY`, `PET`, `BEVERAGE`, `SHOPPING` |
| `payments.methods[].method.name` | `DIGITAL_WALLET`, `BANK_PAY` |
| `fees[].title` | `Taxa de serviço`, `Entrega rápida` |
| `bag.benefits[].type` / `target` | `VOUCHER`, `ITEM_TAG`, `MERCHANT_TAG` / `CART`, `ITEM`, `DELIVERY_FEE` |
| `executions[].lastState` | `COMPLETED`, `CANCELLED` |
| `refund.type` | `FULL_REFUND`, `PARTIAL_REFUND` |
| `historyChanges.bag.items[].deltaType` | `REMOVED`, `REPLACED` |
| `timeline[].events[].value` | `DELIVERY_CREATED`, `DELIVERY_ACCEPTED`, `DELIVERY_GOING_TO_ORIGIN`, `DELIVERY_ARRIVED_AT_ORIGIN`, `DELIVERY_COLLECTED`, `DELIVERY_GOING_TO_DESTINATION`, `DELIVERY_NEAR_DESTINATION`, `DELIVERY_ARRIVED_AT_DESTINATION`, `DELIVERY_COMPLETED`, `DELIVERY_LATE`, `DELIVERY_GROUP_ASSIGNED`, `DELIVERY_CANCELLED` |

### Convenções

- **Dinheiro em centavos:** `bag.total.value = 10439` significa R$ 104,39.
- **Datas em ISO 8601 com fuso:** `2026-09-09T16:28:18-03:00`.
- **`expectedDuration` em segundos:** `780` = 13 minutos.
- **`subItems[].quantity` é por unidade do item pai:** um item com `quantity: 5` e complemento com `quantity: 1` significa 5 complementos. Os preços confirmam: `item.totalPrice = item.unitPrice × item.quantity`.
- **Itens de preço zero:** combos como "McOferta" vêm com `unitPrice: 0` no item pai; o preço e o conteúdo estão nos complementos.
- **Pedidos em andamento:** aparecem na lista com status intermediário (ex.: `ARRIVED`) e sem `closedAt`. Para análise, filtrar por status final ou recoletar depois.
- **Eventos repetidos:** um pedido pode ter mais de uma execução logística (troca de entregador). Para horários de coleta e entrega, usar a última ocorrência do evento.

---

## 10. Cuidados

- **API interna e não documentada.** Rota, versão, cabeçalhos e formato podem mudar sem aviso.
- **Histórico limitado ao que a API devolve.** Pedidos muito antigos podem não aparecer.
- **Dados sensíveis na resposta:** a API devolve endereço de entrega com coordenadas, nome do entregador e `verificationCodes[].value` (código de confirmação da entrega). O passo 4 remove tudo isso antes de salvar. Não pule esse passo se for enviar o arquivo para qualquer lugar.
- **Uso só de leitura e da própria conta.** A coleta usa a sessão do usuário para listar os pedidos dele; não altera nada na conta.
- **Ritmo das chamadas.** Manter o intervalo entre páginas para não parecer tráfego automatizado e não disparar o antifraude.
