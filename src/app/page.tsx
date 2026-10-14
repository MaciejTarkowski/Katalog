import { Dashboard } from "@/components/dashboard/Dashboard";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 sm:p-8 bg-slate-950 text-slate-100">
      <header className="w-full max-w-6xl flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            K
          </div>
          <h1 className="text-xl font-bold tracking-tight">Katalog</h1>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
          PWA
        </span>
      </header>

      <section className="w-full max-w-6xl my-6 flex flex-col items-center">
        <Dashboard />
      </section>

      <footer className="w-full max-w-6xl text-center py-4 border-t border-slate-900 text-xs text-slate-500">
        Katalog PWA &copy; 2026. Tryb oszczędności tokenów i automatycznych testów.
      </footer>
    </main>
  );
}
