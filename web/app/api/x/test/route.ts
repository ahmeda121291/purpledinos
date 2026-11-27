/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { admin, tokenOk } from "@/lib/ingest";
import { xDelete, xPost, xUploadImage } from "@/lib/x";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// End-to-end check of the X pipeline: upload a card, post it, reply, then delete both.
export async function GET(req: Request) {
  const db = admin();
  if (!(await tokenOk(db, req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const steps: Record<string, any> = {};
  let postId: string | undefined, replyId: string | undefined;
  try {
    const img = await fetch(`https://purpledinos.ca/api/card/onthisday?v=${Date.now()}`, { cache: "no-store" });
    steps.card = img.status;
    const media = await xUploadImage(await img.arrayBuffer());
    steps.upload = media;
    postId = (await xPost("Testing the pipes 🦖 (this deletes itself in a few seconds)", [media])).id;
    steps.post = postId;
    replyId = (await xPost("Reply test 🦖", undefined, postId)).id;
    steps.reply = replyId;
  } catch (e: any) {
    steps.error = String(e?.message ?? e);
  }
  if (replyId) steps.deleteReply = await xDelete(replyId).catch((e: any) => String(e?.message));
  if (postId) steps.deletePost = await xDelete(postId).catch((e: any) => String(e?.message));
  await db.from("job_runs").insert({ job: "x-test", status: steps.error ? "error" : "ok", started_at: new Date().toISOString(), finished_at: new Date().toISOString(), detail: JSON.stringify(steps).slice(0, 900) });
  return NextResponse.json({ ok: !steps.error, steps });
}
