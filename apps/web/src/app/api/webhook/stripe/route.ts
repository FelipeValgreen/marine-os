import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey) {
    return NextResponse.json({ received: true, note: "Stripe key not configured" });
  }

  const stripe = new Stripe(stripeSecretKey);
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  // Handle billing events
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const planTier = session.metadata?.plan_tier || "b2c_pro";
      // In production, update Supabase user / organization record
      console.log(`[Stripe Webhook] Checkout completed for tier: ${planTier}, customer: ${session.customer}`);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[Stripe Webhook] Subscription canceled: ${subscription.id}`);
      break;
    }
    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true, eventType: event.type });
}
