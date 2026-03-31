import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'Set' : 'Missing',
    clerkSecretKey: process.env.CLERK_SECRET_KEY ? 'Set' : 'Missing',
    clerkPublishableKeyPrefix: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 10),
  });
}
