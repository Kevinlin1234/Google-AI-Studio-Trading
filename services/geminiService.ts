
import { GoogleGenAI, Type } from "@google/genai";
import { CoinSymbol, AiDecision } from "../types";

// Use process.env.API_KEY as mandated
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeMarket = async (
  symbol: CoinSymbol,
  currentPrice: number,
  history: number[], // This receives array of close prices
  portfolioBalance: number
): Promise<AiDecision> => {
  if (!apiKey) {
    console.warn("API Key missing for Gemini");
    return { action: 'HOLD', confidence: 0, reason: 'API Key missing' };
  }

  // Format history for the prompt
  const historyStr = history.slice(-20).map(p => p.toFixed(4)).join(', ');

  const prompt = `
    You are an expert high-frequency crypto trading bot. 
    Current Market for ${symbol}:
    - Price: ${currentPrice}
    - Recent Price History (last 20 ticks): [${historyStr}]
    - Available Cash: ${portfolioBalance}

    Analyze the micro-trend. Is it pumping, dumping, or ranging?
    Decide IMMEDIATE action: BUY, SELL, or HOLD.
    
    If BUY, suggest a conservative amount based on available cash (max 5% of cash).
    If SELL, assume we have holdings (simulate logic).
    
    Output strict JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"] },
                confidence: { type: Type.NUMBER, description: "0 to 100" },
                reason: { type: Type.STRING, description: "Short technical analysis (max 15 words)" },
                suggestedAmount: { type: Type.NUMBER, description: "Amount of coin to buy/sell" }
            },
            required: ["action", "confidence", "reason"]
        }
      }
    });

    let text = response.text;
    if (!text) return { action: 'HOLD', confidence: 0, reason: 'No response from AI' };

    // Cleanup markdown if present (sometimes models wrap json in ```json ... ```)
    text = text.replace(/```json\n?|\n?```/g, '').trim();

    return JSON.parse(text) as AiDecision;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return { action: 'HOLD', confidence: 0, reason: 'Analysis Error' };
  }
};
