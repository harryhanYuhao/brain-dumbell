export type Exercise = {
  href: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
};

export const exercises: Exercise[] = [
  {
    href: "/calculation",
    name: "Quick Maths",
    tagline: "Mental arithmetic",
    description:
      "Race the clock on mental arithmetic. Choose the digits, operations (+ − × ÷ and powers), integers, decimals or fractions, and the time limit.",
    icon: "±",
  },
  {
    href: "/reaction",
    name: "Reaction Time",
    tagline: "Speed & inhibition",
    description:
      "Wait for green to turn red, then click as fast as you can. Too early and it doesn't count. Five rounds, one average.",
    icon: "⚡",
  },
  {
    href: "/schulte",
    name: "Schulte Table",
    tagline: "Focus & visual search",
    description:
      "Find the numbers in order on a scrambled grid as fast as you can. Start at 3 × 3 and work up to 9 × 9.",
    icon: "#",
  },
  {
    href: "/stroop",
    name: "Stroop Clash",
    tagline: "Attention & impulse control",
    description:
      "The word says RED but the ink is blue. Name the ink, not the word, and see how much a clashing word slows you down.",
    icon: "Aa",
  },
  {
    href: "/n-back",
    name: "N-Back",
    tagline: "Working memory",
    description:
      "Spot when a square, or a spoken letter in dual mode, matches the one N steps back. It levels up as you improve.",
    icon: "N",
  },
  {
    href: "/corsi",
    name: "Corsi Blocks",
    tagline: "Spatial memory span",
    description:
      "Watch blocks light up, then tap them back in order, or in reverse if you're brave. The sequence grows until you slip.",
    icon: "▦",
  },
];
