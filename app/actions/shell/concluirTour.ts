"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

const entrada = z.object({
  motivo: z.enum(["concluido", "pulado"]),
  passo: z.number().int().min(0).max(99).optional(),
});

/**
 * Guarda que esta pessoa já viu o passeio — concluído ou pulado, tanto faz:
 * nos dois casos ele não deve abrir sozinho de novo. Quem quiser revê-lo tem o
 * item "Conhecer o sistema" no menu do usuário.
 *
 * Mora em `user_metadata`, ao lado de `locale` e `timezone` (ver
 * `trocarIdioma.ts`): é preferência da PESSOA, não da organização. Quem
 * trabalha em duas empresas aprende a interface uma vez só.
 *
 * A auditoria sai como `profile.updated`, que é o que ela É — uma escrita em
 * `user_metadata` — e é o mesmo nome que a troca de idioma usa. Uma ação nova
 * no union `AUDIT_ACTIONS` só para isto seria ruído no log de quem audita.
 */
export async function concluirTour(
  motivo: "concluido" | "pulado",
  passo?: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = entrada.safeParse({ motivo, passo });
  if (!parsed.success) return { ok: false, error: "entrada_invalida" };

  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();
  const agora = new Date().toISOString();
  const { error } = await supabase.auth.updateUser({ data: { tour_concluido_em: agora } });
  if (error) return { ok: false, error: error.message };

  const hdrs = await headers();
  const activeOrg = await resolveActiveOrg(authUser);
  await audit({
    action: "profile.updated",
    actorUserId: authUser.id,
    organizationId: activeOrg?.orgId ?? null,
    resourceType: "user",
    resourceId: authUser.id,
    requestId: hdrs.get("x-request-id"),
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: hdrs.get("user-agent") ?? null,
    metadata: { tour: parsed.data.motivo, passo: parsed.data.passo ?? null, origem: "tour_guiado" },
  });

  revalidatePath("/app", "layout");
  return { ok: true };
}
