import { redirect } from "next/navigation";

// Raiz do app → redireciona para dashboard (middleware cuida de auth)
export default function RootPage() {
  redirect("/dashboard");
}

