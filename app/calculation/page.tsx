import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { CalculationGame } from "./CalculationGame";

export const metadata: Metadata = { title: "Quick Maths" };

export default function CalculationPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Quick Maths"
        instructions="Solve as many questions as you can before the clock runs out. Choose the size of the numbers, which operations to use, the number type and the time limit, then press start."
      />
      <CalculationGame />
    </div>
  );
}
