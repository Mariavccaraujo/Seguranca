# Gestor+ (versão 100% GitHub Pages, sem servidor)

Esse app agora funciona **inteiramente dentro do navegador**, sem precisar de nenhum servidor rodando por trás. Os dados (clientes, pedidos, agenda, etc.) ficam salvos no **armazenamento local do navegador** (`localStorage`), no aparelho onde você está usando o site.

Isso significa: dá pra publicar direto no **GitHub Pages**, de graça, sem configurar mais nada.

## O que importa aqui

```
public/index.html   -> o app inteiro (HTML + CSS + JS + dados), é só isso que precisa ir pro ar
```

Os arquivos `server.js`, `schema.sql`, `package.json` e a pasta `data/` são de uma versão anterior que usava um servidor Node.js — foram deixados aqui só de referência, mas **você não precisa deles pra publicar no GitHub Pages**.

## Publicando no GitHub Pages

1. No seu repositório do GitHub (o que já existe, `anderson`), coloque o arquivo `public/index.html` na **raiz do repositório** e renomeie para `index.html` (ou configure o GitHub Pages pra servir a partir da pasta `public`, em Settings → Pages → Branch → escolher a pasta).
2. Vá em **Settings → Pages** no repositório, confirme que está publicando a partir da branch e pasta certas.
3. Acesse `mariavccaraujo.github.io/anderson/` — pronto, o app carrega e já funciona, incluindo salvar clientes, pedidos, etc.

## Importante: onde os dados ficam salvos

- Os dados ficam guardados **só no navegador que você usou pra cadastrar**. Se você abrir o mesmo link em outro celular ou computador, ele começa vazio (com os dados de exemplo iniciais) — não é uma nuvem compartilhada entre aparelhos.
- Se você limpar os dados de navegação / cache do navegador, ou usar aba anônima, os dados somem.
- Pra ter um "backup", dá pra exportar os dados eventualmente (me avisa se quiser esse recurso).
- Se um dia você precisar que os dados fiquem **sincronizados entre vários aparelhos/pessoas**, aí sim vai ser necessário algum tipo de banco online — é só falar comigo que eu adapto.

## Zerar os dados

Abra o Console do navegador (F12) na página do app e rode:
```js
localStorage.clear()
```
Depois recarregue a página — ele volta pros dados de exemplo iniciais.
