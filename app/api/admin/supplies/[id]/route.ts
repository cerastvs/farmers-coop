import { writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  requireUser,
  requireUuid,
} from "@/lib/api";
import prisma from "@/lib/client";
import { SUPPLY_REVIEW_ROLES } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

async function uploadToImgbb(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API}`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  if (!data.success) throw new Error("Image upload failed");
  return data.data.url;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(SUPPLY_REVIEW_ROLES);
    const formData = await req.formData();
    const { id: rawId } = await params;
    const id = requireUuid(rawId, "Supply ID");

    const productName = (formData.get("productName") as string)?.trim();
    const price = Number(formData.get("price"));
    const quantity = Number(formData.get("quantity"));
    const loanLimitRaw = formData.get("loanLimitPerHectare");
    const loanLimitPerHectare =
      loanLimitRaw && loanLimitRaw !== "" ? Number(loanLimitRaw) : null;
    const image = formData.get("image") as File | null;
    const removeImage = formData.get("removeImage") as string | null;

    if (!productName || productName.length < 2) {
      throw new ApiError(400, "Product name is required (min 2 chars)");
    }
    if (isNaN(price) || price < 0) {
      throw new ApiError(400, "Price must be a non-negative number");
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new ApiError(400, "Quantity must be a non-negative integer");
    }

    const existing = await prisma.supply.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Supply not found");

    let imageUrl = existing.imageUrl;
    if (image && image.size > 0) {
      imageUrl = await uploadToImgbb(image);
    } else if (removeImage === "true") {
      imageUrl = null;
    }

    const supply = await prisma.$transaction(async (tx) => {
      const updated = await tx.supply.update({
        where: { id },
        data: { productName, price, quantity, imageUrl, loanLimitPerHectare },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "SUPPLY_UPDATED",
        entity: "Supply",
        entityId: id,
        metadata: { productName, price, quantity, loanLimitPerHectare },
      });
      return updated;
    });

    return NextResponse.json({ ...supply, price: Number(supply.price) });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update supply");
  }
}
