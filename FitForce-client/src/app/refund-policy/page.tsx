import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy | FitForce',
  description:
    'Understand how refunds, cancellations, trials, and billing work for your FitForce subscription.',
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary,#020617)] text-[var(--text-primary,#f9fafb)]">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <h1 className="text-3xl md:text-4xl font-black mb-6">Refund &amp; Cancellation Policy</h1>
        <p className="text-sm text-[var(--text-tertiary,#9ca3af)] mb-8">Last updated: 26 November 2025</p>

        <p className="mb-6 text-[var(--text-secondary,#e5e7eb)]">
          This Refund &amp; Cancellation Policy (&quot;Policy&quot;) explains how subscriptions, cancellations, and
          refunds work for FitForce subscriptions. By creating an account or subscribing to FitForce, you agree to this
          Policy, which forms part of our Terms of Service.
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">1. General</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            FitForce is a subscription-based software service for fitness coaches and organizations. Subscriptions renew
            automatically at the end of each billing period unless cancelled in advance. All prices are typically shown
            in Egyptian Pounds (EGP) unless stated otherwise, and payments are processed securely through our payment
            partners such as Paymob or other providers we may use from time to time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">2. Free Trial</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We may offer a free trial period (for example, 14 days) with access to some or all features of FitForce. The
            duration and conditions of the trial will be communicated on our website or during signup.
          </p>
          <ul className="list-disc list-inside space-y-2 mt-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>You may be required to create an account to start a trial.</li>
            <li>
              If a payment method is required for the trial, you will be informed clearly before confirming.
            </li>
            <li>
              If you do not wish to continue after the trial, you must cancel before the trial ends to avoid being
              charged.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">3. Subscription Billing</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">When you subscribe to a paid plan:</p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              You authorize us and our payment partners (such as Paymob) to charge the applicable subscription fee to
              your selected payment method at the start of each billing cycle (monthly, quarterly, semi-annual, annual,
              or as otherwise agreed).
            </li>
            <li>
              Your subscription will renew automatically at the end of each billing period unless you cancel in
              advance.
            </li>
            <li>Invoices or receipts may be sent to the email address associated with your account.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">4. Cancellations</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">You can cancel your subscription at any time. To cancel:</p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>Follow the cancellation instructions provided in the app or on our website.</li>
            <li>
              Or contact our support team at{' '}
              <a href="mailto:support@fitforce.io" className="text-cyan-400">
                support@fitforce.io
              </a>{' '}
              or via WhatsApp (where available) with your account details and cancellation request.
            </li>
          </ul>
          <p className="mt-2 text-[var(--text-secondary,#e5e7eb)]">
            When you cancel, your subscription will remain active until the end of your current billing period. You will
            not be charged again after the current period ends, but we do not typically provide refunds for the
            remaining days in the current billing cycle unless explicitly stated otherwise in this Policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">5. Refunds</h2>
          <p className="mb-2 text-[var(--text-secondary,#e5e7eb)]">
            Because FitForce provides access to a digital, cloud-based service, we generally operate with the following
            refund principles:
          </p>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary,#e5e7eb)]">
            <li>
              <span className="font-semibold">First-time subscriptions:</span> if you are a new customer and you are
              genuinely unhappy with the service, you may request a refund within 30 days from the date of your first
              paid subscription charge. We review these requests on a case-by-case basis.
            </li>
            <li>
              <span className="font-semibold">Renewals:</span> for automatic renewals of existing subscriptions, refunds
              are generally not provided once the new billing period has started, as resources are already allocated for
              your account.
            </li>
            <li>
              <span className="font-semibold">Partial periods:</span> we do not typically provide pro-rated refunds for
              unused days within a billing period if you cancel early.
            </li>
            <li>
              <span className="font-semibold">Abuse or violations:</span> if your account is suspended or terminated due
              to violation of our Terms of Service, we are not obligated to offer any refund.
            </li>
          </ul>
          <p className="mt-2 text-[var(--text-secondary,#e5e7eb)]">
            To request a refund, please contact us at{' '}
            <a href="mailto:support@fitforce.io" className="text-cyan-400">
              support@fitforce.io
            </a>{' '}
            with your registered email, workspace name, invoice details, and a brief explanation. We will review your
            request and inform you of the outcome. If a refund is approved, it will be processed through the original
            payment method where technically possible.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">6. Payment Issues and Chargebacks</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            If your payment fails or is disputed (for example, via a chargeback through your bank or card issuer), we
            may temporarily or permanently suspend access to your FitForce account until the issue is resolved. Repeated
            payment issues, chargebacks, or suspected fraud may result in permanent account termination. If you have any
            billing issues, please contact us first so we can try to resolve them quickly.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">7. Changes to Prices and Plans</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We may update our pricing or change the features included in each plan from time to time. Any changes will
            be communicated on our website or directly to you by email or in-app notification. For existing
            subscriptions, price changes will generally take effect from the next renewal date. If you do not agree to
            the new pricing, you can cancel before the change takes effect.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-3">8. Country-Specific Considerations</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            We are based in Egypt and primarily serve customers in Egypt and the wider region, but we may also serve
            customers globally. Where local consumer protection laws provide you with additional mandatory rights
            regarding cancellations or refunds, we will respect those rights in addition to this Policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">9. Contact Us</h2>
          <p className="text-[var(--text-secondary,#e5e7eb)]">
            If you have any questions about this Refund &amp; Cancellation Policy or need help with a billing issue,
            please contact us at:
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


