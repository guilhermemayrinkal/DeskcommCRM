---
impacto: nada_mudou
secao: corrigido
titulo: O robô de sincronização não morre mais sem conseguir avisar
---

Quando ele parava por conflito, a tentativa de abrir o aviso podia falhar — e
falhava, porque este repositório está com as issues desabilitadas. O robô morria
ali, sem publicar nada e sem dizer por quê: sete execuções seguidas falharam em
silêncio, e quem percebeu foi a pessoa, notando que a versão nova não aparecia
na tela.

Agora o aviso sai num passo só, no fim, e o resumo da execução sempre o recebe —
ele não depende de permissão nenhuma. Se a issue não puder ser criada, o robô
reprova de propósito: falha de execução agendada é a única coisa que o GitHub
avisa por e-mail, e um robô mudo é pior que um vermelho.
