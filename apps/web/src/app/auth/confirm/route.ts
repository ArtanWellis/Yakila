import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Lien de confirmation d'e-mail. Le modèle d'e-mail « Confirm signup » de Supabase doit pointer ici :
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * `verifyOtp` échange le hash contre une session (cookies posés par le client serveur), quel que soit
 * l'appareil qui ouvre le lien. On n'accepte que les types de la phase 1.
 */
const ACCEPTED_TYPES = ["signup", "email"] as const;
type AcceptedType = (typeof ACCEPTED_TYPES)[number];

function isAcceptedType(value: string | null): value is AcceptedType {
  return ACCEPTED_TYPES.some((type) => type === value);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && isAcceptedType(type)) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(safeNextPath(searchParams.get("next")));
    console.error("[auth] confirmation refusée :", error.code ?? error.status);
  }

  redirect("/connexion?error=confirmation");
}
