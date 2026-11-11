import { forwardMultipartRequest, MAX_CHAT_REQUEST_BYTES } from "@/lib/upload-proxy";

export async function POST(request: Request) {
  return forwardMultipartRequest(request, "/api/chat/messages", MAX_CHAT_REQUEST_BYTES);
}
