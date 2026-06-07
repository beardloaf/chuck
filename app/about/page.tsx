import { SiteNav } from "@/app/SiteNav";
import { StubPage } from "@/app/StubPage";

export const metadata = { title: "About · Mikula" };

export default function AboutStub() {
  return (
    <div className="w-full max-w-[2000px] mx-auto px-4 sm:px-6 py-8">
      <SiteNav />
      <StubPage title="About" />
    </div>
  );
}
