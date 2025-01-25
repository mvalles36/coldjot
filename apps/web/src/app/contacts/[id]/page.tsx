import ContactPageClient from "./contact-page-client";

interface PageProps {
  params: { id: string };
}

export default function ContactPage({ params }: PageProps) {
  return <ContactPageClient contactId={params.id} />;
}
