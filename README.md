# Meu Controle Financeiro

App de organização financeira em HTML + CSS + JavaScript puros: gastos, entradas, cartões, parcelas, divisão com reembolso, orçamento, gráficos e importação de extratos. Os dados ficam no aparelho (localStorage); instala no celular (PWA) e funciona sem internet. Publicado de graça no GitHub Pages.

## Arquivos
Todos os arquivos usados pelo app ficam na raiz do repositório, sem pastas intermediárias:

- Aplicação: index.html, manifest.json e sw.js.
- Estilos: theme.css, base.css e components.css.
- Scripts: arquivos .js da raiz.
- Ícones: icon-192.png, icon-512.png e icon-maskable-512.png.
- Testes: calculos.test.js, importacao.test.js, versao.test.js e caminhos.test.js.
- Instruções: agententz.md, agenteof.md e regrasof.md.
- Testes automáticos no GitHub: .github/workflows/testes.yml.

## Documentos
- [agententz.md](agententz.md) — como o usuário quer as respostas e as entregas.
- [agenteof.md](agenteof.md) — contexto do projeto e regras de trabalho para uma nova IA.
- [regrasof.md](regrasof.md) — funcionalidades, formato dos dados e regras de negócio.

## Testes
node --test (Node 18+, sem instalação) roda os testes da raiz. No GitHub, a aba Actions executa os testes a cada envio.

## Versão
O número da versão aparece no cabeçalho do app (selo vNN) e sobe 1 a cada alteração.
