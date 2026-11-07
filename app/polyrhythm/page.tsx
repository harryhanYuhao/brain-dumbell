import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { PolyrhythmGame } from "./PolyrhythmGame";

export const metadata: Metadata = { title: "Polyrhythm" };

export default function PolyrhythmPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Polyrhythm"
        instructions="Tap two different beats at once: say, two taps with your left hand in the time your right hand taps three. Your hands want to fall into the same rhythm. Don't let them."
      />
      <PolyrhythmGame />
    </div>
  );
}
