import { auth } from "@/auth";
import { Separator } from "@/components/ui/separator";
import ApolloSearchComponent from "./ApolloSearchComponent";

export default async function ApolloPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apollo Search</h1>
        <p className="text-muted-foreground">
          Search for decision makers by company domain and enrich their contact
          information.
        </p>
      </div>
      <Separator />
      <ApolloSearchComponent userId={session.user.id} />
    </div>
  );
}
