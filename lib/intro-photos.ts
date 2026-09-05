/**
 * Photos shown beside the intro text, in order. Filenames match the output of
 * `npm run intro:photos`, which compresses whatever is dropped in `intro-src/`.
 *
 * Keep this list the same length as what that script emits — an entry with no
 * file behind it renders as a broken image, silently.
 */
export interface IntroPhoto {
  src: string;
  alt: string;
}

export const INTRO_PHOTOS: IntroPhoto[] = [
  {
    src: "/intro/intro-1.webp",
    alt: "Chuck grinning in a Chuckweiser t-shirt, gesturing at Miles Davis standing beside him",
  },
  {
    src: "/intro/intro-2.webp",
    alt: "Five band members against a chalkboard scrawled with “Black Flag”, the one in front wearing a Chuck Sabbath t-shirt",
  },
  {
    src: "/intro/intro-3.webp",
    alt: "Someone in black-metal face paint and horns throwing devil horns in a Mikula t-shirt",
  },
  {
    src: "/intro/intro-4.webp",
    alt: "A cold Chuckweiser can on a bar top among bottle caps, beside an opener reading “Today was a good day — Chuck Mikula”",
  },
];
