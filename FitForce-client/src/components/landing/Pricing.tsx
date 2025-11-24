'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/landing/LanguageContext';
import { useScrollAnimation } from '@/lib/landing/useScrollAnimation';
import Button from './Button';

type BillingPeriod = 'monthly' | 'quarterly' | 'semiAnnual' | 'annual';

export default function Pricing() {
  const { t, dir } = useLanguage();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [teamMembers, setTeamMembers] = useState(3);
  const headerRef = useScrollAnimation();
  const cardsRef = useScrollAnimation();

  const discounts = {
    monthly: 0,
    quarterly: 0.05,
    semiAnnual: 0.1,
    annual: 0.2
  };

  const calculatePrice = (basePrice: number) => {
    const discount = discounts[billingPeriod];
    return Math.round(basePrice * (1 - discount));
  };

  const calculateTeamPrice = () => {
    const basePrice = 4000;
    const additionalMembers = Math.max(0, teamMembers - 3);
    const totalPrice = basePrice + additionalMembers * 800;
    return calculatePrice(totalPrice);
  };

  const plans = [
    {
      name: t.pricing.oneForce.name,
      basePrice: 1600,
      description: t.pricing.oneForce.description,
      highlight: t.pricing.oneForce.highlight,
      features: t.pricing.oneForce.features,
      color: 'blue',
      cta: t.pricing.cta,
      href: '/register'
    },
    {
      name: t.pricing.teamForce.name,
      basePrice: null,
      description: t.pricing.teamForce.description,
      highlight: t.pricing.teamForce.highlight,
      features: t.pricing.teamForce.features,
      color: 'cyan',
      cta: t.pricing.cta,
      href: '/register',
      popular: true,
      isTeam: true
    },
    {
      name: t.pricing.enterpriseForce.name,
      basePrice: null,
      description: t.pricing.enterpriseForce.description,
      highlight: t.pricing.enterpriseForce.highlight,
      features: t.pricing.enterpriseForce.features,
      color: 'purple',
      cta: t.pricing.contactSales,
      href: 'https://wa.me/1234567890'
    }
  ];

  const colorClasses = {
    blue: 'from-cyan-500 to-blue-600',
    cyan: 'from-cyan-400 to-blue-500',
    purple: 'from-blue-500 to-purple-600'
  };

  return (
    <section
      id="pricing"
      className="min-h-screen bg-[var(--bg-primary)] relative scroll-snap-section scroll-snap-start py-16 md:py-20"
      dir={dir}
    >
      {/* Optimized background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)]"></div>
      <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/8 to-blue-600/8 rounded-full blur-2xl"></div>

      <div className="section-container py-8 w-full relative z-10">
        <div ref={headerRef} className="text-center mb-8 animate-on-scroll fade-in-up">
          <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] mb-3 tracking-tight">{t.pricing.title}</h2>
          <p className="text-lg text-[var(--text-secondary)] mb-6">{t.pricing.subtitle}</p>

          {/* Billing Period Toggle */}
          <div className="inline-flex items-center justify-center gap-1 sm:gap-2 bg-gray-900/60 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-1 sm:p-1.5 shadow-lg shadow-cyan-500/10 max-w-full">
            {(['monthly', 'quarterly', 'semiAnnual', 'annual'] as BillingPeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setBillingPeriod(period)}
                className={`px-2 sm:px-3 md:px-4 py-2 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                  billingPeriod === period
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/40'
                    : 'text-gray-300 hover:text-cyan-400 hover:bg-gray-800/50'
                }`}
              >
                <span className="block">{t.pricing[period]}</span>
                {period !== 'monthly' && (
                  <span className={`text-[9px] sm:text-xs font-bold block ${dir === 'rtl' ? 'mr-0' : 'ml-0'}`}>
                    {t.pricing.save} {Math.round(discounts[period] * 100)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div ref={cardsRef} className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl overflow-hidden backdrop-blur-xl border transition-all duration-300 flex flex-col ${
                plan.popular
                  ? 'ring-2 ring-cyan-500/50 shadow-2xl shadow-cyan-500/30 border-cyan-500/50 md:transform md:scale-105'
                  : 'shadow-lg border-cyan-500/20 hover:border-cyan-500/40'
              }`}
            >
              {/* Highlight Badge */}
              <div
                className={`absolute top-0 left-0 right-0 ${
                  plan.popular ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-gradient-to-r from-gray-700 to-gray-800'
                } text-white text-center py-2 text-xs font-bold uppercase tracking-wider`}
              >
                {plan.popular && '⭐ '}
                {plan.highlight}
              </div>

              <div
                className={`bg-gradient-to-br ${colorClasses[plan.color as keyof typeof colorClasses]} p-6 text-white pt-12 relative overflow-hidden`}
              >
                {/* Subtle glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>

                <h3 className="text-3xl md:text-4xl font-black mb-2 relative z-10 bg-gradient-to-r from-white via-cyan-50 to-white bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                  {plan.name}
                </h3>
                <p className="text-white/90 mb-4 text-sm relative z-10">{plan.description}</p>

                {/* Team Members Selector */}
                {plan.isTeam && (
                  <div className="mb-3 relative z-10">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-white/90">{t.pricing.teamMembers}</label>
                      <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2 py-0.5 border border-white/20">
                        <button
                          onClick={() => setTeamMembers(Math.max(3, teamMembers - 1))}
                          disabled={teamMembers <= 3}
                          className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-xs font-bold transition-all"
                        >
                          −
                        </button>
                        <span className="text-base font-bold text-white min-w-[24px] text-center">{teamMembers}</span>
                        <button
                          onClick={() => setTeamMembers(Math.min(20, teamMembers + 1))}
                          disabled={teamMembers >= 20}
                          className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-xs font-bold transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {teamMembers > 3 && (
                      <div className="text-[10px] text-cyan-200/80 font-mono bg-white/5 rounded px-2 py-1 border border-white/10">
                        Base (3) + Extra ({teamMembers - 3}) × 800 {dir === 'rtl' ? 'ج.م' : 'LE'}
                      </div>
                    )}
                  </div>
                )}

                {/* Price Display */}
                <div className="mb-4 relative z-10">
                  {plan.basePrice || plan.isTeam ? (
                    <>
                      <div className="flex items-baseline gap-2 justify-center md:justify-start">
                        <div className="text-4xl md:text-5xl font-bold">
                          {plan.isTeam ? calculateTeamPrice().toLocaleString() : calculatePrice(plan.basePrice!).toLocaleString()}
                        </div>
                        <span className="text-xl opacity-90">{dir === 'rtl' ? 'ج.م' : 'LE'}</span>
                        {billingPeriod !== 'monthly' && (
                          <span className="text-sm line-through opacity-60">
                            {plan.isTeam ? (4000 + Math.max(0, teamMembers - 3) * 800).toLocaleString() : plan.basePrice!.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="text-white/90 text-sm mt-1">{t.pricing.perMonth}</div>
                      {plan.popular && (
                        <div className="mt-3 text-xs bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 inline-block">
                          💰 {dir === 'rtl' ? 'تسترد تكلفته مع عميلين فقط!' : 'Pays for itself with just 2 clients'}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-4xl font-bold">{t.pricing.enterpriseForce.price}</div>
                  )}
                </div>
              </div>

              {/* Features List */}
              <div className="bg-gray-900/40 backdrop-blur-xl border-t border-white/10 p-6 flex-1 flex flex-col">
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature, index) => {
                    const isUnlimited = feature.includes('∞') || feature.includes('Unlimited') || feature.includes('غير محدود');
                    return (
                      <li
                        key={index}
                        className={`flex items-start gap-3 ${isUnlimited ? 'bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-2 -m-1' : ''}`}
                      >
                        <svg
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isUnlimited ? 'text-cyan-300' : 'text-cyan-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className={`text-sm ${isUnlimited ? 'text-cyan-200 font-semibold' : 'text-gray-200'}`}>{feature}</span>
                      </li>
                    );
                  })}
                </ul>

                <Button href={plan.href} variant="primary" fullWidth>
                  {plan.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="text-center">
          <p className="text-gray-400 text-sm">{t.pricing.allPricesTaxIncluded}</p>
        </div>
      </div>
    </section>
  );
}
