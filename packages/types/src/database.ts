/**
 * Types de la base, écrits à la main pour la phase 1 (le contrat de `docs/database.md`).
 * À remplacer par la sortie du générateur une fois les migrations poussées :
 *   pnpm exec supabase gen types typescript --project-id iapbmccyucfcdktmmkkj > packages/types/src/database.ts
 * Le format est celui du générateur, pour que le remplacement ne change rien côté appelants.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          bio: string | null;
          avatar_url: string | null;
          city: string | null;
          approx_lat: number | null;
          approx_lng: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          city?: string | null;
          approx_lat?: number | null;
          approx_lng?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          city?: string | null;
          approx_lat?: number | null;
          approx_lng?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profile_private: {
        Row: {
          id: string;
          exact_lat: number;
          exact_lng: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          exact_lat: number;
          exact_lng: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          exact_lat?: number;
          exact_lng?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_private_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      set_profile_location: {
        Args: { p_lat: number; p_lng: number };
        Returns: undefined;
      };
      clear_profile_location: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
