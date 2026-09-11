# Exportar pedidos do iFood para o eatIQ

Use um computador com Chrome ou Edge. O procedimento usa a sessão da sua própria
conta na plataforma. Não funciona dentro do aplicativo de celular.

## 1. Abra seus pedidos

Entre em https://www.ifood.com.br/pedidos e faça login normalmente. Mantenha esta aba aberta.
O tempo depende da quantidade de pedidos e da resposta da plataforma; a Rappi
consulta um comprovante por pedido e pode levar dezenas de minutos.

## 2. Execute o exportador uma vez

Na página do guia, copie o código do exportador. Volte à aba do iFood e abra o
console: Mac **⌘ + Option + J**; Windows/Linux **Ctrl + Shift + J**.
Cole o código e pressione Enter. Aparecerá um painel eatIQ no canto da página.

O código completo pode ser inspecionado e baixado em
https://eat-iq.netlify.app/exportadores/ifood.js . Não envie tokens, cookies ou
cabeçalhos para o eatIQ ou para o suporte. Nunca cole código enviado por desconhecidos.

### Se o navegador bloquear a colagem

O Chrome ou Edge pode mostrar um aviso de segurança ao tentar colar no console.
Ele protege sua conta contra códigos maliciosos. Leia o aviso e revise o código
em **Inspecionar o código completo**; se não entender o que ele faz, peça ajuda.

Se você revisou o código e o aviso pedir a frase **allow pasting**:

1. Clique na linha de entrada do **Console**, ao lado do símbolo **>**, na aba do iFood.
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
