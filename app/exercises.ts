export const categories = [
  {
    id: "memory",
    name: "Memory",
    blurb: "Hold more in mind, for longer.",
  },
  {
    id: "attention",
    name: "Attention & control",
    blurb: "Focus on what matters and ignore what doesn't.",
  },
  {
    id: "speed",
    name: "Speed & timing",
    blurb: "React faster and keep a steady inner clock.",
  },
  {
    id: "reasoning",
    name: "Reasoning",
    blurb: "Numbers, patterns and shapes in your head.",
  },
  {
    id: "coordination",
    name: "Coordination",
    blurb: "Get both hands working at once.",
  },
] as const;

export type CategoryId = (typeof categories)[number]["id"];

export type Exercise = {
  href: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  category: CategoryId;
};

export const exercises: Exercise[] = [
  {
    href: "/n-back",
    name: "N-Back",
    tagline: "Working memory",
    description:
      "Spot when a square, or a spoken letter in dual mode, matches the one N steps back. It levels up as you improve.",
    icon: "N",
    category: "memory",
  },
  {
    href: "/digit-span",
    name: "Digit Span",
    tagline: "Verbal memory span",
    description:
      "Digits flash one at a time. Type them back, forwards or in reverse. Each success adds a digit.",
    icon: "7",
    category: "memory",
  },
  {
    href: "/corsi",
    name: "Corsi Blocks",
    tagline: "Spatial memory span",
    description:
      "Watch blocks light up, then tap them back in order, or in reverse if you're brave. The sequence grows until you slip.",
    icon: "▦",
    category: "memory",
  },
  {
    href: "/pattern-memory",
    name: "Pattern Memory",
    tagline: "Visual memory",
    description:
      "A pattern of tiles lights up for a moment. Tap them all back. Every level adds a tile and the grid keeps growing.",
    icon: "▚",
    category: "memory",
  },
  {
    href: "/pairs",
    name: "Memory Pairs",
    tagline: "Visual recall",
    description:
      "The classic card game. Flip two cards at a time and find every matching pair in as few moves as you can.",
    icon: "🂠",
    category: "memory",
  },
  {
    href: "/stroop",
    name: "Stroop Clash",
    tagline: "Impulse control",
    description:
      "The word says RED but the ink is blue. Name the ink, not the word, and see how much a clashing word slows you down.",
    icon: "Aa",
    category: "attention",
  },
  {
    href: "/flanker",
    name: "Flanker Arrows",
    tagline: "Selective attention",
    description:
      "Which way does the middle arrow point? Easy, until its neighbours point the other way.",
    icon: "⇇",
    category: "attention",
  },
  {
    href: "/go-no-go",
    name: "Go / No-Go",
    tagline: "Response inhibition",
    description:
      "Hit GO as fast as you can, but freeze on STOP. Speed builds a habit; this game tests your brakes.",
    icon: "✋",
    category: "attention",
  },
  {
    href: "/schulte",
    name: "Schulte Table",
    tagline: "Focus & visual search",
    description:
      "Find the numbers in order on a scrambled grid as fast as you can. Start at 3 × 3 and work up to 9 × 9.",
    icon: "#",
    category: "attention",
  },
  {
    href: "/reaction",
    name: "Reaction Time",
    tagline: "Raw reflexes",
    description:
      "Wait for green to turn red, then click as fast as you can. Too early and it doesn't count. Five rounds, one average.",
    icon: "⚡",
    category: "speed",
  },
  {
    href: "/symbol-digit",
    name: "Symbol Digit",
    tagline: "Processing speed",
    description:
      "Match symbols to digits using a key, as many as you can before time runs out. Based on a standard clinical test.",
    icon: "◇",
    category: "speed",
  },
  {
    href: "/trails",
    name: "Trail Making",
    tagline: "Task switching",
    description:
      "Join scattered circles in order: 1-2-3, or alternating 1-A-2-B in Part B. The switching is the hard part.",
    icon: "⤳",
    category: "speed",
  },
  {
    href: "/time-sense",
    name: "Time Sense",
    tagline: "Interval timing",
    description:
      "Stop the hidden clock at exactly 5 seconds. Find out whether your inner clock runs fast or slow.",
    icon: "⏱",
    category: "speed",
  },
  {
    href: "/calculation",
    name: "Quick Maths",
    tagline: "Mental arithmetic",
    description:
      "Race the clock on mental arithmetic. Choose the digits, operations (+ − × ÷ and powers), integers, decimals or fractions, and the time limit.",
    icon: "±",
    category: "reasoning",
  },
  {
    href: "/series",
    name: "Number Series",
    tagline: "Pattern reasoning",
    description:
      "2, 5, 9, 14, … what comes next? Crack the rule behind each sequence, from simple steps to interleaved series.",
    icon: "…",
    category: "reasoning",
  },
  {
    href: "/rotation",
    name: "Mental Rotation",
    tagline: "Spatial reasoning",
    description:
      "Is the shape on the right the same one turned around, or its mirror image? Spin it in your head to find out.",
    icon: "↻",
    category: "reasoning",
  },
  {
    href: "/two-hands",
    name: "Two Hands",
    tagline: "Bimanual coordination",
    description:
      "A red arrow for your left hand on W A S D, a blue one for your right on the arrow keys. Clear both, get a new pair, and keep going until time runs out.",
    icon: "⇄",
    category: "coordination",
  },
  {
    href: "/twin-lanes",
    name: "Twin Lanes",
    tagline: "Split attention",
    description:
      "Two cars, two hands, four lanes. Catch the circles and dodge the squares on both sides at once as the road speeds up.",
    icon: "⇉",
    category: "coordination",
  },
  {
    href: "/twin-steer",
    name: "Twin Steer",
    tagline: "Parallel control",
    description:
      "Drive a red dot with W A S D and a blue dot with the arrow keys at the same time, collecting rings without crashing them together.",
    icon: "◎",
    category: "coordination",
  },
  {
    href: "/polyrhythm",
    name: "Polyrhythm",
    tagline: "Independent timing",
    description:
      "Tap 2 against 3, or 3 against 4, one rhythm per hand. Your hands want to sync up; keep them apart.",
    icon: "♩",
    category: "coordination",
  },
  {
    href: "/split-rules",
    name: "Split Rules",
    tagline: "Divided thinking",
    description:
      "Left hand: is the number odd or even? Right hand: is the letter a vowel? Answer both at once, even when the cards swap sides.",
    icon: "½",
    category: "coordination",
  },
  {
    href: "/chords",
    name: "Key Chords",
    tagline: "Simultaneity",
    description:
      "Strike a left-hand and a right-hand letter at exactly the same moment. Find out which hand jumps the gun.",
    icon: "⌨",
    category: "coordination",
  },
];
