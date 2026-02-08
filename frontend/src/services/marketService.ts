"use server";

import { connectToDatabase, getCollectionName } from "@/lib/mongodb";
import { Long } from "mongodb";

export interface MarketRecord {
  // On-chain data
  marketId: string;
  ammAddress: string;
  creatorAddress: string;
  
  // Market details
  question: string; // Short question (max 80 chars) - stored on blockchain
  closeTime: number; // Unix timestamp
  xPostUrl?: string;
  xPostId?: string;
  
  // AI-generated context (stored in database only, not on blockchain)
  description?: string; // Detailed context from AI
  aiSuggestedCloseTime?: string;
  
  // Scraped tweet data
  tweetContent?: string;
  tweetAuthor?: string;
  tweetTimestamp?: string;
  
  // Liquidity info
  initialLiquidity: string;
  
  // Metadata
  createdAt: Date;
  chainId: number;
  transactionHash?: string;
}

export async function saveMarketToDatabase(market: MarketRecord): Promise<string> {
  const { db } = await connectToDatabase();
  const collectionName = await getCollectionName();
  const collection = db.collection<MarketRecord>(collectionName);
  
  const result = await collection.insertOne({
    ...market,
    createdAt: new Date(),
  });
  
  console.log("Market saved to MongoDB:", result.insertedId.toString());
  return result.insertedId.toString();
}

export async function getMarketByMarketId(marketId: string): Promise<MarketRecord | null> {
  const { db } = await connectToDatabase();
  const collectionName = await getCollectionName();
  const collection = db.collection<MarketRecord>(collectionName);
  
  return await collection.findOne({ marketId });
}

export async function getMarketByXPostId(xPostId: string): Promise<MarketRecord | null> {
  const { db } = await connectToDatabase();
  const collectionName = await getCollectionName();
  const collection = db.collection<MarketRecord>(collectionName);
  
  console.log("Querying MongoDB for xPostId:", xPostId);
  
  // MongoDB stores large numbers as Long type, so we need to query with Long
  const longValue = Long.fromString(xPostId);
  
  // Try multiple query approaches since MongoDB might store as string, number, or Long
  const result = await collection.findOne({
    $or: [
      { xPostId: xPostId },           // As string
      { xPostId: longValue },         // As MongoDB Long
    ]
  });
  
  console.log("MongoDB query result:", result ? "Found" : "Not found");
  
  if (!result) return null;
  
  // Serialize to plain object for client components
  return serializeMarketRecord(result);
}

// Helper to serialize MongoDB document to plain object
function serializeMarketRecord(doc: MarketRecord & { _id?: unknown }): MarketRecord {
  return {
    marketId: doc.marketId?.toString() || "",
    ammAddress: doc.ammAddress || "",
    creatorAddress: doc.creatorAddress || "",
    description: doc.description || "",
    closeTime: typeof doc.closeTime === 'object' ? Number(doc.closeTime) : doc.closeTime,
    xPostUrl: doc.xPostUrl,
    xPostId: doc.xPostId?.toString(),
    aiContext: doc.aiContext,
    aiSuggestedCloseTime: doc.aiSuggestedCloseTime,
    tweetContent: doc.tweetContent,
    tweetAuthor: doc.tweetAuthor,
    tweetTimestamp: doc.tweetTimestamp,
    initialLiquidity: doc.initialLiquidity?.toString() || "0",
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    chainId: typeof doc.chainId === 'object' ? Number(doc.chainId) : doc.chainId,
    transactionHash: doc.transactionHash,
  };
}

export async function getAllMarkets(): Promise<MarketRecord[]> {
  const { db } = await connectToDatabase();
  const collectionName = await getCollectionName();
  const collection = db.collection<MarketRecord>(collectionName);
  
  return await collection.find({}).sort({ createdAt: -1 }).toArray();
}

export async function getMarketsByCreator(creatorAddress: string): Promise<MarketRecord[]> {
  const { db } = await connectToDatabase();
  const collectionName = await getCollectionName();
  const collection = db.collection<MarketRecord>(collectionName);
  
  return await collection.find({ creatorAddress }).sort({ createdAt: -1 }).toArray();
}
