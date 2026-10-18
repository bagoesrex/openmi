import { Elysia, t } from "elysia";
import { Database } from "bun:sqlite";
import { createAccountRepo, createLogRepo } from "../db/repository";
import { authPlugin } from "./auth";
import { checkUserState } from "../services/xiaomi/client";
import { logBroadcaster } from "../services/broadcaster";

export function createAccountsApi(db: Database) {
  const accountRepo = createAccountRepo(db);
  const logRepo = createLogRepo(db);

  return new Elysia()
    .use(authPlugin)
    .guard(
      {
        beforeHandle: async ({ verifyAuth }) => {
          await verifyAuth();
        },
      },
      (app) =>
        app
          .get("/api/accounts", () => {
            return accountRepo.getAll();
          })
          .get("/api/accounts/:id", ({ params: { id }, set }) => {
            const acc = accountRepo.getById(id);
            if (!acc) {
              set.status = 404;
              return { error: "Account not found" };
            }
            return acc;
          })
          .post(
            "/api/accounts",
            ({ body }) => {
              return accountRepo.create({
                label: body.label,
                region: body.region || "global",
                cUserId: body.cUserId,
                serviceToken: body.serviceToken,
                deviceId: body.deviceId || null,
                proxyUrl: body.proxyUrl || null,
                autoApplyEnabled: body.autoApplyEnabled !== undefined ? (body.autoApplyEnabled ? 1 : 0) : 1,
              });
            },
            {
              body: t.Object({
                label: t.String(),
                region: t.Optional(t.String()),
                cUserId: t.String(),
                serviceToken: t.String(),
                deviceId: t.Optional(t.Nullable(t.String())),
                proxyUrl: t.Optional(t.Nullable(t.String())),
                autoApplyEnabled: t.Optional(t.Boolean()),
              }),
            }
          )
          .put(
            "/api/accounts/:id",
            ({ params: { id }, body, set }) => {
              const updated = accountRepo.update(id, {
                label: body.label,
                region: body.region,
                cUserId: body.cUserId,
                serviceToken: body.serviceToken,
                deviceId: body.deviceId,
                proxyUrl: body.proxyUrl,
                autoApplyEnabled: body.autoApplyEnabled !== undefined ? (body.autoApplyEnabled ? 1 : 0) : undefined,
              });
              if (!updated) {
                set.status = 404;
                return { error: "Account not found" };
              }
              return updated;
            },
            {
              body: t.Object({
                label: t.Optional(t.String()),
                region: t.Optional(t.String()),
                cUserId: t.Optional(t.String()),
                serviceToken: t.Optional(t.String()),
                deviceId: t.Optional(t.Nullable(t.String())),
                proxyUrl: t.Optional(t.Nullable(t.String())),
                autoApplyEnabled: t.Optional(t.Boolean()),
              }),
            }
          )
          .delete("/api/accounts/:id", ({ params: { id }, set }) => {
            const deleted = accountRepo.delete(id);
            if (!deleted) {
              set.status = 404;
              return { error: "Account not found" };
            }
            return { success: true };
          })
          .post("/api/accounts/:id/test", async ({ params: { id }, set }) => {
            const acc = accountRepo.getById(id);
            if (!acc) {
              set.status = 404;
              return { error: "Account not found" };
            }

            try {
              const res = await checkUserState(acc);
              const isValid = res.code === 0;
              const buttonState = res.data?.button_state ?? res.data?.buttonState;
              const isPass = res.data?.is_pass ?? res.data?.isPass;

              accountRepo.update(acc.id, {
                sessionValid: isValid ? 1 : 0,
                lastButtonState: buttonState !== undefined ? buttonState : acc.lastButtonState,
              });

              const logEntry = {
                accountId: acc.id,
                timestamp: Date.now(),
                action: "CHECK_STATE",
                resultCode: res.code ?? 0,
                message: isValid
                  ? `Cookie valid. buttonState=${buttonState}, isPass=${isPass}`
                  : `Cookie test failed: code ${res.code} (${res.message || "Unknown error"})`,
                rawPayload: JSON.stringify(res),
                errorDetails: isValid ? null : `API returned code ${res.code}: ${res.message}`,
              };

              logRepo.insert(logEntry);
              logBroadcaster.broadcast({ ...logEntry, id: Date.now() });

              return {
                valid: isValid,
                code: res.code,
                buttonState,
                isPass,
                raw: res,
              };
            } catch (err: any) {
              const errorMsg = err?.message || String(err);
              accountRepo.update(acc.id, { sessionValid: 0 });

              const logEntry = {
                accountId: acc.id,
                timestamp: Date.now(),
                action: "CHECK_STATE_ERROR",
                resultCode: 500,
                message: `Connection failed: ${errorMsg}`,
                errorDetails: `Network error or proxy failure testing account ${acc.id}: ${err.stack || errorMsg}`,
              };

              logRepo.insert(logEntry);
              logBroadcaster.broadcast({ ...logEntry, id: Date.now() });

              set.status = 502;
              return { error: errorMsg };
            }
          })
    );
}
