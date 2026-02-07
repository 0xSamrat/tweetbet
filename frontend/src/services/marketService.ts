"use server";

import { connectToDatabase, getCollectionName } from "@/lib/mongodb";

export interface MarketRecord {
  // On-chain data
  marketId: string;
  ammAddress: string;
  creatorAddress: string;
  
  // Market details
  description: string;
  closeTime: number; // Unix timestamp
  xPostUrl?: string;
  xPostId?: string;
  
  // AI-generated context
  aiContext?: string;
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
