# Meu Controle Financeiro

App de organização financeira em HTML + CSS + JavaScript puros: gastos, entradas, cartões, parcelas, divisão com reembolso, orçamento, gráficos e importação de extratos. Os dados ficam no aparelho (localStorage); instala no celular (PWA) e funciona sem internet. Publicado de graça no GitHub Pages.

## Estrutura
```
index.html  manifest.json  sw.js  package.json  .nojekyll
css/     estilos (theme, base, components)
js/      código do app (um arquivo por assunto)
icons/   ícones do app
tests/   testes automáticos
docs/    agententz.md · agenteof.md · regrasof.md
.github/workflows/testes.yml
```

## Documentos
- `docs/agententz.md` — como o usuário quer as respostas e as entregas.
- `docs/agenteof.md` — contexto do projeto e regras de trabalho para uma nova IA.
- `docs/regrasof.md` — funcionalidades, formato dos dados e regras de negócio.

## Testes
`node --test` (Node 18+, não precisa instalar nada) roda os testes de `tests/`. No GitHub, a aba **Actions** mostra ✔ verde ou ✖ vermelho a cada envio.

## Versão
O número da versão aparece no cabeçalho do app (selo `vNN`, no `index.html`) e sobe 1 a cada alteração.
