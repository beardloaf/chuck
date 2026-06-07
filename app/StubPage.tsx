/** Placeholder for nav destinations that aren't built yet. */
export function StubPage({ title }: { title: string }) {
  return (
    <div className="stub">
      <p className="stub-eyebrow">{title}</p>
      <h1 className="stub-title">Coming soon</h1>
      <p className="stub-body">
        This corner of Mikula isn&apos;t built yet. Check back later.
      </p>
    </div>
  );
}
