import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { PatternMemoryGame } from "./PatternMemoryGame";

export const metadata: Metadata = { title: "Pattern Memory" };

export default function PatternMemoryPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Pattern Memory"
        instructions="Some tiles light up for a moment, then go dark. Tap every tile that was lit. Each level adds one more tile, and the grid grows to make room."
      />
      <PatternMemoryGame />
    </div>
  );
}
