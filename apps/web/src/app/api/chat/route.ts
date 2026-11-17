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
    const { prompt, messages } = body;
    const userQuery =
      prompt ||
      (messages && messages.length > 0
        ? messages[messages.length - 1].content
        : "Reporte de a bordo");

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    // IF GEMINI API KEY IS CONFIGURED, USE VERCEL AI SDK WITH TOOL CALLING
    if (apiKey) {
      try {
        const result = await generateText({
          model: google("gemini-1.5-flash"),
          system: `Eres el Asistente Copiloto Táctico y Radiooperador de a bordo de MarinOS (Chile).
Hablas con lenguaje náutico auténtico, profesional, conciso y respetuoso.
Estás a bordo del yate navegando en las aguas del Seno de Reloncaví y Archipiélago de Chiloé.
Tienes acceso a 3 herramientas críticas (Tools):
1. 'log_to_logbook': Registra automáticamente novedades técnicas o de navegación en la bitácora de a bordo.
2. 'draft_port_authority_email': Redacta mensajes formales a la Capitanía de Puerto / Alcaldía de Mar (DIRECTEMAR).
3. 'search_inventory_parts': Busca repuestos y su ubicación exacta en el pañol.
Usa las herramientas cuando el capitán lo pida.`,
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
                message: `Asentado en bitácora [${category}]: ${content} (SOG: ${sog_kn || "N/A"} kn)`,
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

    if (
      lowerQuery.includes("bitácora") ||
      lowerQuery.includes("anota") ||
      lowerQuery.includes("registrar") ||
      lowerQuery.includes("apunta")
    ) {
      const entryText = userQuery.replace(/anota|registra|escribe en la bit[aá]cora/gi, "").trim();
      toolExecutions.push({
        toolName: "log_to_logbook",
        args: { content: entryText || userQuery, category: "NAVEGACION" },
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
      replyText = `Actualmente registramos viento de 18 nudos del Suroeste (225°), con mar rizada a marejadilla en el Seno de Reloncaví. Presión atmosférica estable en 1014 hPa.`;
    } else {
      replyText = `Copiado, Capitán. Estoy a la escucha en frecuencia de guardia. Puedo registrar novedades en la bitácora, buscar repuestos o preparar mensajes para Capitanía.`;
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
