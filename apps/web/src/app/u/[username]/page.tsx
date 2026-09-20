import { usernameSchema } from "@yakila/validation";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { isTrustedAvatarUrl } from "@/lib/avatar";
import { getPublicProfile } from "@/lib/profile/queries";
import { profileDescription, profileName, profileTitle } from "@/lib/profile/seo";

/**
 * Profil public, indexable : `/u/marie_d`. Ne rend que des champs publics (nom, pseudo, bio, ville,
 * avatar), jamais de position ni d'identifiant.
 *
 * Pas de `loading.tsx` ni de `<Suspense>` autour du contenu : un `notFound()` déclenché après le début
 * du streaming renverrait un statut 200. Ici la réponse n'est envoyée qu'une fois le profil lu,
 * ce qui garantit un vrai 404 (important pour l'indexation) pour un pseudo inconnu.
 */

async function loadProfile(rawUsername: string) {
  const parsed = usernameSchema.safeParse(rawUsername);
  if (!parsed.success) notFound();

  const { data, error } = await getPublicProfile(parsed.data);
  // Une erreur technique n'est pas un 404 : on ne veut pas désindexer un profil pour une panne passagère.
  if (error) throw new Error(`Lecture du profil impossible (${error.code})`);
  if (!data) notFound();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);

  const title = profileTitle(profile);
  const description = profileDescription(profile);
  const path = `/u/${profile.username}`;
  const avatar =
    profile.avatar_url &&
    isTrustedAvatarUrl(profile.avatar_url, process.env.NEXT_PUBLIC_SUPABASE_URL)
      ? profile.avatar_url
      : null;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
      title,
      description,
      url: path,
      username: profile.username,
      ...(avatar ? { images: [{ url: avatar }] } : {}),
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const profile = await loadProfile(username);

  // `/u/Marie_D` et `/u/marie_d` ne doivent pas être deux pages : une seule URL canonique.
  if (profile.username !== username) permanentRedirect(`/u/${profile.username}`);

  const name = profileName(profile);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={name} size={96} />
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight">{name}</h1>
          <p className="break-all text-zinc-600 dark:text-zinc-400">@{profile.username}</p>
          {profile.city ? <p className="break-words">{profile.city}</p> : null}
        </div>
      </header>

      {profile.bio ? <p className="whitespace-pre-line break-words">{profile.bio}</p> : null}
    </article>
  );
}
