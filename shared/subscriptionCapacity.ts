/** Standard covers the entire active roster; All Inclusive is not billed per employee. */
export function hasSubscriptionCapacity(company: { subscriptionType: string | null; subscriptionQuantity?: number | null }, activeEmployees: number) {
  return company.subscriptionType === "all_inclusive" || (company.subscriptionType === "standard" &&
    Number.isSafeInteger(company.subscriptionQuantity) && (company.subscriptionQuantity ?? 0) > 0 &&
    activeEmployees <= (company.subscriptionQuantity ?? 0));
}
