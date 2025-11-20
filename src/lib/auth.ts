// src/lib/auth.ts
import { auth } from "@clerk/nextjs/server";

export async function authorize() {
  const session = await auth();
  const userId = session?.userId;

  if (!userId) {
    throw new Error("Not authenticated");
  }

  return { userId };
}
