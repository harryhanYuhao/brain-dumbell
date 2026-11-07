import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { TwoHandsGame } from "./TwoHandsGame";

export const metadata: Metadata = { title: "Two Hands" };

export default function TwoHandsPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Two Hands"
        instructions="A red and a blue arrow appear somewhere on the board. Your left hand answers the red one with W A S D, your right hand answers the blue one with the arrow keys. Clear both and a new pair appears. Clear as many pairs as you can before time runs out."
      />
      <TwoHandsGame />
    </div>
  );
}
