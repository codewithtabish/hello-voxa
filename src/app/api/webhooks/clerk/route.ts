// src/app/api/webhooks/clerk/route.ts

import prisma from "@/lib/clients/prisma-client";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { Webhook } from "svix";

// ============================================
// POST /api/webhooks/clerk
// ============================================
//
// Handles Clerk lifecycle events → syncs
// User rows into Neon PostgreSQL.
//
// Handled events:
//   - user.created
//   - user.updated
//   - user.deleted
//   - session.created
//
// VOXA-specific differences vs LEXA:
//   - NO credits (VOXA meters AI by billableSeconds)
//   - NO CreditTransaction
//   - NO isPro boolean (source of truth = Subscription)
//   - First/last name, image, email sync only
//
// ============================================

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(7);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[Clerk Webhook][${requestId}] 🚀 Incoming request`);
  console.log(`[Clerk Webhook][${requestId}] Timestamp:`, new Date().toISOString());

  // ═══════════════════════════════════════════════
  // STEP 0: Env
  // ═══════════════════════════════════════════════

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  console.log(`[Clerk Webhook][${requestId}] 🔑 Webhook secret present:`, !!WEBHOOK_SECRET);
  console.log(`[Clerk Webhook][${requestId}] 🔑 DATABASE_URL present:`, !!process.env.DATABASE_URL);

  if (!WEBHOOK_SECRET) {
    console.error(`[Clerk Webhook][${requestId}] ❌ Missing CLERK_WEBHOOK_SIGNING_SECRET`);
    return new Response("Missing CLERK_WEBHOOK_SIGNING_SECRET", { status: 500 });
  }

  // ═══════════════════════════════════════════════
  // STEP 1: Svix headers
  // ═══════════════════════════════════════════════

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  console.log(`[Clerk Webhook][${requestId}] 📨 Svix headers:`, {
    svixId: svixId ? "✅" : "❌",
    svixTimestamp: svixTimestamp ? "✅" : "❌",
    svixSignature: svixSignature ? "✅" : "❌",
  });

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error(`[Clerk Webhook][${requestId}] ❌ Missing Svix headers`);
    return new Response("Missing Svix headers", { status: 400 });
  }

  // ═══════════════════════════════════════════════
  // STEP 2: Raw body
  // ═══════════════════════════════════════════════

  const payload = await req.text();
  console.log(`[Clerk Webhook][${requestId}] 📦 Payload length:`, payload.length);

  if (!payload) {
    console.error(`[Clerk Webhook][${requestId}] ❌ Empty payload`);
    return new Response("Empty payload", { status: 400 });
  }

  // ═══════════════════════════════════════════════
  // STEP 3: Verify signature
  // ═══════════════════════════════════════════════

  const wh = new Webhook(WEBHOOK_SECRET);

  try {
    wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    console.log(`[Clerk Webhook][${requestId}] ✅ Signature verified`);
  } catch (err: any) {
    console.error(`[Clerk Webhook][${requestId}] ❌ Signature failed:`, err.message);
    return new Response("Invalid webhook", { status: 400 });
  }

  // ═══════════════════════════════════════════════
  // STEP 4: Parse
  // ═══════════════════════════════════════════════

  let evt: WebhookEvent;
  try {
    evt = JSON.parse(payload) as WebhookEvent;
    console.log(`[Clerk Webhook][${requestId}] 🎯 Event type:`, evt?.type);
  } catch (parseErr: any) {
    console.error(`[Clerk Webhook][${requestId}] ❌ Parse failed:`, parseErr.message);
    return new Response("Invalid payload JSON", { status: 400 });
  }

  if (!evt?.type) {
    console.error(`[Clerk Webhook][${requestId}] ❌ Missing type`);
    return new Response("Invalid webhook payload", { status: 400 });
  }

  // ═══════════════════════════════════════════════
  // STEP 5: Handle events
  // ═══════════════════════════════════════════════

  try {
    switch (evt.type) {
      // ═══════════════════════════════════════════
      // USER CREATED
      // ═══════════════════════════════════════════
      case "user.created": {
        const data = evt.data;

        console.log(`[Clerk Webhook][${requestId}] 👤 user.created:`, {
          id: data.id,
          emailCount: data.email_addresses?.length,
          primaryEmailId: data.primary_email_address_id,
        });

        const email =
          data.email_addresses?.find(
            (e) => e.id === data.primary_email_address_id
          )?.email_address ??
          data.email_addresses?.[0]?.email_address ??
          null;

        console.log(`[Clerk Webhook][${requestId}] 📧 Resolved email:`, email);

        if (!email) {
          console.warn(`[Clerk Webhook][${requestId}] ⚠️ No email, skipping`);
          break;
        }

        // ─────────────────────────────────────────
        // Existing by clerkId?
        // ─────────────────────────────────────────

        const existingByClerkId = await prisma.user.findUnique({
          where: { clerkId: data.id },
        });

        if (existingByClerkId) {
          console.log(`[Clerk Webhook][${requestId}] ♻️ Refreshing existing user`);

          await prisma.user.update({
            where: { clerkId: data.id },
            data: {
              firstName: data.first_name ?? null,
              lastName: data.last_name ?? null,
              email,
              imageUrl: data.image_url ?? null,
              lastActiveAt: new Date(),
            },
          });
          break;
        }

        // ─────────────────────────────────────────
        // Existing by email? Re-link
        // ─────────────────────────────────────────

        const existingByEmail = await prisma.user.findUnique({
          where: { email },
        });

        if (existingByEmail) {
          console.log(`[Clerk Webhook][${requestId}] ♻️ Re-linking by email`);

          await prisma.user.update({
            where: { email },
            data: {
              clerkId: data.id,
              firstName: data.first_name ?? null,
              lastName: data.last_name ?? null,
              imageUrl: data.image_url ?? null,
              lastActiveAt: new Date(),
            },
          });
          break;
        }

        // ─────────────────────────────────────────
        // NEW USER
        // ─────────────────────────────────────────
        //
        // VOXA defaults:
        //   plan           = FREE
        //   paymentProvider= NONE
        //   status         = ACTIVE
        //   onlineStatus   = OFFLINE
        //   availability   = NOT_AVAILABLE
        //
        // NO credits. NO isPro.
        // Real plan state comes from Subscription.
        //

        console.log(`[Clerk Webhook][${requestId}] ✨ Creating NEW user`);

        const user = await prisma.user.create({
          data: {
            clerkId: data.id,
            email,
            firstName: data.first_name ?? null,
            lastName: data.last_name ?? null,
            imageUrl: data.image_url ?? null,

            status: "ACTIVE",

            onlineStatus: "OFFLINE",
            availability: "NOT_AVAILABLE",
            lastActiveAt: new Date(),

            plan: "FREE",
            paymentProvider: "NONE",
          },
        });

        console.log(`[Clerk Webhook][${requestId}] ✅ User created:`, user.id);
        break;
      }

      // ═══════════════════════════════════════════
      // USER UPDATED
      // ═══════════════════════════════════════════
      case "user.updated": {
        const data = evt.data;
        console.log(`[Clerk Webhook][${requestId}] 📝 user.updated:`, data.id);

        const email =
          data.email_addresses?.find(
            (e) => e.id === data.primary_email_address_id
          )?.email_address ??
          data.email_addresses?.[0]?.email_address ??
          null;

        try {
          await prisma.user.updateMany({
            where: { clerkId: data.id },
            data: {
              firstName: data.first_name ?? null,
              lastName: data.last_name ?? null,
              ...(email ? { email } : {}),
              imageUrl: data.image_url ?? null,
            },
          });
          console.log(`[Clerk Webhook][${requestId}] ✅ User updated`);
        } catch (updateErr: any) {
          console.error(`[Clerk Webhook][${requestId}] ❌ update failed:`, {
            message: updateErr.message,
            code: updateErr.code,
            meta: updateErr.meta,
          });
        }
        break;
      }

      // ═══════════════════════════════════════════
      // SESSION CREATED
      // ═══════════════════════════════════════════
      //
      // Marks the user as recently active.
      // Does NOT set onlineStatus — that's Redis-driven.
      //
      case "session.created": {
        const data = evt.data as { user_id: string };
        console.log(`[Clerk Webhook][${requestId}] 🔐 session.created:`, data.user_id);

        if (data.user_id) {
          await prisma.user.updateMany({
            where: { clerkId: data.user_id },
            data: { lastActiveAt: new Date() },
          });
          console.log(`[Clerk Webhook][${requestId}] ✅ lastActiveAt updated`);
        }
        break;
      }

      // ═══════════════════════════════════════════
      // USER DELETED
      // ═══════════════════════════════════════════
      //
      // Cascade deletes will clean up:
      //   - Profile
      //   - UserLanguage, UserInterest
      //   - Conversations, Messages, Calls
      //   - RoomParticipant, hostedRooms
      //   - AISession
      //   - SafepaySubscription, Subscription
      //   - Notification
      //   - UserBlock (both sides)
      //   - UserReport (both sides)
      //
      case "user.deleted": {
        const data = evt.data;
        console.log(`[Clerk Webhook][${requestId}] 🗑️ user.deleted:`, data.id);

        if (data.id) {
          await prisma.user.deleteMany({
            where: { clerkId: data.id },
          });
          console.log(`[Clerk Webhook][${requestId}] ✅ User deleted`);
        }
        break;
      }

      default:
        console.log(`[Clerk Webhook][${requestId}] ℹ️ Unhandled event:`, evt.type);
        break;
    }

    console.log(`[Clerk Webhook][${requestId}] ✅ Success\n`);
    return Response.json({ success: true });
  } catch (error: any) {
    console.error(`[Clerk Webhook][${requestId}] 💥 FATAL ERROR`);
    console.error(`[Clerk Webhook][${requestId}] Message:`, error.message);
    console.error(`[Clerk Webhook][${requestId}] Code:`, error.code);
    console.error(`[Clerk Webhook][${requestId}] Meta:`, JSON.stringify(error.meta, null, 2));
    console.error(`[Clerk Webhook][${requestId}] Stack:`, error.stack);
    console.error(`[Clerk Webhook][${requestId}] Event type:`, evt.type);
    console.error(`[Clerk Webhook][${requestId}] 💥 END ERROR\n`);

    return new Response("Webhook Error: " + error.message, { status: 500 });
  }
}