import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChatPage from "./page";

const { replace, getSearchParams } = vi.hoisted(() => ({
  replace: vi.fn(),
  getSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => getSearchParams(),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    replace.mockReset();
    getSearchParams.mockReset();
  });

  it.each([
    ["groupId", "group-1", "/admin/chat/groups/group-1"],
    ["userId", "user-1", "/admin/chat/users/user-1"],
    [null, null, "/admin/chat/groups"],
  ])("redirects legacy %s chat URLs", async (key, value, destination) => {
    const params = new URLSearchParams();
    if (key && value) params.set(key, value);
    getSearchParams.mockReturnValue(params);

    render(<ChatPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
  });
});
