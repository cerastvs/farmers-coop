import { ApplicationSchema } from "@/lib/validators/registration";

export async function handleSubmit(
  e: any,
  setLoading: (args: boolean) => void,
  setErrors: (args: Record<string, string>) => void,
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

    setErrors(fieldErrors);
    setLoading(false);
    return;
  }

  try {
    const res = await fetch("/api/registration", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert("Application submitted!");
    e.target.reset();
  } catch (err) {
    alert("Something went wrong");
  } finally {
    setLoading(false);
  }
}
