/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Clerk webhook for user creation — creates user record in our DB when they sign up
 * DEPENDENCIES: Prisma, svix (webhook verification)
 * STATUS: Scaffold — needs real webhook verification and user creation
 */

import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// TODO: Person 1 — Verify webhook signature using svix, handle user.created event
export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return apiError('Missing webhook secret', 500);
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return apiError('Missing svix headers', 400);
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  // TODO: Person 1 — Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: { type: string; data: Record<string, unknown> };

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as { type: string; data: Record<string, unknown> };
  } catch {
    return apiError('Invalid webhook signature', 400);
  }

  // Handle the event
  if (evt.type === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data as {
      id: string;
      email_addresses: { email_address: string }[];
      first_name: string | null;
      last_name: string | null;
    };

    const primaryEmail = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(' ') || null;

    // TODO: Person 1 — Create user in database
    try {
      await db.user.create({
        data: {
          clerkId: id,
          email: primaryEmail,
          name,
        },
      });
    } catch (error) {
      console.error('[webhook] Error creating user:', error);
      return apiError('Failed to create user', 500);
    }
  }

  return apiSuccess({ received: true });
}
