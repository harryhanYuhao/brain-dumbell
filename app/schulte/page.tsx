import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { SchulteGame } from "./SchulteGame";

export const metadata: Metadata = { title: "Schulte Table" };

export default function SchultePage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Schulte Table"
        instructions="The board is filled with numbers in random order. Tap them in order from 1 up to the highest as fast as you can. The clock starts when the board appears, and wrong taps are counted as mistakes."
      />
      <SchulteGame />
    </div>
  );
}
