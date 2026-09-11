from pathlib import Path
from html import escape
root=Path(__file__).resolve().parents[1]
template=(root/'scripts/exportador-template.js').read_text()
for key,title,url in [('ifood','iFood','https://www.ifood.com.br/pedidos'),('rappi','Rappi','https://www.rappi.com.br/account/orders')]:
 code=template.replace('__PLATFORM__',key)
 (root/f'site/exportadores/{key}.js').write_text(code)
 md=f'''# Exportar pedidos do {title} para o eatIQ

Use um computador com Chrome ou Edge. O procedimento usa a sessão da sua própria
conta na plataforma. Não funciona dentro do aplicativo de celular.

## 1. Abra seus pedidos

Entre em {url} e faça login normalmente. Mantenha esta aba aberta.
O tempo depende da quantidade de pedidos e da resposta da plataforma; a Rappi
consulta um comprovante por pedido e pode levar dezenas de minutos.

## 2. Execute o exportador uma vez

Na página do guia, copie o código do exportador. Volte à aba do {title} e abra o
console: Mac **⌘ + Option + J**; Windows/Linux **Ctrl + Shift + J**.
Cole o código e pressione Enter. Aparecerá um painel eatIQ no canto da página.

O código completo pode ser inspecionado e baixado em
https://eat-iq.netlify.app/exportadores/{key}.js . Não envie tokens, cookies ou
cabeçalhos para o eatIQ ou para o suporte. Nunca cole código enviado por desconhecidos.

### Se o navegador bloquear a colagem

O Chrome ou Edge pode mostrar um aviso de segurança ao tentar colar no console.
Ele protege sua conta contra códigos maliciosos. Leia o aviso e revise o código
em **Inspecionar o código completo**; se não entender o que ele faz, peça ajuda.

Se você revisou o código e o aviso pedir a frase **allow pasting**:

1. Clique na linha de entrada do **Console**, ao lado do símbolo **>**, na aba do {title}.
2. **Digite manualmente** `allow pasting`, exatamente assim, sem aspas. Não copie e cole essa frase.
3. Pressione **Enter** para autorizar a colagem.
4. Agora cole o código completo do exportador e pressione **Enter** novamente.

Essa frase só deve ser digitada quando o navegador solicitar. Se a colagem já
funcionar, pule esta etapa. Se o aviso pedir outra frase, siga o texto exibido
pelo próprio navegador. Não digite na barra de endereço, na busca do console
ou no campo de código desta página.

## 3. Identifique a sessão e inicie

Com o painel aberto, clique em **Ver mais** na lista de pedidos da plataforma.
Se não existir, abra outra seção do site e volte a Meus pedidos, sem recarregar
a aba. Quando o painel disser **Sessão identificada**, clique em
**Iniciar / continuar**. Se não identificar a sessão, pare: a interface ou a
forma de autenticação da plataforma pode ter mudado.

## 4. Acompanhe e confira

O painel mostra pedidos encontrados, processados e pendências. **Pausar**
interrompe a coleta; **Iniciar / continuar** retoma os pedidos restantes.
Não feche nem recarregue a aba sem salvar a retomada.

Erros de sessão, limite de chamadas, rede e formato interrompem a coleta sem
ser confundidos com fim do histórico. O arquivo é parcial quando há pendências
ou divergência com o total informado pela plataforma. Mesmo uma coleta sem
pendências cobre apenas o histórico que as APIs retornam, não pedidos omitidos
pela plataforma.

## 5. Baixe e importe

Clique em **Baixar pedidos**. O resultado é um arquivo **JSON** em Downloads,
com data, origem e indicação **PARCIAL** quando necessário. A exportação parcial
exige confirmação e contém somente os pedidos já processados.

Abra https://eat-iq.netlify.app/login/ e escolha **Enviar exportação**. O eatIQ
importa apenas pedidos concluídos e calcula a nutrição. Não é necessário gerar
calorias ou planilhas durante a coleta. Arquivos antigos JSON iFood e XLSX das
duas plataformas continuam aceitos. Para atualizar pedidos já importados, use
**Reprocessar** com a exportação desejada.

## Retomar depois de fechar ou refazer o login

1. Pause e aguarde a requisição terminar.
2. Clique em **Salvar retomada** e guarde o JSON de retomada.
3. Depois, abra a mesma conta, execute novamente o exportador e identifique a sessão.
4. Clique em **Abrir retomada**, escolha esse arquivo e depois **Iniciar / continuar**.

O arquivo de retomada não deve ser enviado ao importador do eatIQ. Ele contém
os pedidos já processados, a posição da coleta e uma assinatura pseudônima da
conta para impedir misturas acidentais. Não contém o token de autenticação.

## O que é exportado

IDs, datas, status, lojas, valores e campos dos produtos necessários à análise:
nome, descrição, quantidade, apresentação, peso quando disponível e opções.
Não são copiados os blocos de endereço, coordenadas, cartão, entregador, dados
do cliente ou códigos de entrega. Observações livres de entrega também ficam
fora. Descrições de produtos são preservadas; revise o arquivo antes de
compartilhá-lo com terceiros. O histórico de compras continua sendo pessoal.

O exportador não envia o arquivo ao eatIQ: você escolhe importá-lo depois.
Não instala dependências, não grava comprovantes brutos no armazenamento do
site e faz somente consultas GET. **Fechar** remove o painel e restaura os
mecanismos de captura instalados por ele.

## Limitações e suporte

As APIs usadas não são públicas nem estáveis. Não há garantia de compatibilidade
com futuras mudanças. Não tente insistir em bloqueios de acesso. Uma falha de
permissão exige login válido ou revisão do exportador.

Se precisar de ajuda, informe plataforma, etapa e mensagem do painel; envie uma
captura recortada sem dados pessoais. Não envie o conteúdo da aba Network,
tokens, cookies ou comprovantes brutos.

Versão do exportador: 2.0.0. Testes automatizados cobrem respostas simuladas;
a interface e os endpoints precisam ser confirmados numa sessão real da plataforma.
'''
 for d in ['docs','site']:(root/f'{d}/exportador-pedidos-{key}.md').write_text(md)
 body=f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exportar {title} · eatIQ</title><link rel="stylesheet" href="exportadores/guide.css"><script defer src="exportadores/guide.js"></script></head><body><main><nav><a href="index.html#exportar">eatIQ · voltar</a><a href="login/">Minha conta</a></nav><p class="eyebrow">SEUS PEDIDOS, NA SUA CONTA</p><h1>Exporte seus pedidos do {title}.</h1><p class="intro">Um código, um painel de acompanhamento e um arquivo pronto para importar. Use Chrome ou Edge no computador.</p><ol class="steps"><li><h2>Abra sua conta</h2><p><a href="{url}" target="_blank" rel="noopener noreferrer">Abrir meus pedidos no {title} ↗</a>. Faça login e mantenha a aba aberta.</p></li><li><h2>Copie e execute</h2><p>Copie o código abaixo. Na aba do {title}, abra o console: <strong>⌘ + Option + J</strong> no Mac ou <strong>Ctrl + Shift + J</strong> no Windows/Linux. Cole e pressione Enter.</p><div class="actions"><button id="copy">Copiar exportador</button><a href="exportadores/{key}.js" download>Baixar código</a></div><p id="copyStatus" role="status" aria-live="polite"></p><details><summary>Inspecionar o código completo</summary><textarea id="source" readonly spellcheck="false" aria-label="Código do exportador {title}">{escape(code)}</textarea></details><aside class="paste-help" aria-labelledby="pasteHelpTitle"><h3 id="pasteHelpTitle">Se o navegador bloquear a colagem</h3><p>O Chrome ou Edge pode mostrar um aviso de segurança para proteger sua conta contra códigos maliciosos. Leia o aviso e revise o exportador em <strong>Inspecionar o código completo</strong>. Se não entender o código, peça ajuda antes de continuar.</p><p>Se você revisou o código e o aviso pedir <strong>allow pasting</strong>:</p><ol><li>Na aba do {title}, clique na linha de entrada do <strong>Console</strong>, ao lado do símbolo <strong>&gt;</strong>.</li><li><strong>Digite manualmente</strong> <code>allow pasting</code>, exatamente assim, sem aspas. Não copie e cole essa frase.</li><li>Pressione <strong>Enter</strong> para autorizar a colagem.</li><li>Depois, cole o código completo do exportador e pressione <strong>Enter</strong> novamente.</li></ol><p class="note">Só faça isso se o navegador solicitar. Se a colagem já funcionar, pule esta etapa. Se o aviso pedir outra frase, siga o texto exibido pelo próprio navegador. Não digite na barra de endereço, na busca do console ou no campo de código deste guia.</p></aside></li><li><h2>Identifique a sessão e inicie</h2><p>No site da plataforma, clique em <strong>Ver mais</strong>. Se esse botão não existir, navegue para outra seção e volte a Meus pedidos sem recarregar a aba. Quando o painel eatIQ indicar <strong>Sessão identificada</strong>, clique em <strong>Iniciar / continuar</strong>.</p></li><li><h2>Confira e baixe</h2><p>O painel informa encontrados, processados e pendências. Ao terminar, clique em <strong>Baixar pedidos</strong>. O JSON vai para Downloads. A Rappi consulta cada comprovante e pode levar dezenas de minutos.</p><p class="note">Se houver falhas ou divergência de contagem, o arquivo será marcado como PARCIAL. A exportação cobre os pedidos disponibilizados pela plataforma.</p></li><li><h2>Importe no eatIQ</h2><p><a href="login/">Abra sua conta</a> e clique em <strong>Enviar exportação</strong>. Escolha o JSON de pedidos. O eatIQ calcula os macros; não é preciso preparar uma planilha.</p></li></ol><section><h2>Precisa parar?</h2><p>Use <strong>Pausar</strong> e espere terminar a requisição. Para continuar noutra sessão, clique em <strong>Salvar retomada</strong>. Depois execute o exportador na mesma conta, identifique a sessão e use <strong>Abrir retomada</strong>. Esse arquivo serve ao exportador, não ao importador do eatIQ.</p></section><section><h2>O que fica no arquivo</h2><p>Pedidos, lojas, valores e dados dos produtos. Endereços, cartões, entregadores e tokens não são copiados. O histórico de compras continua sendo pessoal; revise antes de compartilhar.</p><p>A sessão fica na memória da aba. Nenhum arquivo é enviado automaticamente ao eatIQ. Os arquivos antigos continuam aceitos.</p></section><details><summary>Erros, limitações e instruções completas</summary><p>Sessão recusada: salve a retomada, faça login novamente e execute o código de novo. Falha de rede: use Iniciar / continuar mais tarde. Formato inesperado: pare e informe a mensagem ao suporte, sem enviar tokens ou cabeçalhos.</p><p>As interfaces e APIs podem mudar. Esta versão tem testes com respostas simuladas; o funcionamento na sua sessão depende da plataforma.</p><a href="exportador-pedidos-{key}.md" download>Baixar instruções completas</a></details><footer>eatIQ · Exportador 2.0.0 · consultas somente de leitura</footer></main></body></html>'''
 (root/f'site/exportar-{key}.html').write_text(body+'\n')
