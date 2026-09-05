import { CELEBRATION as E } from "@/lib/event";
import { asset } from "@/lib/site";

/**
 * Pinned feed cell for the celebration-of-life gathering, printed as a 1990s
 * hard ticket: guilloche security weave, torn stubs down both edges, the band
 * wordmark over a condensed-caps headline, and the date block divided from the
 * venue column by a heavy rule.
 *
 * It spans two grid columns and keeps the 880 × 428 proportions of the design,
 * scaling as one object via container units; below the two-column breakpoint it
 * drops the stubs and stacks (see `.event-ticket` in globals.css).
 *
 * The ticket leaves the site, so it renders as a plain external <a>.
 */
export function EventTile() {
  // The wordmark is a black-and-white plate used as a luminance mask, so the
  // ink colour comes from CSS. Set here (not in the stylesheet) so the URL goes
  // through asset() and survives a sub-path deployment.
  const mark = { WebkitMaskImage: `url(${asset("/mikula-ink.png")})`, maskImage: `url(${asset("/mikula-ink.png")})` };

  return (
    <a
      href={E.url}
      target="_blank"
      rel="noopener noreferrer"
      className="tile-link event-link"
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
