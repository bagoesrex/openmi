import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";

export const authPlugin = new Elysia({ name: "auth-plugin" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "openmi-default-secret-change-me",
      exp: "7d",
    })
  )
  .derive({ as: "scoped" }, async ({ jwt, headers, query, set }) => {
    return {
      async verifyAuth() {
        const authHeader = headers["authorization"];
        let token = "";

        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.slice(7).trim();
        } else if (query && (query as any).token) {
          // Support ?token= query param for SSE connections
          token = (query as any).token;
        }

        if (!token) {
          set.status = 401;
          throw new Error("Missing authentication token");
        }

        const payload = await jwt.verify(token);
        if (!payload) {
          set.status = 401;
          throw new Error("Invalid or expired authentication token");
        }

        return payload;
      },
    };
  })
  .post(
    "/api/auth/login",
    async ({ body, jwt, set }) => {
      const masterPassword = process.env.MASTER_PASSWORD || "admin";
      if (!body.password || body.password !== masterPassword) {
        set.status = 401;
        return { error: "Invalid master password" };
      }

      const token = await jwt.sign({
        sub: "openmi-admin",
        iat: Math.floor(Date.now() / 1000),
      });

      return {
        success: true,
        token,
        expiresIn: "7d",
      };
    },
    {
      body: t.Object({
        password: t.String(),
      }),
    }
  );
