import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { RECORDS_ROLES } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(RECORDS_ROLES);
    const { id } = await params;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw new ApiError(404, "Report not found");
    return NextResponse.json(report);
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch report");
  }
}
