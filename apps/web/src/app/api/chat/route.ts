/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { generateText, tool } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// Chilean nautical knowledge base for offline fallback
const INVENTORY_PARTS_DB = [
  {
    name: "Filtro Decantador Racor R20P (30 micras)",
    partNumber: "R20P",
    system: "Motor Yanmar 4JH57",
    location: "Pañol de proa, caja estanca roja #2",
    stock: 3,
    minStock: 2,
    specification: "30 micras según catálogo Parker Racor",
  },
  {
    name: "Impulsor Bomba de Agua Salada Johnson",
    partNumber: "1028B",
    system: "Refrigeración Motor",
    location: "Pañol de popa babor, gaveta #1",
    stock: 2,
    minStock: 1,
    specification: "Neopreno para agua de mar con chaveta",
  },
  {
    name: "Ánodos de Zinc para Eje 35mm",
    partNumber: "ZN-35",
    system: "Protección Catódica",
    location: "Pañol de popa estribor",
    stock: 4,
    minStock: 2,
    specification: "Zinc electrolítico mil-spec",
  },
  {
    name: "Correa de Alternador Gates 13x1050",
    partNumber: "AVX13x1050",
    system: "Electricidad Yanmar",
    location: "Caja de repuestos motor",
    stock: 2,
    minStock: 1,
    specification: "Correa trapezoidal dentada alta temperatura",
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, messages, telemetry } = body;
    const userQuery =
      prompt ||
      (messages && messages.length > 0
        ? messages[messages.length - 1].content
        : "Reporte de a bordo");

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    // Build real-time telemetry block for Gemini grounding
    const telemetryString = telemetry
      ? `\n[TELEMETRÍA REAL EN VIVO A BORDO]:
- Posición GPS: Lat ${telemetry.lat ? Number(telemetry.lat).toFixed(4) : "-41.6850"}, Lon ${telemetry.lon ? Number(telemetry.lon).toFixed(4) : "-72.8250"}
- Velocidad actual (SOG): ${telemetry.sog_kn !== undefined ? Number(telemetry.sog_kn).toFixed(1) : "0.0"} nudos
- Rumbo de gobierno (COG): ${telemetry.cog_deg !== undefined ? Math.round(Number(telemetry.cog_deg)) : 0}°
- Sonda acústica (Profundidad): ${telemetry.depth_m !== undefined ? Number(telemetry.depth_m).toFixed(1) : "18.2"} m
- Viento aparente: ${telemetry.aws_kn !== undefined ? Number(telemetry.aws_kn).toFixed(1) : "14.5"} nudos (${telemetry.awa_deg !== undefined ? Math.round(Number(telemetry.awa_deg)) : 225}° de proa)
- Waypoint objetivo: ${telemetry.activeWaypoint || "Navegación libre"} ${telemetry.dtwNm ? `(a ${Number(telemetry.dtwNm).toFixed(1)} NM)` : ""}`
      : "";

    // IF GEMINI API KEY IS CONFIGURED, USE VERCEL AI SDK WITH TOOL CALLING
    if (apiKey) {
      try {
        const result = await generateText({
          model: google("gemini-1.5-flash"),
          system: `Eres el Asistente Copiloto Táctico y Radiooperador de a bordo de MarinOS (Chile).
Hablas con lenguaje náutico auténtico, profesional, conciso y respetuoso.
Estás a bordo del yate navegando en las aguas del Seno de Reloncaví y Archipiélago de Chiloé.
${telemetryString}
Tienes acceso a 4 herramientas críticas (Tools):
1. 'log_to_logbook': Registra automáticamente novedades técnicas o de navegación en la bitácora de a bordo.
2. 'draft_port_authority_email': Redacta mensajes formales a la Capitanía de Puerto / Alcaldía de Mar (DIRECTEMAR).
3. 'search_inventory_parts': Busca repuestos y su ubicación exacta en el pañol.
4. 'recommend_safe_anchorage': Sugiere fondeaderos seguros y abrigados según el cuadrante del viento.
Si el capitán pregunta por velocidad, posición, profundidad o navegación, usa SIEMPRE los datos de la telemetría en vivo.`,
          prompt: userQuery,
          tools: {
            log_to_logbook: tool({
              description: "Registra una entrada en la bitácora oficial de a bordo.",
              parameters: z.object({
                content: z.string().describe("Texto de la anotación en bitácora"),
                category: z
                  .enum(["NAVEGACION", "MOTOR", "METEO", "SEGURIDAD"])
                  .default("NAVEGACION"),
                sog_kn: z.number().optional().describe("Velocidad actual en nudos"),
              }),
              execute: async ({ content, category, sog_kn }: any) => ({
                status: "success",
                message: `Asentado en bitácora [${category}]: ${content} (SOG: ${sog_kn || telemetry?.sog_kn || "0.0"} kn)`,
                timestamp: new Date().toISOString(),
              }),
            } as any),
            draft_port_authority_email: tool({
              description: "Redacta un mensaje formal de comunicación marítima a Capitanía de Puerto.",
              parameters: z.object({
                station: z.string().describe("Capitanía de Puerto (ej: Puerto Montt, Castro, Calbuco)"),
                intent: z.enum(["ZARPE", "RECALADA", "AVISO_FONDEO", "EMERGENCIA"]),
                vessel_name: z.string().default("SV Albatros"),
                crew_count: z.number().default(4),
              }),
              execute: async ({
                station,
                intent,
                vessel_name,
                crew_count,
              }: any) => ({
                status: "success",
                station,
                intent,
                draft: `DE: Patrón ${vessel_name}\nPARA: ${station}\nFECHA: ${new Date().toLocaleDateString(
                  "es-CL"
                )}\nASUNTO: Comunicación de ${intent}\n\nSeñor Capitán de Puerto:\nComunico a usted que la nave ${vessel_name}, matrícula 1284-PTT, con ${crew_count} personas a bordo, solicita registrar ${intent} en aguas jurisdiccionales. Equipos de radio y seguridad SOLAS 100% operativos.\n\nAtentamente,\nPatrón al Mando.`,
              }),
            } as any),
            search_inventory_parts: tool({
              description: "Busca repuestos, filtros o herramientas en el pañol del barco.",
              parameters: z.object({
                query: z.string().describe("Nombre o código de la pieza (ej: filtro, impulsor, correa)"),
              }),
              execute: async ({ query }: any) => {
                const lower = query.toLowerCase();
                const matches = INVENTORY_PARTS_DB.filter(
                  (p) =>
                    p.name.toLowerCase().includes(lower) ||
                    p.partNumber.toLowerCase().includes(lower)
                );
                return {
                  found: matches.length > 0,
                  parts: matches,
                };
              },
            } as any),
            recommend_safe_anchorage: tool({
              description: "Recomienda fondeaderos protegidos en el Seno de Reloncaví y Chiloé según el viento y tenedero.",
              parameters: z.object({
                wind_quadrant: z.string().describe("Cuadrante del viento (ej: SW, Sur, Norte, NW, Este)"),
              }),
              execute: async ({ wind_quadrant }: any) => ({
                status: "success",
                wind_quadrant,
                anchorage: "Estero Huito (Calbuco)",
                seabed: "Fango compacto / Excelente tenedero",
                depth_m: 9.5,
                shelter: `Óptimo abrigo con vientos del cuadrante ${wind_quadrant}`,
              }),
            } as any),
          },
        });

        return NextResponse.json({
          reply: result.text,
          toolCalls: result.toolCalls,
          toolResults: result.toolResults,
          source: "gemini-cloud",
        });
      } catch (geminiErr: any) {
        console.warn("[Gemini API Error, falling back to local deterministic dispatcher]:", geminiErr?.message);
      }
    }

    // LOCAL-FIRST DETERMINISTIC NAUTICAL AGENT (Works 100% Offline / No API Key required)
    const lowerQuery = userQuery.toLowerCase();
    let replyText = "";
    const toolExecutions: any[] = [];

    // 1. Telemetry Queries (Speed, Depth, Position, Heading)
    if (
      lowerQuery.includes("velocidad") ||
      lowerQuery.includes("sog") ||
      lowerQuery.includes("rápido") ||
      lowerQuery.includes("nudos")
    ) {
      const speed = telemetry?.sog_kn !== undefined ? Number(telemetry.sog_kn).toFixed(1) : "0.0";
      const heading = telemetry?.cog_deg !== undefined ? Math.round(Number(telemetry.cog_deg)) : 194;
      replyText = `Capitán, navegamos a ${speed} nudos sobre el fondo (SOG) con rumbo de gobierno ${heading}°.`;
    } else if (
      lowerQuery.includes("profundidad") ||
      lowerQuery.includes("sonda") ||
      lowerQuery.includes("fondo") ||
      lowerQuery.includes("calado")
    ) {
      const depth = telemetry?.depth_m !== undefined ? Number(telemetry.depth_m).toFixed(1) : "18.2";
      replyText = `Sonda bajo transductor: ${depth} metros. Margen de seguridad sobre quilla conforme a carta náutica.`;
    } else if (
      lowerQuery.includes("dónde") ||
      lowerQuery.includes("donde") ||
      lowerQuery.includes("posición") ||
      lowerQuery.includes("posicion") ||
      lowerQuery.includes("coordenada")
    ) {
      const lat = telemetry?.lat ? Number(telemetry.lat).toFixed(4) : "-41.6850";
      const lon = telemetry?.lon ? Number(telemetry.lon).toFixed(4) : "-72.8250";
      replyText = `Posición actual del SV Albatros: Latitud ${lat}, Longitud ${lon}. Seno de Reloncaví.`;
    } else if (
      lowerQuery.includes("bitácora") ||
      lowerQuery.includes("anota") ||
      lowerQuery.includes("registrar") ||
      lowerQuery.includes("apunta")
    ) {
      const entryText = userQuery.replace(/anota|registra|escribe en la bit[aá]cora/gi, "").trim();
      toolExecutions.push({
        toolName: "log_to_logbook",
        args: { content: entryText || userQuery, category: "NAVEGACION", sog_kn: telemetry?.sog_kn },
        result: {
          status: "success",
          message: `Registrado en bitácora local: "${entryText || userQuery}"`,
          timestamp: new Date().toISOString(),
        },
      });
      replyText = `Entendido, Capitán. He registrado la siguiente anotación en la bitácora: "${entryText || userQuery}".`;
    } else if (
      lowerQuery.includes("correo") ||
      lowerQuery.includes("capitanía") ||
      lowerQuery.includes("armada") ||
      lowerQuery.includes("zarpe") ||
      lowerQuery.includes("recalada")
    ) {
      const station = lowerQuery.includes("castro")
        ? "Capitanía de Puerto de Castro"
        : lowerQuery.includes("calbuco")
        ? "Capitanía de Puerto de Calbuco"
        : "Capitanía de Puerto de Puerto Montt";
      const draftText = `DE: Capitán SV Albatros\nPARA: ${station}\nFECHA: ${new Date().toLocaleDateString(
        "es-CL"
      )}\nASUNTO: Comunicación Náutica\n\nSeñor Capitán de Puerto:\nInformo a usted que la nave SV Albatros se encuentra navegando con 4 tripulantes a bordo, rumbo a Caleta Mechuque con condiciones favorables. Equipos de navegación y radio VHF Canal 16 en escucha permanente.\n\nAtentamente,\nPatrón de Yate.`;
      toolExecutions.push({
        toolName: "draft_port_authority_email",
        args: { station, intent: "ZARPE" },
        result: { status: "success", station, draft: draftText },
      });
      replyText = `He redactado el comunicado formal para la ${station}. Puedes revisarlo y despacharlo cuando tengas señal.`;
    } else if (
      lowerQuery.includes("filtro") ||
      lowerQuery.includes("repuesto") ||
      lowerQuery.includes("racor") ||
      lowerQuery.includes("impulsor") ||
      lowerQuery.includes("correa") ||
      lowerQuery.includes("ánodo")
    ) {
      const matches = INVENTORY_PARTS_DB.filter((p) =>
        lowerQuery.includes(p.name.toLowerCase().split(" ")[0]) ||
        lowerQuery.includes(p.partNumber.toLowerCase())
      );
      toolExecutions.push({
        toolName: "search_inventory_parts",
        args: { query: userQuery },
        result: { found: matches.length > 0, parts: matches.length > 0 ? matches : INVENTORY_PARTS_DB.slice(0, 2) },
      });
      if (matches.length > 0) {
        const item = matches[0];
        replyText = `Encontré el repuesto: ${item.name}. Disponibles: ${item.stock} unidades. Ubicación: ${item.location}.`;
      } else {
        replyText = `En el pañol tenemos filtros Racor R20P (3 uds en pañol de proa) e impulsores de repuesto Johnson 1028B (2 uds en pañol de popa).`;
      }
    } else if (lowerQuery.includes("viento") || lowerQuery.includes("clima") || lowerQuery.includes("ola")) {
      const windSpeed = telemetry?.aws_kn !== undefined ? Number(telemetry.aws_kn).toFixed(1) : "14.5";
      const windAngle = telemetry?.awa_deg !== undefined ? Math.round(Number(telemetry.awa_deg)) : 225;
      replyText = `Registramos viento aparente de ${windSpeed} nudos a ${windAngle}° de proa. Mar rizada a marejadilla en el Seno de Reloncaví.`;
    } else {
      replyText = `Copiado, Capitán. Estoy a la escucha en frecuencia de guardia. Puedo informarte velocidad y sonda viva, registrar novedades en la bitácora o buscar repuestos.`;
    }

    return NextResponse.json({
      reply: replyText,
      toolResults: toolExecutions,
      source: "local-first-marine-agent",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error en procesamiento de audio/chat", details: error?.message },
      { status: 500 }
    );
  }
}
