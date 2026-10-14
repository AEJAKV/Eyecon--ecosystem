// Affiliate commission, calculated rather than typed:
//   billed     = gross − discount            (what the patient is charged)
//   net        = max(billed − operation cost, 0)
//   commission = round(net × rate ÷ 100, 2)  only when the booking came from an affiliate; otherwise 0
// Example: $400 billed, $200 operation cost → $200 net → 10% → $20 commission.
// supabase/migrations/007_commission.sql (complete_appointment) applies the same rule in the database, which is what
// actually saves it; this copy drives the live calculator, the demo and the tests. Amounts are worked in whole cents
// so rounding matches the database's numeric arithmetic.
export const MAX_AMOUNT = 1000000;
const cents = value => Math.round(Number(value) * 100);
const dollars = value => value / 100;

function amount(value, label) {
  const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) throw new Error(`Enter ${label} between $0 and $${MAX_AMOUNT.toLocaleString('en-CA')}.`);
  return cents(n);
}
// What staff enter: the amount billed before discount (gross) and the discount.
export function validateCompletion({ gross, discount = 0 }) {
  const g = amount(gross, 'the amount billed'), d = amount(discount === '' || discount == null ? 0 : discount, 'a discount');
  if (d > g) throw new Error('The discount cannot be more than the amount billed.');
  return { gross: dollars(g), discount: dollars(d) };
}
// A procedure's prices on the Pricing page.
export function validatePricing({ retailPrice, operationCost }) {
  return { retailPrice: dollars(amount(retailPrice, 'a retail price')), operationCost: dollars(amount(operationCost, 'an operation cost')) };
}
// rate is a percentage (10 means 10%). hasAffiliate false means a direct booking: no commission whatever the rate.
export function calculateCommission({ gross, discount = 0, operationCost = 0, rate = 0, hasAffiliate = true }) {
  const g = cents(gross), d = cents(discount || 0), cost = cents(operationCost || 0);
  const basisPoints = Math.round(Number(rate || 0) * 100);
  const billed = g - d, net = Math.max(billed - cost, 0);
  const commission = hasAffiliate ? Math.round(net * basisPoints / 10000) : 0;
  return { gross: dollars(g), discount: dollars(d), billed: dollars(billed), operationCost: dollars(cost), net: dollars(net), rate: hasAffiliate ? basisPoints / 100 : 0, commission: dollars(commission) };
}
