export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const DEMO_CONTACTS = [
  {
    email: "zee.khan34@gmail.com",
    firstName: "Zee",
    lastName: "Khan",
    name: "Zee Khan",
  },
  {
    email: "mr.xee.khan@gmail.com",
    firstName: "Mr",
    lastName: "Xee",
    name: "Mr Xee",
  },
  {
    email: "blackapple34@gmail.com",
    firstName: "Black",
    lastName: "Apple",
    name: "Black Apple",
  },
];

// Multiple demo recipient emails
export const DEMO_RECIPIENT_EMAILS = [
  "zee.khan34@gmail.com",
  "mr.xee.khan@gmail.com",
  "blackapple34@gmail.com",
  // Add more emails as needed
];

// Function to get a random demo recipient
export const getRandomDemoRecipient = () => {
  const index = Math.floor(Math.random() * DEMO_RECIPIENT_EMAILS.length);
  return DEMO_RECIPIENT_EMAILS[index];
};
