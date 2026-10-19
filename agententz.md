# Regras do AgenteNtz.md Coding Agent

## 1. Perfil e Objetivo
- O usuário não sabe programar e utiliza IAs gratuitas.
- O objetivo é manter a máxima qualidade economizando o máximo de tokens, permitindo avançar o projeto sem estourar os limites da IA.
- Seja direto e responda de forma curta, sem textos teóricos ou introduções.

## 2. Formato de Entrega do Código (Para Copiar e Colar)
- Devolva apenas os arquivos que sofreram alterações.

## 3. Comentários Didáticos e Econômicos
- Todo código gerado deve conter comentários em português explicativos.
- Para economizar tokens, os comentários devem ser curtos, diretos e focados apenas na lógica principal (o que o bloco faz), evitando redundâncias ou explicações de linhas óbvias.

## 4. Controle de Versão Inteligente
- O cabeçalho do arquivo HTML principal deve possuir uma marcação discreta de versão (ex: `<!-- Versão 1 -->`).
- Atualize e incremente esse número de versão a cada modificação.

## 5. Como o usuário gosta de ser atendido (acrescentado com base no que foi aprendido)
- **Resultado primeiro, curto.** Sem teoria ou introdução. Se algo deu errado ou ficou diferente do combinado, diga logo e com clareza.
- **Seja honesto sobre limites:** diga o que foi testado e o que não foi; não prometa o que não pôde verificar.
- **Faça, não pergunte demais.** Quando ele diz "faça tudo", entregue o máximo que for favorável, completo e de uma vez (ele pode ficar sem acesso à IA). Pergunte só o indispensável, no máximo uma pergunta.
- **Configurações fora do código** (GitHub, hospedagem, contas): passo a passo numerado, cada clique, e "como saber que deu certo".
- **Aponte diferenças** entre documentos e arquivos reais sempre que encontrar; ele pede isso.

## 6. Entrega (mínimo de esforço)
- Arquivos alterados completos, com o **caminho** de cada um. Pacote grande: **.zip** com a pasta pronta para arrastar ao GitHub.
- Se a estrutura mudar, liste os arquivos antigos que devem ser apagados.
- Mostre a versão nova do app a cada alteração (selo no cabeçalho, ver item 4).
- Não perca trabalho já feito: se uma parte não será usada agora, guarde com instruções de como retomar.

## 7. Produto
- **Custo zero:** nada de serviço pago, hospedagem paga ou domínio.
- **Uso principal no celular:** confira o layout em 360–420 px; campos alinhados e do mesmo tamanho; sem poluição visual (junte telas parecidas); sem janelas do navegador (use as caixas do app); reordenar com segurar e arrastar, não com setas.
- **Os dados dele são reais:** nunca apague ou mude dados salvos sem migração; avise antes de qualquer mudança arriscada; nunca peça para "limpar dados do site".
- **Teste de verdade** antes de entregar (testes automáticos e navegador) e relate o resultado.
- Ele usa **mais de uma IA** (a do VS Code e outras): mantenha os documentos do projeto atualizados e leia os arquivos reais antes de assumir.

## 8. Esclarecimento sobre o item 4 (versão)
- No projeto atual a versão é um **selo pequeno e visível no cabeçalho do app** (`<span id="appVersion">vNN</span>` em `index.html`), no lugar do comentário `<!-- Versão N -->`. Continua discreto e é incrementado a cada modificação. O `sw.js` não carrega número de versão.
