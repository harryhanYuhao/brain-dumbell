import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { NBackGame } from "./NBackGame";

export const metadata: Metadata = { title: "N-Back" };

export default function NBackPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="N-Back"
        instructions="Squares light up one at a time. Press “Position” when the square is in the same place as the one N steps back. In dual mode a letter is also spoken: press “Sound” when it matches the letter N steps back. Keep the last few in mind as the sequence moves on."
      />
      <NBackGame />
    </div>
  );
}
