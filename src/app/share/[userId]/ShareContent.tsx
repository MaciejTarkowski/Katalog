"use client";

import { use } from "react";
import { PublicCollectionView } from "@/components/items/PublicCollectionView";

interface ShareContentProps {
  params: Promise<{
    userId: string;
  }>;
}

export function ShareContent({ params }: ShareContentProps) {
  const { userId } = use(params);
  return <PublicCollectionView userId={userId} />;
}
