import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | FitForce',
  description:
    'Learn how FitForce collects, uses, and protects your personal data as a fitness SaaS platform for coaches and clients.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary,#020617)] text-[var(--text-primary,#f9fafb)]">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <h1 className="text-3xl md:text-4xl font-black mb-6">Privacy Policy</h1>
        <p className="text-sm text-[var(--text-tertiary,#9ca3af)] mb-8">Effective Date: 14 Dec, 2025</p>

        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
          Your privacy matters. This Privacy Policy explains how FitForce collects, uses, and protects your data.
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Information We Collect</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            We may collect:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              Personal information (name, email, phone number)
            </li>
            <li>
              Account and subscription details
            </li>
            <li>
              Client data entered by coaches (managed securely)
            </li>
            <li>
              Usage data to improve platform performance
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">How We Use Your Information</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            Your data is used to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              Operate and improve FitForce services
            </li>
            <li>
              Manage accounts and subscriptions
            </li>
            <li>
              Provide technical support
            </li>
            <li>
              Communicate important updates
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Data Protection</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
            We apply industry-standard security measures
            </li>
            <li>
            Client data belongs to the coach — FitForce does not sell or share it
            </li>
            <li>
            Access to data is restricted and monitored
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Third-Party Services</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
          FitForce may use trusted third-party services (payment gateways, analytics tools) strictly to operate the platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">Your Rights</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
          You have the right to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
            Request access to your data
            </li>
            <li>
            Request correction or deletion of your data
            </li>
            <li>
            Cancel your account at any time
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">Contact Us</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
          For privacy-related questions, contact us at:
          </p>
          <p className="mt-3 text-[var(--text-secondary,#e5e7eb)]">
            📧 Email:{' '}
            <a href="mailto:info@fitforce.io" className="text-cyan-400">
              info@fitforce.io
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}


