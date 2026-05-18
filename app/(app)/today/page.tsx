import { createClient } from "@/lib/supabase/server";
import { displayNameForUser } from "@/lib/profile/display";
import { TodayClient } from "./today-client";

export const metadata = {
  title: "Today",
};

export default async function TodayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName = displayNameForUser(user);
  const firstName = displayName?.split(/\s+/)[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1480px] px-3 py-4 md:px-7 md:py-8">
      <TodayClient firstName={firstName} />
    </div>
  );
}
