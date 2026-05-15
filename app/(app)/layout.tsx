import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { MobileTabBar } from "@/components/app-shell/mobile-tabbar";
import { KeyboardShortcuts } from "@/components/app-shell/keyboard-shortcuts";
import { ShortcutsOverlay } from "@/components/app-shell/shortcuts-overlay";
import { QuickAddOverlay } from "@/components/tasks/quick-add-overlay";
import { CommandPalette } from "@/components/app-shell/command-palette";
import { TaskDetail } from "@/components/tasks/task-detail";
import { PwaRuntime } from "@/components/app-shell/pwa-runtime";
import { SettingsRuntime } from "@/components/app-shell/settings-runtime";
import { PulseWorkBridge } from "@/components/app-shell/pulse-work-bridge";
import { displayNameForUser } from "@/lib/profile/display";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
    return null;
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden md:flex md:w-80 md:shrink-0">
        <SidebarNav email={user.email} name={displayNameForUser(user)} />
      </aside>
      <main className="pulse-mobile-scroll flex min-w-0 flex-1 flex-col pb-20 md:pb-0">{children}</main>
      <MobileTabBar />
      <KeyboardShortcuts />
      <ShortcutsOverlay />
      <QuickAddOverlay />
      <CommandPalette />
      <TaskDetail />
      <PwaRuntime />
      <SettingsRuntime />
      <PulseWorkBridge />
    </div>
  );
}
