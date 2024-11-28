import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
  cache: true,
  rateLimit: true,
});

export async function verifyPubSubJwt(token: string): Promise<boolean> {
  try {
    console.log("🚀 Verifying Pub/Sub JWT...");

    // Decode the token header without verification
    const decodedHeader = jwt.decode(token, { complete: true })?.header;
    if (!decodedHeader?.kid) {
      throw new Error("No key ID (kid) found in token header");
    }

    // Get the signing key using the kid
    const key = await client.getSigningKey(decodedHeader.kid);
    const signingKey = key.getPublicKey();

    // Verify the token
    const verified = jwt.verify(token, signingKey, {
      algorithms: ["RS256"],
      audience: process.env.PUBSUB_AUDIENCE || undefined,
    });

    return !!verified;
  } catch (error) {
    console.error("Failed to verify Pub/Sub JWT:", error);
    return false;
  }
}
