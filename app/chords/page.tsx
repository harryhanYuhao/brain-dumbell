import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { ChordsGame } from "./ChordsGame";

export const metadata: Metadata = { title: "Key Chords" };

export default function ChordsPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Key Chords"
        instructions="A red letter and a blue letter appear. Strike them at exactly the same moment, left hand and right hand, like a chord on a piano. Close doesn't count."
      />
      <ChordsGame />
    </div>
  );
}
