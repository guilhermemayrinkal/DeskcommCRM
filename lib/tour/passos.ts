/**
 * O passeio guiado pelo sistema — para quem entra pela primeira vez.
 *
 * O wizard de onboarding monta o funcionário de IA e termina numa lista de
 * "o que mais existe" (`lib/onboarding/o-que-mais-existe.ts`). Depois disso a
 * pessoa cai no `/app` sozinha, diante de um menu com cinco grupos e nomes que
 * ela ainda não reconhece — "Inbox", "Radar", "Roteadores". Este módulo
 * descreve os passos do passeio que apresenta a INTERFACE: a barra lateral,
 * grupo a grupo, e a barra superior. Não é o wizard (que configura); é o mapa
 * (que orienta).
 *
 * Regras que este arquivo obedece:
 *
 *  - Nenhuma frase do menu é reescrita aqui. `label` e `description` vêm do
 *    registro de navegação; o "por quê" e o "como funciona" das telas curadas
 *    vêm de `oQueMaisExiste()`. É a mesma doutrina daquele arquivo: duas
 *    redações divergem na primeira vez que alguém muda uma delas.
 *
 *  - Um passo só entra se a pessoa PODE VER o destino. `sidebarGroups` já
 *    aplica papel e preset de interface — um viewer não é apresentado a
 *    "Agentes", que ele nunca vai enxergar no menu.
 *
 *  - A lógica é pura: nada de DOM aqui. Quem procura o elemento na tela é o
 *    componente; se não encontrar (celular sem barra lateral, grupo recolhido),
 *    ele pula o passo. Por isso cada alvo é uma LISTA de seletores, do mais
 *    específico ao mais tolerante.
 */
import type { Role } from "@/lib/auth/types";
import type { InterfaceSettings } from "@/lib/navigation/interface";
import { NAV_DESTINATIONS, sidebarGroups, type NavDestination } from "@/lib/navigation/registry";
import type { NavGroupId } from "@/lib/navigation/catalogo";
import { oQueMaisExiste, type PecaDoSistema } from "@/lib/onboarding/o-que-mais-existe";

/** Onde o card do passo se encosta, em relação ao alvo. */
export type LadoDoCard = "direita" | "baixo" | "esquerda" | "cima";

export interface PassoDoTour {
  id: string;
  /**
   * Seletores CSS, tentados em ordem. Vazio = passo sem alvo (card no centro).
   * O componente usa o primeiro que existir na tela.
   */
  alvos: string[];
  /** Texto em português — a chave do dicionário. O componente aplica `t()`. */
  titulo: string;
  texto: string;
  /** Lista curta abaixo do texto (o "como funciona" curado, ou os nomes de um grupo). */
  itens?: string[];
  lado: LadoDoCard;
}

export interface ContextoDoTour {
  isPlatformAdmin: boolean;
  role: Role | null;
  settings?: InterfaceSettings;
}

/**
 * O roteiro, na ordem em que faz sentido para quem acabou de entrar: primeiro
 * onde o dia acontece (atendimento), depois onde a venda anda (CRM), depois
 * quem trabalha junto (IA), e por fim as ferramentas da barra superior. O
 * `abertura` e o `fim` não têm alvo; os demais são filtrados pela visibilidade.
 */
type Entrada =
  | { tipo: "abertura" }
  | { tipo: "menu" }
  | { tipo: "destino"; href: string }
  | { tipo: "grupo"; grupo: NavGroupId; titulo: string; texto: string }
  | { tipo: "topo"; id: "busca" | "alertas" | "usuario"; titulo: string; texto: string }
  | { tipo: "fim" };

const ROTEIRO: readonly Entrada[] = [
  { tipo: "abertura" },
  { tipo: "menu" },
  { tipo: "destino", href: "/app/inbox" },
  { tipo: "destino", href: "/app/radar" },
  { tipo: "destino", href: "/app/agenda" },
  { tipo: "destino", href: "/app/templates" },
  {
    tipo: "grupo",
    grupo: "crm",
    titulo: "Onde a venda anda",
    texto:
      "Cada cliente vira um cartão que anda de coluna conforme a conversa avança. Quem é, o que ficou combinado e o que falta fazer ficam no mesmo grupo.",
  },
  { tipo: "destino", href: "/app/kanban" },
  {
    tipo: "grupo",
    grupo: "ia",
    titulo: "O funcionário de IA",
    texto:
      "É aqui que você monta e acompanha quem atende com você: os agentes, o retorno a quem sumiu e quem decide o que vai para quem.",
  },
  { tipo: "destino", href: "/app/ai/followups" },
  { tipo: "destino", href: "/app/connections" },
  { tipo: "destino", href: "/app/metrics" },
  {
    tipo: "topo",
    id: "busca",
    titulo: "Não decore o menu",
    texto: "Esta busca encontra qualquer tela pelo nome. No teclado: Ctrl K, ou ⌘K no Mac.",
  },
  {
    tipo: "topo",
    id: "alertas",
    titulo: "Quando algo precisa de você",
    texto:
      "Conversas paradas, pedidos de ajuda do agente e conexões caídas chegam aqui. O número no sino é o que está esperando.",
  },
  {
    tipo: "topo",
    id: "usuario",
    titulo: "Sua conta — e este passeio",
    texto:
      "Idioma, tema e saída ficam aqui. Para rever este passeio, use Conhecer o sistema neste mesmo menu.",
  },
  { tipo: "fim" },
];

const ABERTURA = {
  titulo: "Um passeio de dois minutos",
  texto:
    "Antes de começar, vale saber onde cada coisa mora. São poucos passos e você pode pular quando quiser — dá para voltar a este passeio pelo menu do seu perfil.",
};

const MENU = {
  titulo: "Tudo que existe está neste menu",
  texto:
    "Cinco grupos, na ordem do seu dia: o atendimento, a venda, o funcionário de IA, os canais ligados e os números. Não precisa decorar — a busca no topo encontra qualquer tela pelo nome.",
};

const FIM = {
  titulo: "É isso",
  texto:
    "O resto você descobre usando. Se não achar uma tela, a busca no topo acha; se o agente travar, ele pede ajuda nos alertas.",
};

/**
 * Os seletores da barra superior. `alerts-bell` já tinha `data-testid` estável;
 * busca e usuário ganharam `data-tour` porque o único texto neles é traduzido
 * (`aria-label={t(...)}`), e um seletor por texto quebraria em espanhol.
 */
const ALVOS_DO_TOPO: Record<"busca" | "alertas" | "usuario", string[]> = {
  busca: ['[data-tour="busca"]'],
  alertas: ['[data-testid="alerts-bell"]'],
  usuario: ['[data-tour="usuario"]'],
};

function seletorDoDestino(href: string): string {
  return `nav a[href="${href}"]`;
}

/**
 * Monta os passos que ESTA pessoa vai ver. Puro: recebe o contexto, devolve a
 * lista; não olha o DOM.
 */
export function passosDoTour(ctx: ContextoDoTour): PassoDoTour[] {
  const grupos = sidebarGroups(ctx.isPlatformAdmin, ctx.role, ctx.settings);
  const visiveis = new Map<string, NavDestination>();
  const itensDoGrupo = new Map<NavGroupId, NavDestination[]>();
  for (const g of grupos) {
    itensDoGrupo.set(g.group.id, g.items);
    for (const d of g.items) visiveis.set(d.href, d);
  }
  const curadoria = new Map<string, PecaDoSistema>(oQueMaisExiste().map((p) => [p.href, p]));

  const passos: PassoDoTour[] = [];
  for (const e of ROTEIRO) {
    switch (e.tipo) {
      case "abertura":
        passos.push({ id: "abertura", alvos: [], lado: "baixo", ...ABERTURA });
        break;
      case "menu":
        passos.push({ id: "menu", alvos: ['[data-tour="menu"]'], lado: "direita", ...MENU });
        break;
      case "destino": {
        const d = visiveis.get(e.href);
        if (!d) break;
        const c = curadoria.get(e.href);
        passos.push({
          id: `destino:${e.href}`,
          alvos: [seletorDoDestino(e.href)],
          lado: "direita",
          titulo: c?.comoChamar ?? d.label,
          texto: c?.porQue ?? d.description,
          itens: c?.comoFunciona,
        });
        break;
      }
      case "grupo": {
        const itens = itensDoGrupo.get(e.grupo);
        if (!itens || itens.length === 0) break;
        passos.push({
          id: `grupo:${e.grupo}`,
          // O <h2 id="nav-grupo-x"> só existe com a barra expandida; recolhida,
          // ela vira um divisor sem id — aí o alvo passa a ser o primeiro item.
          alvos: [`#nav-grupo-${e.grupo}`, ...itens.slice(0, 1).map((d) => seletorDoDestino(d.href))],
          lado: "direita",
          titulo: e.titulo,
          texto: e.texto,
          itens: itens.map((d) => d.label),
        });
        break;
      }
      case "topo":
        passos.push({
          id: `topo:${e.id}`,
          alvos: ALVOS_DO_TOPO[e.id],
          lado: "baixo",
          titulo: e.titulo,
          texto: e.texto,
        });
        break;
      case "fim":
        passos.push({ id: "fim", alvos: [], lado: "baixo", ...FIM });
        break;
    }
  }
  return passos;
}

/** Só para o teste provar que todo `destino` do roteiro existe no catálogo. */
export const HREFS_DO_ROTEIRO: readonly string[] = ROTEIRO.flatMap((e) =>
  e.tipo === "destino" ? [e.href] : [],
);

/** Só para o teste: o catálogo inteiro, para conferir os hrefs acima. */
export const HREFS_DO_CATALOGO: readonly string[] = NAV_DESTINATIONS.map((d) => d.href);

/**
 * O passeio abre sozinho UMA vez por pessoa: quando ela ainda não o concluiu
 * nem pulou (`tour_concluido_em` vazio), está dentro do app com uma
 * organização ativa, e não é suporte acompanhando a conta de outra pessoa —
 * quem entra para dar suporte já conhece a interface, e o passeio na frente
 * atrapalharia justamente o atendimento.
 */
export function deveAbrirSozinho(
  pessoa: { tour_concluido_em?: string | null; support?: unknown },
  temOrganizacao: boolean,
  pathname: string | null,
): boolean {
  if (!temOrganizacao) return false;
  if (pessoa.support) return false;
  if (pessoa.tour_concluido_em) return false;
  return typeof pathname === "string" && pathname.startsWith("/app");
}
