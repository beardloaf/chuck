import { SiteNav } from "@/app/SiteNav";
import { StubPage } from "@/app/StubPage";

export const metadata = { title: "Party · Mikula" };

export default function PartyStub() {
  return (
    <div className="w-full max-w-[2000px] mx-auto px-4 sm:px-6 py-8">
      <SiteNav />
      <StubPage title="Party" />
    </div>
  );
}
