import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy | FitForce',
  description:
    'Understand how refunds, cancellations, trials, and billing work for your FitForce subscription.',
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary,#020617)] text-[var(--text-primary,#f9fafb)]">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <h1 className="text-3xl md:text-4xl font-black mb-6">Refund Policy</h1>
        <p className="text-sm text-[var(--text-tertiary,#9ca3af)] mb-8">Effective Date: 14 Dec, 2025</p>

        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
        At FitForce, we are committed to delivering a high-quality software experience for fitness coaches. Please read our refund policy carefully before subscribing.
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Subscription-Based Service</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
          FitForce is a Software as a Service (SaaS) platform. By subscribing, you gain immediate access to digital tools, features, and system capabilities.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Refund Eligibility</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">No refunds are provided for:</p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
            Partial usage of a subscription period
            </li>
            <li>
            Downgrades or unused features
            </li>
            <li>
            Change of mind after using the platform
            </li>
          </ul>
          <p className="mt-2 text-[var(--text-secondary,#e5e7eb)]">
          Refunds may be considered only in the following case:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
            A technical issue that completely prevents platform usage and cannot be resolved by our support team within a reasonable timeframe
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Free Trial</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
          If a free trial is offered, we strongly recommend using it to evaluate FitForce before purchasing. Once a paid plan is activated, the refund policy applies.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">Contact for Refund Requests</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
          All refund requests must be submitted in writing via email, including clear details of the issue.
          </p>
          <p className="mt-3 text-[var(--text-secondary,#e5e7eb)]">
            📧 Email:{' '}
            <a href="mailto:info@fitforce.io" className="text-cyan-400">
            info@fitforce.io
            </a>
          </p>
          <p className="mt-3 text-[var(--text-secondary,#e5e7eb)]">
          FitForce reserves the right to approve or reject refund requests based on fair assessment.
          </p>
        </section>
      </div>
    </main>
  );
}


