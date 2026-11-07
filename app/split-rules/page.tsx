import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { SplitRulesGame } from "./SplitRulesGame";

export const metadata: Metadata = { title: "Split Rules" };

export default function SplitRulesPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Split Rules"
        instructions="Two cards, two rules, two hands. Your left hand says whether the number is odd or even while your right hand says whether the letter is a vowel or a consonant."
      />
      <SplitRulesGame />
    </div>
  );
}
