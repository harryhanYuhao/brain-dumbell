import type { Metadata } from "next";
import { ExerciseHeader } from "../components/ExerciseHeader";
import { ReactionGame } from "./ReactionGame";

export const metadata: Metadata = { title: "Reaction Time" };

export default function ReactionPage() {
  return (
    <div className="flex flex-col gap-8">
      <ExerciseHeader
        title="Reaction Time"
        instructions="The panel starts green. After a random delay it turns red — click (or press Space) as fast as you can. Click while it's still green and the round is restarted. Five rounds, then you'll see your average."
      />
      <ReactionGame />
    </div>
  );
}
