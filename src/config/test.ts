export const TEST_MODE = process.env.TEST_MODE === "true";

export const TEST_CONTACTS = [
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

// Multiple test recipient emails
export const TEST_RECIPIENT_EMAILS = [
  "zee.khan34@gmail.com",
  "mr.xee.khan@gmail.com",
  "blackapple34@gmail.com",
  // Add more emails as needed
];

// Function to get a random demo recipient
export const getRandomTestRecipient = () => {
  const index = Math.floor(Math.random() * TEST_RECIPIENT_EMAILS.length);
  return TEST_RECIPIENT_EMAILS[index];
};
