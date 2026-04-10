import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOfficeAccess } from "@/lib/office-auth";

export default async function OfficeIndexPage() {
  const access = await getOfficeAccess(await cookies());
  if (!access) {
    redirect("/office/login");
  }

  redirect(access.redirectPath);
}
