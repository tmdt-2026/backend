import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, env } from 'prisma/config';

const rootEnvPath = [
	resolve(process.cwd(), '.env'),
	resolve(process.cwd(), '../../.env'),
	resolve(__dirname, '../../.env'),
	resolve(__dirname, '../../../.env'),
].find((path) => existsSync(path));

if (rootEnvPath) {
	loadEnv({ path: rootEnvPath });
}

export default defineConfig({
	schema: './prisma/schema.prisma',
	migrations: {
		path: './prisma/migrations',
	},
	datasource: {
		url: env('INVENTORY_DATABASE_URL'),
	},
});