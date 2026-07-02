import { describe, expect, test } from "vitest";
import { popupService } from "./popupService";

describe("popupService", () => {
  test("resolves confirm with selected value", async () => {
    const seenKinds: Array<string | null> = [];
    const unsubscribe = popupService.subscribe((request) => {
      seenKinds.push(request?.kind ?? null);
    });

    const confirmPromise = popupService.confirm("Ban co chac chan khong?");
    popupService.resolveCurrent(true);

    await expect(confirmPromise).resolves.toBe(true);
    expect(seenKinds).toContain("confirm");

    unsubscribe();
  });

  test("handles queued dialogs in order", async () => {
    const first = popupService.alert("Thông báo thu nhat");
    const second = popupService.confirm("Thông báo thu hai");

    popupService.resolveCurrent(undefined);
    popupService.resolveCurrent(false);

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBe(false);
  });
});
