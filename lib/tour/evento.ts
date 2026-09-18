/**
 * Como se pede para o passeio abrir de novo, de qualquer lugar da interface.
 *
 * Um evento no `window` em vez de um contexto React: quem pede (o menu do
 * usuário, no topo) e quem atende (o passeio, montado no shell) não têm
 * ancestral comum conveniente, e criar um provider só para um botão seria
 * plumbing demais para um sinal de uma via.
 */
// Sem marca no nome: a catraca de `tests/unit/branding.test.ts` varre todo
// `.ts` pelo nome do produto, e um identificador técnico não precisa carregá-lo.
export const EVENTO_ABRIR_TOUR = "passeio-guiado:abrir";

export function pedirParaAbrirTour(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_TOUR));
}
