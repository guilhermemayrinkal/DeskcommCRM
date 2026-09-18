/**
 * As duas decisões de texto da sincronização, na linha de comando.
 *
 * O workflow faz o git; isto faz o que ele não pode chutar. Fino de propósito:
 * a lógica mora em `lib/sincronizacao/origem.ts`, provada no teste ao lado, e
 * aqui só há leitura de arquivo e código de saída.
 *
 *   tsx scripts/sincronizar-origem.ts resolver-changelog
 *       Desfaz os conflitos do CHANGELOG (o único arquivo que conflita em toda
 *       sincronização) mantendo os dois lados.
 *
 *   tsx scripts/sincronizar-origem.ts fragmento <versao> [versao-anterior]
 *       Escreve o fragmento de `.changes/` que o corte de versão consome.
 *       Sai com 3 — e explica na saída de erro — quando a versão de origem
 *       pede ação de quem hospeda: aí quem decide é gente, não o robô.
 */
import fs from "node:fs";
import path from "node:path";

import {
  fragmentoDeSincronizacao,
  impactoDaVersaoDeOrigem,
  motivoParaOlhoHumano,
  resolverConflitoDoChangelog,
  secaoDaVersao,
} from "../lib/sincronizacao/origem";

const RAIZ = process.cwd();
const CHANGELOG = path.join(RAIZ, "CHANGELOG.md");
const DIR_FRAGMENTOS = path.join(RAIZ, ".changes");

/** Sai com 3, e não com 1, para o workflow distinguir "pede gente" de "quebrou". */
const PEDE_GENTE = 3;

function resolver(): number {
  const antes = fs.readFileSync(CHANGELOG, "utf8");
  const depois = resolverConflitoDoChangelog(antes);
  fs.writeFileSync(CHANGELOG, depois);
  process.stdout.write(
    antes === depois
      ? "CHANGELOG sem conflito — nada a resolver.\n"
      : "CHANGELOG resolvido: as duas seções ficaram, a nossa acima.\n",
  );
  return 0;
}

function fragmento(versao: string | undefined, anterior: string | undefined): number {
  if (!versao) {
    process.stderr.write("uso: fragmento <versao> [versao-anterior]\n");
    return 2;
  }
  const changelog = fs.readFileSync(CHANGELOG, "utf8");
  const secao = secaoDaVersao(changelog, versao);

  const motivo = motivoParaOlhoHumano(secao);
  if (motivo) {
    process.stderr.write(`${motivo}\n`);
    return PEDE_GENTE;
  }

  const impacto = impactoDaVersaoDeOrigem(anterior ?? null, versao);
  const f = fragmentoDeSincronizacao(versao, impacto);
  fs.mkdirSync(DIR_FRAGMENTOS, { recursive: true });
  fs.writeFileSync(path.join(DIR_FRAGMENTOS, f.arquivo), f.conteudo);
  process.stdout.write(`.changes/${f.arquivo} escrito (impacto: ${impacto}).\n`);
  return 0;
}

function main(argv: string[]): number {
  const [comando, ...resto] = argv;
  switch (comando) {
    case "resolver-changelog":
      return resolver();
    case "fragmento":
      return fragmento(resto[0], resto[1]);
    default:
      process.stderr.write("comandos: resolver-changelog | fragmento <versao> [anterior]\n");
      return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
