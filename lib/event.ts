/**
 * The celebration-of-life gathering, surfaced as a pinned ticket in the feed.
 *
 * Everything the ticket prints lives here so wording can be corrected in one
 * place. The full street address is deliberately absent: the Partiful invite
 * releases it only to guests who have replied, so the ticket shows the venue
 * and the town.
 */
export const CELEBRATION = {
  /** Where the ticket goes. Opens in a new tab — it leaves the site. */
  url: "https://partiful.com/e/H6byK7XjnKrAook6HJFp",
  presenter: "Margaret Mikula and the kids",
  headline: "Celebration of Life",
  monthAbbr: "Sep",
  dayOfMonth: "15",
  year: "2026",
  time: "Tue  12:00PM–3:00PM",
  venue: "Cook's Corner",
  town: "Trabuco Canyon, CA",
  /** Printed across the foot of the stub, in the family's own words. */
  facts: ["All welcome", "Band tee or costume", "Tacos"],
  /** Right-hand stub, where a hard ticket carries its admission terms. */
  terms: ["Admits one", "Beers + tears", "No charge"],
  /** Serial down the left stub: his initials and the years on the wordmark. */
  serial: "CDM19622026",
  /**
   * When the gathering ends. After this the ticket stops rendering and the feed
   * grid goes back to plain square tiles — a ticket advertising a finished event
   * is worse than no ticket. Explicit -07:00 (Pacific) so the cutoff is a real
   * moment rather than whatever the reader's clock says.
   */
  endsAt: new Date("2026-09-15T15:00:00-07:00"),
} as const;

/**
 * Whether the gathering is over. Evaluated on the server (the feed page is
 * force-dynamic, so this re-runs every request) and passed down as a boolean —
 * checking the clock in the browser instead would risk the server and client
 * disagreeing across the cutoff, and would trust the reader's system time.
 */
export function isCelebrationOver(now: number = Date.now()): boolean {
  return now >= CELEBRATION.endsAt.getTime();
}
