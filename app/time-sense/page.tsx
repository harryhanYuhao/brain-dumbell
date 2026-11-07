import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { TimeSenseGame } from "./TimeSenseGame";

export const metadata: Metadata = { title: "Time Sense" };

export default function TimeSensePage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Time Sense"
        instructions="Start the clock, then stop it when you think the target time has passed. There is no timer on screen, so you have to feel it."
      />
      <TimeSenseGame />
    </div>
  );
}
