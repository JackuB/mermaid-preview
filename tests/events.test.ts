import { beforeEach, describe, expect, it, vi } from "vitest";

const rendering = vi.hoisted(() => ({
  attachRenderedImage: vi.fn(),
  buildRenderErrorText: vi.fn(() => "render failed"),
  renderMermaidToPng: vi.fn(async () => ({
    png: Buffer.from("png"),
    mermaidGenerationTimeMs: 10,
  })),
  uploadRenderedImageToThread: vi.fn(),
}));

vi.mock("../src/rendering", () => rendering);

import initializeMessageListeners from "../src/events";

describe("message listener", () => {
  let listener: (args: any) => Promise<void>;
  let client: {
    chat: {
      postMessage: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const app = {
      message: vi.fn((registeredListener) => {
        listener = registeredListener;
      }),
    };
    client = {
      chat: {
        postMessage: vi.fn(async () => ({ ts: "preview-ts" })),
        update: vi.fn(),
      },
    };

    initializeMessageListeners(app as any);
  });

  it("renders detected Mermaid as an image-only thread reply", async () => {
    await listener({
      message: {
        type: "message",
        subtype: undefined,
        channel: "C123",
        user: "U123",
        ts: "source-ts",
        text: "```mermaid\nflowchart LR\nA --> B\n```",
      },
      client,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(rendering.renderMermaidToPng).toHaveBeenCalledWith(
      "flowchart LR\nA --> B",
    );
    expect(rendering.uploadRenderedImageToThread).toHaveBeenCalledWith(
      client,
      "C123",
      "source-ts",
      Buffer.from("png"),
    );
    expect(rendering.attachRenderedImage).not.toHaveBeenCalled();
  });

  it("replies at the root of an existing thread", async () => {
    await listener({
      message: {
        type: "message",
        subtype: undefined,
        channel: "C123",
        user: "U123",
        ts: "reply-ts",
        thread_ts: "root-ts",
        text: "```\nflowchart LR\nA --> B\n```",
      },
      client,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(rendering.uploadRenderedImageToThread).toHaveBeenCalledWith(
      client,
      "C123",
      "root-ts",
      Buffer.from("png"),
    );
  });

  it("renders Mermaid sent by another app", async () => {
    await listener({
      message: {
        type: "message",
        subtype: "bot_message",
        bot_id: "B123",
        channel: "C123",
        ts: "bot-ts",
        text: "```mermaid\nflowchart LR\nA --> B\n```",
      },
      client,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(rendering.renderMermaidToPng).toHaveBeenCalledWith(
      "flowchart LR\nA --> B",
    );
    expect(rendering.uploadRenderedImageToThread).toHaveBeenCalledWith(
      client,
      "C123",
      "bot-ts",
      Buffer.from("png"),
    );
  });
});
