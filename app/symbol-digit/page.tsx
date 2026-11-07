import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { SymbolDigitGame } from "./SymbolDigitGame";

export const metadata: Metadata = { title: "Symbol Digit" };

export default function SymbolDigitPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Symbol Digit"
        instructions="A key pairs nine symbols with the digits 1 to 9. A symbol appears below it: press its digit, then the next one, and the next. Match as many as you can before time runs out."
      />
      <SymbolDigitGame />
    </div>
  );
}
