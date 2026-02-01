export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**"]
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    }
  }
];
