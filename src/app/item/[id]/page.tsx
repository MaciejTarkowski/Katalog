import { Suspense } from "react";
import { ItemContent } from "./ItemContent";
import { T } from "@/components/ui/T";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
  }>;
}

export default function ItemPage({ params, searchParams }: PageProps) {
  return (
    <main className="flex-1 w-full max-w-[480px] mx-auto bg-bg text-tx">
      <Suspense fallback={<p className="text-sm text-mu py-24 text-center"><T k="detail.loading" /></p>}>
        <ItemContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
