import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { GoNoGoGame } from "./GoNoGoGame";

export const metadata: Metadata = { title: "Go / No-Go" };

export default function GoNoGoPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Go / No-Go"
        instructions="A shape appears after a short pause. Press as fast as you can when it is a green GO circle, and hold still when it is a red STOP sign. Most shapes are GO, so the urge to press builds up: resisting it is the exercise."
      />
      <GoNoGoGame />
    </div>
  );
}
