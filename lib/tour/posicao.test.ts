import { describe, expect, it } from "vitest";

import { posicionarCard } from "@/lib/tour/posicao";

const janela = { width: 1280, height: 900 };
const card = { width: 360, height: 220 };

describe("onde o card se encosta", () => {
  it("à direita de um item da barra lateral, alinhado ao topo dele", () => {
    const alvo = { top: 300, left: 8, width: 200, height: 40 };
    const p = posicionarCard(alvo, card, "direita", janela);
    expect(p.lado).toBe("direita");
    expect(p.left).toBe(8 + 200 + 14);
    expect(p.top).toBe(300);
  });

  it("abaixo de um botão do topo, sem sair pela direita da tela", () => {
    const alvo = { top: 12, left: 1200, width: 40, height: 32 };
    const p = posicionarCard(alvo, card, "baixo", janela);
    expect(p.lado).toBe("baixo");
    expect(p.left + card.width).toBeLessThanOrEqual(janela.width - 12);
  });

  it("cai para o próximo lado quando o preferido não cabe", () => {
    // Alvo colado na borda direita: "direita" não cabe, vem "baixo".
    const alvo = { top: 300, left: 1100, width: 160, height: 40 };
    const p = posicionarCard(alvo, card, "direita", janela);
    expect(p.lado).toBe("baixo");
  });

  it("centraliza quando não há alvo", () => {
    const p = posicionarCard(null, card, "direita", janela);
    expect(p.lado).toBe("centro");
    expect(p.left).toBe((janela.width - card.width) / 2);
  });

  it("numa tela baixa demais para qualquer lado, centraliza em vez de cortar", () => {
    const baixa = { width: 400, height: 240 };
    const alvo = { top: 100, left: 20, width: 360, height: 40 };
    const p = posicionarCard(alvo, card, "baixo", baixa);
    expect(p.lado).toBe("centro");
    expect(p.top).toBeGreaterThanOrEqual(12);
  });
});
