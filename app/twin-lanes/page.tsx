import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { TwinLanesGame } from "./TwinLanesGame";

export const metadata: Metadata = { title: "Twin Lanes" };

export default function TwinLanesPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Twin Lanes"
        instructions="Drive two cars at once, one per hand. Each car switches between its own two lanes: catch the circles, dodge the squares. It keeps speeding up until you run out of lives."
      />
      <TwinLanesGame />
    </div>
  );
}
