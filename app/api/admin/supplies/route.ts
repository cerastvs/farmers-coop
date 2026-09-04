import { writeAudit } from "@/lib/activity";
import {
  apiErrorResponse,
  ApiError,
  requireUser,
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

export async function GET() {
  try {
    await requireUser(SUPPLY_REVIEW_ROLES);
    const supplies = await prisma.supply.findMany({
      orderBy: { productName: "asc" },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        },
      },
    });

    return NextResponse.json(
      supplies.map((supply) => ({
        ...supply,
        price: Number(supply.price),
        transactions: supply.transactions.map((transaction) => ({
          ...transaction,
          totalPrice: Number(transaction.totalPrice),
        })),
      })),
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch supply inventory");
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser(SUPPLY_REVIEW_ROLES);
    const formData = await req.formData();

    const productName = (formData.get("productName") as string)?.trim();
    const price = Number(formData.get("price"));
    const quantity = Number(formData.get("quantity"));
    const loanLimitRaw = formData.get("loanLimitPerHectare");
    const loanLimitPerHectare =
      loanLimitRaw && loanLimitRaw !== "" ? Number(loanLimitRaw) : null;
    const image = formData.get("image") as File | null;

    if (!productName || productName.length < 2) {
      throw new ApiError(400, "Product name is required (min 2 chars)");
    }
    if (isNaN(price) || price < 0) {
      throw new ApiError(400, "Price must be a non-negative number");
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new ApiError(400, "Quantity must be a non-negative integer");
    }

    let imageUrl: string | null = null;
    if (image && image.size > 0) {
      imageUrl = await uploadToImgbb(image);
    }

    const supply = await prisma.$transaction(async (tx) => {
      const created = await tx.supply.create({
        data: { productName, price, quantity, imageUrl, loanLimitPerHectare },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "SUPPLY_CREATED",
        entity: "Supply",
        entityId: created.id,
        metadata: { productName, price, quantity, loanLimitPerHectare },
      });
      return created;
    });

    return NextResponse.json(
      { ...supply, price: Number(supply.price) },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to create supply");
  }
}
