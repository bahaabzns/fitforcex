// Display-currency conversion shared by every money summary (Transactions, Finance dashboard).
// Fixed rates, expressed as EGP per one unit of the currency — a display convenience for totals,
// not an accounting figure: amounts are stored and shown in their own currency everywhere else.
export const EXCHANGE_RATES = { EGP: 1, USD: 50.5, SAR: 13.47, EUR: 55.2, GBP: 64.1 };
export const DISPLAY_CURRENCIES = Object.keys(EXCHANGE_RATES);
export const DEFAULT_DISPLAY_CURRENCY = "EGP";

export function convertAmount(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    return (amount * (EXCHANGE_RATES[fromCurrency] || 1)) / (EXCHANGE_RATES[toCurrency] || 1);
}
