import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { RotationGame } from "./RotationGame";

export const metadata: Metadata = { title: "Mental Rotation" };

export default function RotationPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Mental Rotation"
        instructions="Two shapes appear side by side. Decide whether the right one is the left one turned around, or its mirror image. Answer as many as you can before time runs out."
      />
      <RotationGame />
    </div>
  );
}
