// FROZEN CONTRACT — supporter tier. Billing stubbed unless BILLING_ENABLED=1 and provider configured.
export const SUPPORTER_PRICE = { monthly: 2, yearly: 18, currency: "USD" } as const;
export const SUPPORTER_PERKS = ["Cloud sync across devices", "Custom themes & app icons", "Advanced stats & yearly recap", "Supporter badge in threads"] as const;
export const billingEnabled = () => process.env.NEXT_PUBLIC_BILLING_ENABLED === "1";
