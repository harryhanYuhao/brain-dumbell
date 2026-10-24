import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { StroopGame } from "./StroopGame";

export const metadata: Metadata = { title: "Stroop Clash" };

export default function StroopPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Stroop Clash"
        instructions="A colour word appears in a coloured ink, and the two often clash. Answer with the ink colour, not the word, as fast as you can. Your brain will want to read the word, and holding that back is the exercise."
      />
      <StroopGame />
    </div>
  );
}
