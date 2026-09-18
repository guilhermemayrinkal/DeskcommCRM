/**
 * O passeio abre sozinho para quem nunca viu, some para quem já viu, volta
 * quando pedido, e pular o marca como visto — porque um passeio que reabre
 * toda vez é a forma mais rápida de ensinar alguém a odiar um sistema.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { concluirTour, estado } = vi.hoisted(() => ({
  concluirTour: vi.fn(async (_motivo: "concluido" | "pulado", _passo?: number) => ({ ok: true as const })),
  estado: { tourConcluidoEm: null as string | null },
}));

vi.mock("@/app/actions/shell/concluirTour", () => ({ concluirTour }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("next/navigation", () => ({ usePathname: () => "/app/inbox" }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u", is_platform_admin: false, support: null, tour_concluido_em: estado.tourConcluidoEm },
    activeOrg: { orgId: "o", name: "Studio", role: "admin" },
  }),
}));

import { TourGuiado } from "./TourGuiado";
import { pedirParaAbrirTour } from "@/lib/tour/evento";

/**
 * O jsdom não tem o shell de verdade: só o suficiente para três alvos existirem.
 *
 * Num nó PRÓPRIO, e nunca via `document.body.innerHTML`: o passeio renderiza
 * num portal direto no body, e zerar o body arrancava o portal e o container do
 * Testing Library antes do cleanup dele — que então falhava ao remover nós que
 * já não existiam, exatamente nos testes em que o diálogo ficava aberto.
 */
let fixture: HTMLDivElement;
function montarBarraLateral() {
  fixture = document.createElement("div");
  fixture.innerHTML = `
    <nav data-tour="menu"><a href="/app/inbox">Inbox</a></nav>
    <button data-tour="busca">Buscar</button>
  `;
  document.body.appendChild(fixture);
}

/** Abre e deixa o layout "assentar" (o atraso de abertura + um quadro de medição). */
function abrirSozinho() {
  act(() => {
    vi.advanceTimersByTime(700);
  });
  act(() => {
    vi.advanceTimersByTime(50);
  });
}

function seta(tecla: "ArrowRight" | "ArrowLeft" | "Escape") {
  act(() => {
    fireEvent.keyDown(window, { key: tecla });
  });
  act(() => {
    vi.advanceTimersByTime(50);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  concluirTour.mockClear();
  estado.tourConcluidoEm = null;
  montarBarraLateral();
});
afterEach(() => {
  // Primeiro o React desmonta (e tira o portal do body); só depois a fixture sai.
  cleanup();
  fixture.remove();
  vi.useRealTimers();
});

describe("passeio guiado", () => {
  it("abre sozinho para quem nunca viu, depois de o layout assentar", () => {
    render(<TourGuiado />);
    expect(screen.queryByTestId("tour-card")).toBeNull();
    abrirSozinho();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Um passeio de dois minutos")).toBeTruthy();
    expect(screen.getByTestId("tour-progresso").textContent).toMatch(/^Passo 1 de \d+$/);
  });

  it("NÃO abre sozinho para quem já concluiu ou pulou — mas volta quando pedido pelo menu", () => {
    estado.tourConcluidoEm = "2026-09-18T00:00:00Z";
    render(<TourGuiado />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      pedirParaAbrirTour();
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("anda pelo teclado e pula os passos cujo alvo não está na tela", () => {
    render(<TourGuiado />);
    abrirSozinho();
    seta("ArrowRight");
    expect(screen.getByText("Tudo que existe está neste menu")).toBeTruthy();
    seta("ArrowRight");
    expect(screen.getByText("As conversas")).toBeTruthy();
    seta("ArrowRight");
    // Radar, Agenda, Respostas, CRM, Funis, IA, Follow-ups, Conexões e
    // Desempenho não têm alvo neste DOM: o próximo resolvível é a busca do topo.
    expect(screen.getByText("Não decore o menu")).toBeTruthy();
    // E a seta para a esquerda volta para as conversas, saltando os mesmos ausentes.
    seta("ArrowLeft");
    expect(screen.getByText("As conversas")).toBeTruthy();
  });

  it("pular marca como visto e guarda em que passo a pessoa desistiu", async () => {
    render(<TourGuiado />);
    abrirSozinho();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
    expect(concluirTour).toHaveBeenCalledWith("pulado", 0);
  });

  it("Esc também pula", async () => {
    render(<TourGuiado />);
    abrirSozinho();
    seta("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
    expect(concluirTour).toHaveBeenCalledWith("pulado", 0);
  });

  it("no último passo o botão vira Concluir, e concluir grava 'concluido'", async () => {
    render(<TourGuiado />);
    abrirSozinho();
    // Anda até o fim (o roteiro tem menos de 30 passos; sobra margem).
    for (let i = 0; i < 30; i += 1) {
      if (screen.queryByRole("button", { name: /Concluir/ })) break;
      seta("ArrowRight");
    }
    expect(screen.getByText("É isso")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pular" })).toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Concluir/ }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(concluirTour).toHaveBeenCalledWith("concluido", expect.any(Number));
  });

  it("alvo escondido por um ancestral (barra lateral no celular) é pulado como se não existisse", () => {
    // Esconde a barra do jeito que o shell esconde no celular: no PAI, não no <nav>.
    const barra = fixture.querySelector("nav")!;
    const pai = document.createElement("div");
    pai.style.display = "none";
    barra.replaceWith(pai);
    pai.appendChild(barra);

    render(<TourGuiado />);
    abrirSozinho();
    seta("ArrowRight");
    // Menu e Inbox estão escondidos; o próximo alvo visível é a busca do topo.
    expect(screen.queryByText("Tudo que existe está neste menu")).toBeNull();
    expect(screen.getByText("Não decore o menu")).toBeTruthy();
  });

  it("o alvo iluminado fica livre para clique: o holofote não captura eventos", () => {
    render(<TourGuiado />);
    abrirSozinho();
    seta("ArrowRight");
    expect(screen.getByTestId("tour-holofote").className).toContain("pointer-events-none");
  });
});
