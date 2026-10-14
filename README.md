# Meu Controle Financeiro

App de organização financeira em HTML + CSS + JavaScript puro (sem instalar nada). Os dados ficam salvos no aparelho (localStorage) e o app pode ser instalado no celular (PWA). Todos os arquivos do app ficam na MESMA pasta (sem subpastas; a única exceção é `.github/workflows/`, usada pelos testes automáticos).

> **Sobre o "site com login, pagamentos e nuvem":** foi construído e testado, mas fica **guardado à parte** (pacote `meu-controle-site-arquivado`), porque precisa de um servidor sempre ligado com disco, o que não é gratuito. Este app, sozinho, é 100% gratuito: roda no aparelho (GitHub Pages) e não depende de servidor. Para levar os dados de um aparelho para outro, use Importar > backup (arquivo, compartilhar ou copiar/colar).

## Funcionalidades
- **Lançamentos** de gastos e entradas, com forma de pagamento, cartão, parcelamento e divisão do gasto entre pessoas (com controle de reembolso e empréstimos).
- **Resumo do mês** pela data de pagamento: cards, Planilha do mês, saídas pagas x previstas, fluxo de caixa, pendências de reembolso.
- **Gráficos** (SVG): últimos 6 meses (entradas x gasto seu x saldo) e rosca com a distribuição das saídas.
- **Orçamento por categoria**: limite mensal definido na categoria; barras verde / atenção (80%) / estourado (100%).
- **Recorrentes**: aluguel, assinaturas, salário... criados automaticamente todo mês.
- **Aba Regras**: Categorias (arrastar para ordenar), Pessoas, Recorrentes e Regras automáticas.
- **Importar** extrato CSV/OFX, **backup** (arquivo, compartilhar, copiar/colar), **relatórios** (CSV do mês/todos e PDF do Resumo pela impressão).
- **Segurança:** bloqueio por PIN (4 a 8 números, guardado só como hash PBKDF2 com sal) e **Verificar dados** (acha inconsistências e corrige o que é seguro).
- **Boas-vindas** na primeira vez (app vazio) e **modo demonstração** com dados fictícios (os dados reais ficam guardados à parte e voltam ao sair).
- PWA (instala no celular, funciona sem internet), tema claro/escuro, botão voltar do celular fecha painéis e caixas de confirmação.

## Testes automáticos
`node --test` (Node 18+; não precisa instalar nada) roda `calculos.test.js`, que carrega os arquivos do app num ambiente isolado e testa datas, divisão/reembolso, vencimento do crédito, séries mensais, orçamentos, recorrentes, CSV, modo demonstração, PIN e verificação de dados. No GitHub, `.github/workflows/testes.yml` roda os testes a cada alteração enviada (✔ verde / ✖ vermelho). Ao mudar uma regra de cálculo, atualize ou crie o teste correspondente.

## Regras para a IA que for analisar ou alterar este projeto
1. Responda em português e de forma curta.
2. Devolva SOMENTE os arquivos que mudaram, cada um com o código INTEIRO, em blocos separados e com o nome do arquivo como título. O usuário cola cada um direto no VS Code do GitHub.
3. Todo trecho de código tem um comentário em português dizendo O QUE ele faz. Mantenha esse padrão nos trechos novos e atualize o comentário se o comportamento mudar.
4. São scripts clássicos, sem módulos: as funções são globais (o HTML usa `onclick="..."`) e a ordem de carregamento no `index.html` importa. `main.js` é sempre o último.
5. Os dados são de uma pessoa real, guardados no aparelho: nunca mude o formato salvo sem uma migração em `loadData` / `normalizeTransaction` (`storage.js`).
6. Ao alterar qualquer arquivo do app, aumente a versão do cache em `sw.js` (`meu-controle-v18` -> `v19`). Se criar um arquivo novo, inclua-o na lista `FILES` do `sw.js` e no `index.html`.
7. Antes de entregar, confira se a mudança respeita as "Regras de negócio" abaixo e rode `node --test`.
8. Não use `confirm()`/`alert()` do navegador: use `askConfirm()` / `askAlert()` (`ui.js`), que respeitam o botão voltar do celular.

## Arquivos
- `index.html` — estrutura das telas (abas, cards, tabelas, painel)
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — instalação no celular e funcionamento sem internet
- `theme.css` — cores dos temas claro e escuro (comece aqui para mudar uma cor)
- `base.css` — cabeçalho, abas, cards, botões, formulários, tabelas, barras
- `components.css` — painel, caixa de confirmação, prévia de parcelas, Resumo, gráficos, impressão, efeito de elevação, ajustes para celular
- `utils.js` — dinheiro, datas, ids
- `config.js` — constantes e estado global (mês visto, seleção, dados)
- `theme.js` — tema claro/escuro (padrão: claro)
- `calculations.js` — cálculos: entradas, gasto realmente seu, empréstimos, vencimentos, séries mensais, totais por categoria e orçamentos
- `storage.js` — salvar/carregar (localStorage, com aviso se não couber), armazenamento persistente e histórico de atividades
- `ui.js` — aviso rápido, painel (modal), caixa de confirmação (`askConfirm`/`askAlert`), troca de aba, mês visto, redesenho geral
- `dashboard.js` — aba Resumo (cards do topo, Planilha do mês, painéis de detalhe)
- `sheet-drag.js` — arrastar categorias (segurar e arrastar) na Planilha do mês
- `transactions.js` — aba Lançamentos, seleção em massa e formulário de gasto/entrada
- `cadastros.js` — Cartões, Pessoas, Categorias (com limite mensal e arrastar para ordenar) e Regras automáticas
- `recorrentes.js` — lançamentos recorrentes (modelos, geração mensal, lista e formulário)
- `graficos.js` — gráficos SVG e barras de orçamento do Resumo
- `exportar.js` — CSV e impressão/PDF do Resumo
- `demo.js` — modo demonstração (dados fictícios) e cartão de boas-vindas
- `bloqueio.js` — bloqueio por PIN (tela de bloqueio, hash, ativar/alterar/desativar)
- `integridade.js` — "Verificar dados": detecção e correção segura de inconsistências
- `importer.js` — leitura de CSV/OFX
- `backup.js` — baixar, compartilhar e restaurar backup
- `main.js` — liga os botões aos comportamentos e inicia o app
- `calculos.test.js`, `package.json`, `.github/workflows/testes.yml` — testes automáticos (não fazem parte do app)

## Onde mexer para...
| Quero mudar... | Arquivo |
|---|---|
| Uma cor do app | `theme.css` |
| Texto ou lugar de um card | `index.html` |
| Como um número do Resumo é calculado | `calculations.js` e `dashboard.js` |
| O formulário de gasto/entrada | `transactions.js` |
| Cartões, pessoas, categorias, regras | `cadastros.js` |
| Recorrentes | `recorrentes.js` |
| Gráficos e orçamento | `graficos.js` (dados em `calculations.js`) |
| Relatórios CSV/PDF | `exportar.js` |
| Como o app lê extratos | `importer.js` |
| Um botão que não faz nada | `main.js` (é onde os botões são ligados) |

## Formato dos dados (localStorage, chave `meu-controle-v2`)
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

## Regras de negócio importantes
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
- PIN: a configuração fica na chave `meu-controle-lock` (fora dos dados e do backup: restaurar backup não troca o PIN). Um script no `<head>` põe a classe `locked` no `<html>` antes de a página aparecer. Depois de 5 erros seguidos há espera (30 s, 60 s...). Não há recuperação: "Esqueci o PIN" apaga os dados do aparelho. O PIN barra o uso do app, mas os dados no localStorage NÃO são criptografados.
- Valores: ao carregar, `cleanFloat` (`storage.js`) remove ruído de ponto flutuante (0,30000000000000004 -> 0,30); valores com 3+ casas de verdade são apontados por "Verificar dados".
- Aba Lançamentos: "Selecionar" marca gastos e entradas; definir/limpar pagamento previsto vale só para gastos; excluir vale para tudo e pode ser desfeito.
- Tema: padrão claro; a escolha fica em `localStorage` na chave `meu-controle-theme` (fora do backup).

## Limitações conhecidas / ideias futuras
- Os dados ficam só no aparelho (sem conta, sem sincronização entre aparelhos): o backup é o caminho para levar os dados. O app pede armazenamento persistente ao navegador. Há bloqueio por PIN, mas sem criptografia dos dados guardados.
- Valores são guardados em reais com duas casas (arredondados nos pontos críticos, como parcelas); migrar para centavos inteiros exigiria uma migração dos dados salvos.
- Ideias: criptografar os dados com uma chave derivada do PIN, biometria (WebAuthn), sincronização (ex.: Supabase/Firebase — exige criar uma conta no serviço), metas de economia, comparação entre meses.
