# agenteof.md — Contexto do projeto para a próxima IA

Leia nesta ordem: `agententz.md` (como o usuário quer as respostas), este arquivo (contexto e regras de trabalho) e `regrasof.md` (funcionalidades, dados e regras de negócio). Se algo aqui contradizer o código, **confie no código** e avise o usuário.

## 1. O projeto
- **Meu Controle Financeiro**: app de finanças pessoais em HTML + CSS + JavaScript puros, dados no `localStorage`, PWA. Publicado de graça no **GitHub Pages**. Custo zero é requisito.
- O dono **não programa**, usa IAs gratuitas e edita pelo VS Code do GitHub (github.dev). Outra IA (no VS Code) também altera os arquivos: **leia sempre os arquivos reais antes de assumir** e mantenha estes documentos atualizados.
- Os dados são de uma pessoa real: nunca perca nem altere dados salvos sem migração.

## 2. Estado atual
- Versão do app: **v27** (selo no cabeçalho do `index.html`).
- Sem servidor: tudo roda no aparelho. Um **site com servidor** (login, assinatura Pro, sincronização na nuvem, painel admin) foi construído e testado, mas ficou **arquivado fora deste repositório** porque exige servidor com disco (não é gratuito). Só retome se o usuário pedir e aceitar o custo.
- Sem pendências conhecidas. Textos legais (Termos/Privacidade) ficam para depois, se um dia houver site público com contas.

## 3. Estrutura dos arquivos
Todos os arquivos usados pelo app ficam na raiz, sem subpastas:

```
index.html  manifest.json  sw.js  package.json
theme.css  base.css  components.css
utils.js  config.js  theme.js  calculations.js  storage.js  ui.js  dashboard.js
sheet-drag.js  transactions.js  cadastros.js  importer.js  backup.js  recorrentes.js
graficos.js  exportar.js  demo.js  bloqueio.js  integridade.js  main.js
icon-192.png  icon-512.png  icon-maskable-512.png
calculos.test.js  importacao.test.js  versao.test.js  caminhos.test.js
agententz.md  agenteof.md  regrasof.md
.github/workflows/testes.yml
```
`index.html`, `manifest.json` e `sw.js` ficam na raiz de propósito (o service worker precisa cobrir o site todo).

## 4. Onde mexer para...
| Quero mudar... | Arquivo |
|---|---|
| Uma cor do app | `theme.css` |
| Texto ou lugar de um card | `index.html` |
| Cabeçalho, abas, cards, botões, formulários | `base.css` |
| Painel, gráficos, impressão, celular (até 680 px) | `components.css` |
| Como um número do Resumo é calculado | `calculations.js` e `dashboard.js` |
| Formulário de gasto/entrada, aba Lançamentos | `transactions.js` |
| Cartões, pessoas, categorias, regras automáticas | `cadastros.js` |
| Recorrentes | `recorrentes.js` |
| Gráficos e orçamento | `graficos.js` (dados em `calculations.js`) |
| Relatórios CSV/PDF | `exportar.js` |
| Importar extratos CSV/OFX | `importer.js` |
| Backup | `backup.js` |
| PIN | `bloqueio.js` |
| Verificar dados | `integridade.js` |
| Modo demonstração e boas-vindas | `demo.js` |
| Salvar/carregar, migração de dados | `storage.js` |
| Painéis, caixa de confirmação, troca de aba | `ui.js` |
| Um botão que não faz nada | `main.js` (liga os botões e inicia o app) |
| Dinheiro, datas, ids | `utils.js` |
| Constantes e estado global | `config.js` |

## 5. Regras de trabalho
1. **Entrega:** só os arquivos que mudaram, cada um com o **código inteiro** e o **caminho completo** como título (ex.: `importer.js`). Pacote grande: `.zip` com a pasta pronta para arrastar ao GitHub. Se mover/apagar arquivos, liste os antigos a apagar.
2. **Versão:** a cada alteração em **qualquer** arquivo do app, aumente em 1 o selo `#appVersion` no cabeçalho do `index.html` e diga a nova versão. **Não** mexa no `sw.js` por isso: o app revalida na internet e usa o cache só sem conexão. Mexa no `sw.js` apenas se criar/remover arquivo (lista `FILES`) ou mudar o próprio service worker.
3. **Arquivo novo** (`.js`/`.css`): inclua no `index.html` (ordem importa; `main.js` por último) e na lista `FILES` do `sw.js`.
4. **Scripts clássicos e globais** (o HTML usa `onclick="..."`): sem módulos; **não repita** nomes de `const`/`let`/`function` entre arquivos.
5. **Dados:** formato novo exige migração em `loadData`/`normalizeTransaction` (`storage.js`). Campo novo em `data`: inclua em `defaultData` (`config.js`), em `loadData` e em `applyBackup` (`backup.js`, copia campo a campo), senão some ao restaurar backup.
6. **Sem `confirm()`/`alert()`** do navegador: use `askConfirm()`/`askAlert()` (`ui.js`).
7. **Comentários** em português, curtos, só sobre o que o bloco faz.
8. **Nunca** peça ao usuário para "limpar dados do site" (apaga os dados dele). Para atualizar: fechar e reabrir o app.
9. **Teste antes de entregar:** `node --test` (Node 18+, sem instalar nada) e, se possível, abra no navegador em 360–420 px e confira o console sem erros. Ao mudar uma regra de cálculo, atualize/crie o teste. O GitHub roda os testes a cada envio (✔/✖ em Actions).
10. **Ao terminar:** versão aumentada, `regrasof.md` e este arquivo atualizados se funcionalidades/regras/arquivos mudaram, e dizer ao usuário o que foi testado e qualquer diferença encontrada.

## 6. Histórico resumido
1. App base (Resumo por data de pagamento, lançamentos, cartões, divisão com reembolso, empréstimos, importação, backup, PWA).
2. Aba Regras reuniu categorias, pessoas, recorrentes e regras automáticas; categorias ordenadas por arrastar; atalhos de criar categoria/pessoa; caixas de confirmação próprias.
3. Gráficos, orçamento por categoria, recorrentes, relatórios CSV/PDF, modo demonstração, testes automáticos.
4. PIN, Verificar dados, limpeza de ponto flutuante, boas-vindas, acessibilidade.
5. Correção da importação (sinal de gasto x entrada pela maioria das linhas, separador `;` do CSV, tipo por linha, correção de importações antigas) e prévia no celular.
6. Versão passou a ser um selo visível no cabeçalho do HTML; service worker passou a revalidar sempre; projeto reorganizado em pastas.

## 7. Decisões que não devem ser refeitas sem perguntar
- Nada de serviço pago; sincronização entre aparelhos não existe (usar Importar > backup).
- Valores continuam em reais com 2 casas (sem migrar para centavos inteiros).
- O PIN é só barreira de uso (sem criptografia dos dados).
