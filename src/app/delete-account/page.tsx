import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { DELETE_ACCOUNT } from "@/lib/legal/content";

export const metadata: Metadata = { title: "Katalog – Delete your account" };

export default function DeleteAccountPage() {
  return <LegalPage texts={DELETE_ACCOUNT} />;
}
