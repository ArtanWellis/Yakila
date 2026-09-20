import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/lib/supabase";
import { nextAuthState, type AuthState, type SignedInState } from "./auth-state";

const AuthContext = createContext<AuthState | null>(null);

/**
 * Expose l'état d'authentification à toute l'application et pilote le rafraîchissement du jeton.
 * La session elle-même reste dans le client Supabase (et le stockage sécurisé) : le contexte ne
 * garde que l'identité minimale, pour ne pas re-rendre l'application à chaque rafraîchissement.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // `onAuthStateChange` émet `INITIAL_SESSION` dès l'abonnement : pas besoin de `getSession()`.
    // Ne rien appeler d'asynchrone sur `supabase` dans ce callback (risque d'interblocage).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((previous) => nextAuthState(previous, session?.user ?? null));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Le rafraîchissement automatique ne tourne qu'au premier plan : en arrière-plan le timer
    // JavaScript n'est pas fiable, et le jeton est vérifié au retour dans l'application.
    const applyAppState = (status: AppStateStatus) => {
      if (status === "active") void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    };
    applyAppState(AppState.currentState);
    const subscription = AppState.addEventListener("change", applyAppState);
    return () => {
      subscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (state === null) throw new Error("useAuth doit être utilisé sous <SessionProvider>.");
  return state;
}

/**
 * Utilisateur connecté, ou `null`. Pendant une déconnexion, un écran protégé peut se rendre une
 * dernière fois avant que la navigation ne le retire : il doit alors rendre `null`, pas planter.
 */
export function useSignedInUser(): SignedInState | null {
  const state = useAuth();
  return state.status === "signed-in" ? state : null;
}
