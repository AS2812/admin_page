import { useAuth as useAuthContext, type AuthSession } from "../providers/AuthProvider";

export type SessionState = AuthSession;

export function useAuth(): SessionState {
  return useAuthContext();
}
