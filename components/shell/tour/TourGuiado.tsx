"use client";

/**
 * O passeio guiado pela interface — holofote sobre um elemento, card ao lado.
 *
 * Abre sozinho no primeiro acesso (regra em `lib/tour/passos.ts`) e de novo
 * quando alguém pede pelo menu do usuário (`lib/tour/evento.ts`). Não bloqueia
 * a tela: o holofote é um recorte num fundo escurecido, e o elemento iluminado
 * continua clicável — quem quiser abrir o Inbox no meio do passeio abre, e o
 * passeio segue de onde estava, porque o shell não remonta entre telas do /app.
 *
 * Por que não uma biblioteca de tour: o projeto não tem nenhuma, e o que
 * precisamos é pequeno — medir um alvo, posicionar um card, ouvir o teclado.
 * Trazer uma dependência para isso seria pagar por CSS que briga com o nosso
 * e por animação que o 07-motion-language não pediu.
 *
 * Alvo que não existe na tela (celular sem barra lateral, grupo recolhido,
 * papel sem permissão) é pulado em silêncio, na direção em que a pessoa está
 * andando. O passeio nunca aponta para o vazio.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { CaretLeft, CaretRight, Check, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { concluirTour } from "@/app/actions/shell/concluirTour";
import { EVENTO_ABRIR_TOUR } from "@/lib/tour/evento";
import { deveAbrirSozinho, passosDoTour, type PassoDoTour } from "@/lib/tour/passos";
import { posicionarCard, type Caixa, type Posicao } from "@/lib/tour/posicao";

/** Espera o layout assentar antes de abrir sozinho — a barra lateral anima ao montar. */
const ATRASO_DA_ABERTURA_MS = 700;
/** Folga do holofote em volta do alvo, em px. */
const FOLGA_DO_HOLOFOTE = 6;
const LARGURA_DO_CARD = 360;

/**
 * Visível = nenhum ancestral com `display: none` e o próprio elemento não
 * escondido. Sobe pelos ancestrais porque é assim que a barra lateral some no
 * celular: o `<nav>` continua no DOM, quem tem `hidden md:block` é o pai. Sem
 * esta checagem, `querySelector` acha o elemento, `getBoundingClientRect`
 * devolve zeros, e o passeio aponta para o canto vazio da tela em vez de pular.
 *
 * `getComputedStyle` e não `offsetParent`/`getClientRects`: é o único critério
 * que o browser e o jsdom respondem igual (o jsdom não tem layout, mas honra
 * `style="display:none"` — que é como o teste esconde um alvo).
 */
function visivel(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const estilo = window.getComputedStyle(n);
    if (estilo.display === "none" || (n === el && estilo.visibility === "hidden")) return false;
  }
  return true;
}

function encontrarAlvo(passo: PassoDoTour): HTMLElement | null {
  for (const css of passo.alvos) {
    for (const el of document.querySelectorAll<HTMLElement>(css)) {
      if (visivel(el)) return el;
    }
  }
  return null;
}

function medir(el: HTMLElement): Caixa {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function TourGuiado() {
  const t = useT();
  const pathname = usePathname();
  const { user, activeOrg } = useAuth();
  const [, startTransition] = useTransition();

  const passos = useMemo(
    () =>
      passosDoTour({
        isPlatformAdmin: user.is_platform_admin,
        role: activeOrg?.role ?? null,
        settings: activeOrg?.interface_settings,
      }),
    [user.is_platform_admin, activeOrg?.role, activeOrg?.interface_settings],
  );

  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [alvo, setAlvo] = useState<Caixa | null>(null);
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const jaAbriuSozinho = useRef(false);

  /**
   * Anda até o próximo passo cujo alvo exista na tela (ou que não tenha alvo),
   * na direção pedida. Devolve -1 quando não há mais para onde ir.
   */
  const proximoResolvivel = useCallback(
    (aPartirDe: number, direcao: 1 | -1): number => {
      for (let i = aPartirDe; i >= 0 && i < passos.length; i += direcao) {
        const p = passos[i];
        if (!p) return -1;
        if (p.alvos.length === 0 || encontrarAlvo(p)) return i;
      }
      return -1;
    },
    [passos],
  );

  const abrir = useCallback(() => {
    const i = proximoResolvivel(0, 1);
    if (i < 0) return;
    // Zera a geometria da sessão anterior: sem isto o holofote piscaria um
    // quadro na posição do último alvo visto antes de medir o primeiro.
    setAlvo(null);
    setPosicao(null);
    setIndice(i);
    setAberto(true);
  }, [proximoResolvivel]);

  const fechar = useCallback(
    (motivo: "concluido" | "pulado") => {
      setAberto(false);
      const passo = indice;
      startTransition(async () => {
        const r = await concluirTour(motivo, passo);
        if (!r.ok) {
          toast.error(t("Não conseguimos guardar o passeio. Ele pode aparecer de novo no próximo acesso."));
        }
      });
    },
    [indice, t],
  );

  const avancar = useCallback(() => {
    const i = proximoResolvivel(indice + 1, 1);
    if (i < 0) fechar("concluido");
    else setIndice(i);
  }, [indice, proximoResolvivel, fechar]);

  const voltar = useCallback(() => {
    const i = proximoResolvivel(indice - 1, -1);
    if (i >= 0) setIndice(i);
  }, [indice, proximoResolvivel]);

  // Abre sozinho, uma vez por montagem, se esta pessoa ainda não viu.
  useEffect(() => {
    if (jaAbriuSozinho.current) return;
    // `navigator.webdriver` é o sinal padrão de sessão dirigida por automação —
    // true no Playwright, false em navegador de gente. Ver `deveAbrirSozinho`.
    const automatizada = typeof navigator !== "undefined" && navigator.webdriver === true;
    if (!deveAbrirSozinho(user, activeOrg !== null, pathname, automatizada)) return;
    if (passos.length < 2) return;
    jaAbriuSozinho.current = true;
    const timer = window.setTimeout(abrir, ATRASO_DA_ABERTURA_MS);
    return () => window.clearTimeout(timer);
  }, [user, activeOrg, pathname, passos.length, abrir]);

  // Abre quando alguém pede pelo menu do usuário.
  useEffect(() => {
    const ouvir = () => abrir();
    window.addEventListener(EVENTO_ABRIR_TOUR, ouvir);
    return () => window.removeEventListener(EVENTO_ABRIR_TOUR, ouvir);
  }, [abrir]);

  const passo = aberto ? passos[indice] : undefined;

  // Mede o alvo, e volta a medir quando a janela muda ou algo rola. A medição
  // é sempre assíncrona (um quadro): o efeito só assina; quem escreve estado é
  // o callback — o que o React pede de um efeito que sincroniza com o DOM.
  useLayoutEffect(() => {
    if (!passo) return;
    const el = passo.alvos.length ? encontrarAlvo(passo) : null;
    // `scrollIntoView` não existe no jsdom; o guard é para o teste, não para o browser.
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    let quadro = 0;
    const remedir = () => {
      window.cancelAnimationFrame(quadro);
      quadro = window.requestAnimationFrame(() => setAlvo(el ? medir(el) : null));
    };
    remedir();
    if (!el) return () => window.cancelAnimationFrame(quadro);
    window.addEventListener("resize", remedir);
    window.addEventListener("scroll", remedir, true);
    return () => {
      window.cancelAnimationFrame(quadro);
      window.removeEventListener("resize", remedir);
      window.removeEventListener("scroll", remedir, true);
    };
  }, [passo]);

  // Posiciona o card assim que ele existe e sempre que alvo ou passo mudam. É um
  // callback ref, e não um efeito, porque precisa do TAMANHO do card — que só se
  // conhece com ele no DOM — e medir-e-posicionar é exatamente o que um ref
  // callback faz no commit, antes de pintar.
  const posicionar = useCallback(
    (el: HTMLDivElement | null) => {
      cardRef.current = el;
      if (!el || !passo) return;
      const r = el.getBoundingClientRect();
      setPosicao(
        posicionarCard(
          alvo,
          { width: r.width || LARGURA_DO_CARD, height: r.height || 220 },
          passo.lado,
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    },
    [passo, alvo],
  );

  // Foco no card a cada passo: leitor de tela anuncia o título; teclado já está no lugar.
  useEffect(() => {
    if (aberto) cardRef.current?.focus({ preventScroll: true });
  }, [aberto, indice]);

  // Teclado: Esc pula, setas andam.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar("pulado");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        avancar();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        voltar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, fechar, avancar, voltar]);

  // No servidor `aberto` é sempre false: quem o liga é um efeito (timer ou
  // evento), e efeito só roda no cliente — então o `document` do portal existe.
  if (!aberto || !passo) return null;

  const ultimo = proximoResolvivel(indice + 1, 1) < 0;
  const primeiro = proximoResolvivel(indice - 1, -1) < 0;
  const numero = indice + 1;
  const total = passos.length;
  const tituloId = `tour-passo-${passo.id}`;

  return createPortal(
    <>
      {alvo ? (
        <div
          aria-hidden
          data-testid="tour-holofote"
          className="tour-holofote pointer-events-none fixed z-[70] rounded-md"
          style={{
            top: alvo.top - FOLGA_DO_HOLOFOTE,
            left: alvo.left - FOLGA_DO_HOLOFOTE,
            width: alvo.width + FOLGA_DO_HOLOFOTE * 2,
            height: alvo.height + FOLGA_DO_HOLOFOTE * 2,
            // O fundo escuro é a SOMBRA deste recorte — um só elemento, sem
            // quatro painéis em volta, e o alvo fica livre para clique.
            boxShadow: "0 0 0 100vmax var(--color-overlay)",
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[70]" style={{ background: "var(--color-overlay)" }} />
      )}

      <div
        ref={posicionar}
        role="dialog"
        aria-labelledby={tituloId}
        aria-label={t("Passeio guiado pelo sistema")}
        tabIndex={-1}
        data-testid="tour-card"
        className={cn(
          "tour-card-in fixed z-[70] flex flex-col gap-3 rounded-lg border bg-popover p-5 text-popover-foreground shadow-lg outline-hidden",
          "focus-visible:ring-2 focus-visible:ring-ring",
        )}
        style={{
          width: `min(${LARGURA_DO_CARD}px, calc(100vw - 24px))`,
          top: posicao?.top ?? 24,
          left: posicao?.left ?? 24,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground" data-testid="tour-progresso">
            {t("Passo {n} de {total}").replace("{n}", String(numero)).replace("{total}", String(total))}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 h-8 w-8"
            aria-label={t("Fechar")}
            onClick={() => fechar("pulado")}
          >
            <X size={16} aria-hidden />
          </Button>
        </div>

        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-slow"
            style={{ width: `${Math.round((numero / total) * 100)}%` }}
          />
        </div>

        <h2 id={tituloId} className="text-base font-semibold leading-snug">
          {t(passo.titulo)}
        </h2>
        <p className="text-sm text-muted-foreground">{t(passo.texto)}</p>
        {passo.itens && passo.itens.length > 0 && (
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {passo.itens.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{t(item)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          {ultimo ? (
            <span />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => fechar("pulado")}>
              {t("Pular")}
            </Button>
          )}
          <div className="flex items-center gap-2">
            {!primeiro && (
              <Button variant="outline" size="sm" onClick={voltar}>
                <CaretLeft size={14} aria-hidden />
                {t("Anterior")}
              </Button>
            )}
            {ultimo ? (
              <Button size="sm" onClick={() => fechar("concluido")}>
                <Check size={14} aria-hidden />
                {t("Concluir")}
              </Button>
            ) : (
              <Button size="sm" onClick={avancar}>
                {t("Próximo")}
                <CaretRight size={14} aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
