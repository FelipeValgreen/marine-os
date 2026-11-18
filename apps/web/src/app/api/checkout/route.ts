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

    let unitAmount = 1900; // $19.00 USD
    let name = "MarinOS Skipper Pro (Mensual)";
    let description = "Modo Alta Mar, Gimbal UI, Telemetría NMEA 2000 y Bitácora IA";

    if (isPro && isAnnual) {
      unitAmount = 19000; // $190.00 USD/año
      name = "MarinOS Skipper Pro (Anual 20% OFF)";
      description = "Acceso anual con Modo Alta Mar, Gimbal UI y PTT por Voz Ilimitado";
    } else if (isFleet && !isAnnual) {
      unitAmount = 7900; // $79.00 USD/mes
      name = "MarinOS B2B Fleet & Astilleros (Mensual)";
      description = "Flota ilimitada, Genesis Handover, Libro Inmutable SHA-256 y OCR";
    } else if (isFleet && isAnnual) {
      unitAmount = 82800; // $828.00 USD/año ($69/mes)
      name = "MarinOS B2B Fleet & Astilleros (Anual 20% OFF)";
      description = "Licencia anual para empresas de charter, astilleros y concesionarios";
    }

    const host = req.headers.get("origin") || req.headers.get("host") || "https://marine-os-sigma.vercel.app";
    const finalSuccessUrl = successUrl || `${host}/?checkout_status=success&tier=${planTier}`;
    const finalCancelUrl = cancelUrl || `${host}/?checkout_status=cancelled`;

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name,
              description,
              images: ["https://marine-os-sigma.vercel.app/icon-512.png"],
            },
            unit_amount: unitAmount,
            recurring: {
              interval: isAnnual ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        plan_tier: planTier,
        billing_cycle: billingCycle,
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
