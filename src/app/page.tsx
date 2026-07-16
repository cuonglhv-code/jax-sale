import { redirect } from "next/navigation";

// Root simply routes into the authenticated workspace; the Layer-1 guard (src/proxy.ts) sends
// unauthenticated visitors to /login. Built out in later phases.
export default function Home() {
  redirect("/tasks");
}
