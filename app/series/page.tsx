import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { SeriesGame } from "./SeriesGame";

export const metadata: Metadata = { title: "Number Series" };

export default function SeriesPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Number Series"
        instructions="Each question shows the start of a number sequence. Work out the rule and type the next number. After each answer you'll see the rule, so you learn the patterns as you go."
      />
      <SeriesGame />
    </div>
  );
}
