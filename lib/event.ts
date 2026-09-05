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
} as const;
