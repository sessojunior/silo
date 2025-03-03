// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxtjs/google-fonts",
    "@nuxt/icon",
    "@nuxt/image",
  ],
  plugins: ["~/plugins/preline.client.ts", "~/plugins/apexcharts.client.ts"],
  tailwindcss: {
    cssPath: ["~/assets/css/tailwind.css", { injectPosition: "last" }],
    config: {},
    viewer: true,
    exposeConfig: false,
  },
  googleFonts: {
    display: "auto",
    subsets: "latin",
    preload: true,
    outputDir: "assets",
    fontsDir: "assets/fonts",
    download: true,
    overwriting: false,
    families: {
      Inter: [200, 300, 400, 500, 600, 700, 800],
    },
  },
  image: {
    dir: "assets/images",
    format: ["webp"],
  },
});
