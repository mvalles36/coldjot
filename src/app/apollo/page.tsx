import { auth } from "@/auth";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/PageHeader";
import ApolloSearch from "@/components/search/apollo/apollo-search-component";

export default async function ApolloPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className="max-w-7xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Apollo Search"
          description="Search for decision makers by company domain and enrich their contact information."
        />
        <Separator />
      </div>
      <ApolloSearch userId={session.user.id} />
    </div>
  );
}
