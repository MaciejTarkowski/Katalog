"use client";

import { use } from "react";
import { ItemDetailView } from "@/components/items/ItemDetailView";

interface ItemContentProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
  }>;
}

export function ItemContent({ params, searchParams }: ItemContentProps) {
  const { id } = use(params);
  const { from } = use(searchParams);
  return <ItemDetailView itemId={id} fromShare={from === "share"} />;
}
