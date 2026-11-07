import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { PairsGame } from "./PairsGame";

export const metadata: Metadata = { title: "Memory Pairs" };

export default function PairsPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Memory Pairs"
        instructions="All cards start face down. Flip two at a time: if they match they stay up, if not they turn back over. Remember where you saw each symbol and clear the board in as few moves as you can."
      />
      <PairsGame />
    </div>
  );
}
