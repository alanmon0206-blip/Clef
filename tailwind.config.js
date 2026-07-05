/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brume: "#EEF1F0",   // fond principal, gris-vert très clair
        ardoise: "#16232D", // encre / texte principal, bleu-nuit
        laiton: "#B08A3E",  // accent doré, CTA, éléments de confiance
        sauge: "#3E7A5D",   // succès, validation, statut "vérifié"
        brique: "#C1503A",  // alerte, refus, statut "hors budget"
        ligne: "#D8DDD9",   // bordures / dividers
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
