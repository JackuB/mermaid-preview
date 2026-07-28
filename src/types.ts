export type PrivateDataObject = {
  user_id: string;
  channel: string;
  response_url: string;
  invocation_id: number;
  edit?: {
    // The reply message that holds the diagram source, in the thread.
    messageTs: string;
    // The original file-share message that holds the rendered image.
    parentTs: string;
  };
};
