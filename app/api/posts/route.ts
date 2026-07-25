import { writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { RECORDS_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PostSchema = z.object({
  title: z.string().trim().min(3).max(150),
  content: z.string().trim().max(10_000).nullable().optional(),
  published: z.boolean().optional().default(false),
});

const authorSelect = {
  id: true,
  name: true,
  username: true,
} as const;

export async function GET(req: NextRequest) {
  try {
    const includeDrafts = req.nextUrl.searchParams.get("includeDrafts") === "true";
    if (includeDrafts) {
      await requireUser(RECORDS_ROLES);
    }

    const posts = await prisma.post.findMany({
      where: includeDrafts ? undefined : { published: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      include: { author: { select: authorSelect } },
    });
    return NextResponse.json(posts);
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch posts");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(RECORDS_ROLES);
    const result = PostSchema.safeParse(await req.json());
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          ...result.data,
          content: result.data.content || null,
          authorId: actor.userId,
        },
        include: { author: { select: authorSelect } },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "POST_CREATED",
        entity: "Post",
        entityId: created.id,
        metadata: {
          title: created.title,
          published: created.published,
        },
      });
      return created;
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Failed to create post");
  }
}
