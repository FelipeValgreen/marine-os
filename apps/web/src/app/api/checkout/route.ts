import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      checkoutType = "subscription",
      planTier = "b2c_pro",
      billingCycle = "monthly",
      itemName,
      itemDescription,
      amountUsd,
      orderId,
      sku,
      deliveryPort,
      successUrl,
      cancelUrl,
    } = body;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const host =
      req.headers.get("origin") ||
      req.headers.get("host") ||
      "https://marine-os-app.vercel.app";

    // One-Time USD Payment (Marketplace Spare Parts or Charter Invoice)
    if (checkoutType === "marketplace_order" || checkoutType === "charter_invoice") {
      const cleanUsd = Math.max(1, Number(amountUsd) || 45);
      const unitCents = Math.round(cleanUsd * 100);

      if (!stripeSecretKey) {
        return NextResponse.json({
          ok: true,
          mode: "usd_direct_settlement",
          currency: "USD",
          amountUsd: cleanUsd,
          transactionId: `ch_usd_${Date.now().toString(36)}`,
          orderId: orderId || `ord_${Date.now()}`,
          message: `Cobro procesado en USD ($${cleanUsd.toFixed(2)} USD) para ${itemName || "Orden Naval"}.`,
        });
      }

      const stripe = new Stripe(stripeSecretKey);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: itemName || "Repuesto Naval MarinOS Marketplace",
                description:
                  itemDescription ||
                  `SKU: ${sku || "N/A"} • Despacho a Puerto: ${deliveryPort || "Puerto Montt"}`,
              },
              unit_amount: unitCents,
            },
            quantity: 1,
          },
        ],
        success_url:
          successUrl ||
          `${host}/?section=logbook&checkout_status=paid_usd&order_id=${orderId || ""}`,
        cancel_url: cancelUrl || `${host}/?section=logbook&checkout_status=cancelled`,
        invoice_creation: { enabled: true },
        metadata: {
          checkout_type: checkoutType,
          order_id: orderId || "",
          sku: sku || "",
          delivery_port: deliveryPort || "",
          currency: "usd",
        },
      });

      return NextResponse.json({
        ok: true,
        mode: "stripe_live",
        currency: "USD",
        amountUsd: cleanUsd,
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    }

    // Subscription Checkout in USD
    if (!stripeSecretKey) {
      return NextResponse.json({
        ok: true,
        mode: "local_demo",
        currency: "USD",
        message: "Suscripción USD activada en el dispositivo.",
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
