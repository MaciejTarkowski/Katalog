import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY } from "@/lib/legal/content";

export const metadata: Metadata = { title: "Katalog – Privacy policy" };

export default function PrivacyPage() {
  return <LegalPage texts={PRIVACY} />;
}
