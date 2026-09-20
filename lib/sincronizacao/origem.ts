/**
 * O que a sincronização com o repositório de origem decide sozinha.
 *
 * Esta instalação roda um fork: o código de quem escreveu o sistema continua
 * evoluindo lá, e o que acrescentamos aqui não existe nas versões dele. Juntar
 * as duas coisas à mão a cada versão é trabalho que ninguém lembra de fazer —
 * e enquanto não se faz, a tela de atualização fica muda.
 *
 * O trabalho de git (buscar, juntar, empurrar) é do workflow; o que mora aqui
 * são as três decisões de TEXTO que ele não pode chutar, cada uma com o defeito
 * que ela evita:
 *
 *  1. `resolverConflitoDoChangelog` — o merge do CHANGELOG conflita SEMPRE, e
 *     sempre da mesma forma: as duas versões mais novas (a nossa e a dele)
 *     disputam o topo. A resolução é determinística, então não há razão para
 *     acordar uma pessoa por causa dela.
 *
 *  2. `impactoDaVersaoDeOrigem` — a doutrina de versionamento (docs/doctrine)
 *     pede o EFEITO, não o número. Uma versão de origem que só corrige coisas
 *     não é capacidade nova aqui.
 *
 *  3. `motivoParaOlhoHumano` — o único caso em que publicar sozinho seria
 *     irresponsável: quando a versão de origem pede ação de quem hospeda. Aí o
 *     robô para e chama gente, em vez de entregar ao parque instalado um aviso
 *     que ninguém leu.
 *
 * Nada aqui toca disco nem rede: recebe texto, devolve texto. É o que permite
 * prová-lo no teste ao lado sem montar um repositório git de mentira.
 */

/** Os três efeitos que um fragmento de `.changes/` pode declarar. */
export type Impacto = "nada_mudou" | "capacidade_nova" | "exige_acao";

const ABRE = "<<<<<<<";
const MEIO = "=======";
const FECHA = ">>>>>>>";

/** `[1.35.0]: https://…` — a linha de referência do rodapé do CHANGELOG. */
const LINHA_DE_REFERENCIA = /^\[([^\]]+)\]:\s/;

/**
 * Desfaz os conflitos do CHANGELOG mantendo OS DOIS LADOS, o nosso primeiro.
 *
 * Por que os dois: o arquivo é uma pilha de seções em ordem decrescente de
 * versão, e a nossa é sempre maior que a de origem (a linha do fork começa
 * acima da dela). Concatenar nessa ordem já produz a ordenação certa, sem
 * precisar comparar versão nenhuma.
 *
 * Por que o rodapé é caso à parte: lá as duas pontas definem a MESMA chave
 * (`[Não lançado]`), e markdown com a chave repetida resolve pela primeira —
 * que precisa ser a nossa, apontando para o nosso repositório. Manter as duas
 * deixaria um link morto para o repositório de origem no rodapé, que é o tipo
 * de sujeira que ninguém vê até clicar.
 *
 * Um conflito que não seja do CHANGELOG nunca chega aqui: o workflow só chama
 * esta função depois de conferir que o único arquivo em conflito é ele.
 */
export function resolverConflitoDoChangelog(texto: string): string {
  const saida: string[] = [];
  let nosso: string[] | null = null;
  let deles: string[] | null = null;

  for (const linha of texto.split("\n")) {
    if (linha.startsWith(ABRE)) {
      nosso = [];
      deles = null;
      continue;
    }
    if (nosso !== null && deles === null && linha.startsWith(MEIO)) {
      deles = [];
      continue;
    }
    if (deles !== null && linha.startsWith(FECHA)) {
      saida.push(...nosso!, ...deles);
      nosso = null;
      deles = null;
      continue;
    }
    if (deles !== null) deles.push(linha);
    else if (nosso !== null) nosso.push(linha);
    else saida.push(linha);
  }

  // Conflito aberto que nunca fechou seria um arquivo truncado. Devolver o
  // texto pela metade daria um CHANGELOG plausível e errado; falhar aqui custa
  // uma execução do robô e nada mais.
  if (nosso !== null) {
    throw new Error("conflito sem fechamento no CHANGELOG — o merge não terminou como esperado");
  }

  const vistas = new Set<string>();
  return saida
    .filter((linha) => {
      const m = LINHA_DE_REFERENCIA.exec(linha);
      if (!m) return true;
      if (vistas.has(m[1]!)) return false;
      vistas.add(m[1]!);
      return true;
    })
    .join("\n");
}

/** `1.35.0` → `[1, 35, 0]`; qualquer outra forma devolve `null`. */
function partes(versao: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(versao.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * O efeito, aqui, da distância entre duas versões de origem.
 *
 * Só `patch` vira `nada_mudou`: correção lá é correção aqui. Qualquer coisa
 * acima disso é capacidade nova para quem usa — inclusive um salto de major
 * dele, que não vira major nosso: `exige_acao` é reservado para quando ALGUÉM
 * TEM DE FAZER ALGO, e quem decide isso é `motivoParaOlhoHumano`, não a
 * aritmética do número.
 */
export function impactoDaVersaoDeOrigem(anterior: string | null, nova: string): Impacto {
  const a = anterior ? partes(anterior) : null;
  const n = partes(nova);
  if (!a || !n) return "capacidade_nova";
  const soPatch = a[0] === n[0] && a[1] === n[1];
  return soPatch ? "nada_mudou" : "capacidade_nova";
}

/**
 * Extrai o corpo de uma versão do CHANGELOG — da linha `## [X.Y.Z]` até a
 * próxima `## [`. Devolve `null` quando a versão não está lá.
 */
export function secaoDaVersao(changelog: string, versao: string): string | null {
  const alvo = versao.replace(/^v/, "");
  const linhas = changelog.split("\n");
  const inicio = linhas.findIndex((l) => l.startsWith(`## [${alvo}]`));
  if (inicio === -1) return null;
  const resto = linhas.slice(inicio + 1);
  const fim = resto.findIndex((l) => l.startsWith("## ["));
  return (fim === -1 ? resto : resto.slice(0, fim)).join("\n").trim();
}

/**
 * O motivo para NÃO publicar sozinho, ou `null` quando é seguro seguir.
 *
 * A régua é o bloco que a doutrina de versionamento reserva para isso: uma
 * versão que traz `Requer atenção` está dizendo que quem hospeda precisa fazer
 * algo. Empacotá-la numa versão nossa e entregá-la ao parque instalado sem
 * ninguém ter lido o aviso é exatamente o acidente que aquele bloco existe para
 * evitar — então o robô para, abre um aviso e espera gente.
 *
 * Seção ausente também para: publicar uma versão sem saber o que ela muda seria
 * assinar embaixo de conteúdo que não se leu.
 */
export function motivoParaOlhoHumano(secao: string | null): string | null {
  if (secao === null) {
    return "não achei a seção desta versão no CHANGELOG depois de juntar — sem ela, não dá para saber o que está sendo publicado";
  }
  if (/requer aten[çc][ãa]o/i.test(secao)) {
    return "a versão de origem traz um bloco **Requer atenção**: alguém precisa ler o que ela pede antes de isso chegar a quem hospeda";
  }
  return null;
}

/** O fragmento de `.changes/` que embrulha uma versão de origem. */
export interface FragmentoDeSincronizacao {
  arquivo: string;
  conteudo: string;
}

/**
 * Escreve o fragmento que o corte de versão vai consumir.
 *
 * O corpo NÃO repete o que a versão de origem mudou: essa lista já está no
 * CHANGELOG, escrita por quem fez as mudanças, e uma segunda redação divergiria
 * dela na primeira vez que alguém mexesse numa das duas. O fragmento diz de
 * onde a versão veio e aponta para lá.
 */
export function fragmentoDeSincronizacao(
  versaoDeOrigem: string,
  impacto: Impacto,
): FragmentoDeSincronizacao {
  const versao = versaoDeOrigem.replace(/^v/, "");
  return {
    // Os pontos da versão viram traços: `fragmentos-de-release.test.ts` cobra
    // kebab-case puro no nome do arquivo (`/^[a-z0-9][a-z0-9-]*\.md$/`), e um
    // `1.40.0` no meio do nome reprova o corte da versão inteira.
    arquivo: `versao-de-origem-${versao.replace(/\./g, "-")}.md`,
    conteudo: [
      "---",
      `impacto: ${impacto}`,
      "secao: alterado",
      `titulo: Traz a versão ${versao} do sistema original`,
      "---",
      "",
      `Esta versão junta o que o sistema original publicou na ${versao} com o que`,
      "esta instalação acrescenta por conta própria. O que mudou lá está escrito na",
      `seção **${versao}** deste mesmo changelog, logo abaixo, por quem fez as`,
      "mudanças.",
      "",
      "Nada a configurar: a atualização é a de sempre.",
      "",
    ].join("\n"),
  };
}
