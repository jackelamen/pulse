import { redirect } from "next/navigation";

export default function RootPage() {
  // Middleware sends unauthenticated users to /login.
  // Authenticated users land on Today.
  redirect("/today");
}
