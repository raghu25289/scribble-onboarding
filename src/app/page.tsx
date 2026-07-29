import OnboardingFlow from "@/components/OnboardingFlow";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-10 sm:px-8">
      <header className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: "var(--lime-deep)" }}
        />
        <span className="font-display text-lg font-semibold tracking-tight">
          Scribble
        </span>
        <span className="ml-2 text-xs text-[var(--ink-45)]">AI visibility for brands</span>
      </header>

      <OnboardingFlow />

      <footer className="mt-auto pt-16 text-center text-xs text-[var(--ink-45)]">
        Scribble checks whether AI assistants recommend your brand where it counts.
      </footer>
    </main>
  );
}
