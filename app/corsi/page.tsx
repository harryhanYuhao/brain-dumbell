import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { CorsiGame } from "./CorsiGame";

export const metadata: Metadata = { title: "Corsi Blocks" };

export default function CorsiPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Corsi Blocks"
        instructions="Watch the blocks light up one by one, then tap them in the same order. Get it right and the sequence grows by one. You have two tries at each length, and your score is the longest sequence you remember."
      />
      <CorsiGame />
    </div>
  );
}
