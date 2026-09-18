/**
 * O robô junta o código de origem sozinho — e as duas coisas que ele NÃO pode
 * errar são perder uma seção do changelog e publicar sem ler um aviso.
 *
 * O merge do CHANGELOG conflita em toda sincronização, sempre igual. Se a
 * resolução ficasse a cargo de quem escreveu o workflow em bash, o primeiro
 * erro apareceria numa VPS, na tela de atualização, sem histórico de como o
 * arquivo chegou lá. Aqui ele aparece em milissegundos.
 */
import { describe, expect, it } from "vitest";

import {
  fragmentoDeSincronizacao,
  impactoDaVersaoDeOrigem,
  motivoParaOlhoHumano,
  resolverConflitoDoChangelog,
  secaoDaVersao,
} from "@/lib/sincronizacao/origem";

const CONFLITO = [
  "# Changelog",
  "",
  "## [Não lançado]",
  "",
  "<<<<<<< HEAD",
  "## [2.0.0] — 2026-09-18",
  "",
  "### Adicionado",
  "",
  "- O que esta instalação acrescenta.",
  "",
  "=======",
  "## [1.35.0] — 2026-09-18",
  "",
  "### Corrigido",
  "",
  "- O que o sistema original corrigiu.",
  "",
  ">>>>>>> origem/v1.35.0",
  "## [1.34.0] — 2026-09-17",
  "",
  "- Mais velho.",
  "",
  "<<<<<<< HEAD",
  "[Não lançado]: https://github.com/dona/Projeto/compare/v2.0.0...HEAD",
  "[2.0.0]: https://github.com/dona/Projeto/compare/v1.34.0...v2.0.0",
  "=======",
  "[Não lançado]: https://github.com/autor/Projeto/compare/v1.35.0...HEAD",
  "[1.35.0]: https://github.com/autor/Projeto/compare/v1.34.0...v1.35.0",
  ">>>>>>> origem/v1.35.0",
  "[1.34.0]: https://github.com/autor/Projeto/compare/v1.33.0...v1.34.0",
].join("\n");

describe("resolver o conflito do changelog", () => {
  const resolvido = resolverConflitoDoChangelog(CONFLITO);

  it("não deixa marcador nenhum para trás", () => {
    expect(resolvido).not.toMatch(/<<<<<<<|=======|>>>>>>>/);
  });

  it("mantém as DUAS seções — a nossa e a de origem", () => {
    expect(resolvido).toContain("## [2.0.0]");
    expect(resolvido).toContain("## [1.35.0]");
    expect(resolvido).toContain("- O que esta instalação acrescenta.");
    expect(resolvido).toContain("- O que o sistema original corrigiu.");
  });

  it("põe a nossa acima da de origem — é a ordem que o arquivo exige", () => {
    const linhas = resolvido.split("\n");
    expect(linhas.findIndex((l) => l.startsWith("## [2.0.0]"))).toBeLessThan(
      linhas.findIndex((l) => l.startsWith("## [1.35.0]")),
    );
    expect(linhas.findIndex((l) => l.startsWith("## [1.35.0]"))).toBeLessThan(
      linhas.findIndex((l) => l.startsWith("## [1.34.0]")),
    );
  });

  it("no rodapé, a chave repetida fica com a NOSSA — a de origem apontaria para outro repositório", () => {
    const naoLancado = resolvido.split("\n").filter((l) => l.startsWith("[Não lançado]:"));
    expect(naoLancado).toHaveLength(1);
    expect(naoLancado[0]).toContain("/dona/Projeto/");
  });

  it("mas as referências que só existem de um lado sobrevivem", () => {
    expect(resolvido).toContain("[2.0.0]: https://github.com/dona/Projeto/");
    expect(resolvido).toContain("[1.35.0]: https://github.com/autor/Projeto/");
    expect(resolvido).toContain("[1.34.0]: https://github.com/autor/Projeto/");
  });

  it("texto sem conflito nenhum atravessa sem mudar", () => {
    const limpo = "# Changelog\n\n## [1.0.0]\n\n- nada.\n";
    expect(resolverConflitoDoChangelog(limpo)).toBe(limpo);
  });

  it("conflito que nunca fecha é erro, não um arquivo pela metade", () => {
    expect(() => resolverConflitoDoChangelog("a\n<<<<<<< HEAD\nb\n")).toThrow(/não terminou/);
  });
});

describe("o efeito declarado para a versão que embrulha a de origem", () => {
  it("correção lá é correção aqui", () => {
    expect(impactoDaVersaoDeOrigem("1.34.0", "1.34.1")).toBe("nada_mudou");
  });

  it("minor lá é capacidade nova aqui", () => {
    expect(impactoDaVersaoDeOrigem("1.34.0", "1.35.0")).toBe("capacidade_nova");
  });

  it("major lá NÃO vira exige_acao aqui — quem decide isso é o aviso, não o número", () => {
    expect(impactoDaVersaoDeOrigem("1.34.0", "2.0.0")).toBe("capacidade_nova");
  });

  it("sem versão anterior conhecida, assume o lado seguro", () => {
    expect(impactoDaVersaoDeOrigem(null, "1.35.0")).toBe("capacidade_nova");
    expect(impactoDaVersaoDeOrigem("qualquer-coisa", "1.35.0")).toBe("capacidade_nova");
  });
});

describe("quando o robô tem de chamar gente", () => {
  const changelog = resolverConflitoDoChangelog(CONFLITO);

  it("versão comum: segue sozinho", () => {
    expect(motivoParaOlhoHumano(secaoDaVersao(changelog, "1.35.0"))).toBeNull();
  });

  it("versão que pede ação de quem hospeda: para e explica", () => {
    const com = "### ⚠️ Requer atenção\n\n- Apague a conexão antiga antes de atualizar.";
    expect(motivoParaOlhoHumano(com)).toContain("Requer atenção");
  });

  it("seção que não existe: para — publicar sem saber o que muda é pior que atrasar", () => {
    expect(motivoParaOlhoHumano(secaoDaVersao(changelog, "9.9.9"))).toContain("não achei a seção");
  });
});

describe("a seção de uma versão", () => {
  const changelog = resolverConflitoDoChangelog(CONFLITO);

  it("vai até a próxima versão e não invade a vizinha", () => {
    const secao = secaoDaVersao(changelog, "1.35.0");
    expect(secao).toContain("O que o sistema original corrigiu.");
    expect(secao).not.toContain("Mais velho.");
    expect(secao).not.toContain("## [");
  });

  it("aceita a versão com o `v` da tag", () => {
    expect(secaoDaVersao(changelog, "v1.35.0")).toContain("O que o sistema original corrigiu.");
  });
});

describe("o fragmento que o corte de versão consome", () => {
  const f = fragmentoDeSincronizacao("v1.35.0", "capacidade_nova");

  it("tem o frontmatter que o parser de fragmentos exige", () => {
    expect(f.conteudo.startsWith("---\n")).toBe(true);
    expect(f.conteudo).toContain("impacto: capacidade_nova");
    expect(f.conteudo).toContain("secao: alterado");
    expect(f.conteudo).toContain("titulo: Traz a versão 1.35.0 do sistema original");
  });

  it("o nome do arquivo carrega a versão, então duas sincronizações nunca colidem", () => {
    expect(f.arquivo).toBe("versao-de-origem-1.35.0.md");
    expect(fragmentoDeSincronizacao("1.36.0", "nada_mudou").arquivo).toBe(
      "versao-de-origem-1.36.0.md",
    );
  });

  it("aponta para a seção em vez de reescrever o que ela diz", () => {
    expect(f.conteudo).toContain("seção **1.35.0**");
    expect(f.conteudo).toMatch(/corpo vazio|Nada a configurar/);
  });
});
