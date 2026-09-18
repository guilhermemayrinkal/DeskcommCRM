---
impacto: nada_mudou
secao: alterado
titulo: As imagens e as atualizações passam a vir deste repositório
---

Esta instalação roda um fork do DeskcommCRM. Até aqui, o botão "Atualizar" e o
kit apontavam para as imagens e as tags do repositório original — e uma
atualização substituiria em silêncio o que este fork acrescenta.

Agora o namespace das imagens (`IMG_NS`), os padrões do `docker-compose`, o
exemplo de `.env`, os rótulos de origem dos Dockerfiles e os URLs de clone do
kit apontam para `github.com/guilhermemayrinkal/DeskcommCRM` e
`ghcr.io/guilhermemayrinkal`. O CI deste fork publica as três imagens a cada
tag `vX.Y.Z`; o `update.sh` passa a puxá-las daqui.

Para quem instalou antes desta versão: o clone da VPS precisa ter o `origin`
apontando para este repositório (`git remote set-url origin
https://github.com/guilhermemayrinkal/DeskcommCRM.git`) — sem isso o
`agent.sh` não enxerga as tags novas. Nada muda no comportamento do CRM.
