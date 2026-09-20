/**
 * O passeio não pode apontar para o que a pessoa não enxerga, nem para o que
 * não existe no catálogo.
 *
 * Um viewer não tem "Agentes" no menu; se o passeio o apresentasse a "Agentes",
 * o holofote cairia no vazio — ou pior, a pessoa iria procurar uma tela que o
 * papel dela nunca vai mostrar. E um href digitado errado no roteiro só
 * apareceria como um passo que some sem explicação. As duas coisas viram
 * teste aqui.
 */
import { describe, expect, it } from "vitest";

import {
  HREFS_DO_CATALOGO,
  HREFS_DO_ROTEIRO,
  deveAbrirSozinho,
  passosDoTour,
} from "@/lib/tour/passos";

const admin = passosDoTour({ isPlatformAdmin: false, role: "admin" });
const viewer = passosDoTour({ isPlatformAdmin: false, role: "viewer" });

describe("o roteiro do passeio", () => {
  it("todo destino do roteiro existe no catálogo de navegação", () => {
    for (const href of HREFS_DO_ROTEIRO) expect(HREFS_DO_CATALOGO).toContain(href);
  });

  it("começa na abertura e termina no fim, para todo papel", () => {
    for (const passos of [admin, viewer]) {
      expect(passos[0]?.id).toBe("abertura");
      expect(passos.at(-1)?.id).toBe("fim");
    }
  });

  it("ids não se repetem", () => {
    const ids = admin.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo passo tem título e texto, e os que têm alvo têm ao menos um seletor", () => {
    for (const p of admin) {
      expect(p.titulo.trim().length).toBeGreaterThan(0);
      expect(p.texto.trim().length).toBeGreaterThan(0);
      if (p.id !== "abertura" && p.id !== "fim") expect(p.alvos.length).toBeGreaterThan(0);
    }
  });
});

describe("o que cada papel vê", () => {
  it("admin é apresentado ao funcionário de IA e às conexões", () => {
    const ids = admin.map((p) => p.id);
    expect(ids).toContain("grupo:ia");
    expect(ids).toContain("destino:/app/ai/followups");
    expect(ids).toContain("destino:/app/connections");
  });

  it("viewer NÃO é apresentado ao que o papel dele não mostra no menu", () => {
    const ids = viewer.map((p) => p.id);
    expect(ids).not.toContain("grupo:ia");
    expect(ids).not.toContain("destino:/app/ai/followups");
    expect(ids).not.toContain("destino:/app/connections");
  });

  it("mas todo mundo é apresentado às conversas e ao menu", () => {
    for (const passos of [admin, viewer]) {
      const ids = passos.map((p) => p.id);
      expect(ids).toContain("menu");
      expect(ids).toContain("destino:/app/inbox");
    }
  });

  it("as telas curadas trazem o 'como funciona' do o-que-mais-existe, não uma redação nova", () => {
    const inbox = admin.find((p) => p.id === "destino:/app/inbox");
    expect(inbox?.titulo).toBe("As conversas");
    expect(inbox?.itens?.length).toBeGreaterThan(0);
  });

  it("um grupo lista o nome de cada item que a pessoa vê nele", () => {
    const crm = admin.find((p) => p.id === "grupo:crm");
    expect(crm?.itens).toEqual(expect.arrayContaining(["Funis", "Contatos", "Tarefas"]));
  });
});

describe("abrir sozinho", () => {
  const nova = { tour_concluido_em: null, support: null };

  it("abre para quem nunca viu, dentro do app, com organização", () => {
    expect(deveAbrirSozinho(nova, true, "/app/inbox")).toBe(true);
  });

  it("não abre de novo para quem já concluiu ou pulou", () => {
    expect(deveAbrirSozinho({ ...nova, tour_concluido_em: "2026-09-18T00:00:00Z" }, true, "/app/inbox")).toBe(false);
  });

  it("não abre para suporte acompanhando a conta de outra pessoa", () => {
    expect(deveAbrirSozinho({ ...nova, support: { id: "s" } }, true, "/app/inbox")).toBe(false);
  });

  it("não abre sozinho em sessão dirigida por automação — o e2e entra com gente nova toda vez", () => {
    expect(deveAbrirSozinho(nova, true, "/app/inbox", true)).toBe(false);
    // E o padrão continua sendo o navegador de gente.
    expect(deveAbrirSozinho(nova, true, "/app/inbox")).toBe(true);
  });

  it("não abre sem organização ativa nem fora do /app", () => {
    expect(deveAbrirSozinho(nova, false, "/app/inbox")).toBe(false);
    expect(deveAbrirSozinho(nova, true, "/onboarding/welcome")).toBe(false);
    expect(deveAbrirSozinho(nova, true, null)).toBe(false);
  });
});
