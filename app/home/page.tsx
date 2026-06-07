import { SiteNav } from "@/app/SiteNav";
import { StubPage } from "@/app/StubPage";

export const metadata = { title: "Home · Mikula" };

export default function HomeStub() {
  return (
    <div className="w-full max-w-[2000px] mx-auto px-4 sm:px-6 py-8">
      <SiteNav />
      <StubPage title="Home" />
    </div>
  );
}
