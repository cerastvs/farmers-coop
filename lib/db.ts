import prisma from "./client";

export async function checkIfUserHasApplication(userId: string) {
  const application = await prisma.application.findFirst({
    where: { userId },
  });

  if (!application) return false;

  return true;
}
