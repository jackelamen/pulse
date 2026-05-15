import { Button } from "@/components/ui/button";

export function Placeholder({
  title,
  caption,
  showSignOut = false,
}: {
  title: string;
  caption: string;
  showSignOut?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{caption}</p>

      <div className="pulse-pane mt-6 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </div>

      {showSignOut && (
        <form action="/auth/signout" method="post" className="mt-6">
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      )}
    </div>
  );
}
