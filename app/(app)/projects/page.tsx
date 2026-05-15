import { ListsIndexClient } from "../lists/lists-index-client";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Groups of related tasks. Tasks can still live outside a project.
        </p>
      </header>
      <ListsIndexClient />
    </div>
  );
}
