# regrasof.md — Regras e funcionalidades do app

> App **Meu Controle Financeiro** (HTML + CSS + JavaScript puros, dados no aparelho, PWA). Os arquivos `.js` ficam em `js/` e os `.css` em `css/`. Este arquivo descreve **o que o app faz e as regras que ele segue**. Para saber como trabalhar no código, veja `agenteof.md`.

## 1. Funcionalidades

**Resumo** (aba inicial)
- 4 cards no topo (entradas, saídas previstas, gasto realmente seu, saldo previsto), clicáveis: abrem a lista de lançamentos do mês.
- **Planilha do mês**: despesas por categoria (valor cheio, na ordem escolhida), entradas e saldo; categorias podem ser arrastadas (segurar e arrastar).
- **Gráficos**: "Últimos 6 meses" (entradas x gasto seu x saldo, com paginação de um mês por vez; tocar numa barra seleciona o mês) e rosca com a distribuição das saídas do mês.
- **Orçamento do mês**: barra por categoria com limite (verde, atenção, estourado).
- Saídas pagas x previstas, fluxo de caixa, pendências de reembolso e empréstimos cedidos. Linhas dos painéis são clicáveis e abrem o lançamento destacado em Lançamentos (pendências de reembolso também; o botão de ação continua separado).
- Selo de versão do app no cabeçalho (`vNN`).

**Lançamentos**
- Gasto e entrada, com forma de pagamento (Pix, débito, dinheiro, crédito, parcelado), cartão, parcelamento e **divisão do gasto entre pessoas** com controle de reembolso.
- No formulário de gasto: atalhos "Criar categoria" e "Criar pessoa" sem sair do formulário; sem campo de observação.
- **Recorrência** nos formulários de gasto e entrada: opção mensal com data inicial e final opcionais (a data inicial acompanha a data do lançamento até o usuário editá-la).
- Seleção em massa: definir/limpar pagamento previsto (só gastos), marcar como pago, excluir (com desfazer).
- Botões do cabeçalho e da aba: "Registrar gasto" e "Registrar entrada".

**Cartões**: fechamento, vencimento, limite e total da fatura.

**Regras** (uma aba só, menos poluição visual)
- **Categorias**: criar/editar/excluir, limite mensal opcional, ordem por arrastar (alça ⠿ arrasta na hora).
- **Pessoas**: quem participa das divisões.
- **Recorrentes**: modelos de aluguel, assinaturas, salário... (gasto: uma parte só, sua; não há parcelas, divisão entre pessoas ou reembolso recorrentes). Pausar, retomar, editar, excluir.
- **Regras automáticas**: palavra na descrição sugere a categoria.

**Importar**
- Extrato/fatura **CSV ou OFX**: prévia com **tipo por linha** (Gasto / Entrada / Fatura), botão "Inverter gasto ↔ entrada em todas", cartão da fatura, linhas repetidas ignoradas.
- **Backup**: baixar arquivo, compartilhar, copiar/colar e restaurar.
- **Relatórios**: CSV do mês ou de tudo; imprimir/salvar PDF do Resumo.
- **Segurança**: bloqueio por **PIN** (4 a 8 números) e **Verificar dados** (acha e corrige inconsistências seguras).
- **Modo demonstração**: dados fictícios; os reais ficam guardados à parte e voltam ao sair.

**Tutorial**: explica cada tela; mostra os mesmos atalhos de boas-vindas (registrar gasto/entrada, ver demonstração).

**Geral**: instala no celular (PWA) e funciona sem internet; tema claro/escuro (padrão claro); cartão de boas-vindas quando o app está vazio; botão voltar do celular fecha painéis e caixas de confirmação antes de trocar de aba; caixas de confirmação próprias do app (nunca as do navegador).

## 2. Formato dos dados (localStorage, chave `meu-controle-v2`)
```
data = {
  version: 2,
  transactions: [ ...lançamentos... ],
  people:  [{id, name}],                       // id "self" = o próprio usuário ("Você")
  cards:   [{id, name, limit, closing, due}],  // closing = dia do fechamento, due = dia do vencimento
  categories: ["Casa", "Alimentação", ...],    // lista de nomes
  rules:   [{id, keyword, category}],          // palavra na descrição -> categoria sugerida
  importLog:   [{id, file, date, count}],      // arquivos já importados
  activityLog: [{id, at, kind, text, detail, txId}],  // histórico de "Últimos lançamentos" (máx. 300)
  lastBackupAt: número | null,
  budgets: {"Lazer": 300},                     // limite mensal por categoria (sem entrada = sem limite)
  recurring: [ ...modelos recorrentes... ],    // veja abaixo
  demoMode: true                               // SÓ existe durante o Modo demonstração
}

// Modelo recorrente
{ id, type:"expense|income", description, value, day:1-31, startMonth:"AAAA-MM", endMonth:""|"AAAA-MM",
  startDate:"AAAA-MM-DD", endDate:""|"AAAA-MM-DD",   // opcionais: limites exatos (modelos antigos só têm startMonth/endMonth e continuam valendo)
  method, cardId, category,      // method/cardId/category só para gasto (sem parcelado)
  active, generated:["AAAA-MM"], // meses já criados (nunca recria um mês, mesmo se o lançamento for excluído)
  createdAt }
// Os lançamentos criados por um modelo levam recurringId = id do modelo.

// Gasto (type "expense")
{ id, createdAt, type:"expense",
  date:"AAAA-MM-DD",            // data da compra
  description, notes, 
  value,                         // valor cheio (de uma parcela, se for parcelado)
  method:"pix|debit|cash|credit|installment",
  cardId,                        // "" se não for crédito/parcelado
  paymentDate:"AAAA-MM-DD",      // quando será pago (é ESTA data que manda no Resumo)
  paymentStatus:"planned|paid",
  installments, installmentNo,   // total de parcelas e número desta (1 e 1 se não parcelado)
  splits:[{id, category, amount, ownerId, reimbursed}] }  // divisão por categoria/pessoa; soma = value

// Entrada (type "income")
{ id, createdAt, type:"income", date, description, value, notes,
  source:"normal|reimbursement",
  sourceCategory, linkedTransactionId, linkedSplitId }   // os 3 últimos só existem em reembolsos automáticos

// Pagamento de fatura importado (type "card_payment")
{ id, date, description, value, cardId, importKey }
```

## 3. Regras de negócio importantes
- O Resumo conta cada gasto pelo mês do PAGAMENTO PREVISTO (`paymentDate`), não pelo mês da compra. As entradas contam pela data da entrada.
- Saídas previstas = valor cheio dos gastos com pagamento no mês. Gasto realmente seu = só a parte do `ownerId:"self"`. Saldo previsto = Entradas − Gasto realmente seu.
- As porcentagens das barras (categoria, cartão e gasto realmente seu) são o valor dividido pelas Entradas do mês; sem entradas aparece "—".
- Pix, Débito e Dinheiro: pagamento na própria data da compra e já pago. Crédito e Parcelado: precisam de cartão; o vencimento sugerido é o dia `due` do cartão no mês seguinte à compra; o status padrão é "previsto".
- Parcelado: cada parcela é um lançamento próprio. O total é dividido pelo número de parcelas (a última leva os centavos que sobrarem) e a data da compra e do pagamento avançam um mês por parcela.
- Divisão: a soma das partes precisa ser igual ao valor. A parte de outra pessoa fica "a receber" até `reimbursed:true`; ao marcar como recebido, o app cria uma entrada (`source:"reimbursement"`) ligada ao gasto.
- A categoria "Empréstimos cedidos" é especial: é dinheiro emprestado. O que volta aparece à parte e não entra no Saldo previsto como previsão.
- Resumo: os 4 cards do topo são clicáveis (abrem a lista de lançamentos). A "Planilha do mês" mostra despesas por categoria (valor cheio, na ordem da aba Categorias), entradas e saldo; o saldo dela usa valores cheios, por isso pode diferir do "Saldo previsto" do topo.
- Categorias: `data.categories` é uma lista de nomes na ordem escolhida pelo usuário (segurar e arrastar na aba Regras; a alça ⠿ arrasta na hora). Renomear uma categoria atualiza lançamentos, regras, recorrentes e o limite; excluir é bloqueado se ela estiver em uso. `categoriesV2` marca a migração única que juntou as categorias padrão e ordenou em ordem alfabética.
- Botão voltar do celular: cada aba e cada painel aberto ganham uma entrada no histórico (`history.pushState`, em `ui.js`); o evento `popstate` (em `main.js`) fecha o painel ou volta para a aba anterior.
- Celular (até 680px): tabelas de Lançamentos e de detalhes viram "cartões" via CSS (`data-label` nas células); as abas viram uma grade 3x2; o Fluxo de caixa começa recolhido.
- Orçamento: o gasto contado é só o que é seu (`ownerId:"self"`) na categoria, pelo mês do pagamento. Verde < 80%, atenção de 80% a 99%, estourado a partir de 100%. Limite vazio ou 0 = sem orçamento.
- Recorrentes: ao abrir o app (e ao voltar para ele) são criados os meses que faltam, do mês inicial até o mês seguinte ao atual (`RECURRING_HORIZON`). Gasto recorrente tem uma parte só, sua; crédito vence no mês seguinte (como no formulário); Pix/débito/dinheiro no futuro ficam "previsto". Mudar o modelo vale só para meses ainda não criados.
- Modo demonstração: `startDemo` guarda os dados reais em `meu-controle-v2-real` e carrega dados fictícios; `exitDemo` devolve os reais. Restaurar backup fica bloqueado durante a demonstração.
- Backup: `applyBackup` copia campo a campo; ao criar um campo novo em `data`, inclua-o lá e em `loadData`.
- Importação de extrato (`importer.js`): o sinal que aparece na MAIORIA das linhas (sem contar "pagamento recebido") é o gasto: no CSV do Nubank as compras são positivas; em OFX de cartão e extratos de conta são negativas; empate = positivo é gasto. Linhas do sentido contrário viram entrada/estorno; "pagamento recebido/payment" vira pagamento de fatura. A prévia deixa trocar o tipo de cada linha e inverter todas. O CSV usa o separador da primeira linha (`;`, tabulação ou `,`), pois bancos brasileiros usam `;` com vírgula decimal. Se um arquivo traz como gasto linhas que uma importação antiga gravou como entrada ("Crédito importado", `source:"imported-credit"`), o app pergunta se pode apagá-las (cópia em `localStorage`, chave `meu-controle-importacao-removida`) e importar de novo como gasto.
- PIN: a configuração fica na chave `meu-controle-lock` (fora dos dados e do backup: restaurar backup não troca o PIN). Um script no `<head>` põe a classe `locked` no `<html>` antes de a página aparecer. Depois de 5 erros seguidos há espera (30 s, 60 s...). Não há recuperação: "Esqueci o PIN" apaga os dados do aparelho. O PIN barra o uso do app, mas os dados no localStorage NÃO são criptografados.
- Valores: ao carregar, `cleanFloat` (`storage.js`) remove ruído de ponto flutuante (0,30000000000000004 -> 0,30); valores com 3+ casas de verdade são apontados por "Verificar dados".
- Aba Lançamentos: "Selecionar" marca gastos e entradas; definir/limpar pagamento previsto vale só para gastos; excluir vale para tudo e pode ser desfeito.
- Tema: padrão claro; a escolha fica em `localStorage` na chave `meu-controle-theme` (fora do backup).

## 4. Onde ficam os dados no aparelho (localStorage)
| Chave | O que guarda |
|---|---|
| `meu-controle-v2` | todos os dados do app (entram no backup) |
| `meu-controle-v2-real` | cópia dos dados reais enquanto o modo demonstração está ligado |
| `meu-controle-lock` | PIN (só o hash); fora do backup |
| `meu-controle-theme` | tema claro/escuro; fora do backup |
| `meu-controle-importacao-removida` | cópia de segurança das entradas apagadas na correção de importação |

## 5. Limites do app
- Os dados ficam só no aparelho (sem conta e sem sincronização entre aparelhos): para levar dados de um aparelho para outro, use Importar > backup. O app pede armazenamento persistente ao navegador.
- O PIN barra o uso do app, mas os dados guardados no navegador **não** são criptografados.
- Valores ficam em reais com duas casas (arredondados nos pontos críticos, como parcelas).
