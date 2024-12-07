const QUEUE_API_URL =
  process.env.NEXT_PUBLIC_QUEUE_API_URL || "http://localhost:3001";

export async function addSequenceToQueue(sequenceId: string, userId: string) {
  const response = await fetch(
    `${QUEUE_API_URL}/api/sequences/${sequenceId}/process`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to add sequence to queue");
  }

  return response.json();
}

export async function addEmailToQueue(data: {
  sequenceId: string;
  stepId: string;
  contactId: string;
  userId: string;
}) {
  const response = await fetch(`${QUEUE_API_URL}/api/emails/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to add email to queue");
  }

  return response.json();
}

export async function getJobStatus(jobId: string, type: "sequence" | "email") {
  const response = await fetch(
    `${QUEUE_API_URL}/api/jobs/${jobId}?type=${type}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get job status");
  }

  return response.json();
}
