import { defaultMermaid, mermaidPreviewHintText } from "./mermaid";
import { PrivateDataObject } from "./types";

export function buildMermaidModalView(
  privateMetadata: PrivateDataObject,
  options?: { title?: string; initialValue?: string }
) {
  return {
    type: "modal" as const,
    callback_id: "mermaid-modal-submitted",
    private_metadata: JSON.stringify(privateMetadata),
    title: {
      type: "plain_text" as const,
      text: options?.title ?? "Create a Mermaid diagram",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: mermaidPreviewHintText,
        },
      },
      {
        type: "input",
        block_id: "mermaid-form",
        element: {
          type: "plain_text_input",
          multiline: true,
          focus_on_load: true,
          action_id: "mermaid-input",
          placeholder: {
            type: "plain_text",
            text: defaultMermaid,
          },
          ...(options?.initialValue
            ? { initial_value: options.initialValue }
            : {}),
        },
        label: {
          type: "plain_text",
          text: "Mermaid diagram",
        },
      },
    ],
    submit: {
      type: "plain_text" as const,
      text: "Submit",
    },
  };
}
