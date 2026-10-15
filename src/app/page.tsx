import { Dashboard } from "@/components/dashboard/Dashboard";

export default function Home() {
  return (
    <main className="flex-1 w-full bg-bg text-tx">
      <h1 className="sr-only">Katalog</h1>
      <Dashboard />
    </main>
  );
}
