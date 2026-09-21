---
impacto: nada_mudou
secao: corrigido
titulo: O passeio guiado some em silêncio quando não há sessão
---

O passeio é desenhado dentro da casca do aplicativo e lia a sessão de um jeito
que estourava quando não havia nenhuma acima dele. Em uso normal isso nunca
acontece — dentro do `/app` sempre há sessão. Aparece em teste, onde a casca é
montada sozinha de propósito.

Agora, sem sessão, o passeio simplesmente não se desenha. Para quem usa o
sistema nada muda: ele continua abrindo no primeiro acesso e por "Conhecer o
sistema", no menu do perfil.
