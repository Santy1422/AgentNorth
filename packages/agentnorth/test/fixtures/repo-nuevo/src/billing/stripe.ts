import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_KEY!);

export async function createCustomer(email: string) {
  return stripe.customers.create({ email });
}

export async function createSubscription(customerId: string, priceId: string) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
  });
}
