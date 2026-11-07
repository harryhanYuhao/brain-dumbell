import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { TwinSteerGame } from "./TwinSteerGame";

export const metadata: Metadata = { title: "Twin Steer" };

export default function TwinSteerPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Twin Steer"
        instructions="Drive two dots around the board at the same time, one with each hand, and collect the rings of their colour. Their paths cross, so keep them from colliding."
      />
      <TwinSteerGame />
    </div>
  );
}
