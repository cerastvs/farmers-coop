import prisma from "@/lib/client";
import { getUserId } from "@/lib/session";
import { NextRequest } from "next/server";
import { imgbbUpload } from "sdk-imagebb";
import { ApplicationSchema } from "@/lib/validators/registration";

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
  } catch (error) {
    throw new Error("Image upload failed");
  }
};
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    console.log(formData);

    const dataObj = {
      fullName: formData.get("fullName"),
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
      return Response.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const {
      fullName: fullname,
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

    const farmImgUrl = await uploadImage(proofOfFarm as File);
    const validIdImgUrl = await uploadImage(validId as File);

    const userId = await getUserId();
    await prisma.$transaction([
      prisma.application.create({
        data: {
          userId: userId,
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
      }),
      prisma.user.update({
        where: { id: userId },
        data: { name: fullname },
      }),
    ]);

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userId = await getUserId();

    const existingApplication = await prisma.application.findFirst({
      where: { userId },
    });

    if (!existingApplication) {
      return Response.json({ error: "Application not found" }, { status: 404 });
    }

    const dataObj = {
      fullName: formData.get("fullName"),
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
      dataObj.proofOfFarm = new File(["dummy"], "dummy.jpg", { type: "image/jpeg" });
    }
    if ((dataObj.validId as File)?.size === 0) {
      dataObj.validId = new File(["dummy"], "dummy.jpg", { type: "image/jpeg" });
    }

    const result = ApplicationSchema.safeParse(dataObj);

    if (!result.success) {
      return Response.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const {
      fullName: fullname,
      contact,
      address,
      age,
      gender,
      farmSize,
      cropType,
      yearsFarming,
    } = result.data;

    const proofOfFarm = formData.get("proofOfFarm") as File;
    const validId = formData.get("validId") as File;

    let farmImgUrl = existingApplication.proofOfFarmUrl;
    let validIdImgUrl = existingApplication.validIdUrl;

    if (proofOfFarm && proofOfFarm.size > 0) {
      farmImgUrl = await uploadImage(proofOfFarm);
    }

    if (validId && validId.size > 0) {
      validIdImgUrl = await uploadImage(validId);
    }

    await prisma.$transaction([
      prisma.application.update({
        where: { id: existingApplication.id },
        data: {
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
      }),
      prisma.user.update({
        where: { id: userId },
        data: { name: fullname },
      }),
    ]);

    return Response.json({ success: true });
  } catch (error) {
    console.error("PATCH error:", error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function GET() {
  const user = await getUserId();
  const application = await prisma.application.findFirst({
    where: { userId: user },
  });

  if (!application) {
    return Response.json(null, { status: 404 });
  }

  return Response.json(application);
}
