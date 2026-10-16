import Link from "next/link";

export function ExerciseHeader({
  title,
  instructions,
}: {
  title: string;
  instructions: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← All exercises
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-xl text-muted">{instructions}</p>
    </div>
  );
}
