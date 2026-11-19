import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { planTier, billingCycle = "monthly", successUrl, cancelUrl } = body;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    // Honest fallback: If Stripe Secret Key is not configured yet
    if (!stripeSecretKey) {
      return NextResponse.json({
        ok: true,
        mode: "local_demo",
        message: "Stripe Secret Key no detectada en variables de entorno. Se activó el plan localmente.",
        planTier,
        billingCycle,
      });
    }

    const stripe = new Stripe(stripeSecretKey);

    // Map plan to price or dynamic line item
    const isPro = planTier === "b2c_pro";
    const isFleet = planTier === "b2b_fleet";
    const isAnnual = billingCycle === "annual";

    const STRIPE_PRICES: Record<string, string> = {
      b2c_pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_1UdBvqHOvlvyMtdaohaLRtjo",
      b2c_pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || "price_1UdBvxHOvlvyMtdaf7hvQ3eG",
      b2b_fleet_monthly: process.env.STRIPE_PRICE_FLEET_MONTHLY || "price_1UdBw3HOvlvyMtdaSXLIWl2U",
      b2b_fleet_annual: process.env.STRIPE_PRICE_FLEET_ANNUAL || "price_1UdBw9HOvlvyMtda0YDtIEzM",
    };

    const targetPriceId = STRIPE_PRICES[`${planTier}_${billingCycle}`];

    const host = req.headers.get("origin") || req.headers.get("host") || "https://marine-os-sigma.vercel.app";
    const finalSuccessUrl = successUrl || `${host}/?checkout_status=success&tier=${planTier}`;
    const finalCancelUrl = cancelUrl || `${host}/?checkout_status=cancelled`;

    const lineItems = targetPriceId
      ? [{ price: targetPriceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: isPro ? "MarinOS Skipper Pro" : "MarinOS B2B Fleet & Astilleros",
                description: "Suscripción táctica y gestión de flota",
                images: ["https://marine-os-sigma.vercel.app/icon-512.png"],
              },
              unit_amount: isPro ? (isAnnual ? 19000 : 1900) : isAnnual ? 82800 : 7900,
              recurring: {
                interval: isAnnual ? ("year" as const) : ("month" as const),
              },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: "subscription",
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      tax_id_collection: {
        enabled: true,
      },
      invoice_creation: {
        enabled: true,
      },
      metadata: {
        plan_tier: planTier,
        billing_cycle: billingCycle,
        company_rut: body.companyRut || "",
        company_name: body.companyName || "",
        is_fleet: isFleet ? "true" : "false",
      },
    });

    return NextResponse.json({
      ok: true,
      mode: "stripe_live",
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al crear sesión de pago en Stripe";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
