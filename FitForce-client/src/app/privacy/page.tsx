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
        <p className="text-sm text-[var(--text-tertiary,#9ca3af)] mb-8">Last updated: 26 November 2025</p>

        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
          FitForce (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is a software platform that helps fitness
          coaches and gyms manage clients, create workout and nutrition plans, and deliver coaching services via web and
          mobile apps. This Privacy Policy explains how we collect, use, and protect your information when you use our
          website, web app, or mobile applications (together, the &quot;Service&quot;).
        </p>

        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
          We are based in Egypt, but we may serve users from around the world. By using our Service, you agree to the
          practices described in this Privacy Policy.
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">1. Information We Collect</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            We collect different types of information depending on how you use FitForce:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              <span className="font-semibold">Account information:</span> name, email address, phone number, password
              (stored in hashed form), and basic profile details.
            </li>
            <li>
              <span className="font-semibold">Billing and payment information:</span> subscription plan, invoices, and
              transaction details. Card and payment data are processed securely by our payment providers (such as
              Paymob) and are not stored in plain text by us.
            </li>
            <li>
              <span className="font-semibold">Coaching and client data:</span> information related to your coaching
              business, including client profiles, workout plans, nutrition plans, progress tracking data, messages,
              notes, and uploaded files or photos.
            </li>
            <li>
              <span className="font-semibold">Usage and device data:</span> log data, IP address, browser type, device
              information, approximate location, and actions you take within the Service. We may use analytics tools to
              understand how the platform is used.
            </li>
            <li>
              <span className="font-semibold">Support communications:</span> messages you send to our support team via
              email, WhatsApp, or other channels.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">2. How We Use Your Information</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            We use the information we collect for the following purposes:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>To create and manage your FitForce account and workspace.</li>
            <li>
              To provide and improve the Service, including creating, delivering, and tracking workout and nutrition
              plans.
            </li>
            <li>To process subscriptions, payments, and invoices through our payment partners.</li>
            <li>To communicate with you about your account, updates, and important notices.</li>
            <li>
              To provide customer support and respond to your questions or requests via email, WhatsApp, or other
              channels.
            </li>
            <li>
              To monitor usage, improve performance, develop new features, and protect against abuse or security
              threats.
            </li>
            <li>To comply with legal obligations and enforce our Terms of Service and Refund Policy.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">3. Legal Bases (for users in certain regions)</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            For users in regions where a legal basis is required (for example, the European Union), we rely on the
            following legal bases to process your personal data:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              <span className="font-semibold">Performance of a contract:</span> to provide you with access to FitForce
              and related services.
            </li>
            <li>
              <span className="font-semibold">Legitimate interests:</span> to maintain and improve our Service, prevent
              fraud and abuse, and protect our legal rights.
            </li>
            <li>
              <span className="font-semibold">Consent:</span> for certain optional features such as marketing
              communications or specific tracking technologies, where required.
            </li>
            <li>
              <span className="font-semibold">Legal obligations:</span> to comply with applicable laws and regulations.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">4. How We Share Information</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            We do not sell your personal data. We may share your information in the following limited circumstances:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              <span className="font-semibold">Service providers:</span> with trusted third parties who help us operate
              the Service (for example, hosting providers, analytics tools, email and messaging services, and payment
              processors such as Paymob). These providers only access your data as needed to perform their services for
              us.
            </li>
            <li>
              <span className="font-semibold">Coaches and clients:</span> if you are a coach, the information you choose
              to store in FitForce about your clients will be visible to you and your authorized team members. If you
              are a client, your coach and their authorized team may view the information you provide through the
              platform.
            </li>
            <li>
              <span className="font-semibold">Legal and safety:</span> when required by law, legal process, or
              governmental request, or when we believe it is necessary to protect our rights, users, or the public.
            </li>
            <li>
              <span className="font-semibold">Business transfers:</span> if we are involved in a merger, acquisition, or
              sale of all or part of our business, your information may be transferred as part of that transaction,
              subject to appropriate confidentiality protections.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">5. International Data Transfers</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We are based in Egypt, but our servers or service providers may be located in other countries. This means
            your information may be transferred to and processed in countries that may have different data protection
            laws than your home country. We take reasonable steps to ensure that your information is treated securely
            and in accordance with this Privacy Policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">6. Data Retention</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We keep your personal data for as long as your account is active or as needed to provide the Service. We may
            also retain certain information for a longer period where necessary to comply with legal, tax, or accounting
            obligations, resolve disputes, or enforce our agreements. When data is no longer needed, we will delete it
            or anonymize it.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">7. Your Rights and Choices</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            Depending on your location, you may have certain rights regarding your personal data, including:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>Accessing the personal data we hold about you.</li>
            <li>Requesting correction of inaccurate or incomplete data.</li>
            <li>Requesting deletion of your data, subject to legal obligations to retain it.</li>
            <li>Objecting to or restricting certain types of processing.</li>
            <li>Withdrawing consent where we rely on consent for processing.</li>
          </ul>
          <p className="mt-2 text-[var(--text-secondary,#e5e7eb)]">
            To exercise these rights, please contact us using the details in the &quot;Contact Us&quot; section below.
            We may ask you to verify your identity before responding to your request.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">8. Security</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We use reasonable technical and organizational measures to protect your information against unauthorized
            access, loss, misuse, or alteration. However, no system can be guaranteed to be 100% secure, and you are
            responsible for keeping your login credentials safe and secure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">9. Children&apos;s Privacy</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            FitForce is not intended for children under 16 years of age, and we do not knowingly collect personal data
            directly from children. If you believe that a child has provided us with personal information, please
            contact us so we can delete it or take appropriate action.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">10. Changes to This Privacy Policy</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We may update this Privacy Policy from time to time. When we make significant changes, we will update the
            &quot;Last updated&quot; date at the top of this page and, where appropriate, notify you through the Service
            or by email. Your continued use of FitForce after changes are posted means you accept the updated Policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">11. Contact Us</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            If you have any questions about this Privacy Policy or how we handle your data, please contact us at:
          </p>
          <p className="mt-3 text-[var(--text-secondary,#e5e7eb)]">
            Email:{' '}
            <a href="mailto:support@fitforce.io" className="text-cyan-400">
              support@fitforce.io
            </a>
            <br />
            FitForce, Cairo, Egypt
          </p>
        </section>
      </div>
    </main>
  );
}


