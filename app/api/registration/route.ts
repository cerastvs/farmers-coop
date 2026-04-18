import prisma from "@/lib/client";
import { getUserId } from "@/lib/session";
import { NextRequest } from "next/server";
import { imgbbUpload } from "sdk-imagebb";

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

    const fullname = formData.get("fullName") as string;
    const contact = formData.get("contact") as string;
    const address = formData.get("address") as string;
    const age = Number(formData.get("age"));
    const gender = formData.get("gender") as string;
    const farmSize = Number(formData.get("farmSize"));
    const cropType = formData.get("cropType") as string;
    const yearsFarming = Number(formData.get("yearsFarming"));

    const proofOfFarm = formData.get("proofOfFarm") as File;
    const validId = formData.get("validId") as File;

    const farmImgUrl = await uploadImage(proofOfFarm);
    const validIdImgUrl = await uploadImage(validId);

    const userId = await getUserId();
    await prisma.application.create({
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
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
