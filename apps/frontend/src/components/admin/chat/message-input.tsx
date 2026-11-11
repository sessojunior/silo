import { useState, useRef } from "react";
import { toast } from "@silo/engine/format/toast";
import { Textarea } from "@/components/ui/textarea";
import EmojiPicker from "./emoji-picker";

interface MessageInputProps {
  onSendMessage: (message: string, attachments?: File[]) => Promise<void>;
  isSending: boolean;
  placeholder?: string;
  enableEmojiPicker?: boolean;
  enableAttachments?: boolean;
  autoFocus?: boolean;
}

export function MessageInput({
  onSendMessage,
  isSending,
  placeholder = "Digite sua mensagem...",
  enableEmojiPicker = true,
  enableAttachments = true,
  autoFocus = false,
}: MessageInputProps) {
  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSendingInternal, setIsSendingInternal] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isBusy = isSending || isSendingInternal;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files || []);
    event.target.value = "";
    if (incomingFiles.length === 0) return;

    const nextFiles = [...selectedFiles, ...incomingFiles];
    if (nextFiles.length > 5) {
      toast({ type: "error", title: "VocÃª pode anexar no mÃ¡ximo 5 arquivos." });
      return;
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]);
    const invalidFile = nextFiles.find(
      (file) => !allowedTypes.has(file.type) || file.size > 4 * 1024 * 1024,
    );
    if (invalidFile) {
      toast({
        type: "error",
        title: `Arquivo nÃ£o permitido ou maior que 4MB: ${invalidFile.name}`,
      });
      return;
    }

    setSelectedFiles(nextFiles);
  };

  // Enviar mensagem
  const handleSendMessage = async () => {
    if ((!messageText.trim() && selectedFiles.length === 0) || isBusy) return;

    const text = messageText.trim();
    const files = selectedFiles;
    // Limpa o textarea imediatamente, antes de aguardar a resposta
    setMessageText("");
    setSelectedFiles([]);
    setShowEmojiPicker(false);
    setIsSendingInternal(true);

    try {
      await onSendMessage(text, files);
    } catch (error) {
      console.error("❌ [COMPONENT_MESSAGE_INPUT] Erro ao enviar mensagem:", {
        error,
      });
    } finally {
      setIsSendingInternal(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Adicionar emoji
  const handleEmojiSelect = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative p-4 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center space-x-2">
        <div className="flex-1 relative">
          {enableAttachments && selectedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2" aria-label="Arquivos selecionados">
              {selectedFiles.map((file, index) => (
                <span
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  <span className="icon-[lucide--paperclip] size-3.5 shrink-0" aria-hidden="true" />
                  <span className="max-w-48 truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remover arquivo ${file.name}`}
                    onClick={() => setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                  >
                    <span className="icon-[lucide--x] size-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Textarea
            ref={inputRef}
            autoFocus={autoFocus}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className={`min-h-10 max-h-32 text-sm resize-none ${enableEmojiPicker ? "pr-12" : "pr-4"} rounded-lg border-zinc-300 dark:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200`}
            rows={1}
          />

          {/* Botões de ação */}
          <div className="absolute right-2 inset-y-0 flex items-center gap-1">
            {enableAttachments && (
              <>
                <input
                  type="file"
                  className="hidden"
                  aria-label="Anexar arquivo"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,.docx,.xlsx,.pptx"
                  multiple
                  disabled={isBusy}
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  aria-label="Selecionar arquivo"
                  disabled={isBusy}
                  onClick={(event) => {
                    const input = event.currentTarget.parentElement?.querySelector<HTMLInputElement>(
                      'input[type="file"]',
                    );
                    input?.click();
                  }}
                  className="h-8 w-8 p-0 flex items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  <span className="icon-[lucide--paperclip] h-4 w-4" aria-hidden="true" />
                </button>
              </>
            )}
            {enableEmojiPicker && (
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                aria-label="Abrir seletor de emojis"
                className={`h-8 w-8 p-0 flex items-center justify-center rounded-full transition-all duration-200 ${
                  showEmojiPicker
                    ? "bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200"
                    : "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:bg-zinc-100 dark:focus:bg-zinc-600 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <span className="icon-[mdi--emoticon-happy] h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={(!messageText.trim() && selectedFiles.length === 0) || isBusy}
              aria-label="Enviar mensagem"
              className="h-8 w-8 p-0 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 text-white rounded-full transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {isBusy ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <span className="icon-[mdi--send] h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Emoji Picker */}
      {enableEmojiPicker && showEmojiPicker && (
        <div className="absolute bottom-full right-4 mb-2 z-60">
          <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl w-80">
            <EmojiPicker
              isOpen={showEmojiPicker}
              onClose={() => setShowEmojiPicker(false)}
              onEmojiSelect={handleEmojiSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}
