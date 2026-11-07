import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { TrailsGame } from "./TrailsGame";

export const metadata: Metadata = { title: "Trail Making" };

export default function TrailsPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Trail Making"
        instructions="Circles are scattered across the board. Tap them in order as fast as you can: 1, 2, 3… in Part A, or alternating 1, A, 2, B, 3, C… in Part B."
      />
      <TrailsGame />
    </div>
  );
}
