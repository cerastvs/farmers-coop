import { ApplicationSchema } from "@/lib/validators/registration";

export async function handleSubmit(
  e: any,
  setLoading: (args: boolean) => void,
  setErrors: (args: Record<string, string>) => void,
  isUpdate: boolean = false,
) {
  e.preventDefault();
  setLoading(true);
  setErrors({});
  const formData = new FormData(e.target);
  const formValues = Object.fromEntries(formData.entries());

  // For updates, we might want to make images optional if already present.
  // But let's stick to the schema first and see if it fails.
  const result = ApplicationSchema.safeParse(formValues);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};

    result.error.issues.forEach((err) => {
      const field = err.path[0] as string;
      fieldErrors[field] = err.message;
    });

    // If it's an update, some fields like validId and proofOfFarm might be optional if already present.
    // Let's check if the errors are just about these fields and if it's an update.
    if (isUpdate) {
      if (fieldErrors.validId && (formData.get("validId") as File).size === 0) {
        delete fieldErrors.validId;
      }
      if (
        fieldErrors.proofOfFarm &&
        (formData.get("proofOfFarm") as File).size === 0
      ) {
        delete fieldErrors.proofOfFarm;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }
  }

  try {
    const res = await fetch("/api/registration", {
      method: isUpdate ? "PATCH" : "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert(isUpdate ? "Profile updated!" : "Application submitted!");
    if (!isUpdate) e.target.reset();
  } catch (err) {
    alert("Something went wrong");
  } finally {
    setLoading(false);
  }
}
