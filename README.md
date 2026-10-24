# Meu Controle Financeiro — leia primeiro

App de finanças pessoais em HTML + CSS + JavaScript puros: gastos, entradas, cartões, parcelas, divisão com reembolso, orçamento, gráficos e importação de extratos. Os dados ficam no aparelho (`localStorage`); instala no celular (PWA) e funciona sem internet. Publicado de graça no GitHub Pages.

Este é o **único documento do projeto**: contexto e regras de trabalho (partes 1 a 5) e funcionalidades, dados e regras de negócio (partes 6 a 10). Se algo aqui contradisser o código, **confie no código** e avise o usuário.

## 1. O projeto
- **Custo zero é requisito**: GitHub Pages, sem servidor, sem serviço pago.
- O dono **não programa**, usa IAs gratuitas e edita pelo VS Code do GitHub (github.dev). Outra IA (no VS Code) também altera os arquivos: **leia sempre os arquivos reais antes de assumir** e mantenha este documento atualizado.
- Os dados são de uma pessoa real: nunca perca nem altere dados salvos sem migração.

## 2. Estado atual
- Versão do app: veja o selo `#appVersion` no cabeçalho do `index.html` (sobe 1 a cada alteração; não anote o número aqui).
- Sem servidor: tudo roda no aparelho. Um **site com servidor** (login, assinatura Pro, sincronização na nuvem, painel admin) foi construído e testado, mas ficou **arquivado fora deste repositório** porque exige servidor com disco (não é gratuito). Só retome se o usuário pedir e aceitar o custo.
- Sem pendências conhecidas. Textos legais (Termos/Privacidade) ficam para depois, se um dia houver site público com contas.

## 3. Arquivos
Regra do dono: **o menor número de arquivos possível e nenhum com mais de 500 linhas**.
```
index.html  manifest.json  sw.js  package.json
app.css
01-base.js  02-resumo.js  03-lancamentos.js  04-formulario.js  05-cadastros.js  06-extras.js  07-excel.js  08-inicio.js
icon-192.png  icon-512.png
calculos.test.js  importacao.test.js  excel.test.js  estrutura.test.js
README.md
.github/workflows/testes.yml
```
`index.html`, `manifest.json` e `sw.js` ficam na raiz de propósito (o service worker precisa cobrir o site todo). O `icon-512.png` serve também como ícone "maskable".

Os scripts são clássicos e carregados na ordem dos números. Cada arquivo reúne **seções** marcadas por `/* ===== nome.js ===== */` (os testes e este documento usam esses nomes):

| Arquivo | Seções |
|---|---|
| `01-base.js` | utils.js, config.js, theme.js, calculations.js, storage.js |
| `02-resumo.js` | ui.js, dashboard.js |
| `03-lancamentos.js` | sheet-drag.js, transactions.js (tabela e seleção em massa) |
| `04-formulario.js` | transaction-form.js (formulário de gasto/entrada, reembolsos) |
| `05-cadastros.js` | cadastros.js, importer.js |
| `06-extras.js` | backup.js, recorrentes.js, graficos.js, exportar.js |
| `07-excel.js` | zip.js, xlsx.js, excel.js (planilha Excel do backup; `sheetModel` = dados da Planilha do mês) |
| `08-inicio.js` | demo.js, bloqueio.js, integridade.js, main.js (**sempre o último**) |

## 4. Onde mexer para...
| Quero mudar... | Arquivo |
|---|---|
| Uma cor do app | `app.css` (seção de tema) |
| Texto ou lugar de um card | `index.html` |
| Cabeçalho, abas, cards, botões, formulários | `app.css` (seção base) |
| Painel, gráficos, impressão, celular (até 680 px) | `app.css` (seção de componentes) |
| Cálculos, interface ou uma funcionalidade | o arquivo da tabela acima que tem a seção correspondente |
| Um botão que não faz nada | `08-inicio.js`, seção `main.js` (liga os botões e inicia o app) |

## 5. Regras de trabalho
1. **Entrega:** só os arquivos que mudaram, cada um com o **código inteiro** e o **caminho completo** como título (ex.: `05-cadastros.js`, seção `importer.js`). Pacote grande: `.zip` com a pasta pronta para arrastar ao GitHub. Se mover/apagar arquivos, liste os antigos a apagar.
2. **Versão:** a cada alteração em **qualquer** arquivo do app, aumente em 1 o selo `#appVersion` do `index.html` e diga a nova versão. **Não** mexa no `sw.js` por isso: o app revalida na internet e usa o cache só sem conexão. Mexa no `sw.js` apenas se criar/remover arquivo (lista `FILES`) ou mudar o próprio service worker.
3. **Limite de 500 linhas por arquivo** (código, estilos, testes e este documento). Passou? Divida em seções/arquivos novos. Antes de criar um arquivo, veja se cabe num existente; apague o que ficar sem uso. O `estrutura.test.js` confere o limite.
4. **Arquivo novo** de código: inclua no `index.html` (na ordem certa; `08-inicio.js` continua por último) e na lista `FILES` do `sw.js`. O `estrutura.test.js` avisa se esquecer o `sw.js`.
5. **Scripts clássicos e globais** (o HTML usa `onclick="..."`): sem módulos; **não repita** nomes de `const`/`let`/`function` entre arquivos.
6. **Dados:** formato novo exige migração em `loadData`/`normalizeTransaction` (seção `storage.js`). Campo novo em `data`: inclua em `defaultData` (seção `config.js`), em `loadData` e em `applyBackup` (seção `backup.js`, copia campo a campo), senão some ao restaurar backup.
7. **Sem `confirm()`/`alert()`** do navegador: use `askConfirm()`/`askAlert()` (seção `ui.js`). Também sem a lista nativa do `<select>`: o app abre a própria (`openSelectSheet`, seção `ui.js`); o CSS desliga o toque direto no `<select>` (`pointer-events:none`) e o toque é achado pela posição. Campo de escolha novo funciona sozinho, sem código extra.
8. **Comentários** em português, curtos, só sobre o que o bloco faz.
9. **Nunca** peça ao usuário para "limpar dados do site" (apaga os dados dele). Para atualizar: fechar e reabrir o app.
10. **Teste antes de entregar:** `node --test` (Node 18+, sem instalar nada) e, se possível, abra no navegador em 360–420 px e confira o console sem erros. Ao mudar uma regra de cálculo, atualize/crie o teste. O GitHub roda os testes a cada envio (✔/✖ em Actions).
11. **Ao terminar:** versão aumentada, este `README.md` atualizado se funcionalidades/regras/arquivos mudaram, e dizer ao usuário o que foi testado e qualquer diferença encontrada.

**Decisões que não devem ser refeitas sem perguntar**
- Nada de serviço pago; sincronização entre aparelhos não existe (usar Importar > backup).
- Valores continuam em reais com 2 casas (sem migrar para centavos inteiros).
- O PIN é só barreira de uso (sem criptografia dos dados).
- **Design (v32), estilo Apple:** cores do sistema iOS (azul `#007aff`, fundo cinza agrupado, cartões brancos; escuro = preto puro), fonte do sistema (`-apple-system`/Roboto), título grande, campos cinza arredondados, abas como controle segmentado no computador e **barra inferior translúcida no celular**, painéis como folhas que sobem de baixo, alertas centrais com botões divididos por linha fina. Todas as cores ficam nas variáveis do início do `app.css`; ícones das abas são SVG de traço (`currentColor`), não emoji. Mantenha esse visual em telas novas.
- Limite de 500 linhas por arquivo e o menor número de arquivos possível.

**Histórico resumido**
1. App base (Resumo por data de pagamento, lançamentos, cartões, divisão com reembolso, empréstimos, importação, backup, PWA).
2. Aba Regras reuniu categorias, pessoas, recorrentes e regras automáticas; categorias ordenadas por arrastar; atalhos de criar categoria/pessoa; caixas de confirmação próprias.
3. Gráficos, orçamento por categoria, recorrentes, relatórios CSV/PDF, modo demonstração, testes automáticos.
4. PIN, Verificar dados, limpeza de ponto flutuante, boas-vindas, acessibilidade.
5. Correção da importação (sinal de gasto x entrada pela maioria das linhas, separador `;` do CSV, tipo por linha, correção de importações antigas) e prévia no celular.
6. Versão passou a ser um selo visível no cabeçalho do HTML; service worker passou a revalidar sempre.
7. Scripts e estilos foram agrupados em um `app.js` e um `app.css`.
8. **v29 (reorganização):** `README.md`, `agenteof.md` e `regrasof.md` viraram um só `README.md`; o `app.js` (2.671 linhas) foi dividido em 7 arquivos de até 500 linhas (mesma ordem e mesmas seções); testes de versão e de caminhos viraram `estrutura.test.js`; removidos o arquivo vazio `download`, o `icon-maskable-512.png` e 3 funções sem uso (`transactionGross`, `splitTotal`, `reimbursedAmount`).
9. **v32:** redesenho visual no estilo Apple (só estilo; funcionalidades iguais). Ícone do app no cabeçalho, ícones SVG nas abas, cores da barra do navegador e `manifest.json` atualizados.
10. **v33:** forma "Parcelado" retirada (parcelas = recorrência no crédito; antigos viraram Crédito); formas de pagamento em ordem Pix, Dinheiro, Débito, Crédito; crédito sem campo de data (vencimento automático pelo fechamento); categorias com "Outros" por último e lista abrindo no topo; botão "Selecionar todos"; ajuste de espaçamento do cartão de boas-vindas.
11. **v34:** recorrência com campo "Todo dia" (antes o dia vinha só da data inicial e o app gravava dia 1); editar recorrente atualiza os já criados; card "Repetir mensalmente" também ao editar; divisão do gasto totalmente automática (sem "Dividir igualmente"); "Últimos lançamentos" com caixinhas e botão Excluir selecionados, também no fim da aba Lançamentos; removido o botão azul "Selecionar todos" (vale a caixinha do cabeçalho, que agora aparece no celular); `demo.js` passou para o `07-inicio.js` (o `06-extras.js` passaria de 500 linhas).
12. **v35:** planilha Excel do backup (uma aba por mês no formato da Planilha do mês + aba escondida de dados) e restauração por `.xlsx` ou `.json`; "Compartilhar" envia Excel + backup juntos; ao restaurar, o campo de arquivo só é limpo depois de ler o arquivo (no Android limpar antes podia impedir a leitura) e o aviso mostra o motivo do erro; arquivo novo `07-excel.js` (o antigo `07-inicio.js` virou `08-inicio.js`) e `excel.test.js`.

## 6. Funcionalidades

**Resumo** (aba inicial)
- 4 cards no topo (entradas, saídas previstas, gasto realmente seu, saldo previsto), clicáveis: abrem a lista de lançamentos do mês.
- **Planilha do mês**: despesas por categoria (valor cheio, na ordem escolhida), entradas e saldo; categorias podem ser arrastadas (segurar e arrastar).
- **Gráficos**: "Últimos 6 meses" (entradas x gasto seu x saldo, com paginação de um mês por vez; tocar numa barra seleciona o mês) e rosca com a distribuição das saídas do mês.
- **Orçamento do mês**: barra por categoria com limite (verde, atenção, estourado).
- Saídas pagas x previstas, fluxo de caixa, pendências de reembolso e empréstimos cedidos. Linhas dos painéis são clicáveis e abrem o lançamento destacado em Lançamentos (pendências de reembolso também; o botão de ação continua separado).
- Selo de versão do app no cabeçalho (`vNN`).

**Lançamentos**
- Gasto e entrada, com forma de pagamento (Pix, Dinheiro, Débito, Crédito, nessa ordem), cartão e **divisão do gasto entre pessoas** com controle de reembolso. **Não existe a forma "Parcelado"**: parcelas são feitas com "Repetir esta despesa mensalmente" (card que aparece em qualquer forma de pagamento). No Crédito o formulário pede só o cartão; o vencimento da fatura é calculado sozinho pelo fechamento do cartão (sem campo de data de pagamento).
- No formulário de gasto: atalhos "Criar categoria" e "Criar pessoa" sem sair do formulário; sem campo de observação.
- **Recorrência** nos formulários de gasto e entrada (**também ao editar**, exceto lançamento que já veio de uma recorrência): opção mensal com **"Todo dia"** (dia do mês, 1 a 31), "A partir de" e "Até" opcional. Os campos acompanham a data do lançamento até o usuário mexer neles. Ao repetir na edição, o próprio lançamento é a 1ª ocorrência (o mês dele não é criado de novo). Ao editar um recorrente na aba Regras, o app pergunta se atualiza também os já criados (do mês atual em diante).
- **Divisão automática**: o valor das partes se recalcula sozinho (mudar o valor total, adicionar/remover pessoas). Quem não foi mexido divide igualmente o que sobra; ao digitar o valor de uma pessoa ela fica fixa e as outras dividem o resto. Não existe botão "Dividir igualmente".
- Seleção em massa (a caixinha do cabeçalho da tabela marca todos que aparecem na lista; no celular o cabeçalho mostra só ela): definir/limpar pagamento previsto (só gastos), marcar como pago, excluir (com desfazer).
- Botões do cabeçalho e da aba: "Registrar gasto" e "Registrar entrada".

**Cartões**: fechamento, vencimento, limite e total da fatura.

**Regras** (uma aba só, menos poluição visual)
- **Categorias**: criar/editar/excluir, limite mensal opcional, ordem por arrastar (alça ⠿ arrasta na hora).
- **Pessoas**: quem participa das divisões.
- **Recorrentes**: modelos de aluguel, assinaturas, salário... (gasto: uma parte só, sua; não há divisão entre pessoas nem reembolso recorrentes; no Crédito serve para registrar parcelas). Pausar, retomar, editar, excluir.
- **Regras automáticas**: palavra na descrição sugere a categoria.

**Importar**
- Extrato/fatura **CSV ou OFX**: prévia com **tipo por linha** (Gasto / Entrada / Fatura), botão "Inverter gasto ↔ entrada em todas", cartão da fatura, linhas repetidas ignoradas.
- **Backup**: baixar a **planilha Excel** (`.xlsx`: uma aba por mês no mesmo formato da "Planilha do mês" + aba escondida "Dados do app" com todos os dados), baixar o backup `.json`, compartilhar os dois (menu do aparelho), copiar/colar e restaurar. "Restaurar de um arquivo" (e soltar o arquivo na área de Importar) aceita o `.xlsx` gerado pelo app (lê a aba "Dados do app"; funciona também se o Excel regravar o arquivo) ou o `.json`. Editar as abas dos meses no Excel não altera o que é restaurado: vale a aba "Dados do app".
- **Relatórios**: CSV do mês ou de tudo; imprimir/salvar PDF do Resumo.
- **Segurança**: bloqueio por **PIN** (4 a 8 números) e **Verificar dados** (acha e corrige inconsistências seguras).
- **Modo demonstração**: dados fictícios; os reais ficam guardados à parte e voltam ao sair.

**Tutorial**: explica cada tela; mostra os mesmos atalhos de boas-vindas (registrar gasto/entrada, ver demonstração).

**Geral**: instala no celular (PWA) e funciona sem internet; tema claro/escuro (padrão claro); cartão de boas-vindas quando o app está vazio; botão voltar do celular fecha painéis e caixas de confirmação antes de trocar de aba; caixas de confirmação próprias do app (nunca as do navegador); listas de escolha (`<select>`) abrem numa lista própria colada embaixo da tela (a lista nativa do celular saía da tela).

## 7. Formato dos dados (localStorage, chave `meu-controle-v2`)
```
data = {
  version: 2,
  transactions: [ ...lançamentos... ],
  people:  [{id, name}],                       // id "self" = o próprio usuário ("Você")
  cards:   [{id, name, limit, closing, due}],  // closing = dia do fechamento, due = dia do vencimento
  categories: ["Casa", "Alimentação", ...],    // lista de nomes
  rules:   [{id, keyword, category}],          // palavra na descrição -> categoria sugerida
  importLog:   [{id, file, date, count}],      // arquivos já importados
  activityLog: [{id, at, kind, text, detail, txId}],  // histórico de "Últimos lançamentos" (máx. 300; cada item tem caixinha para excluir do histórico, no Resumo e no fim da aba Lançamentos)
  lastBackupAt: número | null,
  budgets: {"Lazer": 300},                     // limite mensal por categoria (sem entrada = sem limite)
  recurring: [ ...modelos recorrentes... ],    // veja abaixo
  demoMode: true                               // SÓ existe durante o Modo demonstração
}

// Modelo recorrente
{ id, type:"expense|income", description, value, day:1-31, startMonth:"AAAA-MM", endMonth:""|"AAAA-MM",
  startDate:"AAAA-MM-DD", endDate:""|"AAAA-MM-DD",   // opcionais: limites exatos (modelos antigos só têm startMonth/endMonth e continuam valendo)
  method, cardId, category,      // method/cardId/category só para gasto
  active, generated:["AAAA-MM"], // meses já criados (nunca recria um mês, mesmo se o lançamento for excluído)
  createdAt }
// Os lançamentos criados por um modelo levam recurringId = id do modelo.

// Gasto (type "expense")
{ id, createdAt, type:"expense",
  date:"AAAA-MM-DD",            // data da compra
  description, notes, 
  value,                         // valor cheio (de uma parcela, se for compra em parcelas)
  method:"pix|cash|debit|credit",   // "installment" (antigo Parcelado) é convertido para "credit" ao carregar
  cardId,                        // "" se não for crédito
  paymentDate:"AAAA-MM-DD",      // quando será pago (é ESTA data que manda no Resumo)
  paymentStatus:"planned|paid",
  installments, installmentNo,   // total de parcelas e número desta (1 e 1 se não for parcela; só informativo, vem de importação ou de lançamentos antigos)
  splits:[{id, category, amount, ownerId, reimbursed}] }  // divisão por categoria/pessoa; soma = value

// Entrada (type "income")
{ id, createdAt, type:"income", date, description, value, notes,
  source:"normal|reimbursement",
  sourceCategory, linkedTransactionId, linkedSplitId }   // os 3 últimos só existem em reembolsos automáticos

// Pagamento de fatura importado (type "card_payment")
{ id, date, description, value, cardId, importKey }
```

## 8. Regras de negócio importantes
- O Resumo conta cada gasto pelo mês do PAGAMENTO PREVISTO (`paymentDate`), não pelo mês da compra. As entradas contam pela data da entrada.
- Saídas previstas = valor cheio dos gastos com pagamento no mês. Gasto realmente seu = só a parte do `ownerId:"self"`. Saldo previsto = Entradas − Gasto realmente seu.
- As porcentagens das barras (categoria, cartão e gasto realmente seu) são o valor dividido pelas Entradas do mês; sem entradas aparece "—".
- Pix, Débito e Dinheiro: pagamento na própria data da compra e já pago. Crédito: precisa de cartão; o vencimento é calculado por `nextCardPaymentDate` (compra a partir do dia de fechamento vai para a fatura seguinte; se o dia de vencimento é igual ou anterior ao do fechamento, vence no mês seguinte ao do fechamento); o status padrão é "previsto". Na edição, o vencimento já gravado só muda se a data da compra ou o cartão mudarem; para mudar a data de vários gastos use "Definir pagamento previsto" em Lançamentos.
- Parcelas: use "Repetir esta despesa mensalmente" (recorrente); cada mês vira um lançamento próprio, com vencimento calculado pelo fechamento do cartão. Lançamentos antigos de "Parcelado" viraram Crédito e mantêm número da parcela e vencimento.
- Divisão: a soma das partes precisa ser igual ao valor (o formulário recalcula sozinho; `recalcSplits` em `04-formulario.js`). A parte de outra pessoa fica "a receber" até `reimbursed:true`; ao marcar como recebido, o app cria uma entrada (`source:"reimbursement"`) ligada ao gasto.
- A categoria "Empréstimos cedidos" é especial: é dinheiro emprestado. O que volta aparece à parte e não entra no Saldo previsto como previsão.
- Resumo: os 4 cards do topo são clicáveis (abrem a lista de lançamentos). A "Planilha do mês" mostra despesas por categoria (valor cheio, na ordem da aba Categorias), entradas e saldo; o saldo dela usa valores cheios, por isso pode diferir do "Saldo previsto" do topo.
- Categorias: `data.categories` é uma lista de nomes na ordem escolhida pelo usuário (segurar e arrastar na aba Regras; a alça ⠿ arrasta na hora). Renomear uma categoria atualiza lançamentos, regras, recorrentes e o limite; excluir é bloqueado se ela estiver em uso. `categoriesV2` marca a migração única que juntou as categorias padrão e ordenou em ordem alfabética.
- Botão voltar do celular: cada aba e cada painel aberto ganham uma entrada no histórico (`history.pushState`, em `ui.js`); o evento `popstate` (em `main.js`) fecha o painel ou volta para a aba anterior.
- Celular (até 680px): tabelas de Lançamentos e de detalhes viram "cartões" via CSS (`data-label` nas células); as abas viram uma grade 3x2; o Fluxo de caixa começa recolhido.
- Orçamento: o gasto contado é só o que é seu (`ownerId:"self"`) na categoria, pelo mês do pagamento. Verde < 80%, atenção de 80% a 99%, estourado a partir de 100%. Limite vazio ou 0 = sem orçamento.
- Recorrentes: ao abrir o app (e ao voltar para ele) são criados os meses que faltam, do mês inicial até o mês seguinte ao atual (`RECURRING_HORIZON`). Gasto recorrente tem uma parte só, sua; crédito vence pelo fechamento do cartão (como no formulário); Pix/débito/dinheiro no futuro ficam "previsto". Mudar o modelo vale só para meses ainda não criados.
- Modo demonstração: `startDemo` guarda os dados reais em `meu-controle-v2-real` e carrega dados fictícios; `exitDemo` devolve os reais. Restaurar backup fica bloqueado durante a demonstração.
- Backup: `applyBackup` copia campo a campo; ao criar um campo novo em `data`, inclua-o lá e em `loadData`. A planilha Excel (`07-excel.js`) guarda o `data` inteiro como JSON na aba escondida "Dados do app" (em pedaços de 30 mil caracteres), então campo novo entra sozinho; as abas dos meses usam `sheetModel`, a mesma função da tela. O .xlsx é criado sem biblioteca (zip sem compactação) e lido com `DecompressionStream` (navegador atual).
- Importação de extrato (seção `importer.js`, arquivo `05-cadastros.js`): o sinal que aparece na MAIORIA das linhas (sem contar "pagamento recebido") é o gasto: no CSV do Nubank as compras são positivas; em OFX de cartão e extratos de conta são negativas; empate = positivo é gasto. Linhas do sentido contrário viram entrada/estorno; "pagamento recebido/payment" vira pagamento de fatura. A prévia deixa trocar o tipo de cada linha e inverter todas. O CSV usa o separador da primeira linha (`;`, tabulação ou `,`), pois bancos brasileiros usam `;` com vírgula decimal. Se um arquivo traz como gasto linhas que uma importação antiga gravou como entrada ("Crédito importado", `source:"imported-credit"`), o app pergunta se pode apagá-las (cópia em `localStorage`, chave `meu-controle-importacao-removida`) e importar de novo como gasto.
- PIN: a configuração fica na chave `meu-controle-lock` (fora dos dados e do backup: restaurar backup não troca o PIN). Um script no `<head>` põe a classe `locked` no `<html>` antes de a página aparecer. Depois de 5 erros seguidos há espera (30 s, 60 s...). Não há recuperação: "Esqueci o PIN" apaga os dados do aparelho. O PIN barra o uso do app, mas os dados no localStorage NÃO são criptografados.
- Valores: ao carregar, `cleanFloat` (`storage.js`) remove ruído de ponto flutuante (0,30000000000000004 -> 0,30); valores com 3+ casas de verdade são apontados por "Verificar dados".
- Aba Lançamentos: "Selecionar" marca gastos e entradas; definir/limpar pagamento previsto vale só para gastos; excluir vale para tudo e pode ser desfeito.
- Tema: padrão claro; a escolha fica em `localStorage` na chave `meu-controle-theme` (fora do backup).

## 9. Onde ficam os dados no aparelho (localStorage)
| Chave | O que guarda |
|---|---|
| `meu-controle-v2` | todos os dados do app (entram no backup) |
| `meu-controle-v2-real` | cópia dos dados reais enquanto o modo demonstração está ligado |
| `meu-controle-lock` | PIN (só o hash); fora do backup |
| `meu-controle-theme` | tema claro/escuro; fora do backup |
| `meu-controle-importacao-removida` | cópia de segurança das entradas apagadas na correção de importação |

## 10. Limites do app
- Os dados ficam só no aparelho (sem conta e sem sincronização entre aparelhos): para levar dados de um aparelho para outro, use Importar > backup. O app pede armazenamento persistente ao navegador.
- O PIN barra o uso do app, mas os dados guardados no navegador **não** são criptografados.
- Valores ficam em reais com duas casas (arredondados nos pontos críticos).
