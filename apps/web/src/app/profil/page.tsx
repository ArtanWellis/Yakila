import { fetchProfile } from "@yakila/api";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { linkClass } from "@/components/button-styles";
import { requireUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AvatarUploader } from "./avatar-uploader";
import { LocationControls } from "./location-controls";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = {
  title: "Mon profil",
  // Page privée : jamais indexée.
  robots: { index: false, follow: false },
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <h2 id={`${id}-title`} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ProfilePage() {
  // Contrôle sécurisé : le proxy a déjà redirigé les anonymes, mais il n'est qu'un filet optimiste.
  const user = await requireUser("/profil");

  const supabase = await createServerSupabaseClient();
  const { data: profile, error } = await fetchProfile(supabase, user.id);
  if (error) console.error("[profil] lecture impossible :", error.code);

  if (!profile) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Mon profil</h1>
        <p role="alert">Impossible de charger ton profil pour le moment.</p>
        <Link href="/profil" className={linkClass}>
          Réessayer
        </Link>
      </div>
    );
  }

  const name = profile.display_name ?? profile.username;
  // Présence de la position seulement : les coordonnées, même arrondies, ne sont pas affichées ici.
  const hasLocation = profile.approx_lat !== null && profile.approx_lng !== null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Mon profil</h1>
        <AvatarUploader userId={user.id} avatarUrl={profile.avatar_url} name={name} />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pseudo : <strong>@{profile.username}</strong> (non modifiable).{" "}
          <Link href={`/u/${profile.username}`} className={linkClass}>
            Voir mon profil public
          </Link>
        </p>
      </div>

      <Section id="infos" title="Mes informations">
        <ProfileForm
          displayName={profile.display_name ?? ""}
          bio={profile.bio ?? ""}
          city={profile.city ?? ""}
        />
      </Section>

      <Section id="position" title="Ma position">
        <LocationControls hasLocation={hasLocation} />
      </Section>

      {user.email ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connecté avec <span className="break-all">{user.email}</span>
        </p>
      ) : null}
    </div>
  );
}
