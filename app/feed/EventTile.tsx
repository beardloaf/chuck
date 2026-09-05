import { CELEBRATION as E } from "@/lib/event";
import { asset } from "@/lib/site";

/**
 * The celebration-of-life ticket, docked at the bottom of the feed rather than
 * occupying a cell in it — so the grid stays nothing but memories.
 *
 * At rest it peeks up from the bottom edge at a slight tilt. Hovering brings the
 * whole ticket up, straightens it and holds it 20px clear of the edge; the
 * pointer leaving drops it back. `show` is false once the page is scrolled, at
 * which point it drops away entirely and the floating "Add a memory" button
 * takes the same band — the two never share it.
 *
 * Sizing is unchanged from the in-grid version: the interior is expressed in
 * container units, so narrowing the ticket to dock width scales the whole thing
 * as one object with no separate small-size layout.
 *
 * It leaves the site, so it renders as a plain external <a>.
 */
export function EventTile({ show }: { show?: boolean }) {
  const mark = {
    WebkitMaskImage: `url(${asset("/mikula-ink.png")})`,
    maskImage: `url(${asset("/mikula-ink.png")})`,
  };

  return (
    <a
      href={E.url}
      target="_blank"
      rel="noopener noreferrer"
      className="event-dock"
      data-show={show ? "true" : "false"}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      aria-label={`${E.headline} for Charles Mikula — ${E.monthAbbr} ${E.dayOfMonth} ${E.year}, ${E.time}, at ${E.venue}, ${E.town}. RSVP on Partiful, opens in a new tab.`}
    >
      <article className="tile event-ticket">
        <div className="et-stub et-stub-left">
          <span className="et-serial">{E.serial}</span>
        </div>

        <div className="et-main">
          <p className="et-presenter">{E.presenter}</p>
          <p className="et-stars" aria-hidden>
            * ** PRESENT ** *
          </p>

          <div className="et-mark" style={mark} role="img" aria-label="Mikula" />

          <p className="et-headline">{E.headline}</p>

          <div className="et-rule" aria-hidden />

          <div className="et-info">
            <div className="et-date">
              <span className="et-date-month">{E.monthAbbr}</span>
              <span className="et-date-day">{E.dayOfMonth}</span>
              <span className="et-date-year">{E.year}</span>
            </div>
            <div className="et-where">
              <p>{E.time}</p>
              <p>{E.venue}</p>
              <p>{E.town}</p>
            </div>
          </div>

          <div className="et-facts">
            {E.facts.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>

        <div className="et-stub et-stub-right">
          <div className="et-terms">
            {E.terms.map((t) => (
              <span key={t} className="et-term">
                {t}
              </span>
            ))}
          </div>
          <span className="et-rsvp">
            <span className="et-rsvp-word">RSVP</span>
            <span className="et-rsvp-arrow" aria-hidden>
              &#8599;
            </span>
          </span>
        </div>
      </article>
    </a>
  );
}
