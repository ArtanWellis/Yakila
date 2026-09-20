import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath } from "@/lib/auth/redirect";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16 : `middleware.ts` s'appelle désormais `proxy.ts` (runtime Node.js).
 * Deux rôles : rafraîchir la session Supabase, et rediriger tôt les visiteurs anonymes hors des
 * pages protégées. Ce second contrôle n'est qu'« optimiste » : chaque page et chaque Server Action
 * revérifie la session (`requireUser` / `getCurrentUser`), le proxy n'est pas une frontière de sécurité.
 */
export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);

  // Uniquement les navigations : une Server Action (POST) gère elle-même une session expirée.
  const isNavigation = request.method === "GET" || request.method === "HEAD";
  if (!isAuthenticated && isNavigation && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/connexion";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);

    const redirect = NextResponse.redirect(loginUrl);
    // Conserve les cookies posés par le rafraîchissement (ex. suppression d'une session périmée).
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // Tout sauf les fichiers statiques, l'optimiseur d'images et les images publiques.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
