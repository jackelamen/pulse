import { ListsIndexClient } from "../lists/lists-index-client";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="pulse-page">
      <header className="mb-6">
        <h1 className="pulse-title">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Groups of related tasks. Tasks can still live outside a project.
        </p>
      </header>
      <ListsIndexClient />
    </div>
  );
}
