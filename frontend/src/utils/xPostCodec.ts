import type { Hex } from "viem";

/**
 * Encode X post data into bytes32 for smart contract storage
 * Format: [postId (8 bytes)][userLen (1 byte)][user (15 bytes)][padding (8 bytes)]
 * 
 * @param postId - The X post ID (from URL: x.com/user/status/[postId])
 * @param user - The X username (max 15 characters)
 * @returns Encoded bytes32 hex string
 */
export function encodeXPost(postId: bigint, user: string): Hex {
  if (user.length > 15) {
    throw new Error("Username too long (max 15 characters)");
  }
  
  // Convert user to bytes
  const userBytes = new TextEncoder().encode(user);
  const userLen = userBytes.length;
  
  // Create 32-byte array
  const result = new Uint8Array(32);
  
  // Write postId (big-endian, 8 bytes at positions 0-7)
  const postIdBigInt = BigInt(postId);
  for (let i = 0; i < 8; i++) {
    result[7 - i] = Number((postIdBigInt >> BigInt(i * 8)) & 0xFFn);
  }
  
  // Write userLen (1 byte at position 8)
  result[8] = userLen;
  
  // Write user (up to 15 bytes starting at position 9)
  for (let i = 0; i < userLen; i++) {
    result[9 + i] = userBytes[i];
  }
  
  // Convert to hex
  return `0x${Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Decode X post data from bytes32
 * 
 * @param encoded - The encoded bytes32 hex string
 * @returns Object with postId and user, or null if empty
 */
export function decodeXPost(encoded: Hex): { postId: bigint; user: string } | null {
  if (encoded === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return null;
  }
  
  // Remove 0x prefix and convert to bytes
  const hex = encoded.slice(2);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  
  // Read postId (big-endian, 8 bytes from positions 0-7)
  let postId = 0n;
  for (let i = 0; i < 8; i++) {
    postId = (postId << 8n) | BigInt(bytes[i]);
  }
  
  // Read userLen (1 byte at position 8)
  const userLen = bytes[8];
  
  // Read user (userLen bytes starting at position 9)
  const userBytes = bytes.slice(9, 9 + userLen);
  const user = new TextDecoder().decode(userBytes);
  
  return { postId, user };
}

/**
 * Extract postId and user from X post URL
 * 
 * @param url - Full X post URL (e.g., "https://x.com/elonmusk/status/1234567890")
 * @returns Object with postId and user, or null if invalid URL
 */
export function parseXPostUrl(url: string): { postId: bigint; user: string } | null {
  // Match patterns like:
  // https://x.com/user/status/1234567890
  // https://twitter.com/user/status/1234567890
  const match = url.match(/(?:x\.com|twitter\.com)\/([^\/]+)\/status\/(\d+)/);
  if (!match) return null;
  
  return {
    user: match[1],
    postId: BigInt(match[2]),
  };
}

/**
 * Build X post URL from postId and user
 * 
 * @param postId - The X post ID
 * @param user - The X username
 * @returns Full X post URL
 */
export function buildXPostUrl(postId: bigint, user: string): string {
  return `https://x.com/${user}/status/${postId}`;
}

/**
 * Encode X post URL directly to bytes32
 * 
 * @param url - Full X post URL
 * @returns Encoded bytes32 hex string, or null bytes32 if invalid
 */
export function encodeXPostUrl(url: string): Hex {
  const parsed = parseXPostUrl(url);
  if (!parsed) {
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }
  return encodeXPost(parsed.postId, parsed.user);
}

/**
 * Decode bytes32 to full X post URL
 * 
 * @param encoded - The encoded bytes32 hex string
 * @returns Full X post URL, or empty string if not set
 */
export function decodeXPostUrl(encoded: Hex): string {
  const decoded = decodeXPost(encoded);
  if (!decoded) return "";
  return buildXPostUrl(decoded.postId, decoded.user);
}
