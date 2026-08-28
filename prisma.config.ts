import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? `postgresql://vsphere_user:${process.env.POSTGRES_PASSWORD ?? "placeholder"}@postgres:5432/vsphere_panel`,
  },
});
