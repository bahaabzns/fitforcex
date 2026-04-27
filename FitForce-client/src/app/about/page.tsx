import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | FitForce',
  description:
    'Learn about the mission and vision of FitForce, the ultimate software platform for fitness coaches.',
};

export default function AboutUsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary,#020617)] text-[var(--text-primary,#f9fafb)]">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <h1 className="text-3xl md:text-4xl font-black mb-6">About Us</h1>
        
        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
        FitForce is a powerful management platform built specifically for fitness coaches and online training businesses.
        </p>
        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
        We believe coaching is more than workouts and diet plans — it’s operations, systems, clarity, and scale.
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Our Mission</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
          To help fitness coaches:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
            Manage unlimited clients with confidence
            </li>
            <li>
            Deliver professional training experiences
            </li>
            <li>
            Eliminate operational chaos
            </li>
            <li>
            Scale their business without burnout
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">What Makes FitForce Different</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
            Built for real coaches, not generic software users
            </li>
            <li>
            Designed to handle operations, not just plans
            </li>
            <li>
            Flexible tools that adapt to your coaching style
            </li>
            <li>
            Focused on growth, retention, and efficiency
            </li>
          </ul>
        </section>
        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
        FitForce is not just a tool.
        </p>
        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
        It’s the infrastructure behind serious coaching businesses.
        </p>

      </div>
    </main>
  );
}
