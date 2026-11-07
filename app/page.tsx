import Link from "next/link";
import { categories, exercises } from "./exercises";

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
          a minute or two — pick one, give it your full attention, and try to
          beat your last score.
        </p>
        <nav aria-label="Categories" className="flex flex-wrap gap-2 pt-2">
          {categories.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm transition-colors hover:border-accent"
            >
              {c.name}{" "}
              <span className="text-muted">
                {exercises.filter((e) => e.category === c.id).length}
              </span>
            </a>
          ))}
        </nav>
      </section>

      {categories.map((c) => (
        <section key={c.id} id={c.id} className="flex scroll-mt-6 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">{c.name}</h2>
            <p className="text-sm text-muted">{c.blurb}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exercises
              .filter((e) => e.category === c.id)
              .map((exercise) => (
                <li key={exercise.href}>
                  <Link
                    href={exercise.href}
                    className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-xl font-bold text-accent"
                      >
                        {exercise.icon}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <h3 className="font-semibold">{exercise.name}</h3>
                        <p className="text-xs text-muted">{exercise.tagline}</p>
                      </div>
                      <span
                        aria-hidden
                        className="ml-auto text-accent opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100"
                      >
                        →
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-muted">{exercise.description}</p>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
