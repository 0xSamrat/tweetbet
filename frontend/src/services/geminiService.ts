"use server";

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export interface GeneratedPrediction {
  question: string;
  context: string;
  suggestedCloseTime: string; // e.g., "7 days", "30 days", "1 day"
}

export async function generatePredictionFromTweet(
  tweetUrl: string
): Promise<GeneratedPrediction> {
  const prompt = `You are a prediction market expert. Given this X post URL: ${tweetUrl}

Generate a prediction market question based on this tweet. The question should:
1. Be a clear YES/NO question that can be objectively resolved
2. Be engaging and interesting for traders
3. Have a specific, measurable outcome
4. Be time-bound (include when it should be resolved)

Respond in this exact JSON format only, no markdown:
{
  "question": "Will [specific prediction question]?",
  "context": "Brief context about what this prediction is about",
  "suggestedCloseTime": "7 days"
}

The suggestedCloseTime should be one of: "1 day", "3 days", "7 days", "14 days", "30 days", "90 days"

Only respond with the JSON, nothing else.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const text = response.text?.trim() || "";
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedPrediction;
    return parsed;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to generate prediction. Please try again.");
  }
}
