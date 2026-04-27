import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | FitForce',
  description:
    'Read the terms and conditions for using FitForce, the fitness coaching platform for web and mobile.',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary,#020617)] text-[var(--text-primary,#f9fafb)]">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <h1 className="text-3xl md:text-4xl font-black mb-6">Terms of Service</h1>
        <p className="text-sm text-[var(--text-tertiary,#9ca3af)] mb-8">Last updated: 26 November 2025</p>

        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of FitForce (the &quot;Service&quot;),
          including our website, web application, and mobile applications. By creating an account or using FitForce,
          you agree to be bound by these Terms. If you do not agree, please do not use the Service.
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">1. Who We Are</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            FitForce is a software platform based in Egypt that helps fitness coaches, gyms, and organizations manage
            their coaching business, including clients, workout plans, nutrition plans, and progress tracking. We may
            serve users from around the world, but our primary operations are in Egypt.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">2. Eligibility & Accounts</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>You must be at least 18 years old (or the legal age of majority in your country) to use FitForce.</li>
            <li>
              You are responsible for providing accurate registration information and keeping your login credentials
              secure.
            </li>
            <li>
              You are responsible for all activity that occurs under your account. If you believe your account has been
              compromised, you must notify us immediately.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">3. Use of the Service</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            Subject to these Terms and payment of applicable fees, we grant you a limited, non-exclusive,
            non-transferable license to access and use FitForce for your own coaching business or organization.
          </p>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">You agree not to:</p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>Use the Service for illegal purposes or in violation of any applicable laws or regulations.</li>
            <li>
              Copy, modify, reverse engineer, decompile, or attempt to extract the source code of the Service, except
              where allowed by law.
            </li>
            <li>
              Upload or transmit any harmful, offensive, or infringing content, including content that violates
              third-party privacy, intellectual property, or other rights.
            </li>
            <li>
              Attempt to gain unauthorized access to other users&apos; accounts, our systems, or any part of the
              infrastructure.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">4. Coaches and Clients</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              If you are a coach or organization, you are solely responsible for your relationship with your clients,
              including the quality and safety of any training, nutrition, or advice you provide.
            </li>
            <li>
              FitForce provides tools and infrastructure but does not control or supervise the actual coaching services
              delivered by you.
            </li>
            <li>
              You are responsible for obtaining any necessary consents from your clients and for complying with
              applicable health, privacy, and consumer protection laws in your jurisdiction.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">5. Payments, Subscriptions & Refunds</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            Access to certain parts of the Service requires a paid subscription. Subscription terms, automatic renewals,
            cancellations, and refunds are governed by our{' '}
            <a href="/refund-policy" className="text-cyan-400">
              Refund &amp; Cancellation Policy
            </a>
            , which is incorporated into these Terms by reference. Payments are processed through our payment partners
            such as Paymob or others we may use from time to time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">6. Data Protection & Privacy</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            Our collection and use of personal data is described in our{' '}
            <a href="/privacy" className="text-cyan-400">
              Privacy Policy
            </a>
            . By using the Service, you agree that we may process your information in accordance with that Policy. You
            are also responsible for how you handle any personal data about your own clients that you store in FitForce.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">7. Intellectual Property</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              All rights, title, and interest in and to the Service (including software, design, logos, and content we
              provide) are owned by us or our licensors.
            </li>
            <li>
              You retain ownership of content you upload to FitForce (such as your branding, plans, and client content),
              but you grant us a limited license to host, process, and display that content as needed to operate the
              Service.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">8. Health & Medical Disclaimer</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            FitForce is not a medical service and does not provide medical advice. Any health, fitness, or nutrition
            information available through the Service is for general informational purposes only and does not replace
            professional medical advice, diagnosis, or treatment. Users should always consult a qualified healthcare
            professional before starting any new exercise or nutrition program. We are not responsible for any injury or
            health issue resulting from the use of training or nutrition programs created or delivered through FitForce.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">9. Service Availability & Changes</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We strive to keep FitForce available and running smoothly, but we do not guarantee uninterrupted or
            error-free operation. We may modify, suspend, or discontinue parts of the Service at any time (for example,
            to perform maintenance, improve features, or address security issues). Where reasonable, we will try to
            notify you in advance of major changes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">10. Disclaimer of Warranties</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
            whether express or implied. To the maximum extent permitted by law, we disclaim all warranties, including
            implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not
            guarantee that the Service will meet your requirements, achieve specific results, or be free of errors or
            security vulnerabilities.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">11. Limitation of Liability</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            To the maximum extent permitted by law, FitForce and its owners, employees, and partners will not be liable
            for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits,
            revenues, data, or business opportunities arising out of or related to your use of the Service. Our total
            aggregate liability for any claim relating to the Service will be limited to the amount you paid for the
            Service in the 3 months preceding the event giving rise to the claim.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">12. Termination</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            You may stop using the Service and cancel your subscription at any time. We may suspend or terminate your
            access to the Service if you materially breach these Terms, misuse the platform, or engage in fraud or
            illegal activity. Upon termination, your right to use the Service will end, but certain sections of these
            Terms (including those relating to payments due, intellectual property, limitations of liability, and
            dispute resolution) will continue to apply.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">13. Governing Law & Disputes</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            These Terms are governed by the laws of the Arab Republic of Egypt, without regard to its conflict of law
            principles. Any dispute arising out of or relating to the Service or these Terms will be subject to the
            exclusive jurisdiction of the courts of Cairo, Egypt, unless applicable consumer protection laws in your
            country give you additional mandatory rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">14. Changes to These Terms</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We may update these Terms from time to time. When we make significant changes, we will update the &quot;Last
            updated&quot; date at the top of this page and, where appropriate, notify you by email or through the
            Service. Your continued use of FitForce after the updated Terms become effective means you accept them.
          </p>
          <p className="mt-3 text-[var(--text-secondary,#e5e7eb)]">
            If you have any questions about these Terms, please contact us at{' '}
            <a href="mailto:support@fitforce.io" className="text-cyan-400">
              support@fitforce.io
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}


