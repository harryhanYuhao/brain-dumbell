import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { FlankerGame } from "./FlankerGame";

export const metadata: Metadata = { title: "Flanker Arrows" };

export default function FlankerPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Flanker Arrows"
        instructions="A row of arrows appears. Answer which way the middle arrow points and ignore the rest. Sometimes the neighbours agree with it, sometimes they point the other way."
      />
      <FlankerGame />
    </div>
  );
}
