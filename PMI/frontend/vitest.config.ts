import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	server: {
		fs: {
			allow: ["../..", "/home/lupca/projects/topvnsport", "/workspace"],
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		testTimeout: 10000,
		hookTimeout: 10000,
		fileParallelism: false,
		server: {
			deps: {
				inline: [/@voma/],
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@voma/ui-kit": path.resolve(__dirname, "./node_modules/@voma/ui-kit/src/index.ts"),
			"@voma/api-client": path.resolve(__dirname, "./node_modules/@voma/api-client/src/index.ts"),
			"react": path.resolve(__dirname, "./node_modules/react"),
			"react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
			"lucide-react": path.resolve(__dirname, "./node_modules/lucide-react"),
			"clsx": path.resolve(__dirname, "./node_modules/clsx"),
			"tailwind-merge": path.resolve(__dirname, "./node_modules/tailwind-merge"),
		},
	},
});
