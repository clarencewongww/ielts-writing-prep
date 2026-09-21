import { useContext } from "react";
import { SessionContext, type SessionContextValue } from "./SessionProvider";

/** Access the session state machine. Must be called inside `<SessionProvider>`. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession() must be used inside <SessionProvider>.");
  return value;
}
