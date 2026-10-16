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
];
