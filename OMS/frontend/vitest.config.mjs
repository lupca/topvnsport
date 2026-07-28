import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [react()],
	server: {
		fs: {
			allow: ["../..", "/home/lupca/projects/topvnsport", "/workspace"],
		},
		deps: {
			inline: [/@topvnsport/],
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.{test,spec}.{ts,tsx}", "__tests__/**/*.{test,spec}.{ts,tsx}"],
		testTimeout: 10000,
		hookTimeout: 10000,
		fileParallelism: false,
		server: {
			deps: {
				inline: [/@topvnsport/],
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@topvnsport/ui-kit": path.resolve(__dirname, "../../packages/ui-kit/dist/index.js"),
			"@topvnsport/api-client": path.resolve(__dirname, "../../packages/api-client/dist/index.js"),
			"react": path.resolve(__dirname, "./node_modules/react"),
			"react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
			"lucide-react": path.resolve(__dirname, "./node_modules/lucide-react"),
			"clsx": path.resolve(__dirname, "./node_modules/clsx"),
			"tailwind-merge": path.resolve(__dirname, "./node_modules/tailwind-merge"),
		},
	},
});
