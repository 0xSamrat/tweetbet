"use server";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GeneratedPrediction {
  question: string;
  context: string;
  suggestedCloseTime: string; // e.g., "7 days", "30 days", "1 day"
}

interface ScrapedTweet {
  text: string;
  author: string;
  timestamp?: string;
}

/**
 * Scrape tweet content from X/Twitter URL using multiple methods
 */
async function scrapeTweetContent(tweetUrl: string): Promise<ScrapedTweet> {
  // Extract tweet ID from URL
  const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
  if (!tweetIdMatch) {
    throw new Error("Invalid tweet URL format");
  }
  const tweetId = tweetIdMatch[1];

  // Extract username from URL
  const usernameMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/([^\/]+)\/status/);
  const username = usernameMatch ? usernameMatch[1] : "unknown";

  // Method 1: Try using Nitter instances (open source Twitter frontend)
  const nitterInstances = [
    "nitter.poast.org",
    "nitter.privacydev.net",
    "nitter.1d4.us",
  ];

  for (const instance of nitterInstances) {
    try {
      const nitterUrl = `https://${instance}/${username}/status/${tweetId}`;
      const response = await fetch(nitterUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const html = await response.text();
        
        // Extract tweet text from Nitter HTML
        const tweetTextMatch = html.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (tweetTextMatch) {
          // Clean HTML tags
          const text = tweetTextMatch[1]
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          
          if (text.length > 10) {
            return { text, author: username };
          }
        }
      }
    } catch {
      // Try next instance
      continue;
    }
  }

  // Method 2: Try FxTwitter API (community API for embedding)
  try {
    const fxTwitterUrl = `https://api.fxtwitter.com/${username}/status/${tweetId}`;
    const response = await fetch(fxTwitterUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.tweet?.text) {
        return {
          text: data.tweet.text,
          author: data.tweet.author?.name || username,
          timestamp: data.tweet.created_at,
        };
      }
    }
  } catch {
    // Continue to fallback
  }

  // Method 3: Try vxtwitter API
  try {
    const vxTwitterUrl = `https://api.vxtwitter.com/${username}/status/${tweetId}`;
    const response = await fetch(vxTwitterUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.text) {
        return {
          text: data.text,
          author: data.user_name || username,
          timestamp: data.date,
        };
      }
    }
  } catch {
    // Continue to fallback
  }

  // Fallback: Return URL info only, let AI work with less context
  return {
    text: `[Unable to scrape tweet content. Tweet by @${username}, ID: ${tweetId}]`,
    author: username,
  };
}

export async function generatePredictionFromTweet(
  tweetUrl: string
): Promise<GeneratedPrediction> {
  // First, scrape the tweet content
  let tweetContent: ScrapedTweet;
  try {
    tweetContent = await scrapeTweetContent(tweetUrl);
  } catch (error) {
    console.error("Failed to scrape tweet:", error);
    tweetContent = {
      text: "[Could not fetch tweet content]",
      author: "unknown",
    };
  }

  console.log("----------------------");

  console.log("Scraped Tweet Content:", tweetContent);

  const prompt = `You are a prediction market expert. Analyze this X/Twitter post and create a prediction market question.

Tweet URL: ${tweetUrl}
Tweet Author: @${tweetContent.author}
Tweet Content: "${tweetContent.text}"
${tweetContent.timestamp ? `Posted: ${tweetContent.timestamp}` : ""}

Based on this tweet, generate a prediction market question. The question must:
1. Be a clear YES/NO question that can be objectively resolved
2. Be engaging and interesting for traders
3. Have a specific, measurable outcome
4. Be time-bound (include when it should be resolved)
5. Relate directly to the content or implications of this tweet
6. The question MUST be 50 characters or fewer (including spaces and punctuation). Do not exceed 50 characters.

Respond in this exact JSON format only, no markdown:
{
  "question": "Will [specific prediction question]?", // 50 characters max
  "context": "Brief context explaining what this prediction is about and how it relates to the tweet",
  "suggestedCloseTime": "7 days"
}

The suggestedCloseTime should be one of: "1 day", "3 days", "7 days", "14 days", "30 days", "90 days"
Choose the time based on when the event in the tweet is likely to be resolved.

Only respond with the JSON, nothing else.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0,
    });

    const text = completion.choices[0].message.content?.trim() || "";

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedPrediction;
    return parsed;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate prediction. Please try again.");
  }
}
