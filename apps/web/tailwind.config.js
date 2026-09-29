import preset from "@torrentx/ui/tailwind.preset";

export default {
  presets: [preset],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};
