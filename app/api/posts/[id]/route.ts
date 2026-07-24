import { writeAudit } from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { RECORDS_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const UpdatePostSchema = z
  .object({
    title: z.string().trim().min(3).max(150).optional(),
    content: z.string().trim().max(10_000).nullable().optional(),
    published: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const authorSelect = {
  id: true,
  name: true,
  username: true,
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(RECORDS_ROLES);
    const result = UpdatePostSchema.safeParse(await req.json());
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }
    const { id } = await params;

    const post = await prisma.$transaction(async (tx) => {
      const existing = await tx.post.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, "Post not found");

      const updated = await tx.post.update({
        where: { id },
        data: {
          ...result.data,
          content:
            result.data.content === undefined
              ? undefined
              : result.data.content || null,
        },
        include: { author: { select: authorSelect } },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "POST_UPDATED",
        entity: "Post",
        entityId: id,
        metadata: {
          changedFields: Object.keys(result.data),
          title: updated.title,
          published: updated.published,
        },
      });
      return updated;
    });

    return NextResponse.json(post);
  } catch (error) {
    return apiErrorResponse(error, "Failed to update post");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(RECORDS_ROLES);
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.post.findUnique({ where: { id } });
      if (!existing) throw new ApiError(404, "Post not found");

      await tx.post.delete({ where: { id } });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "POST_DELETED",
        entity: "Post",
        entityId: id,
        metadata: {
          title: existing.title,
          published: existing.published,
        },
      });
    });

    return NextResponse.json({ message: "Post deleted" });
  } catch (error) {
    return apiErrorResponse(error, "Failed to delete post");
  }
}
