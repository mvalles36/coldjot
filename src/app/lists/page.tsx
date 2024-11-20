import { Metadata } from "next";
import EmailListsView from "./EmailListsView";

export const metadata: Metadata = {
  title: "Email Lists",
  description: "Manage your email lists and segments",
};

export default function ListsPage() {
  return <EmailListsView />;
}
