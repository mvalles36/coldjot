import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Separator } from "@/components/ui/separator";
import CompanyList from "./CompanyList";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const companies = await prisma.company.findMany({
    where: { userId: session.user.id },
    include: {
      contacts: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
        <p className="text-muted-foreground">
          Manage your companies and their associated contacts.
        </p>
      </div>
      <Separator />
      <CompanyList initialCompanies={companies} />
    </div>
  );
}
