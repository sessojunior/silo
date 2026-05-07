/** @type {import("tailwindcss").Config} */
const sharedTailwindConfig = {
  content: [
    "src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [],
};

export default sharedTailwindConfig;
