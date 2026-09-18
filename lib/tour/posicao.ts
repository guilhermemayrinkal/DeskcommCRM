/**
 * Onde o card do passeio se encosta no alvo — geometria pura, sem DOM.
 *
 * O componente mede o alvo e o card, chama isto e recebe `top`/`left`. Vive
 * fora do componente para ser testável com números e não com um jsdom que
 * devolve zero em todo `getBoundingClientRect`.
 */
import type { LadoDoCard } from "./passos";

export interface Caixa {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Posicao {
  top: number;
  left: number;
  /** O lado que acabou sendo usado — o componente aponta a seta por ele. */
  lado: LadoDoCard | "centro";
}

const MARGEM = 12;
const FOLGA = 14;

const ORDEM: Record<LadoDoCard, LadoDoCard[]> = {
  direita: ["direita", "baixo", "esquerda", "cima"],
  baixo: ["baixo", "cima", "direita", "esquerda"],
  esquerda: ["esquerda", "baixo", "direita", "cima"],
  cima: ["cima", "baixo", "direita", "esquerda"],
};

const prender = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Tenta o lado preferido; se o card não cabe ali, os outros na ordem de
 * `ORDEM`. Se não cabe em lado nenhum (tela muito baixa), centraliza — melhor
 * um card centralizado que um cortado.
 */
export function posicionarCard(
  alvo: Caixa | null,
  card: { width: number; height: number },
  preferido: LadoDoCard,
  janela: { width: number; height: number },
): Posicao {
  const centro = (): Posicao => ({
    top: Math.max(MARGEM, (janela.height - card.height) / 2),
    left: Math.max(MARGEM, (janela.width - card.width) / 2),
    lado: "centro",
  });
  if (!alvo) return centro();

  const maxLeft = janela.width - card.width - MARGEM;
  const maxTop = janela.height - card.height - MARGEM;

  for (const lado of ORDEM[preferido]) {
    switch (lado) {
      case "direita": {
        const left = alvo.left + alvo.width + FOLGA;
        if (left <= maxLeft) return { top: prender(alvo.top, MARGEM, maxTop), left, lado };
        break;
      }
      case "esquerda": {
        const left = alvo.left - FOLGA - card.width;
        if (left >= MARGEM) return { top: prender(alvo.top, MARGEM, maxTop), left, lado };
        break;
      }
      case "baixo": {
        const top = alvo.top + alvo.height + FOLGA;
        if (top <= maxTop) return { top, left: prender(alvo.left, MARGEM, maxLeft), lado };
        break;
      }
      case "cima": {
        const top = alvo.top - FOLGA - card.height;
        if (top >= MARGEM) return { top, left: prender(alvo.left, MARGEM, maxLeft), lado };
        break;
      }
    }
  }
  return centro();
}
