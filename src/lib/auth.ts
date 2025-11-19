// src/lib/auth.ts
import { auth } from "@clerk/nextjs/server";

export async function authorize() {
  const session = await auth();
  const userId = session?.userId;

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const allowedId = process.env.ALLOWED_CLERK_USER_ID;
  const allowedEmail = process.env.ALLOWED_EMAIL;

  if (allowedId && userId !== allowedId) {
    throw new Error("Access denied");
  }

  return { userId };
}
