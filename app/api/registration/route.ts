import { Prisma, Role } from "@/app/generated/prisma";
import { NextRequest } from "next/server";
import { imgbbUpload } from "sdk-imagebb";

import {
  notifyUser,
  writeActivityLog,
  writeAudit,
} from "@/lib/activity";
import { apiErrorResponse, ApiError, requireUser } from "@/lib/api";
import prisma from "@/lib/client";
import { MEMBERSHIP_ROLES } from "@/lib/permissions";
import { ApplicationSchema } from "@/lib/validators/registration";

function composeFullName(
  firstName: string,
  middleName: string,
  lastName: string,
  extensionName: string,
): string {
  const parts = [firstName, middleName, lastName, extensionName].filter(Boolean);
  return parts.join(" ");
}

const uploadImage = async (file: File) => {
  try {
    const response = await imgbbUpload({
      key: process.env.IMGBB_API!,
      image: file,
    });

    console.log("Image URL:", response.data.url);
    console.log("Display URL:", response.data.display_url);
    console.log("Delete URL:", response.data.delete_url);

    return response.data.display_url;
  } catch {
    throw new Error("Image upload failed");
  }
};
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser([Role.APPLICANT]);
    const formData = await req.formData();

    const dataObj = {
      firstName: formData.get("firstName"),
      middleName: formData.get("middleName"),
      lastName: formData.get("lastName"),
      extensionName: formData.get("extensionName"),
      contact: formData.get("contact"),
      address: formData.get("address"),
      age: formData.get("age"),
      gender: formData.get("gender"),
      farmSize: formData.get("farmSize"),
      cropType: formData.get("cropType"),
      yearsFarming: formData.get("yearsFarming"),
      proofOfFarm: formData.get("proofOfFarm"),
      validId: formData.get("validId"),
    };

    const result = ApplicationSchema.safeParse(dataObj);

    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const existingApplication = await prisma.application.findFirst({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (existingApplication) {
      throw new ApiError(409, "A membership application already exists");
    }

    const {
      firstName,
      middleName,
      lastName,
      extensionName,
      contact,
      address,
      age,
      gender,
      farmSize,
      cropType,
      yearsFarming,
      proofOfFarm,
      validId,
    } = result.data;

    const fullname = composeFullName(firstName, middleName, lastName, extensionName);

    const farmImgUrl = await uploadImage(proofOfFarm as File);
    const validIdImgUrl = await uploadImage(validId as File);

    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          userId: actor.userId,
          firstName,
          middleName: middleName || null,
          lastName,
          extensionName: extensionName || null,
          fullName: fullname,
          contact,
          address,
          age,
          gender,
          farmSize,
          cropType,
          yearsFarming,
          proofOfFarmUrl: farmImgUrl!,
          validIdUrl: validIdImgUrl!,
        },
      });
      await tx.user.update({
        where: { id: actor.userId },
        data: { name: fullname },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "MEMBERSHIP_APPLICATION_SUBMITTED",
        entity: "Application",
        entityId: created.id,
      });
      await notifyUser(tx, {
        userId: actor.userId,
        title: "Application submitted",
        message:
          "Your membership application was received and is awaiting review.",
      });

      const reviewers = await tx.user.findMany({
        where: {
          role: { in: [...MEMBERSHIP_ROLES] },
          active: true,
        },
        select: { id: true },
      });
      await Promise.all(
        reviewers.map((reviewer) =>
          notifyUser(tx, {
            userId: reviewer.id,
            title: "New membership application",
            message: `${fullname}'s membership application is ready for review.`,
          }),
        ),
      );

      return created;
    });

    await writeActivityLog({
      userId: actor.userId,
      action: "MEMBERSHIP_APPLICATION_SUBMITTED",
      success: true,
      info: `Membership application ${application.id} submitted`,
    });

    return Response.json(
      { success: true, applicationId: application.id },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return apiErrorResponse(
        new ApiError(409, "A membership application already exists"),
        "Failed to submit membership application",
      );
    }
    return apiErrorResponse(
      error,
      "Failed to submit membership application",
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireUser([Role.APPLICANT, Role.MEMBER]);
    const formData = await req.formData();

    const existingApplication = await prisma.application.findFirst({
      where: { userId: actor.userId },
    });

    if (!existingApplication) {
      throw new ApiError(404, "Application not found");
    }

    const dataObj = {
      firstName: formData.get("firstName"),
      middleName: formData.get("middleName"),
      lastName: formData.get("lastName"),
      extensionName: formData.get("extensionName"),
      contact: formData.get("contact"),
      address: formData.get("address"),
      age: formData.get("age"),
      gender: formData.get("gender"),
      farmSize: formData.get("farmSize"),
      cropType: formData.get("cropType"),
      yearsFarming: formData.get("yearsFarming"),
      proofOfFarm: formData.get("proofOfFarm"),
      validId: formData.get("validId"),
    };

    if ((dataObj.proofOfFarm as File)?.size === 0) {
      dataObj.proofOfFarm = new File(["dummy"], "dummy.jpg", {
        type: "image/jpeg",
      });
    }
    if ((dataObj.validId as File)?.size === 0) {
      dataObj.validId = new File(["dummy"], "dummy.jpg", {
        type: "image/jpeg",
      });
    }

    const result = ApplicationSchema.safeParse(dataObj);

    if (!result.success) {
      throw new ApiError(400, result.error.issues[0].message);
    }

    const {
      firstName,
      middleName,
      lastName,
      extensionName,
      contact,
      address,
      age,
      gender,
      farmSize,
      cropType,
      yearsFarming,
    } = result.data;

    const fullname = composeFullName(firstName, middleName, lastName, extensionName);

    const proofOfFarm = formData.get("proofOfFarm") as File;
    const validId = formData.get("validId") as File;

    let farmImgUrl = existingApplication.proofOfFarmUrl;
    let validIdImgUrl = existingApplication.validIdUrl;

    if (proofOfFarm && proofOfFarm.size > 0) {
      try {
        farmImgUrl = await uploadImage(proofOfFarm);
      } catch {
        throw new ApiError(400, "Failed to upload proof of farming image");
      }
    }

    if (validId && validId.size > 0) {
      try {
        validIdImgUrl = await uploadImage(validId);
      } catch {
        throw new ApiError(400, "Failed to upload valid ID image");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: existingApplication.id },
        data: {
          firstName,
          middleName: middleName || null,
          lastName,
          extensionName: extensionName || null,
          fullName: fullname,
          contact,
          address,
          age,
          gender,
          farmSize,
          cropType,
          yearsFarming,
          proofOfFarmUrl: farmImgUrl,
          validIdUrl: validIdImgUrl,
        },
      });
      await tx.user.update({
        where: { id: actor.userId },
        data: { name: fullname },
      });
      await writeAudit(tx, {
        userId: actor.userId,
        action: "MEMBERSHIP_PROFILE_UPDATED",
        entity: "Application",
        entityId: existingApplication.id,
      });
      await notifyUser(tx, {
        userId: actor.userId,
        title: "Membership profile updated",
        message: "Your membership profile changes were saved.",
      });
    });

    return Response.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update membership profile");
  }
}

export async function GET() {
  try {
    const actor = await requireUser([Role.APPLICANT, Role.MEMBER]);
    const application = await prisma.application.findFirst({
      where: { userId: actor.userId },
    });

    if (!application) {
      return Response.json(null, { status: 404 });
    }

    return Response.json(application);
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch membership application");
  }
}
