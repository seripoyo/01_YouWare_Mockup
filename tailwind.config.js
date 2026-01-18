/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // English font (New Atten Round) with Japanese fallback
        sans: ['"New Atten Round"', '"GenJyuuGothicX"', 'system-ui', '-apple-system', 'sans-serif'],
        // Japanese font (GenJyuuGothicX) as primary
        jp: ['"GenJyuuGothicX"', '"New Atten Round"', 'system-ui', 'sans-serif'],
        // English-only font
        en: ['"New Atten Round"', 'system-ui', 'sans-serif'],
      },
      screens: {
        // スマートフォン: 590px
        'smartphone': '590px',
        // タブレット: 960px
        'tablet': '960px',
      },
    },
  },
  plugins: [],
}
