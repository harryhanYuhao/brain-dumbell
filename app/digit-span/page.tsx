import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { DigitSpanGame } from "./DigitSpanGame";

export const metadata: Metadata = { title: "Digit Span" };

export default function DigitSpanPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Digit Span"
        instructions="Digits appear one at a time. When they stop, type them back in the same order, or in reverse in backward mode. Get it right and the next sequence is one digit longer. Two misses at the same length end the run."
      />
      <DigitSpanGame />
    </div>
  );
}
