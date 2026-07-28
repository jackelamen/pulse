"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUi } from "@/lib/ui/store";

/**
 * Deep-link handler for `?task=<id>`.
 *
 * Lets other apps (xFocus time blocks, notifications, bookmarks) link straight
 * to a task: we open the task detail panel, then strip the param so a refresh
 * or back-navigation doesn't reopen it.
 */
export function TaskDeepLink() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const openTask = useUi((s) => s.openTask);

  useEffect(() => {
    const id = params.get("task");
    if (!id) return;
    openTask(id);

    const next = new URLSearchParams(params.toString());
    next.delete("task");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router, openTask]);

  return null;
}
