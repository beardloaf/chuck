/**
 * Memorial intro shown between the header and the feed: a small eyebrow
 * (lifespan) above two fluid columns — a large lead statement on the left and
 * a body paragraph on the right.
 *
 * Collapsible: hidden by default and revealed (with a smooth height/fade) by
 * the header's info button, which also collapses it again.
 */
export function Intro({ open }: { open?: boolean }) {
  return (
    <div className="intro-wrap" data-open={open ? "true" : "false"}>
      <div className="intro-wrap-inner" inert={!open}>
        <section className="intro" aria-label="About Charles Mikula">
          <p className="intro-eyebrow">1964 — 2026</p>
          <div className="intro-cols">
            <h2 className="intro-lead">
              Charles “Chuck” Mikula was a charming storyteller, a playful and
              loving husband, the most mischievous grandpa, Dave’s bff, and a
              truly wonderful and caring dad to more kids than just his own.
            </h2>
            <div className="intro-body">
              <p>
                He saw your favorite band before they were famous and just so
                happened to coin the term <em>Speed Metal</em>. Not only was he
                famously one of Elton John’s many lovers, tickling a few keys, he
                was also the inspiration behind 2Pac’s <em>California Love</em>.
                He was the first person to shotgun a beer and always said to
                never let the truth get in the way of a good story. Now picture
                him riding off into the sunset with a conquistador in a golf cart.
                That is all. Rest in Power, poppa. ✊
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
