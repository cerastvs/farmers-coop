import { ApplicationSchema } from "@/lib/validators/registration";
import { refreshSession } from "./server-actions";

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

  const result = ApplicationSchema.safeParse(formValues);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};

    result.error.issues.forEach((err) => {
      const field = err.path[0] as string;
      fieldErrors[field] = err.message;
    });

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

    await refreshSession();

    alert(isUpdate ? "Profile updated!" : "Application submitted!");
    if (!isUpdate) e.target.reset();
  } catch (err) {
    alert("Something went wrong");
  } finally {
    setLoading(false);
  }
}
