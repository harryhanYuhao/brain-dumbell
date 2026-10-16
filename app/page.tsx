import Link from "next/link";
import { exercises } from "./exercises";

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4 pt-6">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Brain training
        </p>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          A gym for your mind.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-muted">
          Brain Dumbell is a set of short, focused exercises. Each one takes
          under a minute — pick one, give it your full attention, and try to
          beat your last score.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          Exercises
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {exercises.map((exercise) => (
            <li key={exercise.href}>
              <Link
                href={exercise.href}
                className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
              >
                <span
                  aria-hidden
                  className="grid size-12 place-items-center rounded-xl bg-accent-soft text-2xl font-bold text-accent"
                >
                  {exercise.icon}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">
                    {exercise.tagline}
                  </p>
                  <h3 className="text-xl font-semibold">{exercise.name}</h3>
                </div>
                <p className="flex-1 text-sm leading-6 text-muted">
                  {exercise.description}
                </p>
                <span className="text-sm font-medium text-accent">
                  Start training{" "}
                  <span className="inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
