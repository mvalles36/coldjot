import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      <h1 className="text-4xl font-bold mb-8">
        Welcome to Email Template Manager
      </h1>

      {session ? (
        <div className="space-y-4">
          <Link
            href="/compose"
            className="block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 text-center"
          >
            Compose New Email
          </Link>
          <div className="flex space-x-4">
            <Link
              href="/contacts"
              className="bg-gray-100 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-200"
            >
              Manage Contacts
            </Link>
            <Link
              href="/templates"
              className="bg-gray-100 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-200"
            >
              Manage Templates
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-xl text-gray-600">
          Please sign in to start managing your email templates
        </p>
      )}
    </div>
  );
}
