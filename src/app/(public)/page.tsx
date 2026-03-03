import { redirect } from "next/navigation";

// Redireciona a raiz /  →  /dashboard (middleware lida com auth)
export default function HomePage() {
  redirect("/dashboard");
}
