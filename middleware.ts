import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets, Next internals, and the public
     * PWA files (manifest, service worker, offline fallback). The manifest and
     * its icons must be fetchable without auth or Chrome's install prompt shows
     * a generic placeholder icon instead of the app icon.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
