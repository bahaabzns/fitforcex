import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | FitForce',
  description:
    'Get in touch with FitForce for technical support, billing questions, or partnerships.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary,#020617)] text-[var(--text-primary,#f9fafb)]">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <h1 className="text-3xl md:text-4xl font-black mb-6">Contact Us</h1>
        
        <p className="text-lg text-[var(--text-secondary,#e5e7eb)] mb-8">
          We're here to help.
        </p>

        <div className="space-y-6 text-[var(--text-secondary,#e5e7eb)]">
          <div>
            <p className="text-lg font-semibold mb-2">📞 Mobile (Egypt):</p>
            <a 
              href="tel:+201004914771" 
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              +20 10 04914771
            </a>
          </div>

          <div>
            <p className="text-lg font-semibold mb-2">📧 Email:</p>
            <a 
              href="mailto:info@fitforce.io" 
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              info@fitforce.io
            </a>
          </div>

          <div>
            <p className="text-lg font-semibold mb-2">📍 Address:</p>
            <p>Cairo, Egypt</p>
          </div>

          <div className="mt-8 pt-8 border-t border-cyan-500/20">
            <p className="text-[var(--text-secondary,#e5e7eb)]">
              For technical support, billing questions, or partnerships, reach out anytime — our team will get back to you as soon as possible.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

