import { redirect } from "next/navigation";
import Dashboard from "./Dashboard";
import { createClient } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!configured) return <Dashboard userEmail="Concept user" />;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/signin");
  return <Dashboard userEmail={String(data.claims.email || "Signed-in user")} />;
}
