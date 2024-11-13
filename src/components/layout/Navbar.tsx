"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold">Email Manager</span>
            </Link>

            {session && (
              <div className="ml-10 flex items-center space-x-4">
                <Link
                  href="/contacts"
                  className="text-gray-700 hover:text-gray-900"
                >
                  Contacts
                </Link>
                <Link
                  href="/templates"
                  className="text-gray-700 hover:text-gray-900"
                >
                  Templates
                </Link>
                <Link
                  href="/compose"
                  className="text-gray-700 hover:text-gray-900"
                >
                  Compose
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center">
            {loading ? (
              <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div>
            ) : session ? (
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">{session.user?.name}</span>
                <button
                  onClick={() => signOut()}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Sign In with Google
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
