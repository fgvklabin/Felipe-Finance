import { destroySession } from "@/lib/auth";
import { handler, json } from "@/lib/api";

export const POST = handler("auth/logout", async () => {
  await destroySession();
  return json({ ok: true });
});
